/**
 * DOCUMENT SEND API
 *
 * POST /api/clients/[id]/litigation-cases/[caseId]/documents/[docId]/send
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { SubscriptionTier } from "@/types";
import { sendLitigationLetter, isMailServiceAvailable } from "@/lib/mail";
import { LITIGATION_EVENT_TYPES } from "@/lib/litigation-engine/types";
import { z } from "zod";

export const dynamic = "force-dynamic";

const sendDocSchema = z.object({
  method: z.enum(["MAIL", "EMAIL", "MANUAL"]),
  recipientType: z.enum(["DEFENDANT", "COURT", "AGENCY"]).optional(),
  recipientName: z.string().optional(),
  recipientAddress: z.object({
    name: z.string(),
    address_line1: z.string(),
    address_city: z.string(),
    address_state: z.string(),
    address_zip: z.string(),
  }).optional(),
  extraService: z.enum(["certified", "certified_return_receipt", "registered"]).optional(),
});

export const POST = withAuth<z.infer<typeof sendDocSchema>>(async (req, ctx) => {
  try {
    const { docId } = ctx.params;
    const { method, recipientAddress, extraService } = ctx.body;

    const document = await prisma.litigationDocument.findUnique({
      where: { id: docId },
      include: {
        case: {
          select: {
            organizationId: true,
            caseNumber: true,
            client: {
              select: {
                firstName: true, lastName: true,
                addressLine1: true, city: true, state: true, zipCode: true,
              },
            },
          },
        },
      },
    });

    if (!document || document.case.organizationId !== ctx.organizationId) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (method === "MAIL") {
      if (!isMailServiceAvailable()) {
        return NextResponse.json(
          { error: "Physical mail service is not configured" },
          { status: 400 },
        );
      }

      if (!recipientAddress) {
        return NextResponse.json(
          { error: "recipientAddress is required for MAIL delivery" },
          { status: 400 },
        );
      }

      const client = document.case.client;

      // For now, send the content as a text-based letter
      // In production, you'd generate a PDF first
      const result = await sendLitigationLetter({
        letterPdf: document.content, // URL or Buffer in production
        to: {
          name: recipientAddress.name,
          address_line1: recipientAddress.address_line1,
          address_city: recipientAddress.address_city,
          address_state: recipientAddress.address_state,
          address_zip: recipientAddress.address_zip,
          address_country: "US",
        },
        clientName: `${client.firstName} ${client.lastName}`,
        clientAddress: client.addressLine1 || "",
        clientCity: client.city || "",
        clientState: client.state || "",
        clientZip: client.zipCode || "",
        description: `${document.documentType} — Case ${document.case.caseNumber}`,
        extraService: extraService || "certified",
      });

      if (result.success) {
        // Update document status
        await prisma.litigationDocument.update({
          where: { id: docId },
          data: { approvalStatus: "SENT" },
        });

        // Update linked action if exists
        if (document.actionId) {
          await prisma.litigationAction.update({
            where: { id: document.actionId },
            data: {
              status: "SENT",
              deliveryMethod: "MAIL",
              deliveryId: result.letterId,
              deliveredAt: new Date(),
            },
          });
        }

        // Log event
        await prisma.eventLog.create({
          data: {
            eventType: LITIGATION_EVENT_TYPES.DOCUMENT_SENT,
            actorId: ctx.userId,
            actorEmail: ctx.session.user?.email,
            targetType: "LitigationDocument",
            targetId: docId,
            eventData: JSON.stringify({
              caseId: document.caseId,
              documentType: document.documentType,
              method: "MAIL",
              letterId: result.letterId,
              recipient: recipientAddress.name,
            }),
            organizationId: ctx.organizationId,
          },
        });

        return NextResponse.json({
          success: true,
          letterId: result.letterId,
          expectedDeliveryDate: result.expectedDeliveryDate,
          trackingUrl: result.trackingUrl,
        });
      }

      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // For MANUAL or EMAIL — just update status
    await prisma.litigationDocument.update({
      where: { id: docId },
      data: { approvalStatus: "SENT" },
    });

    if (document.actionId) {
      await prisma.litigationAction.update({
        where: { id: document.actionId },
        data: {
          status: "SENT",
          deliveryMethod: method,
          deliveredAt: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true, method });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send document" },
      { status: 500 },
    );
  }
}, { minTier: SubscriptionTier.PROFESSIONAL, schema: sendDocSchema });
