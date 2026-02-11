import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { withAuth, SUBSCRIPTION_LIMITS } from "@/lib/api-middleware";
import { SubscriptionTier } from "@/types";
import { encryptPIIFields, decryptPIIFields } from "@/lib/encryption";
import { parsePaginationParams, buildPaginatedResponse } from "@/lib/pagination";
import { cacheGet, cacheSet, cacheGetOrSet, cacheDelPrefix } from "@/lib/redis";

export const dynamic = "force-dynamic";

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
  ssnLast4: z.string().length(4).optional().or(z.literal("")),
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
  const page = searchParams.get("page") || "1";
  const limit = searchParams.get("limit") || "20";

  // Check cache (skip for search queries - too many permutations)
  if (!search) {
    const cacheKey = `clients:list:${organizationId}:${priority || ""}:${stage || ""}:${segment || ""}:${page}:${limit}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return NextResponse.json(JSON.parse(cached));
    }
  }

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
        take: 10,
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
      // Include latest credit report for scores
      reports: {
        orderBy: { reportDate: "desc" },
        take: 2, // Get latest 2 to calculate score changes
        select: {
          id: true,
          reportDate: true,
          sourceType: true,
          creditScoresExtracted: true, // JSON: {TU: {score, model, date}, EQ: {...}, EX: {...}}
          accounts: {
            select: {
              id: true,
              accountStatus: true,
              accountType: true,
              balance: true,
              creditLimit: true,
              pastDue: true,
            },
          },
        },
      },
      // Fallback: include credit scores from CreditScore table (for older parsed reports)
      creditScores: {
        orderBy: { scoreDate: "desc" },
        take: 6, // Max 3 bureaus × 2 reports
        select: {
          cra: true,
          score: true,
          scoreDate: true,
          reportId: true,
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

    // Count deleted items
    const deletedItems = allOutcomes.filter((o) => o === "DELETED").length;

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

    // Extract credit scores from latest reports
    const latestReport = client.reports[0];
    const previousReport = client.reports[1];

    // Parse bureau scores from creditScoresExtracted JSON field
    // Format: {TU: {score, model, date}, EQ: {...}, EX: {...}} or {TRANSUNION: score, ...}
    type BureauScoresType = { TRANSUNION?: number | null; EXPERIAN?: number | null; EQUIFAX?: number | null } | null;

    const parseScores = (scoresField: string | null): BureauScoresType => {
      if (!scoresField) return null;
      try {
        const parsed = typeof scoresField === 'string' ? JSON.parse(scoresField) : scoresField;
        // Handle format: {TU: {score: 650}, EQ: {score: 640}, EX: {score: 660}}
        // Or format: {TRANSUNION: 650, EQUIFAX: 640, EXPERIAN: 660}
        return {
          TRANSUNION: parsed.TU?.score ?? parsed.TRANSUNION ?? parsed.TransUnion ?? null,
          EXPERIAN: parsed.EX?.score ?? parsed.EXPERIAN ?? parsed.Experian ?? null,
          EQUIFAX: parsed.EQ?.score ?? parsed.EQUIFAX ?? parsed.Equifax ?? null,
        };
      } catch {
        return null;
      }
    };

    // Build scores from creditScoresExtracted on reports
    let latestScores = parseScores(latestReport?.creditScoresExtracted as string | null);
    let previousScores = parseScores(previousReport?.creditScoresExtracted as string | null);

    // Fallback: If creditScoresExtracted is null, use CreditScore table
    if (!latestScores && client.creditScores && client.creditScores.length > 0) {
      const scoresByReport: Record<string, BureauScoresType> = {};

      for (const cs of client.creditScores) {
        const reportKey = cs.reportId || "no-report";
        if (!scoresByReport[reportKey]) {
          scoresByReport[reportKey] = { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null };
        }
        if (cs.cra === "TRANSUNION") scoresByReport[reportKey]!.TRANSUNION = cs.score;
        else if (cs.cra === "EXPERIAN") scoresByReport[reportKey]!.EXPERIAN = cs.score;
        else if (cs.cra === "EQUIFAX") scoresByReport[reportKey]!.EQUIFAX = cs.score;
      }

      // Get scores from latest and previous reports
      const reportIds = Object.keys(scoresByReport);
      if (reportIds.length > 0) {
        // Match to report IDs if possible, otherwise use first entries
        if (latestReport && scoresByReport[latestReport.id]) {
          latestScores = scoresByReport[latestReport.id];
        } else {
          latestScores = scoresByReport[reportIds[0]];
        }
        if (previousReport && scoresByReport[previousReport.id]) {
          previousScores = scoresByReport[previousReport.id];
        } else if (reportIds.length > 1) {
          previousScores = scoresByReport[reportIds[1]];
        }
      }
    }

    // Count negative accounts from latest report (based on status or past due amount)
    const negativeStatuses = ["COLLECTION", "CHARGEOFF", "CHARGED_OFF", "LATE", "DELINQUENT", "REPOSSESSION", "FORECLOSURE", "BANKRUPTCY"];
    const negativeAccounts = latestReport?.accounts
      ? latestReport.accounts.filter((a) =>
          negativeStatuses.some(status => a.accountStatus?.toUpperCase().includes(status)) ||
          (a.pastDue && a.pastDue > 0)
        ).length
      : 0;

    // Calculate credit utilization from accounts
    let utilization: number | null = null;
    if (latestReport?.accounts) {
      const creditAccounts = latestReport.accounts.filter(
        (a) => a.creditLimit && a.creditLimit > 0 && a.balance !== null
      );
      if (creditAccounts.length > 0) {
        const totalBalance = creditAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
        const totalLimit = creditAccounts.reduce((sum, a) => sum + (a.creditLimit || 0), 0);
        utilization = totalLimit > 0 ? Math.round((totalBalance / totalLimit) * 100) : null;
      }
    }

    const { disputes, reports, creditScores, ...clientWithoutRelations } = client;

    return {
      ...clientWithoutRelations,
      successRate,
      deletedItems,
      activeBureaus,
      currentRound,
      derivedStage,
      lastActivity,
      activeDisputeCount,
      totalDisputes: client._count.disputes,
      latestDisputeStatus: client.disputes[0]?.status || null,
      // Credit report data for dashboard
      latestScores,
      previousScores,
      negativeAccounts,
      utilization,
      hasReports: client._count.reports > 0,
    };
  });

  // Decrypt PII fields before returning
  const decryptedClients = enrichedClients.map((client) =>
    decryptPIIFields(client as Record<string, unknown>)
  );

  // Return paginated response (backwards-compatible: data array + pagination metadata)
  const response = buildPaginatedResponse(decryptedClients, total, pagination);

  // Cache for 30s (skip for search queries)
  if (!search) {
    const cacheKey = `clients:list:${organizationId}:${priority || ""}:${stage || ""}:${segment || ""}:${page}:${limit}`;
    await cacheSet(cacheKey, JSON.stringify(response), 30);
  }

  return NextResponse.json(response);
});

// Get aggregate stats for Command Center header
export const HEAD = withAuth(async (req, { organizationId }) => {
  // Use cacheGetOrSet with thundering herd protection — only one instance
  // fetches from DB on cache miss, others wait for the same result
  const statsCacheKey = `clients:stats:${organizationId}`;
  const statsJson = await cacheGetOrSet(statsCacheKey, async () => {
    const [
      totalClients,
      urgentClients,
      activeDisputes,
      needsActionCount,
      newThisWeek,
      successCount,
      resolvedCount,
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
      // Success rate: count successful outcomes (DELETED/UPDATED)
      prisma.disputeItem.count({
        where: {
          dispute: {
            organizationId,
            client: { isActive: true, archivedAt: null },
          },
          outcome: { in: ["DELETED", "UPDATED"] },
        },
      }),
      // Success rate: count all resolved outcomes (not null, not PENDING)
      prisma.disputeItem.count({
        where: {
          dispute: {
            organizationId,
            client: { isActive: true, archivedAt: null },
          },
          outcome: { notIn: ["PENDING"] },
          NOT: { outcome: null },
        },
      }),
    ]);

    const avgSuccessRate = resolvedCount > 0
      ? Math.round((successCount / resolvedCount) * 100)
      : 0;

    return JSON.stringify({
      totalClients: totalClients.toString(),
      urgentClients: urgentClients.toString(),
      activeDisputes: activeDisputes.toString(),
      needsActionCount: needsActionCount.toString(),
      newThisWeek: newThisWeek.toString(),
      avgSuccessRate: avgSuccessRate.toString(),
    });
  }, 60);

  const stats = JSON.parse(statsJson);
  const response = new NextResponse(null, { status: 200 });
  response.headers.set("X-Total-Clients", stats.totalClients);
  response.headers.set("X-Urgent-Clients", stats.urgentClients);
  response.headers.set("X-Active-Disputes", stats.activeDisputes);
  response.headers.set("X-Needs-Action", stats.needsActionCount);
  response.headers.set("X-New-This-Week", stats.newThisWeek);
  response.headers.set("X-Avg-Success-Rate", stats.avgSuccessRate);

  return response;
});

export const POST = withAuth<CreateClientBody>(async (req, { session, body, organizationId }) => {
  // Check subscription client limits
  const tier = session.user.subscriptionTier as SubscriptionTier || "FREE";
  const limits = SUBSCRIPTION_LIMITS[tier] || SUBSCRIPTION_LIMITS[SubscriptionTier.FREE];
  const clientLimit = limits.clients.total;

  if (clientLimit !== -1) {
    const clientCount = await prisma.client.count({
      where: { organizationId, isActive: true },
    });
    if (clientCount >= clientLimit) {
      return NextResponse.json(
        {
          message: `You've reached your plan's limit of ${clientLimit} active clients. Archive existing clients or upgrade your plan.`,
          upgradeRequired: true,
          currentCount: clientCount,
          limit: clientLimit,
        },
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

  // Invalidate caches
  await cacheDelPrefix(`clients:list:${organizationId}`);
  await cacheDelPrefix(`clients:stats:${organizationId}`);

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
