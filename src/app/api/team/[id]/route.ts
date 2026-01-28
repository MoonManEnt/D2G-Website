import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hash } from "bcryptjs";
import { updateTeamMemberSchema } from "@/lib/api-validation-schemas";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/team/[id] - Get a team member's details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: userId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId: session.user.organizationId,
      },
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
            eventLogs: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get recent activity
    const recentActivity = await prisma.eventLog.findMany({
      where: {
        actorId: userId,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        eventType: true,
        targetType: true,
        targetId: true,
        eventData: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      user: {
        ...user,
        stats: {
          reports: user._count.uploadedReports,
          documents: user._count.createdDocuments,
          actions: user._count.eventLogs,
        },
      },
      recentActivity,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch user" },
      { status: 500 }
    );
  }
}

// PATCH /api/team/[id] - Update a team member
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: userId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    const targetUser = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId: session.user.organizationId,
      },
      select: { role: true },
    });

    if (!currentUser || !targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only OWNER and ADMIN can update users
    // ADMIN cannot update OWNER
    if (!["OWNER", "ADMIN"].includes(currentUser.role)) {
      return NextResponse.json(
        { error: "You don't have permission to update team members" },
        { status: 403 }
      );
    }

    if (currentUser.role === "ADMIN" && targetUser.role === "OWNER") {
      return NextResponse.json(
        { error: "You cannot modify the organization owner" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateTeamMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { name, role, isActive, profilePicture } = parsed.data;

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (profilePicture !== undefined) updateData.profilePicture = profilePicture;

    // Role change restrictions
    if (role !== undefined) {
      // Cannot demote OWNER
      if (targetUser.role === "OWNER" && role !== "OWNER") {
        return NextResponse.json(
          { error: "Cannot change owner role. Transfer ownership first." },
          { status: 400 }
        );
      }

      // Only OWNER can assign OWNER role
      if (role === "OWNER" && currentUser.role !== "OWNER") {
        return NextResponse.json(
          { error: "Only the owner can transfer ownership" },
          { status: 403 }
        );
      }

      updateData.role = role;
    }

    // Status change
    if (isActive !== undefined) {
      // Cannot deactivate OWNER
      if (targetUser.role === "OWNER" && !isActive) {
        return NextResponse.json(
          { error: "Cannot deactivate the organization owner" },
          { status: 400 }
        );
      }

      // Cannot deactivate yourself
      if (userId === session.user.id && !isActive) {
        return NextResponse.json(
          { error: "You cannot deactivate your own account" },
          { status: 400 }
        );
      }

      updateData.isActive = isActive;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        profilePicture: true,
      },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update user" },
      { status: 500 }
    );
  }
}

// DELETE /api/team/[id] - Remove a team member
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: userId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    const targetUser = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId: session.user.organizationId,
      },
      select: { role: true },
    });

    if (!currentUser || !targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only OWNER can delete users
    if (currentUser.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only the organization owner can remove team members" },
        { status: 403 }
      );
    }

    // Cannot delete OWNER
    if (targetUser.role === "OWNER") {
      return NextResponse.json(
        { error: "Cannot delete the organization owner" },
        { status: 400 }
      );
    }

    // Cannot delete yourself
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 }
      );
    }

    // Soft delete by deactivating, or hard delete
    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get("hard") === "true";

    if (hardDelete) {
      await prisma.user.delete({
        where: { id: userId },
      });
    } else {
      await prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      });
    }

    return NextResponse.json({
      success: true,
      message: hardDelete ? "User permanently deleted" : "User deactivated",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete user" },
      { status: 500 }
    );
  }
}
