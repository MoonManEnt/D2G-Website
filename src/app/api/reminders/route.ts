import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createReminderSchema = z.object({
  clientId: z.string().uuid(),
  disputeId: z.string().uuid().optional(),
  reminderType: z.enum([
    "FOLLOW_UP",
    "DEADLINE",
    "DOCUMENT_REQUEST",
    "RESPONSE_DUE",
    "SCORE_CHECK",
    "CUSTOM",
  ]),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  scheduledFor: z.string().datetime(),
  repeatInterval: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]).optional(),
});

// GET /api/reminders - List reminders
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get("clientId");
    const status = searchParams.get("status");
    const upcoming = searchParams.get("upcoming") === "true";

    const where: Record<string, unknown> = {
      client: {
        organizationId: session.user.organizationId,
      },
    };

    if (clientId) {
      where.clientId = clientId;
    }

    if (status) {
      where.status = status;
    }

    if (upcoming) {
      where.scheduledFor = {
        gte: new Date(),
      };
      where.status = "PENDING";
    }

    const reminders = await prisma.reminder.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        dispute: {
          select: {
            id: true,
            cra: true,
            status: true,
          },
        },
      },
      orderBy: { scheduledFor: "asc" },
      take: 100,
    });

    // Group by status for stats
    const stats = {
      pending: reminders.filter((r) => r.status === "PENDING").length,
      completed: reminders.filter((r) => r.status === "COMPLETED").length,
      snoozed: reminders.filter((r) => r.status === "SNOOZED").length,
      overdue: reminders.filter(
        (r) => r.status === "PENDING" && new Date(r.scheduledFor) < new Date()
      ).length,
    };

    return NextResponse.json({
      reminders: reminders.map((r) => ({
        ...r,
        scheduledFor: r.scheduledFor.toISOString(),
        completedAt: r.completedAt?.toISOString(),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
      stats,
    });
  } catch (error) {
    console.error("Failed to fetch reminders:", error);
    return NextResponse.json(
      { error: "Failed to fetch reminders" },
      { status: 500 }
    );
  }
}

// POST /api/reminders - Create a reminder
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createReminderSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { clientId, disputeId, reminderType, title, description, scheduledFor, repeatInterval } =
      validation.data;

    // Verify client belongs to organization
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // If disputeId provided, verify it belongs to the client
    if (disputeId) {
      const dispute = await prisma.dispute.findFirst({
        where: {
          id: disputeId,
          clientId,
        },
      });

      if (!dispute) {
        return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
      }
    }

    const reminder = await prisma.reminder.create({
      data: {
        clientId,
        disputeId,
        reminderType,
        title,
        description,
        scheduledFor: new Date(scheduledFor),
        repeatInterval: repeatInterval || "NONE",
        status: "PENDING",
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        dispute: {
          select: {
            id: true,
            cra: true,
          },
        },
      },
    });

    return NextResponse.json({
      reminder: {
        ...reminder,
        scheduledFor: reminder.scheduledFor.toISOString(),
        createdAt: reminder.createdAt.toISOString(),
        updatedAt: reminder.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to create reminder:", error);
    return NextResponse.json(
      { error: "Failed to create reminder" },
      { status: 500 }
    );
  }
}
