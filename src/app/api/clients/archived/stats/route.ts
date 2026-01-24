import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ArchiveService } from "@/lib/archive";

/**
 * GET /api/clients/archived/stats - Get archive statistics
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stats = await ArchiveService.getArchiveStats(session.user.organizationId);

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching archive stats:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch archive stats" },
      { status: 500 }
    );
  }
}
