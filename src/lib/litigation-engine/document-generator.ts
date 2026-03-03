/**
 * Litigation Document Generator
 *
 * AI-powered legal document generation using the existing LLM orchestrator.
 * Loads case/client/violation data, builds type-specific prompts with legal
 * formatting, calls LLM, and stores as LitigationDocument.
 */

import prisma from "@/lib/prisma";
import { completeLLM } from "@/lib/llm-orchestrator";
import { getDocumentTemplate, buildDocumentPrompt } from "./document-templates";
import {
  LITIGATION_EVENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  type LitigationDocumentType,
  type DocumentGenerationContext,
  type GeneratedDocumentResult,
} from "./types";
import { createLogger } from "@/lib/logger";

const log = createLogger("litigation-document-generator");

// ============================================================================
// Generate Document
// ============================================================================

/**
 * Generate a litigation document for a case.
 * Loads all necessary context, builds prompt, calls LLM, saves result.
 */
export async function generateLitigationDocument(
  caseId: string,
  documentType: LitigationDocumentType,
  organizationId: string,
  targetDefendantId?: string,
  actionId?: string,
  userId?: string,
  userEmail?: string,
): Promise<{ documentId: string; content: string }> {
  // Load case with all related data
  const litCase = await prisma.litigationCase.findUnique({
    where: { id: caseId },
    include: {
      client: true,
      scan: true,
      defendants: true,
    },
  });

  if (!litCase) {
    throw new Error(`Case not found: ${caseId}`);
  }

  // Parse scan data
  const violations = JSON.parse(litCase.scan.violations);
  const caseSummary = JSON.parse(litCase.scan.caseSummary);

  // Get target defendant if specified
  const targetDefendant = targetDefendantId
    ? litCase.defendants.find((d) => d.id === targetDefendantId)
    : litCase.defendants[0]; // Default to first defendant

  // Build defendant address string
  const defendantAddress = targetDefendant
    ? [
        targetDefendant.addressLine1,
        targetDefendant.addressLine2,
        [targetDefendant.city, targetDefendant.state, targetDefendant.zipCode].filter(Boolean).join(", "),
      ]
        .filter(Boolean)
        .join("\n")
    : undefined;

  // Filter violations for target defendant if specified
  const relevantViolations = targetDefendant
    ? violations.filter((v: Record<string, unknown>) => {
        const defs = (v.defendants as string[]) || [];
        return defs.some(
          (d: string) => d.toLowerCase().includes(targetDefendant.name.toLowerCase()),
        );
      })
    : violations;

  // Use all violations if none match specific defendant
  const finalViolations = relevantViolations.length > 0 ? relevantViolations : violations;

  // Build document generation context
  const context: DocumentGenerationContext = {
    caseId,
    documentType,
    targetDefendantId,
    caseNumber: litCase.caseNumber,
    filingState: litCase.filingState,
    courtType: litCase.courtType || undefined,
    courtName: litCase.courtName || undefined,
    courtDistrict: litCase.courtDistrict || undefined,
    clientName: `${litCase.client.firstName} ${litCase.client.lastName}`,
    clientAddress: litCase.client.addressLine1 || "",
    clientCity: litCase.client.city || "",
    clientState: litCase.client.state || "",
    clientZipCode: litCase.client.zipCode || "",
    clientSSNLast4: litCase.client.ssnLast4 || undefined,
    clientDOB: litCase.client.dateOfBirth
      ? litCase.client.dateOfBirth.toISOString().slice(0, 10)
      : undefined,
    defendantName: targetDefendant?.name,
    defendantType: targetDefendant?.type,
    defendantAddress,
    violations: finalViolations.map((v: Record<string, unknown>) => ({
      ruleId: v.ruleId as string,
      title: v.title as string,
      description: v.description as string,
      statute: v.statute as string,
      severity: v.severity as string,
      category: v.category as string,
      estimatedDamagesMin: (v.estimatedDamagesMin as number) || 0,
      estimatedDamagesMax: (v.estimatedDamagesMax as number) || 0,
      affectedAccounts: ((v.affectedAccounts as Array<Record<string, unknown>>) || []).map(
        (a) => ({
          creditorName: (a.creditorName as string) || "",
          cra: a.cra as string | undefined,
          balance: a.balance as number | undefined,
        }),
      ),
    })),
    strengthScore: litCase.strengthScore,
    strengthLabel: litCase.strengthLabel,
    totalViolations: litCase.totalViolations,
    estimatedDamagesMin: litCase.estimatedDamagesMin,
    estimatedDamagesMax: litCase.estimatedDamagesMax,
  };

  // Get template and build prompt
  const template = getDocumentTemplate(documentType);
  const prompt = buildDocumentPrompt(template, context);

  // Call LLM
  const llmResponse = await completeLLM({
    taskType: "LITIGATION_DOCUMENT",
    prompt,
    organizationId,
  });

  // Parse the generated content
  const content = llmResponse.content;

  // Extract statute citations from the generated content
  const statutesCited = extractStatutesCited(content);
  const defendantNames = litCase.defendants.map((d) => d.name);

  // Generate title
  const title = `${DOCUMENT_TYPE_LABELS[documentType]} — ${targetDefendant?.name || litCase.caseNumber}`;

  // Save as LitigationDocument
  const document = await prisma.litigationDocument.create({
    data: {
      caseId,
      actionId: actionId || undefined,
      documentType,
      title,
      content,
      approvalStatus: "DRAFT",
      version: 1,
      aiGenerated: true,
      aiRequestId: llmResponse.requestId,
      aiMetadata: JSON.stringify({
        provider: llmResponse.provider,
        model: llmResponse.model,
        latencyMs: llmResponse.latencyMs,
        costCents: llmResponse.costCents,
        promptTokens: llmResponse.promptTokens,
        completionTokens: llmResponse.completionTokens,
      }),
      statutesCited: JSON.stringify(statutesCited),
      defendants: JSON.stringify(defendantNames),
    },
  });

  // Log event
  await prisma.eventLog.create({
    data: {
      eventType: LITIGATION_EVENT_TYPES.DOCUMENT_GENERATED,
      actorId: userId,
      actorEmail: userEmail,
      targetType: "LitigationDocument",
      targetId: document.id,
      eventData: JSON.stringify({
        caseId,
        documentType,
        caseNumber: litCase.caseNumber,
        targetDefendant: targetDefendant?.name,
        aiRequestId: llmResponse.requestId,
        costCents: llmResponse.costCents,
      }),
      organizationId,
    },
  });

  return { documentId: document.id, content };
}

// ============================================================================
// Regenerate Document
// ============================================================================

/**
 * Regenerate a document, creating a new version.
 */
export async function regenerateDocument(
  documentId: string,
  organizationId: string,
  userId?: string,
  userEmail?: string,
): Promise<{ documentId: string; content: string }> {
  const existingDoc = await prisma.litigationDocument.findUnique({
    where: { id: documentId },
  });

  if (!existingDoc) {
    throw new Error(`Document not found: ${documentId}`);
  }

  // Generate new document with same parameters
  const result = await generateLitigationDocument(
    existingDoc.caseId,
    existingDoc.documentType as LitigationDocumentType,
    organizationId,
    undefined,
    existingDoc.actionId || undefined,
    userId,
    userEmail,
  );

  // Update the new document to reference the parent
  await prisma.litigationDocument.update({
    where: { id: result.documentId },
    data: {
      parentDocumentId: documentId,
      version: existingDoc.version + 1,
    },
  });

  return result;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extract statute citations from generated content using regex.
 */
function extractStatutesCited(content: string): string[] {
  const statutes = new Set<string>();

  // Match "15 U.S.C. § XXXX" pattern
  const uscPattern = /15\s+U\.?S\.?C\.?\s*§?\s*(\d{4}[a-z]?(?:\([a-z0-9]+\))*)/gi;
  let match;
  while ((match = uscPattern.exec(content)) !== null) {
    statutes.add(`15 USC ${match[1]}`);
  }

  // Match "15 USC XXXX" pattern
  const simplePattern = /15\s+USC\s+(\d{4}[a-z]?(?:\([a-z0-9]+\))*)/gi;
  while ((match = simplePattern.exec(content)) !== null) {
    statutes.add(`15 USC ${match[1]}`);
  }

  // Match "28 U.S.C. § XXXX" (jurisdiction statutes)
  const jurisdPattern = /28\s+U\.?S\.?C\.?\s*§?\s*(\d{4})/gi;
  while ((match = jurisdPattern.exec(content)) !== null) {
    statutes.add(`28 USC ${match[1]}`);
  }

  return Array.from(statutes);
}
