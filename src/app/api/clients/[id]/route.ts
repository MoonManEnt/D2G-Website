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
              { isDisputable: true },
              { issueCount: { gt: 0 } },
            ],
          },
          orderBy: { issueCount: "desc" },
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

// DELETE /api/clients/[id] - Soft delete client
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
    });

    if (!existingClient) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Soft delete
    await prisma.client.update({
      where: { id: clientId },
      data: { isActive: false },
    });

    // Log event
    await prisma.eventLog.create({
      data: {
        eventType: "CLIENT_DELETED",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "Client",
        targetId: clientId,
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting client:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete client" },
      { status: 500 }
    );
  }
}
