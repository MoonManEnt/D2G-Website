import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { withAuth } from "@/lib/api-middleware";

const createClientSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  ssnLast4: z.string().length(4).optional(),
  dateOfBirth: z.string().optional(),
  notes: z.string().optional(),
});

type CreateClientBody = z.infer<typeof createClientSchema>;

export const GET = withAuth(async (req, { organizationId }) => {
  const clients = await prisma.client.findMany({
    where: {
      organizationId,
      isActive: true,
    },
    include: {
      _count: {
        select: {
          reports: true,
          disputes: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(clients);
});

export const POST = withAuth<CreateClientBody>(async (req, { session, body, organizationId }) => {
  // Check subscription
  if (session.user.subscriptionTier === "FREE") {
    // Check client count for free tier
    const clientCount = await prisma.client.count({
      where: { organizationId, isActive: true },
    });
    if (clientCount >= 1) {
      return NextResponse.json(
        { message: "Free plan limited to 1 client. Upgrade to Pro for unlimited clients." },
        { status: 403 }
      );
    }
  }

  const client = await prisma.client.create({
    data: {
      ...body,
      email: body.email || null,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      organizationId,
    },
  });

  // Log event
  await prisma.eventLog.create({
    data: {
      eventType: "CLIENT_CREATED",
      actorId: session.user.id,
      actorEmail: session.user.email,
      targetType: "Client",
      targetId: client.id,
      organizationId,
      eventData: JSON.stringify({ clientName: `${client.firstName} ${client.lastName}` }),
    },
  });

  return NextResponse.json(client, { status: 201 });
}, { schema: createClientSchema });
