import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { sendPortalInviteEmail } from "@/lib/email";
import { createLogger } from "@/lib/logger";
const log = createLogger("client-portal-api");

export const dynamic = "force-dynamic";

// GET /api/clients/[id]/portal - Get client portal access status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientId = params.id;

    // Verify client belongs to organization
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
      },
      include: {
        portalAccess: {
          select: {
            id: true,
            email: true,
            isActive: true,
            lastLoginAt: true,
            invitedAt: true,
            acceptedAt: true,
          },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json({
      hasPortalAccess: !!client.portalAccess,
      portalAccess: client.portalAccess,
    });
  } catch (error) {
    log.error({ err: error }, "Failed to get portal access");
    return NextResponse.json(
      { error: "Failed to get portal access" },
      { status: 500 }
    );
  }
}

// POST /api/clients/[id]/portal - Invite client to portal
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientId = params.id;
    const body = await request.json();
    const email = body.email?.toLowerCase();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Verify client belongs to organization
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
      },
      include: {
        organization: {
          select: {
            name: true,
            settings: true,
          },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Check if email is already used
    const existingAccess = await prisma.clientPortalAccess.findUnique({
      where: { email },
    });

    if (existingAccess) {
      return NextResponse.json(
        { error: "Email already has portal access" },
        { status: 400 }
      );
    }

    // Check if client already has portal access
    const existingClientAccess = await prisma.clientPortalAccess.findUnique({
      where: { clientId },
    });

    if (existingClientAccess) {
      return NextResponse.json(
        { error: "Client already has portal access" },
        { status: 400 }
      );
    }

    // Create portal access with temporary password hash
    const inviteToken = uuidv4();
    const tempPasswordHash = await bcrypt.hash(uuidv4(), 12); // Placeholder

    const portalAccess = await prisma.clientPortalAccess.create({
      data: {
        id: inviteToken, // Use as invite token
        clientId,
        email,
        passwordHash: tempPasswordHash,
        isActive: false, // Not active until password is set
      },
    });

    // Send invite email
    try {
      await sendPortalInviteEmail(
        email,
        `${client.firstName} ${client.lastName}`,
        client.organization.name,
        inviteToken,
        session.user.organizationId
      );
    } catch (emailError) {
      log.error({ err: emailError }, "Failed to send invite email");
      // Don't fail the request, portal access is still created
    }

    // Log event
    await prisma.eventLog.create({
      data: {
        eventType: "CLIENT_PORTAL_INVITE",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "CLIENT",
        targetId: clientId,
        eventData: JSON.stringify({ email }),
        organizationId: session.user.organizationId,
      },
    });

    // Generate invite URL for development purposes
    const inviteUrl = `${process.env.NEXTAUTH_URL || ''}/portal/accept-invite?token=${inviteToken}`;

    return NextResponse.json({
      success: true,
      portalAccess: {
        id: portalAccess.id,
        email: portalAccess.email,
        invitedAt: portalAccess.invitedAt,
      },
      ...(process.env.NODE_ENV === 'development' && { inviteUrl }),
    });
  } catch (error) {
    log.error({ err: error }, "Failed to create portal access");
    return NextResponse.json(
      { error: "Failed to invite client to portal" },
      { status: 500 }
    );
  }
}

// DELETE /api/clients/[id]/portal - Revoke client portal access
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientId = params.id;

    // Verify client belongs to organization
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
      },
      include: {
        portalAccess: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (!client.portalAccess) {
      return NextResponse.json(
        { error: "Client has no portal access" },
        { status: 400 }
      );
    }

    // Delete portal access
    await prisma.clientPortalAccess.delete({
      where: { clientId },
    });

    // Log event
    await prisma.eventLog.create({
      data: {
        eventType: "CLIENT_PORTAL_REVOKED",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "CLIENT",
        targetId: clientId,
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "Failed to revoke portal access");
    return NextResponse.json(
      { error: "Failed to revoke portal access" },
      { status: 500 }
    );
  }
}

// PATCH /api/clients/[id]/portal - Toggle portal access active status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientId = params.id;
    const body = await request.json();
    const { isActive } = body;

    if (typeof isActive !== "boolean") {
      return NextResponse.json(
        { error: "isActive must be a boolean" },
        { status: 400 }
      );
    }

    // Verify client belongs to organization
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Update portal access
    const portalAccess = await prisma.clientPortalAccess.update({
      where: { clientId },
      data: { isActive },
    });

    return NextResponse.json({
      success: true,
      portalAccess: {
        id: portalAccess.id,
        email: portalAccess.email,
        isActive: portalAccess.isActive,
      },
    });
  } catch (error) {
    log.error({ err: error }, "Failed to update portal access");
    return NextResponse.json(
      { error: "Failed to update portal access" },
      { status: 500 }
    );
  }
}
