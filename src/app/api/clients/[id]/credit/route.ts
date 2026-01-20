import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  getCreditScores,
  getCreditScoreTrends,
  getCreditAlerts,
  getCreditReportSummary,
  refreshCreditData,
  enrollClient,
  isCreditMonitoringAvailable,
} from "@/lib/credit-monitoring";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/clients/[id]/credit - Get credit monitoring data for a client
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: clientId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dataType = searchParams.get("type") || "summary"; // summary, scores, trends, alerts

    // Fetch client
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Check for credit monitoring enrollment ID
    const enrollmentId = client.creditMonitoringId;
    if (!enrollmentId) {
      return NextResponse.json({
        enrolled: false,
        message: "Client is not enrolled in credit monitoring",
        available: isCreditMonitoringAvailable(),
      });
    }

    // Get requested data
    let data: Record<string, unknown> = { enrolled: true };

    switch (dataType) {
      case "scores": {
        const result = await getCreditScores(enrollmentId);
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        data.scores = result.scores;
        break;
      }

      case "trends": {
        const months = parseInt(searchParams.get("months") || "12");
        const result = await getCreditScoreTrends(enrollmentId, months);
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        data.trends = result.trends;
        break;
      }

      case "alerts": {
        const limit = searchParams.get("limit")
          ? parseInt(searchParams.get("limit")!)
          : undefined;
        const since = searchParams.get("since")
          ? new Date(searchParams.get("since")!)
          : undefined;
        const result = await getCreditAlerts(enrollmentId, { limit, since });
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        data.alerts = result.alerts;
        break;
      }

      case "summary":
      default: {
        const [summaryResult, scoresResult, alertsResult] = await Promise.all([
          getCreditReportSummary(enrollmentId),
          getCreditScores(enrollmentId),
          getCreditAlerts(enrollmentId, { limit: 5 }),
        ]);

        data = {
          enrolled: true,
          summary: summaryResult.success ? summaryResult.summary : null,
          scores: scoresResult.success ? scoresResult.scores : [],
          recentAlerts: alertsResult.success ? alertsResult.alerts : [],
        };
        break;
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching credit data:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch credit data" },
      { status: 500 }
    );
  }
}

// POST /api/clients/[id]/credit - Enroll client in credit monitoring or refresh data
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: clientId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body; // "enroll" or "refresh"

    // Fetch client
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (action === "refresh") {
      // Refresh credit data
      const enrollmentId = client.creditMonitoringId;
      if (!enrollmentId) {
        return NextResponse.json(
          { error: "Client is not enrolled in credit monitoring" },
          { status: 400 }
        );
      }

      const result = await refreshCreditData(enrollmentId);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        refreshId: result.refreshId,
        message: "Credit data refresh initiated",
      });
    }

    // Default action: enroll
    if (client.creditMonitoringId) {
      return NextResponse.json(
        { error: "Client is already enrolled in credit monitoring" },
        { status: 400 }
      );
    }

    // Check if we have all required info
    if (!client.firstName || !client.lastName || !client.email) {
      return NextResponse.json(
        { error: "Client must have first name, last name, and email to enroll" },
        { status: 400 }
      );
    }

    if (!client.addressLine1 || !client.city || !client.state || !client.zipCode) {
      return NextResponse.json(
        { error: "Client must have a complete address to enroll" },
        { status: 400 }
      );
    }

    // Enroll client
    const result = await enrollClient({
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone || undefined,
      ssn: body.ssn, // SSN passed separately for security
      dateOfBirth: client.dateOfBirth
        ? client.dateOfBirth.toISOString().split("T")[0]
        : undefined,
      address: {
        line1: client.addressLine1,
        line2: client.addressLine2 || undefined,
        city: client.city,
        state: client.state,
        zip: client.zipCode,
      },
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // If verification is required, return the questions
    if (result.verificationRequired) {
      // Store temporary enrollment ID for verification
      await prisma.client.update({
        where: { id: clientId },
        data: {
          creditMonitoringId: result.enrollmentId,
          creditMonitoringStatus: "PENDING_VERIFICATION",
        },
      });

      return NextResponse.json({
        success: true,
        status: "verification_required",
        enrollmentId: result.enrollmentId,
        verificationQuestions: result.verificationQuestions,
      });
    }

    // Enrollment successful
    await prisma.client.update({
      where: { id: clientId },
      data: {
        creditMonitoringId: result.enrollmentId,
        creditMonitoringStatus: "ACTIVE",
      },
    });

    return NextResponse.json({
      success: true,
      status: result.status,
      enrollmentId: result.enrollmentId,
    });
  } catch (error) {
    console.error("Error with credit monitoring:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process request" },
      { status: 500 }
    );
  }
}
