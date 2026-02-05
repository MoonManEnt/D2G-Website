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
      "5 clients",
      "15 disputes/month",
      "15 letters/month",
      "10 reports/month",
      "500MB storage",
      "Basic Amelia AI",
      "Evidence Center (Basic)",
    ],
    limits: { clients: 5, reportsPerMonth: 10, disputesPerMonth: 15, aiRequests: 0 },
  },
  STARTER: {
    name: "Starter",
    price: 149,
    priceYearly: 124, // \,490/year
    interval: "month" as const,
    features: [
      "50 clients",
      "100 disputes/month",
      "100 letters/month",
      "50 reports/month",
      "5GB storage",
      "5 team seats",
      "Full Amelia AI",
      "AI-generated letters",
      "Bulk dispute creation",
      "Credit DNA analysis",
      "Evidence Center (Full)",
      "Email support",
    ],
    limits: { clients: 50, reportsPerMonth: 50, disputesPerMonth: 100, aiRequests: 500 },
  },
  PROFESSIONAL: {
    name: "Professional",
    price: 249,
    priceYearly: 207, // \,490/year
    interval: "month" as const,
    features: [
      "250 clients",
      "400 disputes/month",
      "400 letters/month",
      "200 reports/month",
      "25GB storage",
      "15 team seats",
      "Full Amelia AI with priority",
      "AI-generated letters",
      "Bulk dispute creation",
      "CFPB complaint generator",
      "Litigation Scanner",
      "Credit DNA analysis",
      "White-label customization",
      "Evidence Center (Full)",
      "Priority support",
    ],
    limits: { clients: 250, reportsPerMonth: 200, disputesPerMonth: 400, aiRequests: 2000 },
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
      "Full Amelia AI with priority",
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
export function getPriceId(plan: "STARTER" | "PROFESSIONAL", interval: "monthly" | "yearly"): string {
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
  tier: string = "PROFESSIONAL"
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
    case "trialing":
      return "ACTIVE";
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
