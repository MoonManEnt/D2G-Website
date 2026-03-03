import Stripe from "stripe";
import { createLogger } from "./logger";
const log = createLogger("stripe");

// Initialize Stripe client
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
    typescript: true,
  })
  : null;

// Price IDs from environment
export const STRIPE_PRICES = {
  SOLO_MONTHLY: process.env.STRIPE_SOLO_MONTHLY_PRICE_ID || "",
  SOLO_YEARLY: process.env.STRIPE_SOLO_YEARLY_PRICE_ID || "",
  STARTER_MONTHLY: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || "",
  STARTER_YEARLY: process.env.STRIPE_STARTER_YEARLY_PRICE_ID || "",
  PROFESSIONAL_MONTHLY: process.env.STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID || "",
  PROFESSIONAL_YEARLY: process.env.STRIPE_PROFESSIONAL_YEARLY_PRICE_ID || "",
  // Legacy aliases for backward compatibility during migration
  PRO_MONTHLY: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || process.env.STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID || "",
  PRO_YEARLY: process.env.STRIPE_PRO_YEARLY_PRICE_ID || process.env.STRIPE_PROFESSIONAL_YEARLY_PRICE_ID || "",
};

// Plan features for display
export const PLAN_FEATURES = {
  FREE: {
    name: "Free",
    price: 0,
    priceYearly: 0,
    interval: "forever" as const,
    features: [
      "3 clients",
      "10 disputes/month",
      "10 letters/month",
      "5 reports/month",
      "500MB storage",
      "Basic letter templates",
      "Evidence Center",
    ],
    limits: { clients: 3, reportsPerMonth: 5, disputesPerMonth: 10, aiRequests: 0 },
  },
  SOLO: {
    name: "Solo",
    price: 79,
    priceYearly: 65, // $790/year
    interval: "month" as const,
    features: [
      "10 clients",
      "40 disputes/month",
      "40 letters/month",
      "15 reports/month",
      "2GB storage",
      "1 team seat",
      "AMELIA AI letters",
      "Credit DNA analysis",
      "Diff engine",
      "Evidence Center",
      "Email support",
    ],
    limits: { clients: 10, reportsPerMonth: 15, disputesPerMonth: 40, aiRequests: 200 },
  },
  STARTER: {
    name: "Starter",
    price: 129,
    priceYearly: 107, // $1,290/year
    interval: "month" as const,
    features: [
      "50 clients",
      "150 disputes/month",
      "150 letters/month",
      "50 reports/month",
      "10GB storage",
      "5 team seats",
      "AMELIA AI letters",
      "Bulk dispute creation",
      "Credit DNA analysis",
      "Evidence Center",
      "Email support",
    ],
    limits: { clients: 50, reportsPerMonth: 50, disputesPerMonth: 150, aiRequests: 750 },
  },
  PROFESSIONAL: {
    name: "Professional",
    price: 199,
    priceYearly: 166, // $1,990/year
    interval: "month" as const,
    features: [
      "250 clients",
      "500 disputes/month",
      "500 letters/month",
      "200 reports/month",
      "50GB storage",
      "15 team seats",
      "AMELIA AI with priority",
      "Sentry Mode",
      "Bulk dispute creation",
      "CFPB complaint generator",
      "Litigation Scanner",
      "Credit DNA analysis",
      "White-label customization",
      "Auto-mailing integration",
      "Evidence Center",
      "Priority support",
    ],
    limits: { clients: 250, reportsPerMonth: 200, disputesPerMonth: 500, aiRequests: 2500 },
  },
  ENTERPRISE: {
    name: "Enterprise",
    price: null, // Custom pricing
    priceYearly: null,
    interval: "custom" as const,
    features: [
      "Unlimited clients",
      "Unlimited disputes",
      "Unlimited letters",
      "Unlimited reports",
      "100GB storage",
      "Unlimited team seats",
      "AMELIA AI with priority",
      "API access",
      "White-label customization",
      "Dedicated account manager",
      "Custom integrations",
      "SLA guarantee",
    ],
    limits: { clients: Infinity, reportsPerMonth: Infinity, disputesPerMonth: Infinity, aiRequests: Infinity },
  },
};

// Get price ID from plan and interval
export function getPriceId(plan: "SOLO" | "STARTER" | "PROFESSIONAL", interval: "monthly" | "yearly"): string {
  const key = `${plan}_${interval.toUpperCase()}` as keyof typeof STRIPE_PRICES;
  return STRIPE_PRICES[key] || "";
}

// Create a checkout session for subscription
export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  organizationId: string,
  tier: string = "PROFESSIONAL",
  trialDays?: number
): Promise<string | null> {
  if (!stripe) {
    log.error("Stripe not configured");
    return null;
  }

  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        organizationId,
        tier,
      },
      subscription_data: {
        metadata: {
          organizationId,
          tier,
        },
        ...(trialDays ? { trial_period_days: trialDays } : {}),
      },
      allow_promotion_codes: true,
    });

    return session.url;
  } catch (error) {
    log.error({ err: error }, "Error creating checkout session");
    return null;
  }
}

// Create a customer portal session
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string | null> {
  if (!stripe) {
    log.error("Stripe not configured");
    return null;
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session.url;
  } catch (error) {
    log.error({ err: error }, "Error creating portal session");
    return null;
  }
}

// Create or get a Stripe customer for an organization
export async function getOrCreateCustomer(
  organizationId: string,
  email: string,
  name: string
): Promise<string | null> {
  if (!stripe) {
    log.error("Stripe not configured");
    return null;
  }

  try {
    // Search for existing customer
    const customers = await stripe.customers.list({
      email,
      limit: 1,
    });

    if (customers.data.length > 0) {
      // Update metadata if needed
      await stripe.customers.update(customers.data[0].id, {
        metadata: { organizationId },
      });
      return customers.data[0].id;
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        organizationId,
      },
    });

    return customer.id;
  } catch (error) {
    log.error({ err: error }, "Error creating/getting customer");
    return null;
  }
}

// Get subscription details
export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  if (!stripe) {
    log.error("Stripe not configured");
    return null;
  }

  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    log.error({ err: error }, "Error retrieving subscription");
    return null;
  }
}

// Cancel subscription
export async function cancelSubscription(
  subscriptionId: string,
  immediately = false
): Promise<boolean> {
  if (!stripe) {
    log.error("Stripe not configured");
    return false;
  }

  try {
    if (immediately) {
      await stripe.subscriptions.cancel(subscriptionId);
    } else {
      await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    }
    return true;
  } catch (error) {
    log.error({ err: error }, "Error canceling subscription");
    return false;
  }
}

// Verify webhook signature
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event | null {
  if (!stripe) {
    log.error("Stripe not configured");
    return null;
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    log.error("Stripe webhook secret not configured");
    return null;
  }

  try {
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    log.error({ err: error }, "Error verifying webhook signature");
    return null;
  }
}

// Map Stripe subscription status to our status
export function mapSubscriptionStatus(
  stripeStatus: Stripe.Subscription.Status
): string {
  switch (stripeStatus) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
    case "unpaid":
      return "CANCELED";
    case "incomplete":
    case "incomplete_expired":
      return "INCOMPLETE";
    default:
      return "UNKNOWN";
  }
}
