import Stripe from "stripe";

// Initialize Stripe client
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
    typescript: true,
  })
  : null;

// Price IDs from environment
export const STRIPE_PRICES = {
  PRO_MONTHLY: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "",
  PRO_YEARLY: process.env.STRIPE_PRO_YEARLY_PRICE_ID || "",
};

// Plan features for display
export const PLAN_FEATURES = {
  FREE: {
    name: "Free",
    price: 0,
    interval: "forever",
    features: [
      "3 clients",
      "View credit reports",
      "Basic dispute tracking",
      "5 disputes/month",
    ],
    limits: {
      clients: 3,
      reportsPerMonth: 5,
      aiRequests: 0,
    },
  },
  STARTER: {
    name: "Starter",
    price: 49,
    interval: "month",
    features: [
      "15 clients",
      "25 reports/month",
      "AI insights",
      "25 disputes/month",
      "Email support",
    ],
    limits: {
      clients: 15,
      reportsPerMonth: 25,
      aiRequests: 100,
    },
  },
  PROFESSIONAL: {
    name: "Professional",
    price: Number(process.env.NEXT_PUBLIC_PRO_PRICE) || 99,
    interval: "month",
    features: [
      "50 clients",
      "100 reports/month",
      "AI dispute strategy",
      "DOCX letter generation",
      "CFPB complaint generator",
      "AMELIA letter generation",
      "Priority support",
    ],
    limits: {
      clients: 50,
      reportsPerMonth: 100,
      aiRequests: 500,
    },
  },
  ENTERPRISE: {
    name: "Enterprise",
    price: 299,
    interval: "month",
    features: [
      "Unlimited clients",
      "Unlimited reports",
      "Full AI access",
      "White-label options",
      "API access",
      "Dedicated support",
    ],
    limits: {
      clients: Infinity,
      reportsPerMonth: Infinity,
      aiRequests: Infinity,
    },
  },
  // Alias for backward compatibility
  PRO: {
    name: "Professional",
    price: Number(process.env.NEXT_PUBLIC_PRO_PRICE) || 99,
    interval: "month",
    features: [
      "50 clients",
      "100 reports/month",
      "AI dispute strategy",
      "DOCX letter generation",
      "CFPB complaint generator",
      "AMELIA letter generation",
      "Priority support",
    ],
    limits: {
      clients: 50,
      reportsPerMonth: 100,
      aiRequests: 500,
    },
  },
};

// Create a checkout session for subscription
export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  organizationId: string
): Promise<string | null> {
  if (!stripe) {
    console.error("Stripe not configured");
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
      },
      subscription_data: {
        metadata: {
          organizationId,
        },
      },
      allow_promotion_codes: true,
    });

    return session.url;
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return null;
  }
}

// Create a customer portal session
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string | null> {
  if (!stripe) {
    console.error("Stripe not configured");
    return null;
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session.url;
  } catch (error) {
    console.error("Error creating portal session:", error);
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
    console.error("Stripe not configured");
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
    console.error("Error creating/getting customer:", error);
    return null;
  }
}

// Get subscription details
export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  if (!stripe) {
    console.error("Stripe not configured");
    return null;
  }

  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    console.error("Error retrieving subscription:", error);
    return null;
  }
}

// Cancel subscription
export async function cancelSubscription(
  subscriptionId: string,
  immediately = false
): Promise<boolean> {
  if (!stripe) {
    console.error("Stripe not configured");
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
    console.error("Error canceling subscription:", error);
    return false;
  }
}

// Verify webhook signature
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event | null {
  if (!stripe) {
    console.error("Stripe not configured");
    return null;
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("Stripe webhook secret not configured");
    return null;
  }

  try {
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error("Error verifying webhook signature:", error);
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
