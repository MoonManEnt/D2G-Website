import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  sendDisputeLetter,
  getLetterTracking,
  cancelLetter,
  verifyAddress,
  getLetterPricing,
  isMailServiceAvailable,
  CRAType,
} from "@/lib/mail";
import {
  generateDisputeLetterPDF,
  DisputeLetterData,
  CRA_ADDRESSES,
  CRAName,
} from "@/lib/pdf-generate";
import { sendMail, MailProvider } from "@/lib/mail-provider";
import { format, addDays } from "date-fns";
import { createLogger } from "@/lib/logger";
const log = createLogger("dispute-mail-api");

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/disputes/[id]/mail - Get mail status for a dispute
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: disputeId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dispute = await prisma.dispute.findFirst({
      where: {
        id: disputeId,
        organizationId: session.user.organizationId,
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    // Check if there's a mailed letter ID stored
    const mailedLetterId = dispute.mailedLetterId;
    if (!mailedLetterId) {
      return NextResponse.json({
        mailed: false,
        message: "This dispute has not been mailed yet",
      });
    }

    // Get tracking information
    const tracking = await getLetterTracking(mailedLetterId);

    return NextResponse.json({
      mailed: true,
      letterId: mailedLetterId,
      mailedAt: dispute.mailedAt,
      tracking,
    });
  } catch (error) {
    log.error({ err: error }, "Error getting mail status");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get mail status" },
      { status: 500 }
    );
  }
}

// POST /api/disputes/[id]/mail - Send dispute via physical mail
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: disputeId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      provider: requestedProvider = "DOCUPOST",
      color = false,
      doubleSided = true,
      mailType = "usps_first_class",
      extraService,
      scheduledDate,
      verifyAddressFirst = true,
    } = body;

    // Check if mail service is available (for Lob provider)
    const selectedProvider: MailProvider = (requestedProvider as MailProvider) || "DOCUPOST";
    if (selectedProvider === "LOB" && !isMailServiceAvailable()) {
      return NextResponse.json(
        { error: "Physical mail service is not configured" },
        { status: 503 }
      );
    }

    // Fetch dispute with client and items
    const dispute = await prisma.dispute.findFirst({
      where: {
        id: disputeId,
        organizationId: session.user.organizationId,
      },
      include: {
        client: true,
        items: {
          include: {
            accountItem: true,
          },
        },
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    // Check if already mailed
    if (dispute.mailedLetterId) {
      return NextResponse.json(
        { error: "This dispute has already been mailed", letterId: dispute.mailedLetterId },
        { status: 400 }
      );
    }

    // Check if status allows mailing
    if (dispute.status !== "APPROVED" && dispute.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Dispute must be approved before mailing" },
        { status: 400 }
      );
    }

    const client = dispute.client;

    // Use address fields from client
    const clientAddress = client.addressLine1 || "";
    const clientCity = client.city || "";
    const clientState = client.state || "";
    const clientZip = client.zipCode || "";

    if (!clientAddress || !clientCity || !clientState || !clientZip) {
      return NextResponse.json(
        { error: "Client address is incomplete. Please update client information." },
        { status: 400 }
      );
    }

    const clientName = `${client.firstName} ${client.lastName}`;
    const cra = dispute.cra as CRAName;

    // =========================================================================
    // DocuPost Provider Path
    // =========================================================================
    if (selectedProvider === "DOCUPOST") {
      // Prepare HTML content from letter text
      const rawLetterContent = dispute.letterContent || "";
      const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;font-size:12px;line-height:1.5;margin:40px;}</style></head>
<body>
<pre style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:12px;line-height:1.5;">${rawLetterContent}</pre>
</body>
</html>`.slice(0, 9000);

      const docuPostResult = await sendMail({
        cra: dispute.cra,
        clientName,
        clientAddress,
        clientCity,
        clientState,
        clientZip,
        htmlContent,
        certified: !!extraService,
        returnReceipt: extraService === "certified_return_receipt",
        color,
        doubleSided,
        description: `Dispute Letter - ${clientName} - ${cra}`,
        provider: "DOCUPOST",
      });

      if (!docuPostResult.success) {
        return NextResponse.json(
          { error: docuPostResult.error || "Failed to send letter via DocuPost" },
          { status: 500 }
        );
      }

      // Update dispute with mailing info
      const sentNow = new Date();
      await prisma.dispute.update({
        where: { id: disputeId },
        data: {
          status: "SENT",
          mailedLetterId: docuPostResult.letterId,
          mailedAt: sentNow,
          sentDate: sentNow,
        },
      });

      // Lock disputed account items
      for (const item of dispute.items) {
        await prisma.accountItem.update({
          where: { id: item.accountItemId },
          data: { isLockedInDispute: true, lockedByDisputeId: disputeId, lockedAt: sentNow },
        });
      }

      // Create FCRA 30-day deadline reminder
      const fcraDeadline = addDays(sentNow, 30);
      try {
        await prisma.reminder.create({
          data: {
            clientId: dispute.clientId,
            disputeId,
            reminderType: "FCRA_DEADLINE",
            title: `FCRA Deadline: ${cra} dispute`,
            description: `30-day FCRA response deadline for ${cra} R${dispute.round} dispute (${dispute.items.length} items)`,
            scheduledFor: fcraDeadline,
          },
        });
      } catch (reminderErr) {
        log.error({ err: reminderErr }, "Failed to create FCRA deadline reminder (non-blocking)");
      }

      // Sentry Mode: Log activity and send client notification
      try {
        await prisma.sentryActivityLog.create({
          data: {
            organizationId: session.user.organizationId,
            clientId: dispute.clientId,
            activityType: "LETTER_MAILED",
            summary: `${cra} R${dispute.round} dispute letter mailed via DocuPost (${dispute.items.length} items)`,
            triggeredBy: session.user.id,
          },
        });
      } catch (logErr) {
        log.error({ err: logErr }, "Failed to log Sentry activity (non-blocking)");
      }

      // Log event
      await prisma.eventLog.create({
        data: {
          eventType: "DISPUTE_MAILED",
          actorId: session.user.id,
          actorEmail: session.user.email || undefined,
          targetType: "DISPUTE",
          targetId: disputeId,
          eventData: JSON.stringify({
            provider: "DOCUPOST",
            letterId: docuPostResult.letterId,
            cra,
            round: dispute.round,
            itemCount: dispute.items.length,
          }),
          organizationId: session.user.organizationId,
        },
      });

      return NextResponse.json({
        success: true,
        letterId: docuPostResult.letterId,
        provider: "DOCUPOST",
        mailProvider: "DOCUPOST",
        fcraDeadline: fcraDeadline.toISOString(),
      });
    }

    // =========================================================================
    // Lob Provider Path (existing logic)
    // =========================================================================

    // Verify address if requested
    if (verifyAddressFirst) {
      const verification = await verifyAddress({
        addressLine1: clientAddress,
        city: clientCity,
        state: clientState,
        zip: clientZip,
      });

      if (!verification.valid) {
        return NextResponse.json(
          {
            error: "Client address could not be verified",
            deliverability: verification.deliverability,
            suggestedAddress: {
              addressLine1: verification.primaryLine,
              city: verification.city,
              state: verification.state,
              zip: verification.zip,
            },
          },
          { status: 400 }
        );
      }
    }

    // Generate the PDF
    const craAddress = CRA_ADDRESSES[cra] || CRA_ADDRESSES.EQUIFAX;

    const letterData: DisputeLetterData = {
      clientName,
      clientAddress,
      clientCity,
      clientState,
      clientZip,
      clientSSNLast4: client.ssnLast4 || undefined,
      clientDOB: client.dateOfBirth
        ? format(new Date(client.dateOfBirth), "MM/dd/yyyy")
        : undefined,

      craName: craAddress.name,
      craAddress: craAddress.address,
      craCity: craAddress.city,
      craState: craAddress.state,
      craZip: craAddress.zip,

      letterDate: new Date(),
      subject: `Dispute of Inaccurate Information - ${cra}`,
      letterBody: dispute.letterContent || "",
      accountsDisputed: dispute.items.map((item) => ({
        creditorName: item.accountItem?.creditorName || "Unknown Creditor",
        accountNumber: item.accountItem?.maskedAccountId || "N/A",
        reason: item.disputeReason || "Inaccurate information",
      })),

      disputeId: dispute.id,
      referenceNumber: dispute.referenceNumber || undefined,
    };

    const pdfBytes = await generateDisputeLetterPDF(letterData, {
      includeAccountTable: true,
      includeSignatureLine: true,
      includeFooter: true,
    });

    // Send via Lob
    const result = await sendDisputeLetter({
      letterPdf: Buffer.from(pdfBytes),
      cra: cra as CRAType,
      clientName,
      clientAddress,
      clientCity,
      clientState,
      clientZip,
      description: `Dispute Letter - ${clientName} - ${cra}`,
      color,
      doubleSided,
      mailType,
      extraService,
      sendDate: scheduledDate ? new Date(scheduledDate) : undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send letter" },
        { status: 500 }
      );
    }

    // Update dispute with mailing info
    const lobSentDate = new Date();
    await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: "SENT",
        mailedLetterId: result.letterId,
        mailedAt: lobSentDate,
        sentDate: lobSentDate,
      },
    });

    // Lock disputed account items
    for (const item of dispute.items) {
      await prisma.accountItem.update({
        where: { id: item.accountItemId },
        data: { isLockedInDispute: true, lockedByDisputeId: disputeId, lockedAt: lobSentDate },
      });
    }

    // Create FCRA 30-day deadline reminder
    const lobFcraDeadline = addDays(lobSentDate, 30);
    try {
      await prisma.reminder.create({
        data: {
          clientId: dispute.clientId,
          disputeId,
          reminderType: "FCRA_DEADLINE",
          title: `FCRA Deadline: ${cra} dispute`,
          description: `30-day FCRA response deadline for ${cra} R${dispute.round} dispute (${dispute.items.length} items)`,
          scheduledFor: lobFcraDeadline,
        },
      });
    } catch (reminderErr) {
      log.error({ err: reminderErr }, "Failed to create FCRA deadline reminder (non-blocking)");
    }

    // Sentry Mode: Log activity
    try {
      await prisma.sentryActivityLog.create({
        data: {
          organizationId: session.user.organizationId,
          clientId: dispute.clientId,
          activityType: "LETTER_MAILED",
          summary: `${cra} R${dispute.round} dispute letter mailed via Lob (${dispute.items.length} items)`,
          triggeredBy: session.user.id,
        },
      });
    } catch (logErr) {
      log.error({ err: logErr }, "Failed to log Sentry activity (non-blocking)");
    }

    // Log event
    await prisma.eventLog.create({
      data: {
        eventType: "DISPUTE_MAILED",
        actorId: session.user.id,
        actorEmail: session.user.email || undefined,
        targetType: "DISPUTE",
        targetId: disputeId,
        eventData: JSON.stringify({
          provider: "LOB",
          letterId: result.letterId,
          cra,
          round: dispute.round,
          itemCount: dispute.items.length,
        }),
        organizationId: session.user.organizationId,
      },
    });

    // Calculate costs for response
    const pricing = getLetterPricing({
      pages: Math.ceil(pdfBytes.length / 50000), // Rough estimate
      color,
      extraService,
      mailType,
    });

    return NextResponse.json({
      success: true,
      letterId: result.letterId,
      expectedDeliveryDate: result.expectedDeliveryDate,
      trackingUrl: result.trackingUrl,
      testMode: result.testMode,
      pricing,
      provider: "LOB",
      mailProvider: "LOB",
    });
  } catch (error) {
    log.error({ err: error }, "Error sending mail");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send mail" },
      { status: 500 }
    );
  }
}

// DELETE /api/disputes/[id]/mail - Cancel scheduled mail
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: disputeId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dispute = await prisma.dispute.findFirst({
      where: {
        id: disputeId,
        organizationId: session.user.organizationId,
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    if (!dispute.mailedLetterId) {
      return NextResponse.json(
        { error: "This dispute has not been mailed" },
        { status: 400 }
      );
    }

    // Try to cancel with Lob
    const result = await cancelLetter(dispute.mailedLetterId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to cancel letter" },
        { status: 500 }
      );
    }

    if (!result.cancelled) {
      return NextResponse.json(
        { error: "Letter has already been processed and cannot be cancelled" },
        { status: 400 }
      );
    }

    // Update dispute
    await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: "APPROVED",
        mailedLetterId: null,
        mailedAt: null,
        sentDate: null,
      },
    });

    return NextResponse.json({
      success: true,
      cancelled: true,
      message: "Letter has been cancelled",
    });
  } catch (error) {
    log.error({ err: error }, "Error cancelling mail");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel mail" },
      { status: 500 }
    );
  }
}
