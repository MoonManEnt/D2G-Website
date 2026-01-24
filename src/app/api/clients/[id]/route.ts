import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

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

    const client = await prisma.client.findFirst({
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
              { accountStatus: { in: ["COLLECTION", "CHARGED_OFF"] } },
            ],
          },
          orderBy: { confidenceScore: "asc" },
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
    });

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

    // Calculate summary stats
    const summary = {
      totalReports: client._count.reports,
      totalAccounts: client._count.accounts,
      totalDisputes: client._count.disputes,
      negativeItems: client.accounts.length,
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

    return NextResponse.json({
      client: transformedClient,
      summary,
    });
  } catch (error) {
    console.error("Error fetching client:", error);
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

    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email || null,
        phone: body.phone || null,
        addressLine1: body.addressLine1 || null,
        addressLine2: body.addressLine2 || null,
        city: body.city || null,
        state: body.state || null,
        zipCode: body.zipCode || null,
        ssnLast4: body.ssnLast4 || null,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        notes: body.notes || null,
      },
    });

    return NextResponse.json(updatedClient);
  } catch (error) {
    console.error("Error updating client:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update client" },
      { status: 500 }
    );
  }
}

// DELETE /api/clients/[id] - Archive client for 90 days (soft delete with snapshot)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: clientId } = await params;

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

    // Create a snapshot of the client's dispute state for AMELIA to use on return
    const disputeSnapshot = {
      snapshotDate: new Date().toISOString(),
      lastDisputes: existingClient.disputes.map(d => ({
        id: d.id,
        cra: d.cra,
        flow: d.flow,
        round: d.round,
        status: d.status,
        createdAt: d.createdAt,
        responseOutcome: d.responseOutcome,
        items: d.items.map(item => ({
          creditorName: item.accountItem.creditorName,
          cra: item.accountItem.cra,
          disputeReason: item.disputeReason,
          outcome: item.outcome,
          suggestedFlow: item.suggestedFlow,
        }))
      })),
      pendingAccounts: existingClient.accounts.map(a => ({
        id: a.id,
        creditorName: a.creditorName,
        cra: a.cra,
        issueCount: a.issueCount,
        suggestedFlow: a.suggestedFlow,
        detectedIssues: a.detectedIssues,
      })),
      summary: {
        totalDisputes: existingClient._count.disputes,
        totalReports: existingClient._count.reports,
        pendingDisputableAccounts: existingClient.accounts.length,
        lastActiveDate: existingClient.disputes[0]?.createdAt || existingClient.createdAt,
      },
      // AMELIA recommendation data
      ameliaContext: {
        recommendedAction: existingClient.disputes.length === 0
          ? "START_FRESH"
          : existingClient.disputes.some(d => d.status === "SENT" || d.status === "RESPONDED")
            ? "CONTINUE_EXISTING"
            : "REVIEW_OUTCOMES",
        lastFlow: existingClient.disputes[0]?.flow || null,
        lastRound: existingClient.disputes[0]?.round || 0,
        unresolvedCras: [...new Set(existingClient.accounts.map(a => a.cra))],
      }
    };

    // Archive the client (soft delete with snapshot)
    await prisma.client.update({
      where: { id: clientId },
      data: {
        isActive: false,
        archivedAt: new Date(),
        archiveReason: "manual_archive",
        lastDisputeSnapshot: JSON.stringify(disputeSnapshot),
      },
    });

    // Log event
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
          counts: {
            reports: existingClient._count.reports,
            disputes: existingClient._count.disputes,
            accounts: existingClient._count.accounts,
          },
          ameliaRecommendation: disputeSnapshot.ameliaContext.recommendedAction,
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
        totalDisputes: existingClient._count.disputes,
        totalReports: existingClient._count.reports,
        ameliaRecommendation: disputeSnapshot.ameliaContext.recommendedAction,
      }
    });
  } catch (error) {
    console.error("Error archiving client:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to archive client" },
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
    console.error("Error restoring client:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to restore client" },
      { status: 500 }
    );
  }
}
