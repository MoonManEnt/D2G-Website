/**
 * Resend Webhook Handler
 *
 * Receives email delivery events from Resend:
 * - email.sent
 * - email.delivered
 * - email.delivery_delayed
 * - email.bounced
 * - email.complained
 *
 * These events are logged for auditing and can trigger notifications.
 *
 * Setup in Resend Dashboard:
 * 1. Go to https://resend.com/webhooks
 * 2. Add webhook URL: https://your-domain.com/api/webhooks/resend
 * 3. Select events: email.delivered, email.bounced, email.complained
 * 4. Copy signing secret to RESEND_WEBHOOK_SECRET env var
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("resend-webhook");

// Webhook event types from Resend
interface ResendWebhookEvent {
  type:
    | "email.sent"
    | "email.delivered"
    | "email.delivery_delayed"
    | "email.bounced"
    | "email.complained"
    | "email.opened"
    | "email.clicked";
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    // For bounces
    bounce?: {
      message: string;
      type: string;
    };
    // For complaints
    complaint?: {
      feedback_type: string;
    };
  };
}

// Verify webhook signature
function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    // Get raw body for signature verification
    const payload = await req.text();
    const signature = req.headers.get("resend-signature") || "";

    // Verify signature if secret is configured
    if (webhookSecret) {
      // Resend uses format: t=timestamp,v1=signature
      const parts = signature.split(",");
      const sigPart = parts.find((p) => p.startsWith("v1="));
      const sig = sigPart?.replace("v1=", "") || "";

      if (!sig || !verifySignature(payload, sig, webhookSecret)) {
        log.warn("Invalid webhook signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } else if (process.env.NODE_ENV === "production") {
      log.warn("RESEND_WEBHOOK_SECRET not configured - skipping signature verification");
    }

    // Parse the event
    const event: ResendWebhookEvent = JSON.parse(payload);

    log.info({
      type: event.type,
      emailId: event.data.email_id,
      to: event.data.to,
      subject: event.data.subject,
    }, "[RESEND] Webhook received");

    // Log detailed event data for auditing (EventLog requires organizationId,
    // so we log to structured logs instead for system-level events)
    log.info({
      eventType: `EMAIL_${event.type.replace("email.", "").toUpperCase()}`,
      emailId: event.data.email_id,
      to: event.data.to,
      subject: event.data.subject,
      bounce: event.data.bounce,
      complaint: event.data.complaint,
      createdAt: event.created_at,
    }, "[RESEND] Email event logged");

    // Handle specific event types
    switch (event.type) {
      case "email.bounced":
        log.warn({
          emailId: event.data.email_id,
          to: event.data.to,
          bounce: event.data.bounce,
        }, "[RESEND] Email bounced");

        // Could trigger a notification to admins or mark email as invalid
        // For now, just log it
        break;

      case "email.complained":
        log.warn({
          emailId: event.data.email_id,
          to: event.data.to,
          complaint: event.data.complaint,
        }, "[RESEND] Email complaint received");

        // This is serious - could indicate spam issues
        // Could trigger admin notification
        break;

      case "email.delivered":
        log.info({ emailId: event.data.email_id }, "[RESEND] Email delivered");
        break;

      case "email.delivery_delayed":
        log.warn({ emailId: event.data.email_id }, "[RESEND] Email delivery delayed");
        break;

      default:
        log.info({ type: event.type }, "[RESEND] Unhandled event type");
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    log.error({ err: error }, "[RESEND] Webhook processing error");
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

// Resend uses POST for webhooks
export async function GET() {
  return NextResponse.json({
    message: "Resend webhook endpoint. Use POST to receive events.",
    docs: "https://resend.com/docs/webhooks",
  });
}
