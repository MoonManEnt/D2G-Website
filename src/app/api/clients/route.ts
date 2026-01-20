import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

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

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const clients = await prisma.client.findMany({
      where: {
        organizationId: session.user.organizationId,
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
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Check subscription
    if (session.user.subscriptionTier === "FREE") {
      // Check client count for free tier
      const clientCount = await prisma.client.count({
        where: { organizationId: session.user.organizationId, isActive: true },
      });
      if (clientCount >= 1) {
        return NextResponse.json(
          { message: "Free plan limited to 1 client. Upgrade to Pro for unlimited clients." },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const validatedData = createClientSchema.parse(body);

    const client = await prisma.client.create({
      data: {
        ...validatedData,
        email: validatedData.email || null,
        dateOfBirth: validatedData.dateOfBirth ? new Date(validatedData.dateOfBirth) : null,
        organizationId: session.user.organizationId,
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
        organizationId: session.user.organizationId,
        eventData: JSON.stringify({ clientName: `${client.firstName} ${client.lastName}` }),
      },
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating client:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
