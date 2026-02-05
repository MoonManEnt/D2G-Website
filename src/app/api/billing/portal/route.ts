import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createPortalSession } from "@/lib/stripe";
import { createLogger } from "@/lib/logger";
const log = createLogger("billing-portal-api");

export const dynamic = "force-dynamic";

// POST /api/billing/portal - Create a billing portal session
export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
    });

    if (!organization?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account found" },
        { status: 400 }
      );
    }

    // Create portal session
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const portalUrl = await createPortalSession(
      organization.stripeCustomerId,
      `${baseUrl}/billing`
    );

    if (!portalUrl) {
      return NextResponse.json(
        { error: "Failed to create portal session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: portalUrl });
  } catch (error) {
    log.error({ err: error }, "Error creating portal session");
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
