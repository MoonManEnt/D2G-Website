/**
 * AMELIA Section Retry
 *
 * Handles targeted regeneration of individual sections that fail validation.
 * More cost-effective than regenerating the entire letter.
 */

import { completeLLM } from "../llm-orchestrator";
import type { ParsedLetterSections } from "./section-parser";
import type { ValidationIssue } from "./section-validator";
import type { PromptContext } from "./prompt-builder";
import { buildSectionRegenerationPrompt } from "./prompt-builder";

// =============================================================================
// TYPES
// =============================================================================

export interface RetryConfig {
  maxRetries: number;
  organizationId: string;
}

export interface RetryResult {
  success: boolean;
  newContent: string;
  attempts: number;
  finalIssues: ValidationIssue[];
}

// =============================================================================
// SECTION RETRY FUNCTIONS
// =============================================================================

/**
 * Regenerate a single section with targeted feedback
 */
export async function regenerateSection(
  sectionName: keyof ParsedLetterSections,
  currentContent: string,
  issues: ValidationIssue[],
  ctx: PromptContext,
  config: RetryConfig
): Promise<RetryResult> {
  const issueDescriptions = issues.map(i => i.description);

  // Build the focused prompt
  const prompt = buildSectionRegenerationPrompt(
    sectionName,
    currentContent,
    issueDescriptions,
    ctx
  );

  try {
    const response = await completeLLM({
      taskType: "LETTER_GENERATION",
      prompt,
      organizationId: config.organizationId,
      context: {
        flow: ctx.flow,
        round: ctx.round,
        cra: ctx.cra,
      },
    });

    // Extract the content (may or may not have section markers)
    let newContent = response.content;

    // If the AI wrapped it in markers, extract
    const startMarker = `<SECTION:${sectionName.toUpperCase()}>`;
    const endMarker = `</SECTION:${sectionName.toUpperCase()}>`;

    if (newContent.includes(startMarker) && newContent.includes(endMarker)) {
      const startIndex = newContent.indexOf(startMarker) + startMarker.length;
      const endIndex = newContent.indexOf(endMarker);
      newContent = newContent.substring(startIndex, endIndex).trim();
    }

    return {
      success: true,
      newContent,
      attempts: 1,
      finalIssues: [], // Would need to re-validate to populate
    };
  } catch (error) {
    console.error(`Section retry failed for ${sectionName}:`, error);
    return {
      success: false,
      newContent: currentContent,
      attempts: 1,
      finalIssues: issues,
    };
  }
}

/**
 * Retry multiple sections in parallel
 */
export async function retryMultipleSections(
  sections: ParsedLetterSections,
  sectionIssues: Map<keyof ParsedLetterSections, ValidationIssue[]>,
  ctx: PromptContext,
  config: RetryConfig
): Promise<ParsedLetterSections> {
  const updatedSections = { ...sections };
  const retryPromises: Promise<{
    sectionName: keyof ParsedLetterSections;
    result: RetryResult;
  }>[] = [];

  // Create retry promises for each invalid section
  for (const [sectionName, issues] of sectionIssues) {
    if (issues.length > 0 && sections[sectionName]) {
      retryPromises.push(
        regenerateSection(
          sectionName,
          sections[sectionName],
          issues,
          ctx,
          config
        ).then(result => ({ sectionName, result }))
      );
    }
  }

  // Execute all retries in parallel (max 3 at a time to avoid rate limits)
  const batchSize = 3;
  for (let i = 0; i < retryPromises.length; i += batchSize) {
    const batch = retryPromises.slice(i, i + batchSize);
    const results = await Promise.all(batch);

    for (const { sectionName, result } of results) {
      if (result.success) {
        updatedSections[sectionName] = result.newContent;
      }
    }
  }

  return updatedSections;
}

/**
 * Build a section-specific prompt for targeted regeneration
 */
export function buildSectionPrompt(
  sectionName: keyof ParsedLetterSections,
  issues: ValidationIssue[],
  ctx: PromptContext
): string {
  const sectionGuidance: Record<string, string> = {
    opening: `
Generate the OPENING section - a personal impact story.

REQUIREMENTS:
- 2-3 paragraphs minimum
- Include specific personal details (job, family, timeframes)
- Express genuine emotion (${ctx.voiceProfile.emotionalState})
- NO template phrases
- Write as the consumer, not about them

VOICE:
- Age range: ${ctx.voiceProfile.ageRange}
- Communication style: ${ctx.voiceProfile.communicationStyle}
- Use contractions naturally
`,
    bodyFacts: `
Generate the BODY FACTS section - legal arguments woven with narrative.

REQUIREMENTS:
- 2-4 paragraphs minimum
- Cite ${ctx.legalFramework.statutes.primaryCode} naturally
- Reference relevant violations
- Build the case for why the CRA violated the law
- NO template phrases - weave law into story

LEGAL CONTEXT:
- Primary statute: ${ctx.legalFramework.statutes.primary}
- Key arguments: ${ctx.legalFramework.keyArguments.join("; ")}
`,
    accountList: `
Generate the ACCOUNT LIST section - disputed accounts with issues.

REQUIREMENTS:
- List each account clearly
- Include account numbers
- State what's inaccurate for each
- Use natural language, not robotic formatting
`,
    corrections: `
Generate the CORRECTIONS section - what must be fixed.

REQUIREMENTS:
- Specific action for each account
- Clear demands (correct, delete, verify)
- Deadline reference
- Unique language, not template demands
`,
    consumerStatement: `
Generate the CONSUMER STATEMENT - emotional closing.

REQUIREMENTS:
- Express impact on daily life
- Include penalty warning appropriate to Round ${ctx.round}
- Unique voice, NO template phrases
- ${ctx.round >= 3 ? "Reference potential legal action" : "Express determination"}
`,
  };

  const guidance = sectionGuidance[sectionName] || `Generate the ${sectionName} section.`;

  return `
${guidance}

ISSUES TO FIX:
${issues.map(i => `- ${i.description}${i.suggestion ? ` (${i.suggestion})` : ""}`).join("\n")}

CLIENT CONTEXT:
Name: ${ctx.client.fullName}
CRA: ${ctx.cra}
Round: ${ctx.round}

Generate ONLY the content for this section. Do not include section markers.
`.trim();
}

/**
 * Determine if a section should be retried based on severity
 */
export function shouldRetrySection(issues: ValidationIssue[]): boolean {
  // Retry if there are any errors
  if (issues.some(i => i.severity === "error")) {
    return true;
  }

  // Retry if there are multiple warnings
  if (issues.filter(i => i.severity === "warning").length >= 2) {
    return true;
  }

  return false;
}

/**
 * Get sections that need retry based on validation result
 */
export function getSectionsToRetry(
  sectionResults: { section: keyof ParsedLetterSections; issues: ValidationIssue[] }[]
): Map<keyof ParsedLetterSections, ValidationIssue[]> {
  const toRetry = new Map<keyof ParsedLetterSections, ValidationIssue[]>();

  for (const result of sectionResults) {
    if (shouldRetrySection(result.issues)) {
      toRetry.set(result.section, result.issues);
    }
  }

  return toRetry;
}
