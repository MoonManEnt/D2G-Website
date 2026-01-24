/**
 * Archive Service
 *
 * Handles comprehensive client data archival for 90-day retention,
 * including snapshot creation, retrieval, restoration, and cleanup.
 */

import prisma from "@/lib/prisma";
import {
  ComprehensiveArchiveSnapshot,
  ClientProfileSnapshot,
  CreditDNASnapshot,
  CreditScoreSnapshot,
  DisputeSnapshot,
  DisputeResponseSnapshot,
  RoundHistorySnapshot,
  CommunicationSnapshot,
  AccountSnapshot,
  EvidenceRefSnapshot,
  DocumentSnapshot,
  EventLogSnapshot,
  AmeliaReengagementContext,
  ArchivedClientListItem,
  PaginatedResult,
  ArchiveStats,
  DetectedIssue,
} from "./types";
import { generateAmeliaContext } from "./amelia-integration";

const RETENTION_DAYS = 90;

export class ArchiveService {
  /**
   * Create a comprehensive snapshot of all client data before archiving.
   */
  static async createComprehensiveSnapshot(
    clientId: string,
    organizationId: string,
    reason: string
  ): Promise<ComprehensiveArchiveSnapshot> {
    // Fetch all client data in parallel
    const [
      client,
      creditDNA,
      creditScores,
      disputes,
      disputeResponses,
      roundHistory,
      communications,
      accounts,
      evidences,
      documents,
      eventLogs,
    ] = await Promise.all([
      // Client profile
      prisma.client.findUnique({
        where: { id: clientId },
      }),
      // Credit DNA
      prisma.creditDNA.findFirst({
        where: { clientId },
        orderBy: { analyzedAt: "desc" },
      }),
      // Credit scores
      prisma.creditScore.findMany({
        where: { clientId },
        orderBy: { scoreDate: "desc" },
      }),
      // Disputes with items
      prisma.dispute.findMany({
        where: { clientId },
        include: {
          items: {
            include: {
              accountItem: {
                select: {
                  id: true,
                  creditorName: true,
                  maskedAccountId: true,
                  accountType: true,
                  balance: true,
                  cra: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      // Dispute responses
      prisma.disputeResponse.findMany({
        where: { disputeItem: { dispute: { clientId } } },
        orderBy: { responseDate: "desc" },
      }),
      // Round history
      prisma.disputeRoundHistory.findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
      }),
      // Communications
      prisma.communication.findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
      }),
      // Accounts with issues
      prisma.accountItem.findMany({
        where: { clientId },
        include: {
          evidences: {
            select: { id: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      // Evidence
      prisma.evidence.findMany({
        where: { accountItem: { clientId } },
        include: {
          renderedFile: {
            select: { id: true, filename: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      // Client documents
      prisma.clientDocument.findMany({
        where: { clientId },
        include: {
          file: {
            select: {
              id: true,
              filename: true,
              mimeType: true,
              sizeBytes: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      // Event logs for this client
      prisma.eventLog.findMany({
        where: {
          organizationId,
          targetType: "Client",
          targetId: clientId,
        },
        orderBy: { createdAt: "desc" },
        take: 500, // Limit to last 500 events
      }),
    ]);

    if (!client) {
      throw new Error("Client not found");
    }

    // Transform data into snapshot format
    const clientProfile: ClientProfileSnapshot = {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone,
      addressLine1: client.addressLine1,
      addressLine2: client.addressLine2,
      city: client.city,
      state: client.state,
      zipCode: client.zipCode,
      ssnLast4: client.ssnLast4,
      dateOfBirth: client.dateOfBirth?.toISOString() || null,
      notes: client.notes,
      priority: client.priority,
      segment: client.segment,
      stage: client.stage,
      currentRound: client.currentRound,
      successRate: client.successRate,
      totalDisputesSent: client.totalDisputesSent,
      totalItemsDeleted: client.totalItemsDeleted,
      activeBureaus: JSON.parse(client.activeBureaus || "[]"),
      createdAt: client.createdAt.toISOString(),
      lastActivityAt: client.lastActivityAt?.toISOString() || null,
    };

    const creditDNASnapshot: CreditDNASnapshot | null = creditDNA
      ? {
          id: creditDNA.id,
          classification: creditDNA.classification,
          subClassifications: JSON.parse(creditDNA.subClassifications || "[]"),
          confidence: creditDNA.confidence,
          confidenceLevel: creditDNA.confidenceLevel,
          healthScore: creditDNA.healthScore,
          improvementPotential: creditDNA.improvementPotential,
          urgencyScore: creditDNA.urgencyScore,
          fileThickness: JSON.parse(creditDNA.fileThickness || "{}"),
          derogatoryProfile: JSON.parse(creditDNA.derogatoryProfile || "{}"),
          utilization: JSON.parse(creditDNA.utilization || "{}"),
          bureauDivergence: JSON.parse(creditDNA.bureauDivergence || "{}"),
          inquiryAnalysis: JSON.parse(creditDNA.inquiryAnalysis || "{}"),
          positiveFactors: JSON.parse(creditDNA.positiveFactors || "{}"),
          disputeReadiness: JSON.parse(creditDNA.disputeReadiness || "{}"),
          summary: creditDNA.summary,
          keyInsights: JSON.parse(creditDNA.keyInsights || "[]"),
          immediateActions: JSON.parse(creditDNA.immediateActions || "[]"),
          analyzedAt: creditDNA.analyzedAt.toISOString(),
        }
      : null;

    const creditScoresSnapshot: CreditScoreSnapshot[] = creditScores.map((s) => ({
      id: s.id,
      cra: s.cra,
      scoreType: s.scoreType,
      score: s.score,
      scoreDate: s.scoreDate.toISOString(),
      source: s.source,
      factorsPositive: s.factorsPositive ? JSON.parse(s.factorsPositive) : null,
      factorsNegative: s.factorsNegative ? JSON.parse(s.factorsNegative) : null,
      createdAt: s.createdAt.toISOString(),
    }));

    const disputesSnapshot: DisputeSnapshot[] = disputes.map((d) => ({
      id: d.id,
      cra: d.cra,
      flow: d.flow,
      round: d.round,
      status: d.status,
      letterContent: d.letterContent,
      aiStrategy: d.aiStrategy ? JSON.parse(d.aiStrategy) : null,
      sentDate: d.sentDate?.toISOString() || null,
      respondedAt: d.respondedAt?.toISOString() || null,
      resolvedAt: d.resolvedAt?.toISOString() || null,
      responseOutcome: d.responseOutcome,
      responseNotes: d.responseNotes,
      createdAt: d.createdAt.toISOString(),
      items: d.items.map((item) => ({
        id: item.id,
        disputeReason: item.disputeReason,
        outcome: item.outcome,
        suggestedFlow: item.suggestedFlow,
        accountItem: {
          id: item.accountItem.id,
          creditorName: item.accountItem.creditorName,
          maskedAccountId: item.accountItem.maskedAccountId,
          accountType: item.accountItem.accountType,
          balance: item.accountItem.balance ? Number(item.accountItem.balance) : null,
          cra: item.accountItem.cra,
        },
      })),
    }));

    const responsesSnapshot: DisputeResponseSnapshot[] = disputeResponses.map((r) => ({
      id: r.id,
      disputeItemId: r.disputeItemId,
      disputeId: r.disputeId,
      outcome: r.outcome,
      responseDate: r.responseDate.toISOString(),
      responseMethod: r.responseMethod,
      stallTactic: r.stallTactic,
      stallDetails: r.stallDetails,
      updateType: r.updateType,
      previousValue: r.previousValue,
      newValue: r.newValue,
      verificationMethod: r.verificationMethod,
      furnisherResponse: r.furnisherResponse,
      notes: r.notes,
      daysToRespond: r.daysToRespond,
      fcraDeadlineDate: r.fcraDeadlineDate?.toISOString() || null,
      wasLate: r.wasLate,
      createdAt: r.createdAt.toISOString(),
    }));

    const roundHistorySnapshot: RoundHistorySnapshot[] = roundHistory.map((rh) => ({
      id: rh.id,
      disputeId: rh.disputeId,
      round: rh.round,
      flow: rh.flow,
      cra: rh.cra,
      letterSentDate: rh.letterSentDate?.toISOString() || null,
      letterContent: rh.letterContent,
      letterHash: rh.letterHash,
      responseReceivedDate: rh.responseReceivedDate?.toISOString() || null,
      overallOutcome: rh.overallOutcome,
      itemOutcomes: JSON.parse(rh.itemOutcomes || "{}"),
      nextRoundContext: JSON.parse(rh.nextRoundContext || "{}"),
      itemsDisputed: rh.itemsDisputed,
      itemsDeleted: rh.itemsDeleted,
      itemsVerified: rh.itemsVerified,
      itemsUpdated: rh.itemsUpdated,
      itemsNoResponse: rh.itemsNoResponse,
      itemsStalled: rh.itemsStalled,
      createdAt: rh.createdAt.toISOString(),
    }));

    const communicationsSnapshot: CommunicationSnapshot[] = communications.map((c) => ({
      id: c.id,
      type: c.type,
      direction: c.direction,
      subject: c.subject,
      content: c.content,
      status: c.status,
      sentAt: c.sentAt?.toISOString() || null,
      deliveredAt: c.deliveredAt?.toISOString() || null,
      readAt: c.readAt?.toISOString() || null,
      provider: c.provider,
      disputeId: c.disputeId,
      documentId: c.documentId,
      createdAt: c.createdAt.toISOString(),
    }));

    const accountsSnapshot: AccountSnapshot[] = accounts.map((a) => ({
      id: a.id,
      creditorName: a.creditorName,
      maskedAccountId: a.maskedAccountId,
      accountType: a.accountType,
      accountStatus: a.accountStatus,
      balance: a.balance ? Number(a.balance) : null,
      pastDue: a.pastDue ? Number(a.pastDue) : null,
      creditLimit: a.creditLimit ? Number(a.creditLimit) : null,
      dateOpened: a.dateOpened?.toISOString() || null,
      dateReported: a.dateReported?.toISOString() || null,
      paymentStatus: a.paymentStatus,
      cra: a.cra,
      isDisputable: a.isDisputable,
      issueCount: a.issueCount,
      detectedIssues: a.detectedIssues
        ? (JSON.parse(a.detectedIssues) as DetectedIssue[])
        : [],
      suggestedFlow: a.suggestedFlow,
      confidenceScore: a.confidenceScore,
      confidenceLevel: a.confidenceLevel,
      evidenceIds: a.evidences.map((e) => e.id),
      createdAt: a.createdAt.toISOString(),
    }));

    const evidenceSnapshot: EvidenceRefSnapshot[] = evidences.map((e) => ({
      id: e.id,
      evidenceType: e.evidenceType,
      title: e.title,
      description: e.description,
      sourcePageNum: e.sourcePageNum,
      sourceDocumentId: e.sourceFileId,
      accountItemId: e.accountItemId,
      renderedFileId: e.renderedFile?.id || null,
      renderedFilename: e.renderedFile?.filename || null,
      createdAt: e.createdAt.toISOString(),
    }));

    const documentsSnapshot: DocumentSnapshot[] = documents.map((d) => ({
      id: d.id,
      documentType: d.category,
      title: d.title,
      description: d.description,
      filename: d.file.filename,
      mimeType: d.file.mimeType,
      sizeBytes: d.file.sizeBytes,
      uploadedAt: d.createdAt.toISOString(),
    }));

    const eventLogsSnapshot: EventLogSnapshot[] = eventLogs.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      actorId: e.actorId,
      actorEmail: e.actorEmail,
      targetType: e.targetType,
      targetId: e.targetId,
      eventData: e.eventData ? JSON.parse(e.eventData) : null,
      createdAt: e.createdAt.toISOString(),
    }));

    // Generate AMELIA context
    const ameliaContext = generateAmeliaContext(
      disputesSnapshot,
      responsesSnapshot,
      creditDNASnapshot,
      accountsSnapshot
    );

    // Build complete snapshot
    const snapshot: ComprehensiveArchiveSnapshot = {
      version: "1.0.0",
      snapshotDate: new Date().toISOString(),
      archiveReason: reason,
      clientProfile,
      creditDNA: creditDNASnapshot,
      creditScores: creditScoresSnapshot,
      disputes: disputesSnapshot,
      disputeResponses: responsesSnapshot,
      roundHistory: roundHistorySnapshot,
      communications: communicationsSnapshot,
      accounts: accountsSnapshot,
      evidenceRefs: evidenceSnapshot,
      documents: documentsSnapshot,
      eventLogs: eventLogsSnapshot,
      ameliaContext,
      metadata: {
        snapshotSizeBytes: 0, // Will be calculated after serialization
        recordCounts: {
          disputes: disputesSnapshot.length,
          responses: responsesSnapshot.length,
          communications: communicationsSnapshot.length,
          accounts: accountsSnapshot.length,
          evidences: evidenceSnapshot.length,
          documents: documentsSnapshot.length,
          eventLogs: eventLogsSnapshot.length,
          creditScores: creditScoresSnapshot.length,
        },
      },
    };

    return snapshot;
  }

  /**
   * Save archive snapshot to database and update client.
   */
  static async saveArchiveSnapshot(
    clientId: string,
    organizationId: string,
    snapshot: ComprehensiveArchiveSnapshot
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + RETENTION_DAYS);

    // Serialize all JSON fields
    const serializedSnapshot = {
      clientProfile: JSON.stringify(snapshot.clientProfile),
      creditDNA: JSON.stringify(snapshot.creditDNA),
      creditScores: JSON.stringify(snapshot.creditScores),
      disputes: JSON.stringify(snapshot.disputes),
      disputeResponses: JSON.stringify(snapshot.disputeResponses),
      roundHistory: JSON.stringify(snapshot.roundHistory),
      communications: JSON.stringify(snapshot.communications),
      accounts: JSON.stringify(snapshot.accounts),
      evidenceRefs: JSON.stringify(snapshot.evidenceRefs),
      documents: JSON.stringify(snapshot.documents),
      eventLogs: JSON.stringify(snapshot.eventLogs),
      ameliaContext: JSON.stringify(snapshot.ameliaContext),
    };

    // Calculate size
    const totalSize = Object.values(serializedSnapshot).reduce(
      (sum, str) => sum + new TextEncoder().encode(str).length,
      0
    );

    // Upsert snapshot (in case client was previously archived)
    await prisma.clientArchiveSnapshot.upsert({
      where: { clientId },
      create: {
        clientId,
        organizationId,
        snapshotVersion: snapshot.version,
        snapshotDate: new Date(snapshot.snapshotDate),
        archiveReason: snapshot.archiveReason,
        ...serializedSnapshot,
        snapshotSizeBytes: totalSize,
        expiresAt,
      },
      update: {
        snapshotVersion: snapshot.version,
        snapshotDate: new Date(snapshot.snapshotDate),
        archiveReason: snapshot.archiveReason,
        ...serializedSnapshot,
        snapshotSizeBytes: totalSize,
        expiresAt,
      },
    });

    // Update client archive status
    await prisma.client.update({
      where: { id: clientId },
      data: {
        isActive: false,
        archivedAt: new Date(),
        archiveReason: snapshot.archiveReason,
        lastDisputeSnapshot: JSON.stringify(snapshot.ameliaContext),
      },
    });
  }

  /**
   * Get paginated list of archived clients.
   */
  static async getArchivedClients(
    organizationId: string,
    options: { page: number; limit: number; search?: string }
  ): Promise<PaginatedResult<ArchivedClientListItem>> {
    const { page, limit, search } = options;
    const skip = (page - 1) * limit;

    const where = {
      organizationId,
      archivedAt: { not: null },
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: "insensitive" as const } },
          { lastName: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        include: {
          archiveSnapshot: {
            select: {
              snapshotSizeBytes: true,
              expiresAt: true,
              ameliaContext: true,
            },
          },
          _count: {
            select: {
              disputes: true,
              accounts: true,
              communications: true,
            },
          },
        },
        orderBy: { archivedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.client.count({ where }),
    ]);

    const now = new Date();
    const items: ArchivedClientListItem[] = clients.map((client) => {
      const expiresAt = client.archiveSnapshot?.expiresAt || new Date();
      const daysRemaining = Math.max(
        0,
        Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );

      let ameliaContext: AmeliaReengagementContext | null = null;
      try {
        if (client.archiveSnapshot?.ameliaContext) {
          ameliaContext = JSON.parse(client.archiveSnapshot.ameliaContext);
        }
      } catch {
        // Ignore parse errors
      }

      return {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        archiveReason: client.archiveReason || "manual",
        archivedAt: client.archivedAt?.toISOString() || "",
        expiresAt: expiresAt.toISOString(),
        daysRemaining,
        snapshotSizeBytes: client.archiveSnapshot?.snapshotSizeBytes || 0,
        recordCounts: {
          disputes: client._count.disputes,
          accounts: client._count.accounts,
          communications: client._count.communications,
        },
        ameliaRecommendation: ameliaContext?.recommendedAction || "START_FRESH",
      };
    });

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get full archive snapshot for a client.
   */
  static async getArchiveSnapshot(
    clientId: string,
    organizationId: string
  ): Promise<ComprehensiveArchiveSnapshot | null> {
    const snapshot = await prisma.clientArchiveSnapshot.findFirst({
      where: {
        clientId,
        organizationId,
      },
    });

    if (!snapshot) {
      return null;
    }

    return {
      version: snapshot.snapshotVersion,
      snapshotDate: snapshot.snapshotDate.toISOString(),
      archiveReason: snapshot.archiveReason,
      clientProfile: JSON.parse(snapshot.clientProfile),
      creditDNA: JSON.parse(snapshot.creditDNA),
      creditScores: JSON.parse(snapshot.creditScores),
      disputes: JSON.parse(snapshot.disputes),
      disputeResponses: JSON.parse(snapshot.disputeResponses),
      roundHistory: JSON.parse(snapshot.roundHistory),
      communications: JSON.parse(snapshot.communications),
      accounts: JSON.parse(snapshot.accounts),
      evidenceRefs: JSON.parse(snapshot.evidenceRefs),
      documents: JSON.parse(snapshot.documents),
      eventLogs: JSON.parse(snapshot.eventLogs),
      ameliaContext: JSON.parse(snapshot.ameliaContext),
      metadata: {
        snapshotSizeBytes: snapshot.snapshotSizeBytes,
        recordCounts: {
          disputes: JSON.parse(snapshot.disputes).length,
          responses: JSON.parse(snapshot.disputeResponses).length,
          communications: JSON.parse(snapshot.communications).length,
          accounts: JSON.parse(snapshot.accounts).length,
          evidences: JSON.parse(snapshot.evidenceRefs).length,
          documents: JSON.parse(snapshot.documents).length,
          eventLogs: JSON.parse(snapshot.eventLogs).length,
          creditScores: JSON.parse(snapshot.creditScores).length,
        },
      },
    };
  }

  /**
   * Restore an archived client to active status.
   */
  static async restoreClient(
    clientId: string,
    organizationId: string
  ): Promise<{ success: boolean; ameliaContext: AmeliaReengagementContext | null }> {
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId,
        archivedAt: { not: null },
      },
      include: {
        archiveSnapshot: true,
      },
    });

    if (!client) {
      throw new Error("Archived client not found");
    }

    let ameliaContext: AmeliaReengagementContext | null = null;
    if (client.archiveSnapshot?.ameliaContext) {
      try {
        ameliaContext = JSON.parse(client.archiveSnapshot.ameliaContext);
      } catch {
        // Ignore parse errors
      }
    }

    // Restore client to active
    await prisma.client.update({
      where: { id: clientId },
      data: {
        isActive: true,
        archivedAt: null,
        archiveReason: null,
        // Keep lastDisputeSnapshot for AMELIA reference
      },
    });

    // Log restoration event
    await prisma.eventLog.create({
      data: {
        eventType: "CLIENT_RESTORED",
        targetType: "Client",
        targetId: clientId,
        eventData: JSON.stringify({
          clientName: `${client.firstName} ${client.lastName}`,
          ameliaRecommendation: ameliaContext?.recommendedAction,
          wasArchivedFor: client.archiveReason,
        }),
        organizationId,
      },
    });

    return { success: true, ameliaContext };
  }

  /**
   * Get archive statistics for organization.
   */
  static async getArchiveStats(organizationId: string): Promise<ArchiveStats> {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      totalArchived,
      expiringIn7Days,
      expiringIn30Days,
      storageAgg,
      oldest,
      newest,
    ] = await Promise.all([
      prisma.client.count({
        where: { organizationId, archivedAt: { not: null } },
      }),
      prisma.clientArchiveSnapshot.count({
        where: {
          organizationId,
          expiresAt: { lte: in7Days, gt: now },
        },
      }),
      prisma.clientArchiveSnapshot.count({
        where: {
          organizationId,
          expiresAt: { lte: in30Days, gt: now },
        },
      }),
      prisma.clientArchiveSnapshot.aggregate({
        where: { organizationId },
        _sum: { snapshotSizeBytes: true },
      }),
      prisma.clientArchiveSnapshot.findFirst({
        where: { organizationId },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      prisma.clientArchiveSnapshot.findFirst({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    return {
      totalArchived,
      expiringIn7Days,
      expiringIn30Days,
      totalStorageBytes: storageAgg._sum.snapshotSizeBytes || 0,
      oldestArchive: oldest?.createdAt.toISOString() || null,
      newestArchive: newest?.createdAt.toISOString() || null,
    };
  }

  /**
   * Clean up expired archives (for cron job).
   */
  static async cleanupExpiredArchives(
    organizationId?: string
  ): Promise<{ deletedCount: number; deletedClients: string[] }> {
    const now = new Date();

    const where = {
      expiresAt: { lte: now },
      ...(organizationId && { organizationId }),
    };

    // Find expired snapshots
    const expiredSnapshots = await prisma.clientArchiveSnapshot.findMany({
      where,
      select: { clientId: true, organizationId: true },
    });

    if (expiredSnapshots.length === 0) {
      return { deletedCount: 0, deletedClients: [] };
    }

    const deletedClients: string[] = [];

    // Delete each client permanently
    for (const snapshot of expiredSnapshots) {
      try {
        // Use the permanent delete logic (cascading deletes)
        await ArchiveService.permanentlyDeleteArchivedClient(
          snapshot.clientId,
          snapshot.organizationId
        );
        deletedClients.push(snapshot.clientId);
      } catch (error) {
        console.error(`Failed to delete client ${snapshot.clientId}:`, error);
      }
    }

    return { deletedCount: deletedClients.length, deletedClients };
  }

  /**
   * Permanently delete an archived client and all their data.
   */
  static async permanentlyDeleteArchivedClient(
    clientId: string,
    organizationId: string
  ): Promise<{ success: boolean; deletedCounts: Record<string, number> }> {
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId,
      },
      include: {
        _count: {
          select: {
            reports: true,
            disputes: true,
            accounts: true,
            communications: true,
          },
        },
      },
    });

    if (!client) {
      throw new Error("Client not found");
    }

    const counts = {
      reports: client._count.reports,
      disputes: client._count.disputes,
      accounts: client._count.accounts,
      communications: client._count.communications,
    };

    // Delete in order to handle foreign key constraints
    // 1. Delete dispute items
    await prisma.disputeItem.deleteMany({
      where: { dispute: { clientId } },
    });

    // 2. Delete dispute responses
    await prisma.disputeResponse.deleteMany({
      where: { disputeItem: { dispute: { clientId } } },
    });

    // 3. Delete dispute round history
    await prisma.disputeRoundHistory.deleteMany({
      where: { clientId },
    });

    // 4. Delete disputes
    await prisma.dispute.deleteMany({
      where: { clientId },
    });

    // 5. Delete evidence
    await prisma.evidence.deleteMany({
      where: { accountItem: { clientId } },
    });

    // 6. Delete account items
    await prisma.accountItem.deleteMany({
      where: { clientId },
    });

    // 7. Get report IDs for file cleanup
    const reports = await prisma.creditReport.findMany({
      where: { clientId },
      select: { id: true, originalFileId: true },
    });
    const reportIds = reports.map((r) => r.id);
    const fileIds = reports.map((r) => r.originalFileId).filter(Boolean) as string[];

    // 8. Delete diff results
    if (reportIds.length > 0) {
      await prisma.diffResult.deleteMany({
        where: {
          OR: [
            { newReportId: { in: reportIds } },
            { priorReportId: { in: reportIds } },
          ],
        },
      });
    }

    // 9. Delete credit reports
    await prisma.creditReport.deleteMany({
      where: { clientId },
    });

    // 10. Delete stored files
    if (fileIds.length > 0) {
      await prisma.storedFile.deleteMany({
        where: { id: { in: fileIds } },
      });
    }

    // 11. Delete client documents
    await prisma.clientDocument.deleteMany({
      where: { clientId },
    });

    // 12. Delete credit DNA
    await prisma.creditDNA.deleteMany({
      where: { clientId },
    });

    // 13. Delete credit scores
    await prisma.creditScore.deleteMany({
      where: { clientId },
    });

    // 14. Delete communications
    await prisma.communication.deleteMany({
      where: { clientId },
    });

    // 15. Delete AMELIA content hashes
    await prisma.ameliaContentHash.deleteMany({
      where: { clientId },
    });

    // 16. Delete archive snapshot
    await prisma.clientArchiveSnapshot.deleteMany({
      where: { clientId },
    });

    // 17. Delete portal access
    await prisma.clientPortalAccess.deleteMany({
      where: { clientId },
    });

    // 18. Delete reminders
    await prisma.reminder.deleteMany({
      where: { clientId },
    });

    // 19. Finally delete the client
    await prisma.client.delete({
      where: { id: clientId },
    });

    // Log permanent deletion
    await prisma.eventLog.create({
      data: {
        eventType: "CLIENT_PERMANENTLY_DELETED",
        targetType: "Client",
        targetId: clientId,
        eventData: JSON.stringify({
          clientName: `${client.firstName} ${client.lastName}`,
          deletedCounts: counts,
          wasArchived: !!client.archivedAt,
        }),
        organizationId,
      },
    });

    return { success: true, deletedCounts: counts };
  }
}
