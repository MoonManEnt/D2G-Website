import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { constructWebhookEvent, mapSubscriptionStatus } from "@/lib/stripe";
import { sendEmail } from "@/lib/email";
import { paymentFailedTemplate } from "@/lib/email-templates";
import Stripe from "stripe";

// Disable body parsing, we need the raw body for webhook verification
export const runtime = "nodejs";

// POST /api/billing/webhook - Handle Stripe webhooks
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    const event = constructWebhookEvent(body, signature);

    if (!event) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 400 }
      );
    }

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const organizationId = session.metadata?.organizationId;
  const subscriptionId = session.subscription as string;

  if (!organizationId || !subscriptionId) {
    console.error("Missing organizationId or subscriptionId in checkout session");
    return;
  }

  // Update organization with subscription
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      stripeSubscriptionId: subscriptionId,
      subscriptionTier: "PRO",
      subscriptionStatus: "ACTIVE",
    },
  });

  // Log the event
  await prisma.eventLog.create({
    data: {
      eventType: "SUBSCRIPTION_CREATED",
      targetType: "Organization",
      targetId: organizationId,
      eventData: JSON.stringify({
        subscriptionId,
        tier: "PRO",
      }),
      organizationId,
    },
  });
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata?.organizationId;

  if (!organizationId) {
    // Try to find by subscription ID
    const org = await prisma.organization.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });
    if (!org) {
      console.error("Could not find organization for subscription:", subscription.id);
      return;
    }
    await updateOrganizationSubscription(org.id, subscription);
  } else {
    await updateOrganizationSubscription(organizationId, subscription);
  }
}

async function updateOrganizationSubscription(
  organizationId: string,
  subscription: Stripe.Subscription
) {
  const status = mapSubscriptionStatus(subscription.status);

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: status,
      subscriptionTier: status === "ACTIVE" ? "PRO" : "FREE",
    },
  });

  // Log the event
  await prisma.eventLog.create({
    data: {
      eventType: "SUBSCRIPTION_UPDATED",
      targetType: "Organization",
      targetId: organizationId,
      eventData: JSON.stringify({
        subscriptionId: subscription.id,
        status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      }),
      organizationId,
    },
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata?.organizationId;

  let orgId = organizationId;

  if (!orgId) {
    // Try to find by subscription ID
    const org = await prisma.organization.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });
    if (!org) {
      console.error("Could not find organization for subscription:", subscription.id);
      return;
    }
    orgId = org.id;
  }

  // Downgrade to free tier
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      subscriptionTier: "FREE",
      subscriptionStatus: "CANCELED",
      stripeSubscriptionId: null,
    },
  });

  // Log the event
  await prisma.eventLog.create({
    data: {
      eventType: "SUBSCRIPTION_CANCELED",
      targetType: "Organization",
      targetId: orgId,
      eventData: JSON.stringify({
        subscriptionId: subscription.id,
      }),
      organizationId: orgId,
    },
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  // Find organization by customer ID
  const org = await prisma.organization.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!org) {
    console.error("Could not find organization for customer:", customerId);
    return;
  }

  // Update status
  await prisma.organization.update({
    where: { id: org.id },
    data: {
      subscriptionStatus: "PAST_DUE",
    },
  });

  // Log the event
  await prisma.eventLog.create({
    data: {
      eventType: "PAYMENT_FAILED",
      targetType: "Organization",
      targetId: org.id,
      eventData: JSON.stringify({
        invoiceId: invoice.id,
        amountDue: invoice.amount_due,
        attemptCount: invoice.attempt_count,
      }),
      organizationId: org.id,
    },
  });

  // Send failed payment notification to org owner
  try {
    const owner = await prisma.user.findFirst({
      where: { organizationId: org.id, role: "OWNER" },
      select: { email: true, name: true },
    });

    if (owner?.email) {
      const amountDue = (invoice.amount_due / 100).toFixed(2);
      const attemptCount = invoice.attempt_count || 1;
      const nextAttempt = invoice.next_payment_attempt
        ? new Date(invoice.next_payment_attempt * 1000).toLocaleDateString()
        : null;

      const billingUrl = `${process.env.NEXTAUTH_URL || "https://app.dispute2go.com"}/billing`;

      const html = paymentFailedTemplate({
        userName: owner.name || "there",
        amountDue,
        attemptCount,
        nextAttemptDate: nextAttempt,
        billingUrl,
      });

      await sendEmail({
        to: owner.email,
        template: {
          subject: `Action required: Payment of $${amountDue} failed`,
          html,
          text: `Hi ${owner.name || "there"},\n\nYour payment of $${amountDue} failed (attempt ${attemptCount}).${nextAttempt ? ` We'll retry on ${nextAttempt}.` : ""}\n\nPlease update your payment method: ${billingUrl}\n\nIf not resolved, your account will be downgraded to the Free plan.`,
        },
        tags: [{ name: "category", value: "payment-failed" }],
      });
    }
  } catch (emailError) {
    console.error("Failed to send payment failure email:", emailError);
  }
}
