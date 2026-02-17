import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, type AuthContext } from "@/lib/api-middleware";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Schema for creating/updating a draft
const draftSchema = z.object({
  clientId: z.string().uuid(),
  letterContent: z.string().min(1),
  contentHash: z.string().min(1),
  cra: z.enum(["TRANSUNION", "EXPERIAN", "EQUIFAX"]),
  flow: z.enum(["ACCURACY", "COLLECTION", "CONSENT", "COMBO"]),
  round: z.number().int().min(1).default(1),
  accountIds: z.array(z.string()).default([]),
  ameliaMetadata: z.record(z.unknown()).optional().default({}),
  draftId: z.string().uuid().optional(),
});

type DraftInput = z.infer<typeof draftSchema>;

/**
 * GET /api/disputes/drafts
 * List all drafts for a client or organization
 */
async function handleGet(req: NextRequest, context: AuthContext) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");

  const where: Record<string, unknown> = {
    organizationId: context.organizationId,
    status: "ACTIVE",
    expiresAt: { gt: new Date() },
  };

  if (clientId) {
    where.clientId = clientId;
  }

  const drafts = await prisma.disputeDraft.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return NextResponse.json({ drafts });
}

/**
 * POST /api/disputes/drafts
 * Create or update a draft
 */
async function handlePost(req: NextRequest, context: AuthContext<DraftInput>) {
  const validated = context.body;

  // Calculate expiration date (7 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // If draftId is provided, update; otherwise create new
  // Note: DisputeDraft model requires `npx prisma generate` after migration
  const draftData = {
    letterContent: validated.letterContent,
    contentHash: validated.contentHash,
    accountIds: JSON.stringify(validated.accountIds),
    ameliaMetadata: JSON.stringify(validated.ameliaMetadata || {}),
    expiresAt,
  };

  let draft;
  if (validated.draftId) {
    draft = await prisma.disputeDraft.update({
      where: {
        id: validated.draftId,
        organizationId: context.organizationId,
      },
      data: draftData,
    });
  } else {
    draft = await prisma.disputeDraft.create({
      data: {
        clientId: validated.clientId,
        organizationId: context.organizationId,
        cra: validated.cra,
        flow: validated.flow,
        round: validated.round,
        ...draftData,
      },
    });
  }

  return NextResponse.json({ draft, success: true });
}

/**
 * DELETE /api/disputes/drafts
 * Delete a draft by ID
 */
async function handleDelete(req: NextRequest, context: AuthContext) {
  const { searchParams } = new URL(req.url);
  const draftId = searchParams.get("id");

  if (!draftId) {
    return NextResponse.json(
      { error: "Draft ID required" },
      { status: 400 }
    );
  }

  await prisma.disputeDraft.deleteMany({
    where: {
      id: draftId,
      organizationId: context.organizationId,
    },
  });

  return NextResponse.json({ success: true });
}

// Export wrapped handlers
export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost, { schema: draftSchema });
export const DELETE = withAuth(handleDelete);
