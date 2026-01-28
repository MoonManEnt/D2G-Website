import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { defaultBranding, BrandingSettings } from "@/types/branding";
import { orgBrandingSchema } from "@/lib/api-validation-schemas";

export const dynamic = "force-dynamic";

// GET - Fetch branding settings
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { settings: true },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Parse settings JSON
    let settings: Record<string, unknown> = {};
    try {
      settings = JSON.parse(organization.settings || "{}");
    } catch {
      settings = {};
    }

    // Extract branding from settings
    const branding = settings.branding || defaultBranding;

    return NextResponse.json({ branding });
  } catch (error) {
    console.error("Error fetching branding:", error);
    return NextResponse.json(
      { error: "Failed to fetch branding settings" },
      { status: 500 }
    );
  }
}

// PATCH - Update branding settings
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can update branding
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only administrators can update branding settings" },
        { status: 403 }
      );
    }

    const updates = await request.json();

    // Validate updates with Zod schema
    const parsed = orgBrandingSchema.safeParse(updates);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const sanitizedUpdates: Partial<BrandingSettings> = parsed.data;

    // Validate logo URL size (if base64, limit to ~2MB)
    if (
      sanitizedUpdates.logoUrl &&
      sanitizedUpdates.logoUrl.length > 2 * 1024 * 1024 * 1.4
    ) {
      return NextResponse.json(
        { error: "Logo file is too large. Maximum size is 2MB." },
        { status: 400 }
      );
    }

    // Get current settings
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { settings: true },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Parse and merge settings
    let settings: Record<string, unknown> = {};
    try {
      settings = JSON.parse(organization.settings || "{}");
    } catch {
      settings = {};
    }

    const currentBranding = (settings.branding as BrandingSettings) || defaultBranding;
    const newBranding = { ...currentBranding, ...sanitizedUpdates };
    settings.branding = newBranding;

    // Update organization
    await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: { settings: JSON.stringify(settings) },
    });

    // Log event
    await prisma.eventLog.create({
      data: {
        eventType: "BRANDING_UPDATED",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "Organization",
        targetId: session.user.organizationId,
        organizationId: session.user.organizationId,
        eventData: JSON.stringify({
          updatedFields: Object.keys(sanitizedUpdates),
        }),
      },
    });

    return NextResponse.json({ branding: newBranding });
  } catch (error) {
    console.error("Error updating branding:", error);
    return NextResponse.json(
      { error: "Failed to update branding settings" },
      { status: 500 }
    );
  }
}

// DELETE - Reset branding to defaults
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can reset branding
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only administrators can reset branding settings" },
        { status: 403 }
      );
    }

    // Get current settings
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { settings: true },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Parse settings and remove branding
    let settings: Record<string, unknown> = {};
    try {
      settings = JSON.parse(organization.settings || "{}");
    } catch {
      settings = {};
    }

    delete settings.branding;

    // Update organization
    await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: { settings: JSON.stringify(settings) },
    });

    // Log event
    await prisma.eventLog.create({
      data: {
        eventType: "BRANDING_RESET",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "Organization",
        targetId: session.user.organizationId,
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({ branding: defaultBranding });
  } catch (error) {
    console.error("Error resetting branding:", error);
    return NextResponse.json(
      { error: "Failed to reset branding settings" },
      { status: 500 }
    );
  }
}
