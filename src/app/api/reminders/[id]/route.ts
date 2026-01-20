import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const updateReminderSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  scheduledFor: z.string().datetime().optional(),
  status: z.enum(["PENDING", "COMPLETED", "SNOOZED", "CANCELLED"]).optional(),
  repeatInterval: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]).optional(),
});

// GET /api/reminders/[id] - Get single reminder
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reminder = await prisma.reminder.findFirst({
      where: {
        id: params.id,
        client: {
          organizationId: session.user.organizationId,
        },
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
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
    });

    if (!reminder) {
      return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
    }

    return NextResponse.json({
      reminder: {
        ...reminder,
        scheduledFor: reminder.scheduledFor.toISOString(),
        completedAt: reminder.completedAt?.toISOString(),
        createdAt: reminder.createdAt.toISOString(),
        updatedAt: reminder.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to fetch reminder:", error);
    return NextResponse.json(
      { error: "Failed to fetch reminder" },
      { status: 500 }
    );
  }
}

// PATCH /api/reminders/[id] - Update reminder
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = updateReminderSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.errors },
        { status: 400 }
      );
    }

    // Verify reminder belongs to organization
    const existingReminder = await prisma.reminder.findFirst({
      where: {
        id: params.id,
        client: {
          organizationId: session.user.organizationId,
        },
      },
    });

    if (!existingReminder) {
      return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    const { title, description, scheduledFor, status, repeatInterval } = validation.data;

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (scheduledFor !== undefined) updateData.scheduledFor = new Date(scheduledFor);
    if (repeatInterval !== undefined) updateData.repeatInterval = repeatInterval;
    if (status !== undefined) {
      updateData.status = status;
      if (status === "COMPLETED") {
        updateData.completedAt = new Date();

        // If this is a repeating reminder, create the next one
        if (existingReminder.repeatInterval !== "NONE") {
          const nextDate = new Date(existingReminder.scheduledFor);
          switch (existingReminder.repeatInterval) {
            case "DAILY":
              nextDate.setDate(nextDate.getDate() + 1);
              break;
            case "WEEKLY":
              nextDate.setDate(nextDate.getDate() + 7);
              break;
            case "MONTHLY":
              nextDate.setMonth(nextDate.getMonth() + 1);
              break;
          }

          await prisma.reminder.create({
            data: {
              clientId: existingReminder.clientId,
              disputeId: existingReminder.disputeId,
              reminderType: existingReminder.reminderType,
              title: existingReminder.title,
              description: existingReminder.description,
              scheduledFor: nextDate,
              repeatInterval: existingReminder.repeatInterval,
              status: "PENDING",
            },
          });
        }
      }
    }

    const reminder = await prisma.reminder.update({
      where: { id: params.id },
      data: updateData,
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
        completedAt: reminder.completedAt?.toISOString(),
        createdAt: reminder.createdAt.toISOString(),
        updatedAt: reminder.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to update reminder:", error);
    return NextResponse.json(
      { error: "Failed to update reminder" },
      { status: 500 }
    );
  }
}

// DELETE /api/reminders/[id] - Delete reminder
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify reminder belongs to organization
    const reminder = await prisma.reminder.findFirst({
      where: {
        id: params.id,
        client: {
          organizationId: session.user.organizationId,
        },
      },
    });

    if (!reminder) {
      return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
    }

    await prisma.reminder.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete reminder:", error);
    return NextResponse.json(
      { error: "Failed to delete reminder" },
      { status: 500 }
    );
  }
}
