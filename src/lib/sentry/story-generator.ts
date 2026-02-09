/**
 * SENTRY STORY GENERATOR
 *
 * AI-powered generator for unique real-life impact stories.
 * Stories are REQUIRED in every letter - this is the core of human-first letters.
 *
 * Stories are generated on-the-fly using Claude to ensure:
 * - Infinite variety (no repeats ever)
 * - Authentic human voice (8th-11th grade reading level)
 * - Thematic alignment with dispute type
 * - Round-based frustration escalation
 */

import { completeLLM } from "@/lib/llm-orchestrator";
import { createLogger } from "@/lib/logger";
import {
  type StoryContext,
  type GeneratedStory,
  EOSCAR_TO_DISPUTE_TYPE,
} from "./writing-modes";
import type { SentryFlowType, SentryAccountItem } from "@/types/sentry";

const log = createLogger("sentry-story-generator");

// =============================================================================
// STORY CACHE (prevents duplicates within session)
// =============================================================================

const recentStoryHashes = new Set<string>();
const MAX_CACHE_SIZE = 1000;

function hashStory(story: string): string {
  let hash = 0;
  for (let i = 0; i < story.length; i++) {
    const char = story.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

function isStoryUnique(story: string): boolean {
  const hash = hashStory(story);
  if (recentStoryHashes.has(hash)) {
    return false;
  }

  if (recentStoryHashes.size >= MAX_CACHE_SIZE) {
    const entries = Array.from(recentStoryHashes);
    recentStoryHashes.clear();
    entries.slice(-500).forEach((h) => recentStoryHashes.add(h));
  }

  recentStoryHashes.add(hash);
  return true;
}

// =============================================================================
// LIFE SITUATION TEMPLATES
// =============================================================================

/**
 * Real-life situations that credit issues affect
 * Used to make stories relatable and authentic
 */
const LIFE_SITUATIONS = {
  car: [
    "My car broke down last month and I've been taking the bus to work.",
    "I need a reliable car to get my kids to school and activities.",
    "My transmission went out and I can't afford to fix it.",
    "I've been borrowing my sister's car but she needs it back.",
    "I work night shifts and there's no bus that late.",
  ],
  house: [
    "I've been saving for a house for three years now.",
    "My family has outgrown our apartment.",
    "I'm tired of throwing money away on rent.",
    "My landlord is selling and we have to move.",
    "I just want a place my kids can call home.",
  ],
  apartment: [
    "I got denied for an apartment last week because of my credit.",
    "Every landlord runs a credit check and I keep getting rejected.",
    "I'm sleeping on my cousin's couch because I can't find a place.",
    "My lease is up next month and I can't renew.",
    "I need to move closer to work but no one will approve me.",
  ],
  job: [
    "My job does background checks and credit is part of it.",
    "I got passed over for a promotion because of my credit report.",
    "I'm trying to get a security clearance for a better job.",
    "The company I want to work for runs credit checks.",
    "I can't advance my career with this on my report.",
  ],
  family: [
    "I have two kids depending on me.",
    "I'm trying to provide for my family.",
    "My mom is sick and I'm helping with her bills too.",
    "I'm a single parent doing this alone.",
    "I need to get this fixed for my family's future.",
  ],
  business: [
    "I'm trying to start a small business.",
    "I need a business loan to expand my shop.",
    "I want to leave my job and work for myself.",
    "Banks won't give me a business line of credit.",
    "I have a great business idea but can't get funding.",
  ],
  general: [
    "I've been working so hard to get my credit together.",
    "Every time I make progress, something else shows up.",
    "I feel like I'm stuck and can't move forward.",
    "I just want to live a normal life without this stress.",
    "I'm tired of being held back by credit problems.",
  ],
};

/**
 * Round-based frustration openings
 */
const ROUND_FRUSTRATION = {
  1: [
    "I just found out about this and I don't understand how it got there.",
    "I was checking my credit and noticed something wrong.",
    "I never knew about this until I tried to apply for something.",
    "I just discovered this problem on my credit report.",
  ],
  2: [
    "I already sent you a letter about this but nothing changed.",
    "I disputed this before and it's still showing up wrong.",
    "This is my second time writing about the same issue.",
    "I thought this was fixed but it's still on my report.",
  ],
  3: [
    "This is the third time I'm writing about this same problem.",
    "I've been dealing with this for months now.",
    "I don't know what else I need to do to get this fixed.",
    "I'm getting really frustrated that this isn't resolved yet.",
  ],
  4: [
    "I've written multiple times and nothing has been done.",
    "I'm at my wit's end with this situation.",
    "I've tried everything to get this resolved.",
    "This has been going on way too long and I need it fixed now.",
  ],
};

// =============================================================================
// STORY GENERATION - AI POWERED
// =============================================================================

/**
 * Generate a unique impact story using AI
 * Falls back to template-based stories if AI fails
 */
export async function generateImpactStory(
  context: StoryContext,
  organizationId?: string
): Promise<GeneratedStory> {
  const prompt = buildEnhancedPrompt(context);

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;

    try {
      const response = await completeLLM({
        taskType: "CHAT",
        organizationId: organizationId || "default",
        systemPrompt: buildSystemPrompt(context.round),
        prompt: prompt + `\n\n[Attempt ${attempts}: Create something completely fresh]`,
      });

      const storyText = response.content.trim();

      // Validate uniqueness
      if (!isStoryUnique(storyText)) {
        log.warn({ attempts }, "Generated duplicate story, retrying");
        continue;
      }

      // Validate reading level
      const wordCount = storyText.split(/\s+/).length;
      const avgWordLength = storyText.replace(/\s/g, "").length / wordCount;

      if (avgWordLength > 6.5) {
        log.warn({ avgWordLength }, "Story too formal, retrying");
        continue;
      }

      // Extract emotional hook
      const sentences = storyText.split(/[.!?]+/).filter((s) => s.trim());
      const emotionalHook = sentences[0]?.trim() || storyText.substring(0, 100);

      // Generate follow-up
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
        return generateFallbackStory(context);
      }
    }
  }

  return generateFallbackStory(context);
}

/**
 * Build system prompt with round-appropriate frustration level
 */
function buildSystemPrompt(round: number): string {
  const frustrationLevel = Math.min(round, 4);

  const frustrationInstructions = {
    1: "Sound hopeful but concerned. This is new to them.",
    2: "Sound frustrated but still reasonable. They've tried once.",
    3: "Sound really frustrated and tired. They've been at this for a while.",
    4: "Sound exhausted and fed up. They've tried everything.",
  };

  return `You write authentic personal stories about credit report problems.

CRITICAL RULES:
- Write like a REAL PERSON, not an AI
- 8th-11th grade reading level (simple words!)
- 2-3 sentences MAX
- ${frustrationInstructions[frustrationLevel as 1|2|3|4]}
- Include a specific life impact (car, house, job, family)
- Sound frustrated but never aggressive or threatening
- NO perfect grammar - regular people don't write perfectly
- NO fancy vocabulary - use everyday words
- Every response must be UNIQUE`;
}

/**
 * Build enhanced prompt with life situation context
 * Includes randomization to ensure every regeneration is unique
 */
function buildEnhancedPrompt(context: StoryContext): string {
  const disputeDescriptions: Record<StoryContext["disputeType"], string> = {
    NOT_MINE: "an account that isn't theirs at all",
    PAID: "an account showing unpaid when they paid it",
    INACCURATE: "wrong information on an account",
    TOO_OLD: "an account too old to legally be reported",
    UNAUTHORIZED: "an account they never authorized",
    DUPLICATE: "the same account showing multiple times",
    COLLECTION: "a collection they don't recognize",
  };

  const roundContext = {
    1: "just discovered the problem",
    2: "already disputed once with no result",
    3: "frustrated after multiple attempts",
    4: "exhausted and desperate after many tries",
  };

  // Pick a random life situation
  const situations = Object.values(LIFE_SITUATIONS).flat();
  const randomSituation = situations[Math.floor(Math.random() * situations.length)];

  // Random story angles to force variety on each regeneration
  const storyAngles = [
    "Focus on the emotional toll and sleepless nights",
    "Focus on the family impact and how it affects loved ones",
    "Focus on the financial stress and daily struggles",
    "Focus on the embarrassment and shame of being denied",
    "Focus on the dreams being put on hold",
    "Focus on the unfairness and frustration of being wrongly blamed",
    "Focus on the time wasted dealing with this problem",
    "Focus on the impact on their children's future",
  ];
  const randomAngle = storyAngles[Math.floor(Math.random() * storyAngles.length)];

  // Random pain points for deeper variety
  const painPoints = [
    "They've been turned down multiple times because of this",
    "They had to borrow money from family because of this",
    "Their kids have noticed the stress this is causing",
    "They can't sleep at night worrying about this",
    "They've had to cancel plans and postpone dreams",
    "They feel helpless and don't know where to turn",
    "They've spent hours on the phone getting nowhere",
    "This has affected their relationship and home life",
  ];
  const randomPain = painPoints[Math.floor(Math.random() * painPoints.length)];

  // Random opening styles
  const openingStyles = [
    "Start with their immediate problem",
    "Start with what they're trying to achieve",
    "Start with how long they've been dealing with this",
    "Start with a specific denial or rejection they faced",
    "Start with how this is affecting their daily life",
  ];
  const randomOpening = openingStyles[Math.floor(Math.random() * openingStyles.length)];

  return `Write a COMPLETELY UNIQUE personal story about someone dealing with ${disputeDescriptions[context.disputeType]}.

Account: ${context.creditorName}
${context.balance ? `Amount: $${context.balance.toLocaleString()}` : ""}
Situation: They've ${roundContext[context.round as 1|2|3|4] || roundContext[1]}.

CREATIVE DIRECTION (follow these to make it unique):
- ${randomOpening}
- ${randomAngle}
- Pain point to include: "${randomPain}"
- Life situation: "${randomSituation}"

Write 2-3 sentences that feel REAL and DIFFERENT. No templates. No generic phrases. Just raw human frustration:`;
}

/**
 * Generate the "why it matters" follow-up
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
      systemPrompt: `Write ONE simple sentence about why fixing a credit error matters.
Plain English. 8th grade level. Start with "I need this fixed because" or "This matters because".`,
      prompt: `Their story: "${story}"
Dispute about: ${context.disputeType.replace(/_/g, " ").toLowerCase()}
Account: ${context.creditorName}

Write ONE sentence:`,
    });

    return response.content.trim();
  } catch (error) {
    log.error({ err: error }, "Failed to generate why it matters");
    return getDefaultWhyItMatters(context.disputeType);
  }
}

function getDefaultWhyItMatters(disputeType: StoryContext["disputeType"]): string {
  const defaults: Record<StoryContext["disputeType"], string> = {
    NOT_MINE: "I need this fixed because someone else's mistakes are ruining my credit.",
    PAID: "I need this fixed because I paid what I owed and I deserve credit for that.",
    INACCURATE: "I need this fixed because wrong info is making my credit look worse than it is.",
    TOO_OLD: "I need this fixed because this old account should have fallen off years ago.",
    UNAUTHORIZED: "I need this fixed because I never agreed to this account.",
    DUPLICATE: "I need this fixed because the same account is hitting me twice.",
    COLLECTION: "I need this fixed because this collection shouldn't be on my report.",
  };

  return defaults[disputeType] || "I need this fixed so I can move forward with my life.";
}

// =============================================================================
// FALLBACK STORIES - HIGH QUALITY TEMPLATES
// =============================================================================

/**
 * Generate a quality fallback story when AI is unavailable
 * These are diverse, authentic-sounding templates
 */
function generateFallbackStory(context: StoryContext): GeneratedStory {
  const round = Math.min(context.round, 4) as 1|2|3|4;

  // Get round-appropriate frustration opener
  const frustrationOpeners = ROUND_FRUSTRATION[round];
  const opener = frustrationOpeners[Math.floor(Math.random() * frustrationOpeners.length)];

  // Get a life situation
  const lifeCategory = getRandomLifeCategory();
  const lifeSituations = LIFE_SITUATIONS[lifeCategory];
  const situation = lifeSituations[Math.floor(Math.random() * lifeSituations.length)];

  // Get dispute-specific middle
  const disputeStatements = getFallbackDisputeStatements(context);
  const disputeStatement = disputeStatements[Math.floor(Math.random() * disputeStatements.length)];

  // Combine into a natural story
  const storyText = `${opener} ${disputeStatement} ${situation}`;

  return {
    storyParagraph: storyText,
    emotionalHook: opener + " " + disputeStatement.split(".")[0] + ".",
    whyItMatters: getDefaultWhyItMatters(context.disputeType),
    storyHash: hashStory(storyText + Date.now()),
  };
}

function getRandomLifeCategory(): keyof typeof LIFE_SITUATIONS {
  const categories = Object.keys(LIFE_SITUATIONS) as (keyof typeof LIFE_SITUATIONS)[];
  return categories[Math.floor(Math.random() * categories.length)];
}

function getFallbackDisputeStatements(context: StoryContext): string[] {
  const { creditorName, disputeType, balance } = context;
  const balanceStr = balance ? `$${balance.toLocaleString()}` : "money";

  const statements: Record<StoryContext["disputeType"], string[]> = {
    NOT_MINE: [
      `This ${creditorName} account isn't mine - I've never had any business with them.`,
      `I don't know where this ${creditorName} account came from, it's definitely not mine.`,
      `Someone else's ${creditorName} account ended up on my credit somehow.`,
      `I've never even heard of ${creditorName} until I saw this on my report.`,
    ],
    PAID: [
      `I paid off ${creditorName} but it's still showing like I owe ${balanceStr}.`,
      `This ${creditorName} account was paid in full, I have the receipts.`,
      `${creditorName} says I still owe ${balanceStr} but that's not true, I paid this.`,
      `I settled up with ${creditorName} ages ago but my credit still shows a balance.`,
    ],
    INACCURATE: [
      `The ${creditorName} account has wrong information - the numbers don't match my records.`,
      `${creditorName} is reporting ${balanceStr} but that's not the right amount.`,
      `Something's off with how ${creditorName} is showing on my credit.`,
      `The details on this ${creditorName} account aren't accurate at all.`,
    ],
    TOO_OLD: [
      `This ${creditorName} thing is from years ago - it should be gone by now.`,
      `${creditorName} has been on my report way longer than 7 years.`,
      `I thought old accounts like this ${creditorName} one fall off eventually.`,
      `This ${creditorName} account is ancient, why is it still affecting me?`,
    ],
    UNAUTHORIZED: [
      `I never authorized this ${creditorName} account - nobody asked me.`,
      `Someone opened this ${creditorName} account without my permission.`,
      `I never agreed to any account with ${creditorName}.`,
      `This ${creditorName} account was opened without my consent.`,
    ],
    DUPLICATE: [
      `${creditorName} is showing up twice and hurting my score double.`,
      `The same ${creditorName} account is listed multiple times.`,
      `I shouldn't be penalized twice for one ${creditorName} account.`,
      `${creditorName} appears more than once - that can't be right.`,
    ],
    COLLECTION: [
      `I don't recognize this collection from ${creditorName} at all.`,
      `${creditorName} sent this to collections but I never got any notice.`,
      `This ${creditorName} collection doesn't look right to me.`,
      `I got a collection from ${creditorName} but something's wrong here.`,
    ],
  };

  return statements[disputeType] || statements.INACCURATE;
}

// =============================================================================
// BATCH STORY GENERATION
// =============================================================================

/**
 * Generate stories for multiple accounts
 * Ensures variety across all stories
 */
export async function generateStoriesForAccounts(
  accounts: SentryAccountItem[],
  flow: SentryFlowType,
  round: number,
  clientContext?: StoryContext["clientContext"],
  organizationId?: string
): Promise<Map<string, GeneratedStory>> {
  const stories = new Map<string, GeneratedStory>();

  const storyPromises = accounts.map(async (account, index) => {
    let disputeType: StoryContext["disputeType"] = "INACCURATE";

    if (account.detectedIssues && account.detectedIssues.length > 0) {
      const primaryIssue = account.detectedIssues[0];
      if (primaryIssue.suggestedEOSCARCode) {
        disputeType = EOSCAR_TO_DISPUTE_TYPE[primaryIssue.suggestedEOSCARCode] || "INACCURATE";
      }
    }

    const context: StoryContext = {
      disputeType,
      creditorName: account.creditorName,
      accountType: account.accountType,
      balance: account.balance,
      clientContext: clientContext ? { ...clientContext } : undefined,
      flow,
      round,
    };

    // Stagger requests to avoid rate limiting
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
 * Combine multiple stories into one narrative
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

  // For multiple accounts, create combined narrative
  const opener = "These accounts are all causing me problems. ";
  const combined = stories.map((s) => s.emotionalHook).join(" And ");

  let result = opener + combined;

  if (result.length < maxLength - 80) {
    result += " I just want my credit to show the truth so I can move on.";
  }

  if (result.length > maxLength) {
    result = result.substring(0, maxLength - 3) + "...";
  }

  return result;
}

/**
 * Generate summary story for many accounts
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
      systemPrompt: `Write a brief statement from someone with multiple credit errors.
Sound like a real, frustrated but reasonable person. 8th-11th grade level. 2-3 sentences.`,
      prompt: `The person has ${accountCount} accounts to dispute, mainly about ${primaryDisputeType.replace(/_/g, " ").toLowerCase()}.
Write their frustration in 2-3 sentences:`,
    });

    return response.content.trim();
  } catch (error) {
    log.error({ err: error }, "Failed to generate summary story");
    return `I have ${accountCount} accounts that aren't right on my credit report. This is stressful and it's holding me back from things I need. I just want everything to be accurate.`;
  }
}

// =============================================================================
// REQUIRED STORY GENERATION - MAIN EXPORT
// =============================================================================

/**
 * Generate a required story for a dispute letter
 * This ALWAYS returns a story - never fails
 */
export async function generateRequiredStory(
  context: StoryContext,
  organizationId?: string
): Promise<GeneratedStory> {
  try {
    // Try AI generation first
    return await generateImpactStory(context, organizationId);
  } catch (error) {
    // ALWAYS fall back to quality template
    log.warn({ err: error }, "Using fallback story generation");
    return generateFallbackStory(context);
  }
}
