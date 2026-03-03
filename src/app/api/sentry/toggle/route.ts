/**
 * Sentry Toggle API
 *
 * POST /api/sentry/toggle
 * Enable or disable Sentry Mode for a client.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createLogger } from "@/lib/logger";

const log = createLogger("sentry-toggle-api");

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { clientId, enabled } = body as { clientId: string; enabled: boolean };

    if (!clientId || typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "clientId and enabled (boolean) are required" },
        { status: 400 }
      );
    }

    // Verify client belongs to org
    const client = await prisma.client.findFirst({
      where: { id: clientId, organizationId: session.user.organizationId },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Update client
    const updateData: Record<string, unknown> = {
      sentryModeEnabled: enabled,
    };

    if (enabled) {
      updateData.sentryEnabledAt = new Date();
    } else {
      updateData.sentryDisabledAt = new Date();
    }

    await prisma.client.update({
      where: { id: clientId },
      data: updateData,
    });

    // Log event
    await prisma.eventLog.create({
      data: {
        eventType: enabled ? "SENTRY_MODE_ENABLED" : "SENTRY_MODE_DISABLED",
        actorId: session.user.id,
        actorEmail: session.user.email || undefined,
        targetType: "CLIENT",
        targetId: clientId,
        organizationId: session.user.organizationId,
        eventData: JSON.stringify({ enabled }),
      },
    });

    // Log to Sentry activity
    await prisma.sentryActivityLog.create({
      data: {
        organizationId: session.user.organizationId,
        clientId,
        activityType: enabled ? "SENTRY_ENABLED" : "SENTRY_DISABLED",
        summary: `Sentry Mode ${enabled ? "enabled" : "disabled"} for ${client.firstName} ${client.lastName}`,
        triggeredBy: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      sentryModeEnabled: enabled,
      clientId,
    });
  } catch (error) {
    log.error({ err: error }, "Sentry toggle failed");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Toggle failed" },
      { status: 500 }
    );
  }
}
