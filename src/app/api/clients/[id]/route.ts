import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ArchiveService } from "@/lib/archive";
import { encryptPIIFields, decryptPIIFields } from "@/lib/encryption";
import { cacheGet, cacheSet, cacheDel, cacheDelPrefix } from "@/lib/redis";
import { createLogger } from "@/lib/logger";
const log = createLogger("client-detail-api");

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/clients/[id] - Get single client with all related data
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: clientId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = session.user.organizationId;

    // Check cache
    const cacheKey = `clients:detail:${orgId}:${clientId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return NextResponse.json(JSON.parse(cached));
    }

    // Single consolidated query: fetch client with all related data + summary counts in parallel
    const [client, accountSummary] = await Promise.all([
      prisma.client.findFirst({
        where: {
          id: clientId,
          organizationId: session.user.organizationId,
        },
        include: {
          reports: {
            orderBy: { createdAt: "desc" },
            include: {
              originalFile: {
                select: {
                  id: true,
                  filename: true,
                  mimeType: true,
                  sizeBytes: true,
                },
              },
              _count: {
                select: { accounts: true },
              },
            },
          },
          accounts: {
            where: {
              OR: [
                { confidenceLevel: "LOW" },
                { accountStatus: { in: ["COLLECTION", "CHARGED_OFF", "LATE", "DELINQUENT"] } },
                { issueCount: { gt: 0 } },
                { isDisputable: true },
                { pastDue: { gt: 0 } },
              ],
            },
            orderBy: [
              { issueCount: "desc" },
              { confidenceScore: "asc" },
            ],
            include: {
              evidences: {
                select: {
                  id: true,
                  evidenceType: true,
                  title: true,
                  createdAt: true,
                },
              },
            },
          },
          disputes: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
          _count: {
            select: {
              reports: true,
              accounts: true,
              disputes: true,
            },
          },
        },
      }),
      // Fetch lightweight account summary for stats (creditor names + status only)
      prisma.accountItem.findMany({
        where: {
          clientId,
          organizationId: session.user.organizationId,
        },
        select: {
          creditorName: true,
          accountStatus: true,
          detectedIssues: true,
        },
      }),
    ]);

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Transform decimal fields
    const transformedClient = {
      ...client,
      accounts: client.accounts.map((account) => ({
        ...account,
        balance: account.balance ? Number(account.balance) : null,
        pastDue: account.pastDue ? Number(account.pastDue) : null,
        creditLimit: account.creditLimit ? Number(account.creditLimit) : null,
      })),
    };

    // Helper to check if account is truly negative (not just disputable)
    const isTrulyNegative = (account: { accountStatus: string | null; detectedIssues: string | null }) => {
      const status = account.accountStatus?.toUpperCase() || "";
      const isDerogatory = ["DEROGATORY", "CHARGED_OFF", "COLLECTION", "CHARGEOFF"].includes(status);
      const hasLateMarks = account.detectedIssues?.includes("PAYMENT_HISTORY_LATE_MARKS") ||
                          account.detectedIssues?.includes("LATE_PAYMENT_STATUS");
      return isDerogatory || hasLateMarks;
    };

    // Calculate unique creditors from parallel query result
    const uniqueCreditors = new Set(
      accountSummary.map((a) => a.creditorName?.toUpperCase().trim()).filter(Boolean)
    ).size;

    const trulyNegativeCount = accountSummary.filter(isTrulyNegative).length;

    // Calculate summary stats
    const summary = {
      totalReports: client._count.reports,
      totalAccounts: uniqueCreditors,
      totalDisputes: client._count.disputes,
      negativeItems: trulyNegativeCount,
      highSeverityIssues: client.accounts.filter((a) => {
        try {
          const issues = a.detectedIssues ? JSON.parse(a.detectedIssues) : [];
          return issues.some((i: { severity: string }) => i.severity === "HIGH");
        } catch {
          return false;
        }
      }).length,
      totalEvidence: client.accounts.reduce((sum, a) => sum + a.evidences.length, 0),
    };

    // Decrypt PII fields before returning
    const decryptedClient = decryptPIIFields(transformedClient as Record<string, unknown>);

    const responseData = { client: decryptedClient, summary };

    // Cache for 60s
    await cacheSet(cacheKey, JSON.stringify(responseData), 60);

    return NextResponse.json(responseData);
  } catch (error) {
    log.error({ err: error }, "Error fetching client");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch client" },
      { status: 500 }
    );
  }
}

// PATCH /api/clients/[id] - Update client
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: clientId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Verify client belongs to organization
    const existingClient = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingClient) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Encrypt PII fields before storing
    const piiData = encryptPIIFields({
      phone: body.phone || null,
      addressLine1: body.addressLine1 || null,
      addressLine2: body.addressLine2 || null,
      ssnLast4: body.ssnLast4 || null,
      dateOfBirth: body.dateOfBirth || null,
    } as Record<string, unknown>);

    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email || null,
        phone: piiData.phone as string | null,
        addressLine1: piiData.addressLine1 as string | null,
        addressLine2: piiData.addressLine2 as string | null,
        city: body.city || null,
        state: body.state || null,
        zipCode: body.zipCode || null,
        ssnLast4: piiData.ssnLast4 as string | null,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        notes: body.notes || null,
      },
    });

    // Invalidate caches
    await cacheDel(`clients:detail:${session.user.organizationId}:${clientId}`);
    await cacheDelPrefix(`clients:list:${session.user.organizationId}`);

    // Decrypt before returning
    return NextResponse.json(decryptPIIFields(updatedClient as Record<string, unknown>));
  } catch (error) {
    log.error({ err: error }, "Error updating client");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update client" },
      { status: 500 }
    );
  }
}

// DELETE /api/clients/[id] - Delete client (soft or permanent)
// Use ?permanent=true for hard delete, otherwise soft deletes (archives)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: clientId } = await params;
    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get("permanent") === "true";

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify client belongs to organization
    const existingClient = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
      },
      include: {
        disputes: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            items: {
              include: {
                accountItem: {
                  select: {
                    creditorName: true,
                    maskedAccountId: true,
                    cra: true,
                    detectedIssues: true,
                    suggestedFlow: true,
                  }
                }
              }
            }
          }
        },
        accounts: {
          where: { isDisputable: true },
          select: {
            id: true,
            creditorName: true,
            cra: true,
            detectedIssues: true,
            suggestedFlow: true,
            issueCount: true,
          }
        },
        _count: {
          select: {
            reports: true,
            disputes: true,
            accounts: true,
          }
        }
      }
    });

    if (!existingClient) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Invalidate caches for both delete paths
    await cacheDel(`clients:detail:${session.user.organizationId}:${clientId}`);
    await cacheDelPrefix(`clients:list:${session.user.organizationId}`);
    await cacheDelPrefix(`clients:stats:${session.user.organizationId}`);

    // PERMANENT DELETE - removes all client data
    if (permanent) {
      const clientName = `${existingClient.firstName} ${existingClient.lastName}`;
      const counts = {
        reports: existingClient._count.reports,
        disputes: existingClient._count.disputes,
        accounts: existingClient._count.accounts,
      };

      // Delete in order to handle foreign key constraints
      // 1. Delete dispute round history
      await prisma.disputeRoundHistory.deleteMany({
        where: { clientId }
      });

      // 2. Delete documents linked to disputes
      await prisma.document.deleteMany({
        where: { dispute: { clientId } }
      });

      // 3. Delete dispute items
      await prisma.disputeItem.deleteMany({
        where: { dispute: { clientId } }
      });

      // 4. Delete disputes
      await prisma.dispute.deleteMany({
        where: { clientId }
      });

      // 5. Delete pending evidence (references account items)
      await prisma.pendingEvidence.deleteMany({
        where: { accountItem: { clientId } }
      });

      // 6. Delete evidence
      await prisma.evidence.deleteMany({
        where: { accountItem: { clientId } }
      });

      // 7. Delete account items
      await prisma.accountItem.deleteMany({
        where: { clientId }
      });

      // 8. Get report IDs to delete stored files
      const reports = await prisma.creditReport.findMany({
        where: { clientId },
        select: { id: true, originalFileId: true }
      });
      const fileIds = reports.map(r => r.originalFileId).filter(Boolean) as string[];

      // 9. Delete diff results
      const reportIds = reports.map(r => r.id);
      if (reportIds.length > 0) {
        await prisma.diffResult.deleteMany({
          where: {
            OR: [
              { newReportId: { in: reportIds } },
              { priorReportId: { in: reportIds } }
            ]
          }
        });
      }

      // 10. Delete credit reports
      await prisma.creditReport.deleteMany({
        where: { clientId }
      });

      // 11. Delete stored files
      if (fileIds.length > 0) {
        await prisma.storedFile.deleteMany({
          where: { id: { in: fileIds } }
        });
      }

      // 12. Delete client documents
      await prisma.clientDocument.deleteMany({
        where: { clientId }
      });

      // 13. Delete credit DNA
      await prisma.creditDNA.deleteMany({
        where: { clientId }
      });

      // 14. Delete credit scores
      await prisma.creditScore.deleteMany({
        where: { clientId }
      });

      // 15. Delete communications
      await prisma.communication.deleteMany({
        where: { clientId }
      });

      // 16. Delete Amelia content hashes
      await prisma.ameliaContentHash.deleteMany({
        where: { clientId }
      });

      // 17. Delete personal info disputes
      await prisma.personalInfoDispute.deleteMany({
        where: { clientId }
      });

      // 18. Delete client portal access
      await prisma.clientPortalAccess.deleteMany({
        where: { clientId }
      });

      // 19. Delete reminders
      await prisma.reminder.deleteMany({
        where: { clientId }
      });

      // 20. Delete archive snapshots
      await prisma.clientArchiveSnapshot.deleteMany({
        where: { clientId }
      });

      // 21. Finally delete the client
      await prisma.client.delete({
        where: { id: clientId }
      });

      // Log permanent deletion
      await prisma.eventLog.create({
        data: {
          eventType: "CLIENT_PERMANENTLY_DELETED",
          actorId: session.user.id,
          actorEmail: session.user.email,
          targetType: "Client",
          targetId: clientId,
          eventData: JSON.stringify({
            clientName,
            deletedCounts: counts,
          }),
          organizationId: session.user.organizationId,
        },
      });

      return NextResponse.json({
        success: true,
        permanent: true,
        deleted: {
          clientName,
          ...counts,
        }
      });
    }

    // SOFT DELETE (Archive) - default behavior
    // Create comprehensive snapshot of all client data for AMELIA and compliance
    const comprehensiveSnapshot = await ArchiveService.createComprehensiveSnapshot(
      clientId,
      session.user.organizationId,
      "manual_archive"
    );

    // Save the snapshot and update client archive status
    await ArchiveService.saveArchiveSnapshot(
      clientId,
      session.user.organizationId,
      comprehensiveSnapshot
    );

    // Log the archive event
    await prisma.eventLog.create({
      data: {
        eventType: "CLIENT_ARCHIVED",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "Client",
        targetId: clientId,
        eventData: JSON.stringify({
          clientName: `${existingClient.firstName} ${existingClient.lastName}`,
          retentionDays: 90,
          counts: comprehensiveSnapshot.metadata.recordCounts,
          ameliaRecommendation: comprehensiveSnapshot.ameliaContext.recommendedAction,
          snapshotSizeBytes: comprehensiveSnapshot.metadata.snapshotSizeBytes,
        }),
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      archived: true,
      retentionDays: 90,
      willPermanentlyDeleteAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      snapshot: {
        totalDisputes: comprehensiveSnapshot.metadata.recordCounts.disputes,
        totalReports: comprehensiveSnapshot.metadata.recordCounts.creditScores,
        totalCommunications: comprehensiveSnapshot.metadata.recordCounts.communications,
        totalAccounts: comprehensiveSnapshot.metadata.recordCounts.accounts,
        ameliaRecommendation: comprehensiveSnapshot.ameliaContext.recommendedAction,
        ameliaMessage: comprehensiveSnapshot.ameliaContext.personalizedMessage,
      }
    });
  } catch (error) {
    log.error({ err: error }, "Error deleting client");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete client" },
      { status: 500 }
    );
  }
}

// POST /api/clients/[id] - Restore archived client
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: clientId } = await params;
    const body = await request.json();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only handle restore action
    if (body.action !== "restore") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Find archived client
    const archivedClient = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
        archivedAt: { not: null },
      },
    });

    if (!archivedClient) {
      return NextResponse.json({ error: "Archived client not found" }, { status: 404 });
    }

    // Parse the snapshot for AMELIA context
    let ameliaContext = null;
    if (archivedClient.lastDisputeSnapshot) {
      try {
        const snapshot = JSON.parse(archivedClient.lastDisputeSnapshot);
        ameliaContext = snapshot.ameliaContext;
      } catch {
        // Snapshot parsing failed, continue without it
      }
    }

    // Restore the client
    const restoredClient = await prisma.client.update({
      where: { id: clientId },
      data: {
        isActive: true,
        archivedAt: null,
        archiveReason: null,
        // Keep the snapshot for AMELIA to reference
      },
    });

    // Log event
    await prisma.eventLog.create({
      data: {
        eventType: "CLIENT_RESTORED",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "Client",
        targetId: clientId,
        eventData: JSON.stringify({
          clientName: `${restoredClient.firstName} ${restoredClient.lastName}`,
          ameliaRecommendation: ameliaContext?.recommendedAction || "START_FRESH",
        }),
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      client: restoredClient,
      ameliaRecommendation: ameliaContext ? {
        action: ameliaContext.recommendedAction,
        lastFlow: ameliaContext.lastFlow,
        lastRound: ameliaContext.lastRound,
        unresolvedCras: ameliaContext.unresolvedCras,
        message: ameliaContext.recommendedAction === "CONTINUE_EXISTING"
          ? `Welcome back! You have active disputes in progress. AMELIA recommends continuing with your ${ameliaContext.lastFlow} flow at round ${ameliaContext.lastRound}.`
          : ameliaContext.recommendedAction === "REVIEW_OUTCOMES"
            ? "Welcome back! Let's review your previous dispute outcomes and determine the best next steps."
            : "Welcome back! Let's start fresh with a new credit analysis.",
      } : null,
    });
  } catch (error) {
    log.error({ err: error }, "Error restoring client");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to restore client" },
      { status: 500 }
    );
  }
}
