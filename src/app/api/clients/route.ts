import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { withAuth } from "@/lib/api-middleware";
import { encryptPIIFields, decryptPIIFields } from "@/lib/encryption";
import { parsePaginationParams, buildPaginatedResponse } from "@/lib/pagination";

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
  priority: z.enum(["URGENT", "HIGH", "STANDARD", "LOW"]).optional(),
  segment: z.enum(["NEW", "RETURNING", "VIP", "STANDARD"]).optional(),
});

type CreateClientBody = z.infer<typeof createClientSchema>;

export const GET = withAuth(async (req, { organizationId }) => {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const priority = searchParams.get("priority");
  const stage = searchParams.get("stage");
  const segment = searchParams.get("segment");

  // Build where clause
  const where: Record<string, unknown> = {
    organizationId,
    isActive: true,
    archivedAt: null,
  };

  // Search filter
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  // Priority filter
  if (priority && priority !== "all") {
    where.priority = priority;
  }

  // Stage filter
  if (stage && stage !== "all") {
    where.stage = stage;
  }

  // Segment filter
  if (segment && segment !== "all") {
    where.segment = segment;
  }

  // Parse pagination params (supports ?page=1&limit=20)
  const pagination = parsePaginationParams(searchParams);

  // Get total count for pagination metadata
  const total = await prisma.client.count({ where });

  // Fetch clients with extended data for Command Center
  const clients = await prisma.client.findMany({
    where,
    skip: pagination.skip,
    take: pagination.limit,
    include: {
      _count: {
        select: {
          reports: true,
          disputes: true,
        },
      },
      disputes: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          round: true,
          cra: true,
          status: true,
          createdAt: true,
          sentDate: true,
          items: {
            select: {
              outcome: true,
            },
          },
        },
      },
    },
    orderBy: [
      { priority: "asc" }, // URGENT first
      { lastActivityAt: "desc" },
      { createdAt: "desc" },
    ],
  });

  // Calculate derived metrics for each client
  const enrichedClients = clients.map((client) => {
    // Calculate success rate from dispute outcomes
    const allOutcomes = client.disputes.flatMap((d) => d.items.map((i) => i.outcome));
    const successfulOutcomes = allOutcomes.filter((o) => o === "DELETED" || o === "UPDATED");
    const resolvedOutcomes = allOutcomes.filter((o) => o !== null && o !== "PENDING");
    const successRate = resolvedOutcomes.length > 0
      ? Math.round((successfulOutcomes.length / resolvedOutcomes.length) * 100)
      : null;

    // Get active bureaus (bureaus with active disputes)
    const activeBureaus = [...new Set(
      client.disputes
        .filter((d) => ["DRAFT", "PENDING_REVIEW", "APPROVED", "SENT"].includes(d.status))
        .map((d) => {
          if (d.cra === "TRANSUNION") return "TU";
          if (d.cra === "EQUIFAX") return "EQ";
          if (d.cra === "EXPERIAN") return "EX";
          return d.cra;
        })
    )];

    // Get current round (max round from active disputes)
    const activeDisputes = client.disputes.filter(
      (d) => !["RESOLVED", "CLOSED"].includes(d.status)
    );
    const currentRound = activeDisputes.length > 0
      ? Math.max(...activeDisputes.map((d) => d.round))
      : 0;

    // Determine stage from disputes
    let derivedStage = client.stage;
    if (!derivedStage || derivedStage === "INTAKE") {
      if (client._count.disputes === 0) {
        derivedStage = "INTAKE";
      } else if (currentRound > 0) {
        derivedStage = `ROUND_${Math.min(currentRound, 4)}`;
      }
    }

    // Calculate last activity
    const lastActivity = client.lastActivityAt ||
      (client.disputes[0]?.sentDate || client.disputes[0]?.createdAt) ||
      client.updatedAt;

    // Count disputes by status
    const activeDisputeCount = client.disputes.filter(
      (d) => ["DRAFT", "PENDING_REVIEW", "APPROVED", "SENT", "RESPONDED"].includes(d.status)
    ).length;

    const { disputes, ...clientWithoutDisputes } = client;

    return {
      ...clientWithoutDisputes,
      successRate,
      activeBureaus,
      currentRound,
      derivedStage,
      lastActivity,
      activeDisputeCount,
      totalDisputes: client._count.disputes,
      latestDisputeStatus: client.disputes[0]?.status || null,
    };
  });

  // Decrypt PII fields before returning
  const decryptedClients = enrichedClients.map((client) =>
    decryptPIIFields(client as Record<string, unknown>)
  );

  // Return paginated response (backwards-compatible: data array + pagination metadata)
  return NextResponse.json(buildPaginatedResponse(decryptedClients, total, pagination));
});

// Get aggregate stats for Command Center header
export const HEAD = withAuth(async (req, { organizationId }) => {
  const [
    totalClients,
    urgentClients,
    activeDisputes,
    needsActionCount,
    newThisWeek,
  ] = await Promise.all([
    prisma.client.count({
      where: { organizationId, isActive: true, archivedAt: null },
    }),
    prisma.client.count({
      where: { organizationId, isActive: true, archivedAt: null, priority: "URGENT" },
    }),
    prisma.dispute.count({
      where: {
        organizationId,
        status: { in: ["DRAFT", "PENDING_REVIEW", "APPROVED", "SENT"] },
      },
    }),
    prisma.dispute.count({
      where: {
        organizationId,
        status: { in: ["PENDING_REVIEW", "RESPONDED"] },
      },
    }),
    prisma.client.count({
      where: {
        organizationId,
        isActive: true,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  // Calculate average success rate (only for active clients)
  const disputes = await prisma.dispute.findMany({
    where: {
      organizationId,
      client: { isActive: true, archivedAt: null },
    },
    include: {
      items: {
        select: { outcome: true },
      },
    },
  });

  const allOutcomes = disputes.flatMap((d) => d.items.map((i) => i.outcome));
  const successfulOutcomes = allOutcomes.filter((o) => o === "DELETED" || o === "UPDATED");
  const resolvedOutcomes = allOutcomes.filter((o) => o !== null && o !== "PENDING");
  const avgSuccessRate = resolvedOutcomes.length > 0
    ? Math.round((successfulOutcomes.length / resolvedOutcomes.length) * 100)
    : 0;

  // Return stats as headers
  const response = new NextResponse(null, { status: 200 });
  response.headers.set("X-Total-Clients", totalClients.toString());
  response.headers.set("X-Urgent-Clients", urgentClients.toString());
  response.headers.set("X-Active-Disputes", activeDisputes.toString());
  response.headers.set("X-Needs-Action", needsActionCount.toString());
  response.headers.set("X-New-This-Week", newThisWeek.toString());
  response.headers.set("X-Avg-Success-Rate", avgSuccessRate.toString());

  return response;
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

  // Encrypt PII fields before storing
  const encryptedPII = encryptPIIFields({
    ssnLast4: body.ssnLast4,
    phone: body.phone,
    addressLine1: body.addressLine1,
    addressLine2: body.addressLine2,
    dateOfBirth: body.dateOfBirth,
  });

  const client = await prisma.client.create({
    data: {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email || null,
      phone: (encryptedPII.phone as string) || null,
      addressLine1: (encryptedPII.addressLine1 as string) || null,
      addressLine2: (encryptedPII.addressLine2 as string) || null,
      city: body.city || null,
      state: body.state || null,
      zipCode: body.zipCode || null,
      ssnLast4: (encryptedPII.ssnLast4 as string) || null,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      notes: body.notes || null,
      organizationId,
      priority: body.priority || "STANDARD",
      segment: body.segment || "NEW",
      stage: "INTAKE",
      lastActivityAt: new Date(),
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
