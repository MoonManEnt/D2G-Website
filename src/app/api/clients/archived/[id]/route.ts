import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ArchiveService } from "@/lib/archive";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/clients/archived/[id] - Get full archive snapshot
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: clientId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const snapshot = await ArchiveService.getArchiveSnapshot(
      clientId,
      session.user.organizationId
    );

    if (!snapshot) {
      return NextResponse.json(
        { error: "Archive snapshot not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("Error fetching archive snapshot:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch archive" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients/archived/[id] - Restore archived client
 *
 * Body: { action: "restore" }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: clientId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    if (body.action !== "restore") {
      return NextResponse.json(
        { error: "Invalid action. Use { action: 'restore' }" },
        { status: 400 }
      );
    }

    const result = await ArchiveService.restoreClient(
      clientId,
      session.user.organizationId
    );

    return NextResponse.json({
      success: result.success,
      message: "Client restored successfully",
      ameliaContext: result.ameliaContext,
    });
  } catch (error) {
    console.error("Error restoring client:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to restore client" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clients/archived/[id] - Permanently delete archived client
 *
 * Query params:
 * - confirm: Must be "true" to confirm deletion
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: clientId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check for admin role
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only admins can permanently delete archived clients" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const confirm = searchParams.get("confirm");

    if (confirm !== "true") {
      return NextResponse.json(
        {
          error: "Confirmation required",
          hint: "Add ?confirm=true to permanently delete this client",
        },
        { status: 400 }
      );
    }

    const result = await ArchiveService.permanentlyDeleteArchivedClient(
      clientId,
      session.user.organizationId
    );

    return NextResponse.json({
      success: result.success,
      message: "Client permanently deleted",
      deletedCounts: result.deletedCounts,
    });
  } catch (error) {
    console.error("Error permanently deleting client:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete client" },
      { status: 500 }
    );
  }
}
