import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hash } from "bcryptjs";

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
    const maxTeamSize =
      organization?.subscriptionTier === "ENTERPRISE"
        ? 999
        : organization?.subscriptionTier === "PRO"
        ? 10
        : 3;

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
    console.error("Error fetching team:", error);
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
    const { email, name, role = "SPECIALIST" } = body;

    if (!email || !name) {
      return NextResponse.json(
        { error: "Email and name are required" },
        { status: 400 }
      );
    }

    // Validate role
    if (!Object.values(ROLES).includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

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

    const maxTeamSize =
      organization.subscriptionTier === "ENTERPRISE"
        ? 999
        : organization.subscriptionTier === "PRO"
        ? 10
        : 3;

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

    // TODO: Send invitation email with temporary password

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
    console.error("Error creating team member:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create team member" },
      { status: 500 }
    );
  }
}
