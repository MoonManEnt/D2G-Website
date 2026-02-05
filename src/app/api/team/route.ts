import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hash } from "bcryptjs";
import { teamMemberSchema } from "@/lib/api-validation-schemas";
import { sendVerificationEmail } from "@/lib/email-verification";
import { sendEmail, welcomeEmail } from "@/lib/email";
import { createLogger } from "@/lib/logger";
import { SUBSCRIPTION_LIMITS } from "@/lib/api-middleware";
import { SubscriptionTier } from "@/types";
const log = createLogger("team-api");

export const dynamic = "force-dynamic";

// Role definitions
const ROLES = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  SPECIALIST: "SPECIALIST",
  VIEWER: "VIEWER",
} as const;

const ROLE_PERMISSIONS = {
  OWNER: ["*"], // All permissions
  ADMIN: [
    "team:read",
    "team:write",
    "clients:*",
    "disputes:*",
    "reports:*",
    "documents:*",
    "analytics:read",
  ],
  SPECIALIST: [
    "clients:read",
    "clients:write",
    "disputes:*",
    "reports:*",
    "documents:read",
    "documents:write",
  ],
  VIEWER: ["clients:read", "disputes:read", "reports:read", "analytics:read"],
};

// GET /api/team - Get team members
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const where: Record<string, unknown> = {
      organizationId: session.user.organizationId,
    };

    if (!includeInactive) {
      where.isActive = true;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        profilePicture: true,
        _count: {
          select: {
            uploadedReports: true,
            createdDocuments: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });

    // Get organization details
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        id: true,
        name: true,
        subscriptionTier: true,
      },
    });

    // Calculate max team size based on subscription
    const tier = organization?.subscriptionTier || "FREE";
    const tierLimits = SUBSCRIPTION_LIMITS[tier as SubscriptionTier] || SUBSCRIPTION_LIMITS[SubscriptionTier.FREE];
    const maxTeamSize = tierLimits.teamSeats.total === -1 ? 999 : tierLimits.teamSeats.total;

    return NextResponse.json({
      team: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
        profilePicture: u.profilePicture,
        stats: {
          reports: u._count.uploadedReports,
          documents: u._count.createdDocuments,
        },
        permissions: ROLE_PERMISSIONS[u.role as keyof typeof ROLE_PERMISSIONS] || [],
      })),
      roles: Object.entries(ROLES).map(([key, value]) => ({
        key,
        value,
        permissions: ROLE_PERMISSIONS[value as keyof typeof ROLE_PERMISSIONS],
      })),
      limits: {
        current: users.filter((u) => u.isActive).length,
        max: maxTeamSize,
      },
    });
  } catch (error) {
    log.error({ err: error }, "Error fetching team");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch team" },
      { status: 500 }
    );
  }
}

// POST /api/team - Invite a new team member
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to invite
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!currentUser || !["OWNER", "ADMIN"].includes(currentUser.role)) {
      return NextResponse.json(
        { error: "You don't have permission to invite team members" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = teamMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { email, name, role } = parsed.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      );
    }

    // Check team size limits
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      include: {
        users: {
          where: { isActive: true },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const postTier = organization.subscriptionTier || "FREE";
    const postTierLimits = SUBSCRIPTION_LIMITS[postTier as SubscriptionTier] || SUBSCRIPTION_LIMITS[SubscriptionTier.FREE];
    const maxTeamSize = postTierLimits.teamSeats.total === -1 ? 999 : postTierLimits.teamSeats.total;

    if (organization.users.length >= maxTeamSize) {
      return NextResponse.json(
        { error: `Team size limit reached (${maxTeamSize} members)` },
        { status: 400 }
      );
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-12);
    const hashedPassword = await hash(tempPassword, 12);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        role,
        passwordHash: hashedPassword,
        organizationId: session.user.organizationId,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    // Send invitation email with temporary password
    try {
      const template = welcomeEmail(
        newUser.name || newUser.email,
        organization.name
      );
      template.subject = `You have been invited to join ${organization.name}`;
      template.text += `\n\nYour temporary password is: ${tempPassword}\nPlease change it after your first login.`;
      template.html = template.html.replace(
        "</body>",
        `<div style="text-align:center;padding:0 40px 20px;"><p style="font-size:14px;color:#3f3f46;">Your temporary password is: <strong>${tempPassword}</strong></p><p style="font-size:13px;color:#71717a;">Please change your password after your first login.</p></div></body>`
      );

      await sendEmail({
        to: newUser.email,
        template,
        tags: [{ name: "category", value: "team-invite" }],
      });
    } catch (emailError) {
      log.error({ err: emailError }, "Failed to send invitation email");
      // Email failure should not prevent user creation
    }

    // Send email verification
    const verificationResult = await sendVerificationEmail(
      newUser.id,
      newUser.email,
      newUser.name,
      session.user.organizationId
    );

    if (!verificationResult.success) {
      log.error({ err: verificationResult.error }, "Failed to send verification email");
    }

    return NextResponse.json(
      {
        success: true,
        user: newUser,
        temporaryPassword: tempPassword, // In production, only send via email
        message: "User created. Please share the temporary password securely.",
      },
      { status: 201 }
    );
  } catch (error) {
    log.error({ err: error }, "Error creating team member");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create team member" },
      { status: 500 }
    );
  }
}
