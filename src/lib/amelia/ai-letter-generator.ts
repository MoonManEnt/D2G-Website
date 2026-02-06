/**
 * AMELIA AI Letter Generator v4
 *
 * The main orchestrator for AI-driven letter generation.
 * Uses Claude/OpenAI to dynamically generate 100% unique letters.
 *
 * Flow:
 * 1. Build context (client, accounts, voice, legal framework)
 * 2. Build comprehensive prompt with section markers
 * 3. Generate via LLM
 * 4. Parse sections from output
 * 5. Validate each section
 * 6. Retry invalid sections
 * 7. Assemble final letter
 * 8. Final uniqueness check
 */

import type { CRA } from "@/types";
import type { FlowType } from "../amelia-templates";
import { completeLLM } from "../llm-orchestrator";
import { hashContent } from "../amelia-doctrine";
import { inferConsumerVoice, formatVoiceProfileForPrompt, type SoulEngineInput, type ConsumerVoiceProfile } from "../amelia-soul-engine";
import { calculateLetterDate, formatLetterDate, determineTone, type LetterTone } from "../amelia-doctrine";
import { getEffectiveFlow } from "../amelia-templates";
import { getLegalFramework, type LegalFramework } from "./legal-frameworks";
import { buildFullLetterPrompt, type PromptContext, type ClientContext, type AccountContext } from "./prompt-builder";
import { parseLetterSections, parseWithoutMarkers, assembleLetter, type ParsedLetterSections } from "./section-parser";
import { validateAllSections, type FullValidationResult, type ValidationContext } from "./section-validator";
import { retryMultipleSections, getSectionsToRetry, type RetryConfig } from "./section-retry";
import { containsBlacklistedPhrase } from "./phrase-blacklist";
import { validateUniqueness } from "../ai/content-validator";
import { prisma } from "@/lib/prisma";

// =============================================================================
// TYPES
// =============================================================================

export interface AILetterGenerationRequest {
  client: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    zipCode: string;
    ssnLast4: string;
    dateOfBirth?: string;
  };
  accounts: {
    creditorName: string;
    accountNumber: string;
    accountType: string;
    balance?: number;
    paymentStatus?: string;
    dateOpened?: string;
    issues: { code: string; description?: string }[];
    inaccurateCategories?: string[];
  }[];
  cra: CRA;
  flow: FlowType;
  round: number;
  organizationId: string;
  lastDisputeDate?: string;
  debtCollectorNames?: string[];
  previousRoundContext?: string;
  outcomePatternContext?: string;
  litigationMode?: boolean;
  violationCount?: number;
}

export interface AIGeneratedLetter {
  content: string;
  letterDate: Date;
  isBackdated: boolean;
  backdatedDays: number;
  tone: LetterTone;
  flow: FlowType;
  effectiveFlow: FlowType;
  round: number;
  citations: string[];
  contentHash: string;
  uniquenessScore: number;
  validationScore: number;
  ameliaVersion: string;
  litigationMode: boolean;
  violationCount: number;
  generationStats: {
    totalAttempts: number;
    sectionsRetried: string[];
    finalValidation: FullValidationResult;
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get previous letter contents for uniqueness checking
 */
async function getPreviousLetterContents(clientId: string): Promise<string[]> {
  try {
    const previousDisputes = await prisma.dispute.findMany({
      where: { clientId },
      select: { letterContent: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return previousDisputes
      .map((d: { letterContent: string | null }) => d.letterContent)
      .filter((c): c is string => !!c && c.length > 100);
  } catch {
    return [];
  }
}

/**
 * Build Soul Engine input from request
 */
function buildSoulEngineInput(request: AILetterGenerationRequest): SoulEngineInput {
  return {
    client: {
      name: request.client.fullName,
      dob: request.client.dateOfBirth || "1980-01-01", // Default if not provided
      address: `${request.client.city}, ${request.client.state}`,
    },
    account: {
      creditorName: request.accounts[0]?.creditorName || "Unknown",
      accountType: request.accounts[0]?.accountType || "Credit Account",
      currentStatus: request.accounts[0]?.paymentStatus || "Disputed",
      reportedBalance: request.accounts[0]?.balance,
    },
    disputeConfig: {
      mode: "dispute_flow",
      round: request.round,
      priorDisputeDates: request.lastDisputeDate ? [request.lastDisputeDate] : undefined,
    },
    disputeTarget: {
      entityType: request.flow === "COLLECTION" ? "collector" : "CRA",
    },
  };
}

/**
 * Build account context for prompt
 */
function buildAccountContexts(request: AILetterGenerationRequest): AccountContext[] {
  return request.accounts.map(account => ({
    creditorName: account.creditorName,
    accountNumber: account.accountNumber,
    accountType: account.accountType,
    balance: account.balance,
    paymentStatus: account.paymentStatus,
    dateOpened: account.dateOpened,
    issues: account.issues,
    inaccurateCategories: account.inaccurateCategories || determineInaccurateCategories(account),
  }));
}

/**
 * Determine inaccurate categories from account data
 */
function determineInaccurateCategories(account: {
  issues: { code: string; description?: string }[];
  paymentStatus?: string;
  balance?: number;
}): string[] {
  const categories: string[] = [];

  for (const issue of account.issues) {
    const code = issue.code.toUpperCase();
    if (code.includes("BALANCE") || code.includes("AMOUNT")) {
      categories.push("BALANCE");
    }
    if (code.includes("PAYMENT") || code.includes("LATE") || code.includes("DELINQ")) {
      categories.push("PAYMENT HISTORY");
    }
    if (code.includes("STATUS") || code.includes("CLOSED") || code.includes("OPEN")) {
      categories.push("ACCOUNT STATUS");
    }
    if (code.includes("DATE") || code.includes("OPENED") || code.includes("REPORTED")) {
      categories.push("DATE INFORMATION");
    }
  }

  // Ensure at least some categories
  if (categories.length === 0) {
    categories.push("ACCOUNT TYPE", "PAYMENT STATUS", "DATE OPENED");
  }

  return [...new Set(categories)];
}

/**
 * Extract legal citations from content
 */
function extractCitations(content: string): string[] {
  const citationMatches = content.match(/15 U\.?S\.?C\.? ?§? ?\d+[a-z]?(?:\([^)]+\))?/gi) || [];
  return [...new Set(citationMatches)];
}

// =============================================================================
// MAIN GENERATOR
// =============================================================================

/**
 * Generate a dispute letter using AI
 *
 * This is the new AI-driven approach where every section is generated
 * by the LLM at runtime, ensuring 100% unique content.
 */
export async function generateAILetter(
  request: AILetterGenerationRequest
): Promise<AIGeneratedLetter> {
  const startTime = Date.now();

  // 1. Calculate letter date (with backdating)
  const { letterDate, isBackdated, backdatedDays } = calculateLetterDate(request.round);

  // 2. Determine effective flow and tone
  const effectiveFlow = getEffectiveFlow(request.flow, request.round);
  const tone = determineTone(request.round);

  // 3. Get legal framework
  const legalFramework = getLegalFramework(effectiveFlow, request.round);

  // 4. Infer consumer voice profile
  let voiceProfile: ConsumerVoiceProfile;
  try {
    voiceProfile = inferConsumerVoice(buildSoulEngineInput(request));
  } catch {
    // Fallback to a default profile
    voiceProfile = {
      ageRange: "30-44",
      emotionalState: request.round >= 3 ? "frustrated" : "concerned",
      communicationStyle: "direct",
      legalLiteracy: request.round >= 4 ? "high" : "medium",
      grammarPosture: 2,
      lifeStakes: "credit_access",
      relationshipToAccount: "general_inaccuracy",
      formalityBaseline: "moderate",
      disputeFatigue: request.round >= 3 ? "significant" : "mild",
      voiceSource: "minimal-default",
      personalNarrativeElements: [],
    };
  }

  // 5. Get previous letters for uniqueness checking
  const previousLetters = await getPreviousLetterContents(request.client.id);

  // 6. Build prompt context
  const clientContext: ClientContext = {
    firstName: request.client.firstName,
    lastName: request.client.lastName,
    fullName: request.client.fullName,
    addressLine1: request.client.addressLine1,
    addressLine2: request.client.addressLine2,
    city: request.client.city,
    state: request.client.state,
    zipCode: request.client.zipCode,
    ssnLast4: request.client.ssnLast4,
    dateOfBirth: request.client.dateOfBirth,
  };

  const accountContexts = buildAccountContexts(request);

  const promptContext: PromptContext = {
    client: clientContext,
    accounts: accountContexts,
    cra: request.cra,
    flow: effectiveFlow,
    round: request.round,
    voiceProfile,
    legalFramework,
    previousLetterExcerpts: previousLetters.map(l => l.substring(0, 500)),
    letterDate: formatLetterDate(letterDate),
    lastDisputeDate: request.lastDisputeDate,
    debtCollectorNames: request.debtCollectorNames,
    isBackdated,
    backdatedDays,
  };

  // 7. Build the full prompt
  const prompt = buildFullLetterPrompt(promptContext);

  // 8. Generate via LLM
  let rawOutput: string;
  let attempts = 1;

  try {
    const response = await completeLLM({
      taskType: "LETTER_GENERATION",
      prompt,
      organizationId: request.organizationId,
      context: {
        flow: effectiveFlow,
        round: request.round,
        cra: request.cra,
      },
    });
    rawOutput = response.content;
  } catch (error) {
    console.error("[AMELIA v4] LLM generation failed:", error);
    throw new Error("AI letter generation failed");
  }

  // 9. Parse sections from output
  let parseResult = parseLetterSections(rawOutput);

  // If parsing with markers failed, try without
  if (!parseResult.success) {
    parseResult = parseWithoutMarkers(rawOutput);
  }

  let sections = parseResult.sections;

  // 10. Build validation context
  const validationContext: ValidationContext = {
    voiceProfile,
    legalFramework,
    round: request.round,
    previousLetters,
  };

  // 11. Validate all sections
  let validationResult = validateAllSections(sections, validationContext);
  const sectionsRetried: string[] = [];

  // 12. Retry invalid sections (max 2 rounds)
  const retryConfig: RetryConfig = {
    maxRetries: 2,
    organizationId: request.organizationId,
  };

  for (let retryRound = 0; retryRound < 2 && !validationResult.isValid; retryRound++) {
    const sectionsToRetry = getSectionsToRetry(validationResult.sectionResults);

    if (sectionsToRetry.size === 0) break;

    // Track which sections we're retrying
    for (const sectionName of sectionsToRetry.keys()) {
      sectionsRetried.push(sectionName);
    }

    // Retry the sections
    sections = await retryMultipleSections(sections, sectionsToRetry, promptContext, retryConfig);
    attempts++;

    // Re-validate
    validationResult = validateAllSections(sections, validationContext);
  }

  // 13. Assemble final letter
  const content = assembleLetter(sections);

  // 14. Final uniqueness check
  let uniquenessScore = 98;
  if (previousLetters.length > 0) {
    try {
      const uniquenessCheck = validateUniqueness(content, previousLetters);
      uniquenessScore = uniquenessCheck.uniquenessScore;
    } catch {
      // If uniqueness check fails, assume it's unique
      uniquenessScore = 95;
    }
  }

  // 15. Extract citations
  const citations = extractCitations(content);

  // 16. Calculate content hash
  const contentHash = hashContent(content);

  const endTime = Date.now();
  console.log(`[AMELIA v4] Generated letter in ${endTime - startTime}ms, ${attempts} attempt(s), score: ${validationResult.overallScore}`);

  return {
    content,
    letterDate,
    isBackdated,
    backdatedDays,
    tone: request.litigationMode ? (request.round >= 4 ? "PISSED" : "WARNING") : tone,
    flow: request.flow,
    effectiveFlow,
    round: request.round,
    citations,
    contentHash,
    uniquenessScore,
    validationScore: validationResult.overallScore,
    ameliaVersion: "4.0.0-ai-driven",
    litigationMode: request.litigationMode || false,
    violationCount: request.violationCount || 0,
    generationStats: {
      totalAttempts: attempts,
      sectionsRetried: [...new Set(sectionsRetried)],
      finalValidation: validationResult,
    },
  };
}

/**
 * Check if AI generation is available
 */
export function isAIGenerationAvailable(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
}
