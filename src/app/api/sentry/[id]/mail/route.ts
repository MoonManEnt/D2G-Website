/**
 * SENTRY DISPUTE API - Mail Letter via DocuPost
 *
 * POST /api/sentry/[id]/mail - Send a Sentry dispute letter via physical mail
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { mailSendSchema } from "@/lib/api-validation-schemas";
import { sendMail, MailProvider } from "@/lib/mail-provider";
import { createLogger } from "@/lib/logger";
const log = createLogger("sentry-mail-api");

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// =============================================================================
// POST /api/sentry/[id]/mail - Mail a Sentry dispute letter
// =============================================================================

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const parsed = mailSendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { provider, color, doubleSided, certified, returnReceipt } =
      parsed.data;

    // Find the Sentry dispute
    const dispute = await prisma.sentryDispute.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            addressLine1: true,
            city: true,
            state: true,
            zipCode: true,
          },
        },
      },
    });

    if (!dispute) {
      return NextResponse.json(
        { error: "Sentry dispute not found" },
        { status: 404 }
      );
    }

    // Must have letter content
    if (!dispute.letterContent) {
      return NextResponse.json(
        {
          error:
            "Dispute has no letter content. Generate a letter before mailing.",
        },
        { status: 400 }
      );
    }

    // Must be launched (status SENT) before mailing
    if (dispute.status !== "SENT") {
      return NextResponse.json(
        {
          error: `Dispute must be launched (status SENT) before mailing. Current status: ${dispute.status}`,
        },
        { status: 400 }
      );
    }

    // Check if already mailed
    if (dispute.mailedLetterId) {
      return NextResponse.json(
        {
          error: "This dispute has already been mailed",
          letterId: dispute.mailedLetterId,
          mailedAt: dispute.mailedAt,
        },
        { status: 400 }
      );
    }

    // Validate client address
    const client = dispute.client;
    const clientAddress = client.addressLine1 || "";
    const clientCity = client.city || "";
    const clientState = client.state || "";
    const clientZip = client.zipCode || "";

    if (!clientAddress || !clientCity || !clientState || !clientZip) {
      return NextResponse.json(
        {
          error:
            "Client address is incomplete. Please update client information before mailing.",
        },
        { status: 400 }
      );
    }

    // Prepare HTML content from letter text
    // Wrap the letter content in basic HTML and truncate to 9000 chars
    const rawLetterContent = dispute.letterContent;
    const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;font-size:12px;line-height:1.5;margin:40px;}</style></head>
<body>
<pre style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:12px;line-height:1.5;">${rawLetterContent}</pre>
</body>
</html>`.slice(0, 9000);

    // Determine service level for tracking
    let serviceLevel = "standard";
    if (returnReceipt) {
      serviceLevel = "certified_return_receipt";
    } else if (certified) {
      serviceLevel = "certified";
    }

    // Send via unified mail provider
    const clientName = `${client.firstName} ${client.lastName}`;
    const result = await sendMail({
      cra: dispute.cra,
      clientName,
      clientAddress,
      clientCity,
      clientState,
      clientZip,
      htmlContent,
      certified,
      returnReceipt,
      color,
      doubleSided,
      description: `Sentry Dispute Letter - ${clientName} - ${dispute.cra}`,
      provider: provider as MailProvider,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send letter" },
        { status: 500 }
      );
    }

    // Update the Sentry dispute with mailing info
    const updatedDispute = await prisma.sentryDispute.update({
      where: { id },
      data: {
        mailedLetterId: result.letterId || null,
        mailedAt: new Date(),
        mailProvider: result.provider,
        mailServiceLevel: serviceLevel,
      },
    });

    // Create EventLog entry
    await prisma.eventLog.create({
      data: {
        eventType: "SENTRY_DISPUTE_MAILED",
        actorId: session.user.id,
        targetType: "SentryDispute",
        targetId: dispute.id,
        eventData: JSON.stringify({
          cra: dispute.cra,
          provider: result.provider,
          letterId: result.letterId,
          serviceLevel,
          color,
          doubleSided,
          clientName,
        }),
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      letterId: result.letterId,
      provider: result.provider,
      serviceLevel,
      mailedAt: updatedDispute.mailedAt,
      dispute: {
        id: updatedDispute.id,
        status: updatedDispute.status,
        cra: updatedDispute.cra,
      },
    });
  } catch (error) {
    log.error({ err: error }, "Error mailing Sentry dispute");
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to mail Sentry dispute",
        code: "MAIL_ERROR",
      },
      { status: 500 }
    );
  }
}
