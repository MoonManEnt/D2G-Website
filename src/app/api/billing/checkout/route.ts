import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  createCheckoutSession,
  getOrCreateCustomer,
  STRIPE_PRICES,
} from "@/lib/stripe";
import { checkoutSchema } from "@/lib/api-validation-schemas";

export const dynamic = "force-dynamic";

// POST /api/billing/checkout - Create a checkout session
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { plan, interval } = parsed.data;

    // Get price ID
    const priceId =
      interval === "yearly"
        ? STRIPE_PRICES.PRO_YEARLY
        : STRIPE_PRICES.PRO_MONTHLY;

    if (!priceId) {
      return NextResponse.json(
        { error: "Stripe not configured. Contact support." },
        { status: 500 }
      );
    }

    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Get or create Stripe customer
    let customerId = organization.stripeCustomerId;

    if (!customerId) {
      customerId = await getOrCreateCustomer(
        organization.id,
        session.user.email!,
        organization.name
      );

      if (!customerId) {
        return NextResponse.json(
          { error: "Failed to create Stripe customer" },
          { status: 500 }
        );
      }

      // Save customer ID
      await prisma.organization.update({
        where: { id: organization.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create checkout session
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const checkoutUrl = await createCheckoutSession(
      customerId,
      priceId,
      `${baseUrl}/billing?success=true`,
      `${baseUrl}/billing?canceled=true`,
      organization.id
    );

    if (!checkoutUrl) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 }
      );
    }

    // Log the event
    await prisma.eventLog.create({
      data: {
        eventType: "CHECKOUT_INITIATED",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "Organization",
        targetId: organization.id,
        eventData: JSON.stringify({ plan, interval }),
        organizationId: organization.id,
      },
    });

    return NextResponse.json({ url: checkoutUrl });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
