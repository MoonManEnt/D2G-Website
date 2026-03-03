import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { stripe, constructWebhookEvent, mapSubscriptionStatus } from "@/lib/stripe";
import { sendEmail, sendSubscriptionConfirmationEmail } from "@/lib/email";
import { paymentFailedTemplate } from "@/lib/email-templates";
import Stripe from "stripe";
import { createLogger } from "@/lib/logger";
const log = createLogger("billing-webhook");

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
        log.info({ eventType: event.type }, "Unhandled event type");
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    log.error({ err: error }, "Webhook error");
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
    log.error("Missing organizationId or subscriptionId in checkout session");
    return;
  }

  // Read tier from session metadata, default to PROFESSIONAL for backward compat
  const tier = session.metadata?.tier || "PROFESSIONAL";

  // Founding Member logic for Professional tier
  let isFoundingMember = false;
  let foundingMemberNumber: number | null = null;

  if (tier === "PROFESSIONAL") {
    const foundingCount = await prisma.organization.count({
      where: { isFoundingMember: true },
    });
    if (foundingCount < 100) {
      isFoundingMember = true;
      foundingMemberNumber = foundingCount + 1;
    }
  }

  // Retrieve actual subscription status (may be "trialing" for trial checkouts)
  let actualStatus = "ACTIVE";
  let trialEndsAt: Date | null = null;
  if (stripe) {
    try {
      const subscriptionObj = await stripe.subscriptions.retrieve(subscriptionId);
      actualStatus = mapSubscriptionStatus(subscriptionObj.status);
      trialEndsAt = subscriptionObj.trial_end
        ? new Date(subscriptionObj.trial_end * 1000)
        : null;
    } catch (err) {
      log.warn({ err }, "Could not retrieve subscription status, defaulting to ACTIVE");
    }
  }

  // Update organization with subscription
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      stripeSubscriptionId: subscriptionId,
      subscriptionTier: tier,
      subscriptionStatus: actualStatus,
      ...(trialEndsAt && { trialEndsAt }),
      isFoundingMember,
      foundingMemberNumber,
      foundingMemberLockedPrice: isFoundingMember ? 149.0 : null,
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
        tier,
        isFoundingMember,
        foundingMemberNumber,
      }),
      organizationId,
    },
  });

  // Send subscription confirmation email to the org owner
  try {
    const owner = await prisma.user.findFirst({
      where: { organizationId, role: "OWNER" },
      select: { email: true, name: true },
    });

    if (owner?.email) {
      await sendSubscriptionConfirmationEmail(
        owner.email,
        owner.name || "there",
        tier,
        organizationId
      );
      log.info({ tier, email: owner.email }, "Subscription confirmation email sent");
    }
  } catch (emailError) {
    log.error({ err: emailError }, "Failed to send subscription confirmation email");
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata?.organizationId;

  if (!organizationId) {
    // Try to find by subscription ID
    const org = await prisma.organization.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });
    if (!org) {
      log.error({ data: subscription.id }, "Could not find organization for subscription");
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

  // Read tier from subscription metadata, default to PROFESSIONAL for backward compat
  const tier = subscription.metadata?.tier || "PROFESSIONAL";

  // Handle trial end date
  const trialEndsAt = subscription.trial_end
    ? new Date(subscription.trial_end * 1000)
    : null;

  // Trialing status should keep the tier, not revert to FREE
  const isActiveOrTrialing = status === "ACTIVE" || status === "TRIALING";

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: status,
      subscriptionTier: isActiveOrTrialing ? tier : "FREE",
      ...(trialEndsAt && { trialEndsAt }),
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
        tier,
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
      log.error({ data: subscription.id }, "Could not find organization for subscription");
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
    log.error({ data: customerId }, "Could not find organization for customer");
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
    log.error({ err: emailError }, "Failed to send payment failure email");
  }
}
