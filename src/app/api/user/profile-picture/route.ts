import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET - Fetch current profile picture
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { profilePicture: true },
    });

    return NextResponse.json({ profilePicture: user?.profilePicture || null });
  } catch (error) {
    console.error("Error fetching profile picture:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile picture" },
      { status: 500 }
    );
  }
}

// PATCH - Update profile picture
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { profilePicture } = await request.json();

    // Validate profile picture if provided
    if (profilePicture) {
      // Check if it's a valid data URL or URL
      const isDataUrl = profilePicture.startsWith("data:image/");
      const isUrl =
        profilePicture.startsWith("http://") ||
        profilePicture.startsWith("https://");

      if (!isDataUrl && !isUrl) {
        return NextResponse.json(
          { error: "Invalid profile picture format" },
          { status: 400 }
        );
      }

      // Validate data URL size (max ~2MB encoded, which is about 1.5MB actual)
      if (isDataUrl && profilePicture.length > 2 * 1024 * 1024 * 1.4) {
        return NextResponse.json(
          { error: "Profile picture is too large. Maximum size is 2MB." },
          { status: 400 }
        );
      }
    }

    // Update user profile picture
    await prisma.user.update({
      where: { id: session.user.id },
      data: { profilePicture: profilePicture || null },
    });

    // Log event
    await prisma.eventLog.create({
      data: {
        eventType: "USER_UPDATED",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "User",
        targetId: session.user.id,
        organizationId: session.user.organizationId,
        eventData: JSON.stringify({
          field: "profilePicture",
          action: profilePicture ? "updated" : "removed",
        }),
      },
    });

    return NextResponse.json({
      success: true,
      profilePicture: profilePicture || null,
    });
  } catch (error) {
    console.error("Error updating profile picture:", error);
    return NextResponse.json(
      { error: "Failed to update profile picture" },
      { status: 500 }
    );
  }
}

// DELETE - Remove profile picture
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { profilePicture: null },
    });

    // Log event
    await prisma.eventLog.create({
      data: {
        eventType: "USER_UPDATED",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "User",
        targetId: session.user.id,
        organizationId: session.user.organizationId,
        eventData: JSON.stringify({
          field: "profilePicture",
          action: "removed",
        }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing profile picture:", error);
    return NextResponse.json(
      { error: "Failed to remove profile picture" },
      { status: 500 }
    );
  }
}
