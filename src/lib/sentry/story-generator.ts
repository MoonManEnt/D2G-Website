/**
 * SENTRY STORY GENERATOR
 *
 * AI-powered generator for unique real-life impact stories.
 * CRITICAL: Every story must be NEW, UNIQUE, and UNUSED.
 *
 * Stories are generated on-the-fly using Claude to ensure:
 * - Infinite variety (no repeats ever)
 * - Authentic human voice (8th-11th grade reading level)
 * - Thematic alignment with dispute type
 * - e-OSCAR compliance maintained
 */

import { completeLLM } from "@/lib/llm-orchestrator";
import { createLogger } from "@/lib/logger";
import {
  type StoryContext,
  type GeneratedStory,
  buildStoryGenerationPrompt,
  EOSCAR_TO_DISPUTE_TYPE,
} from "./writing-modes";
import type { SentryFlowType, SentryAccountItem } from "@/types/sentry";

const log = createLogger("sentry-story-generator");

// =============================================================================
// STORY CACHE (prevents duplicates within session)
// =============================================================================

// In-memory cache of recently generated story hashes
// This prevents accidental duplicates within a user session
const recentStoryHashes = new Set<string>();
const MAX_CACHE_SIZE = 1000;

function hashStory(story: string): string {
  // Simple hash for story deduplication
  let hash = 0;
  for (let i = 0; i < story.length; i++) {
    const char = story.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

function isStoryUnique(story: string): boolean {
  const hash = hashStory(story);
  if (recentStoryHashes.has(hash)) {
    return false;
  }

  // Clean cache if too large
  if (recentStoryHashes.size >= MAX_CACHE_SIZE) {
    const entries = Array.from(recentStoryHashes);
    recentStoryHashes.clear();
    // Keep last 500
    entries.slice(-500).forEach((h) => recentStoryHashes.add(h));
  }

  recentStoryHashes.add(hash);
  return true;
}

// =============================================================================
// STORY GENERATION
// =============================================================================

/**
 * Generate a unique impact story for the given context
 * Uses AI to ensure every story is fresh and authentic
 */
export async function generateImpactStory(
  context: StoryContext,
  organizationId?: string
): Promise<GeneratedStory> {
  const prompt = buildStoryGenerationPrompt(context);

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;

    try {
      const response = await completeLLM({
        taskType: "CHAT", // Using chat for creative generation
        organizationId: organizationId || "default",
        systemPrompt: `You generate authentic, human-sounding personal stories about credit report problems.
Write like a regular person, not an AI. Use simple words. Sound frustrated but not dramatic.
Every response must be completely unique - never repeat patterns or phrases.
2-3 sentences maximum. No labels, just the story.`,
        prompt: prompt + `\n\nAttempt ${attempts}: Generate something completely different from any previous response.`,
      });

      const storyText = response.content.trim();

      // Validate uniqueness
      if (!isStoryUnique(storyText)) {
        log.warn({ attempts }, "Generated duplicate story, retrying");
        continue;
      }

      // Validate reading level (rough check)
      const wordCount = storyText.split(/\s+/).length;
      const avgWordLength = storyText.replace(/\s/g, "").length / wordCount;

      // If average word length > 6, it might be too formal
      if (avgWordLength > 6.5) {
        log.warn({ avgWordLength }, "Story might be too formal, retrying");
        continue;
      }

      // Extract emotional hook (first sentence typically)
      const sentences = storyText.split(/[.!?]+/).filter((s) => s.trim());
      const emotionalHook = sentences[0]?.trim() || storyText.substring(0, 100);

      // Generate "why it matters" follow-up
      const whyItMatters = await generateWhyItMatters(context, storyText, organizationId);

      return {
        storyParagraph: storyText,
        emotionalHook,
        whyItMatters,
        storyHash: hashStory(storyText),
      };
    } catch (error) {
      log.error({ err: error, attempts }, "Story generation attempt failed");

      if (attempts >= maxAttempts) {
        // Fall back to template-based story
        return generateFallbackStory(context);
      }
    }
  }

  // Should never reach here, but TypeScript needs it
  return generateFallbackStory(context);
}

/**
 * Generate the "why it matters" explanation
 */
async function generateWhyItMatters(
  context: StoryContext,
  story: string,
  organizationId?: string
): Promise<string> {
  try {
    const response = await completeLLM({
      taskType: "CHAT",
      organizationId: organizationId || "default",
      systemPrompt: `You write one simple sentence explaining why a credit error matters to a regular person.
Use plain English. 8th grade reading level. No fancy words.`,
      prompt: `The person's story: "${story}"

The dispute is about: ${context.disputeType.replace(/_/g, " ").toLowerCase()}
Account with: ${context.creditorName}

Write ONE sentence explaining why fixing this matters to them. Start with "This matters because" or "I need this fixed because".`,
    });

    return response.content.trim();
  } catch (error) {
    log.error({ err: error }, "Failed to generate why it matters");
    return getDefaultWhyItMatters(context.disputeType);
  }
}

function getDefaultWhyItMatters(disputeType: StoryContext["disputeType"]): string {
  const defaults: Record<StoryContext["disputeType"], string> = {
    NOT_MINE: "I need this fixed because someone else's mistakes are affecting my life.",
    PAID: "I need this fixed because I paid what I owed and I deserve credit for that.",
    INACCURATE: "I need this fixed because wrong information is making my credit look worse than it is.",
    TOO_OLD: "I need this fixed because this old account shouldn't even be on my report anymore.",
    UNAUTHORIZED: "I need this fixed because I never agreed to this and it shouldn't be on my record.",
    DUPLICATE: "I need this fixed because the same thing is showing up multiple times and hurting my score.",
    COLLECTION: "I need this fixed because I shouldn't have to deal with collections for something that isn't right.",
  };

  return defaults[disputeType] || "I need this fixed so I can move on with my life.";
}

/**
 * Fallback story when AI generation fails
 * Uses randomized templates to maintain some variety
 */
function generateFallbackStory(context: StoryContext): GeneratedStory {
  const templates: Record<StoryContext["disputeType"], string[]> = {
    NOT_MINE: [
      `I was looking at my credit report and found this ${context.creditorName} account that I've never seen before. I've never done business with them and I don't know how this got on my report. It's affecting my ability to get approved for things I actually need.`,
      `Someone must have mixed up my file because this ${context.creditorName} account is definitely not mine. I've been trying to build my credit and this is holding me back for no reason.`,
    ],
    PAID: [
      `I paid off this ${context.creditorName} account a while back and I even kept my receipts. But it's still showing like I owe money and that's not right. It's making it hard for me to get approved for anything.`,
      `This ${context.creditorName} account says I still owe money but I paid this off. I did what I was supposed to do and my credit shouldn't suffer for it.`,
    ],
    INACCURATE: [
      `The information showing for this ${context.creditorName} account is wrong. The numbers don't match what I have in my records and it's making my credit look worse than it should.`,
      `I noticed the details on this ${context.creditorName} account aren't accurate. I keep good records and I know what I owe - this isn't it.`,
    ],
    TOO_OLD: [
      `This ${context.creditorName} account is from years ago and it shouldn't even be on my report anymore. I thought these things are supposed to fall off after 7 years.`,
      `I've been working on my credit for years and this old ${context.creditorName} account is still showing up. It's been way too long for this to still be affecting me.`,
    ],
    UNAUTHORIZED: [
      `I never authorized this ${context.creditorName} account and I don't know why it's on my credit. Nobody asked me if they could open this and I never agreed to it.`,
      `This ${context.creditorName} account was opened without my permission. I would never have agreed to this and it needs to come off my report.`,
    ],
    DUPLICATE: [
      `This ${context.creditorName} account is showing up more than once on my report. It's the same thing listed multiple times and it's hurting my score for no reason.`,
      `I noticed ${context.creditorName} is reporting the same account twice. I shouldn't be penalized twice for the same thing.`,
    ],
    COLLECTION: [
      `This collection from ${context.creditorName} doesn't look right to me. I don't recognize what this is supposed to be for and I need answers before this stays on my credit.`,
      `I got a collection from ${context.creditorName} on my report but something doesn't add up. I need this looked into because it's hurting my credit.`,
    ],
  };

  const disputeTemplates = templates[context.disputeType] || templates.INACCURATE;
  const storyText = disputeTemplates[Math.floor(Math.random() * disputeTemplates.length)];

  return {
    storyParagraph: storyText,
    emotionalHook: storyText.split(".")[0] + ".",
    whyItMatters: getDefaultWhyItMatters(context.disputeType),
    storyHash: hashStory(storyText + Date.now()), // Add timestamp to prevent caching
  };
}

// =============================================================================
// BATCH STORY GENERATION
// =============================================================================

/**
 * Generate stories for multiple accounts at once
 * Ensures variety across all stories in a single letter
 */
export async function generateStoriesForAccounts(
  accounts: SentryAccountItem[],
  flow: SentryFlowType,
  round: number,
  clientContext?: StoryContext["clientContext"],
  organizationId?: string
): Promise<Map<string, GeneratedStory>> {
  const stories = new Map<string, GeneratedStory>();

  // Generate stories in parallel but with slight variation in prompts
  const storyPromises = accounts.map(async (account, index) => {
    // Determine dispute type from e-OSCAR code or detected issues
    let disputeType: StoryContext["disputeType"] = "INACCURATE";

    if (account.detectedIssues && account.detectedIssues.length > 0) {
      const primaryIssue = account.detectedIssues[0];
      if (primaryIssue.suggestedEOSCARCode) {
        disputeType = EOSCAR_TO_DISPUTE_TYPE[primaryIssue.suggestedEOSCARCode] || "INACCURATE";
      }
    }

    // Vary client context per account to get different story angles
    const variedContext: StoryContext["clientContext"] = clientContext
      ? { ...clientContext }
      : undefined;

    const context: StoryContext = {
      disputeType,
      creditorName: account.creditorName,
      accountType: account.accountType,
      balance: account.balance,
      clientContext: variedContext,
      flow,
      round,
    };

    // Add delay between requests to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, index * 100));

    const story = await generateImpactStory(context, organizationId);
    return { accountId: account.id, story };
  });

  const results = await Promise.all(storyPromises);

  for (const { accountId, story } of results) {
    stories.set(accountId, story);
  }

  return stories;
}

// =============================================================================
// STORY COMBINATION FOR MULTI-ACCOUNT LETTERS
// =============================================================================

/**
 * Combine multiple account stories into a cohesive narrative
 */
export function combineStories(
  stories: GeneratedStory[],
  maxLength: number = 500
): string {
  if (stories.length === 0) {
    return "";
  }

  if (stories.length === 1) {
    return stories[0].storyParagraph;
  }

  // For multiple accounts, create a combined narrative
  const opener = "All of these accounts are causing me problems. ";
  const combined = stories.map((s) => s.emotionalHook).join(" Also, ");

  let result = opener + combined;

  // Add a general "why it matters" if space allows
  if (result.length < maxLength - 100) {
    result += " I just want my credit to show what's actually true so I can move forward with my life.";
  }

  // Trim if too long
  if (result.length > maxLength) {
    result = result.substring(0, maxLength - 3) + "...";
  }

  return result;
}

/**
 * Generate a summary story when there are many accounts
 */
export async function generateSummaryStory(
  accountCount: number,
  primaryDisputeType: StoryContext["disputeType"],
  organizationId?: string
): Promise<string> {
  try {
    const response = await completeLLM({
      taskType: "CHAT",
      organizationId: organizationId || "default",
      systemPrompt: `Write a brief, authentic statement from someone dealing with multiple credit report errors.
Sound like a real, frustrated but reasonable person. 8th-11th grade reading level.
2-3 sentences max.`,
      prompt: `The person has ${accountCount} accounts they're disputing, mainly about ${primaryDisputeType.replace(/_/g, " ").toLowerCase()}.
Write their frustration about having so many problems on their credit report. Make it sound human.`,
    });

    return response.content.trim();
  } catch (error) {
    log.error({ err: error }, "Failed to generate summary story");
    return `I have ${accountCount} accounts on my credit report that aren't right. It's exhausting trying to fix all of this, but I need my credit to be accurate. Each one of these is affecting my ability to get approved for things I need.`;
  }
}
