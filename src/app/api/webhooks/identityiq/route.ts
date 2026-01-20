import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { processWebhook, WebhookPayload } from "@/lib/identityiq-api";
import { prisma } from "@/lib/prisma";
import { captureError } from "@/lib/errors";

const WEBHOOK_SECRET = process.env.IDENTITYIQ_WEBHOOK_SECRET;

/**
 * Verify webhook signature from IdentityIQ
 * They typically use HMAC-SHA256 signatures
 */
function verifySignature(payload: string, signature: string | null): boolean {
  if (!WEBHOOK_SECRET || !signature) {
    // If no secret configured, skip verification in development
    if (process.env.NODE_ENV === "development") {
      console.warn("Webhook signature verification skipped (no secret configured)");
      return true;
    }
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");

  // Compare signatures securely
  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

/**
 * POST /api/webhooks/identityiq
 *
 * Receives webhook notifications from IdentityIQ when:
 * - A new credit report is ready (report.ready)
 * - Credit scores are updated (score.updated)
 * - New alerts are created (alert.created)
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-identityiq-signature");

    // Verify webhook signature
    if (!verifySignature(rawBody, signature)) {
      console.error("Invalid webhook signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Parse the payload
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    // Log the webhook event
    const targetId = String(payload.data.reportId || payload.data.userId || payload.memberId || "unknown");
    await prisma.eventLog.create({
      data: {
        eventType: `webhook.identityiq.${payload.event}`,
        targetType: "WEBHOOK",
        targetId,
        eventData: JSON.stringify({
          event: payload.event,
          timestamp: payload.timestamp,
          dataKeys: Object.keys(payload.data),
        }),
        organizationId: "system", // Webhook events are system-level
      },
    });

    // Process the webhook
    const result = await processWebhook(payload);

    if (!result.success) {
      console.error("Webhook processing failed:", result.error);

      // Still return 200 to acknowledge receipt (prevent retries for business logic errors)
      return NextResponse.json({
        received: true,
        processed: false,
        error: result.error,
      });
    }

    console.log(`IdentityIQ webhook processed: ${payload.event}`, result.action);

    return NextResponse.json({
      received: true,
      processed: true,
      action: result.action,
    });
  } catch (error) {
    captureError(error as Error, {
      action: "identityiq_webhook",
    });

    console.error("Webhook error:", error);

    // Return 500 to trigger retry
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/identityiq
 *
 * Health check endpoint for webhook verification
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "identityiq-webhook",
    timestamp: new Date().toISOString(),
  });
}
