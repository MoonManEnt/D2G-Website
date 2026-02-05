import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ArchiveService } from "@/lib/archive";
import { createLogger } from "@/lib/logger";
const log = createLogger("archived-clients-api");

export const dynamic = "force-dynamic";

/**
 * GET /api/clients/archived - List archived clients
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - search: Search by name/email
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const search = searchParams.get("search") || undefined;

    const result = await ArchiveService.getArchivedClients(
      session.user.organizationId,
      { page, limit, search }
    );

    return NextResponse.json(result);
  } catch (error) {
    log.error({ err: error }, "Error fetching archived clients");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch archived clients" },
      { status: 500 }
    );
  }
}
