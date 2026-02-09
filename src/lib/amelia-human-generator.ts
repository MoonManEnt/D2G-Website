/**
 * AMELIA HUMAN-FIRST LETTER GENERATOR
 *
 * Generates dispute letters using the Human-First approach:
 *
 * Structure:
 * 1. Header (client info + CRA address + date)
 * 2. Story (AI-generated real-life impact)
 * 3. Issue (simple statement of what's wrong)
 * 4. Account List (what needs fixing)
 * 5. Demand (clear request)
 * 6. Signature
 * 7. Footer (legal stuff at the end)
 *
 * Key principles:
 * - 8th-11th grade reading level
 * - Story leads, legal follows
 * - Sounds like a real person wrote it
 * - Frustration escalates naturally with rounds
 */

import {
  getHumanFirstAmeliaTemplate,
  getHumanIssueTemplate,
  determineIssueType,
  HUMAN_TEMPLATE_VARIABLES,
  type HumanFirstAmeliaTemplate,
} from "./amelia-human-templates";
import type { FlowType } from "./amelia-templates";
import { generateRequiredStory } from "./sentry/story-generator";
import {
  type StoryContext,
  EOSCAR_TO_DISPUTE_TYPE,
} from "./sentry/writing-modes";
import {
  type ClientPersonalInfo,
  type DisputeAccount,
  calculateLetterDate,
  formatLetterDate,
  CRA_ADDRESSES,
  hashContent,
} from "./amelia-doctrine";
import type { CRA } from "@/types";
import { createLogger } from "./logger";

const log = createLogger("amelia-human-generator");

// =============================================================================
// TYPES
// =============================================================================

export interface HumanLetterGenerationInput {
  client: ClientPersonalInfo;
  accounts: DisputeAccount[];
  cra: CRA;
  flow: FlowType;
  round: number;
  lastDisputeDate?: string;
  organizationId?: string;
  // For regeneration with specific focus
  regenerationFocus?: "story" | "issue" | "demand";
}

export interface GeneratedHumanLetter {
  content: string;
  letterDate: Date;
  isBackdated: boolean;
  backdatedDays: number;
  tone: string;
  flow: FlowType;
  round: number;
  statute: string;
  contentHash: string;
  storyUsed: string;
  // Letter structure indicator
  letterStyle: "HUMAN_FIRST";
}

// =============================================================================
// HEADER GENERATION
// =============================================================================

/**
 * Generate the letter header (simplified format)
 */
function generateHeader(
  client: ClientPersonalInfo,
  cra: CRA,
  letterDate: Date
): string {
  const craInfo = CRA_ADDRESSES[cra];

  const lines = [
    formatLetterDate(letterDate),
    "",
    client.fullName,
    client.addressLine1,
  ];

  if (client.addressLine2) {
    lines.push(client.addressLine2);
  }

  lines.push(`${client.city}, ${client.state} ${client.zipCode}`);
  lines.push("");
  lines.push(craInfo.name);
  lines.push(...craInfo.lines);
  lines.push("");
  lines.push(`My name is ${client.fullName} and my Social Security Number ends in ${client.ssnLast4}.`);

  return lines.join("\n");
}

// =============================================================================
// ACCOUNT LIST GENERATION
// =============================================================================

/**
 * Generate simple account list
 */
function generateAccountList(
  accounts: DisputeAccount[],
  template: HumanFirstAmeliaTemplate
): string {
  if (accounts.length === 0) {
    return "";
  }

  const lines: string[] = [];

  if (accounts.length === 1) {
    // Single account - inline format
    const account = accounts[0];
    const issueType = determineIssueType(account.issues);
    let issueText = getHumanIssueTemplate(template, issueType);

    // Replace placeholders
    issueText = issueText.replace(/\{\{CREDITOR_NAME\}\}/g, account.creditorName);
    if (account.accountNumber) {
      issueText = issueText.replace(/\{\{ACCOUNT_NUMBER\}\}/g, account.accountNumber);
    }

    lines.push(issueText);
  } else {
    // Multiple accounts - list format
    lines.push("I have problems with these accounts:");
    lines.push("");

    accounts.forEach((account, index) => {
      const issueType = determineIssueType(account.issues);
      let issueText = getHumanIssueTemplate(template, issueType);

      // Replace placeholders
      issueText = issueText.replace(/\{\{CREDITOR_NAME\}\}/g, account.creditorName);
      if (account.accountNumber) {
        issueText = issueText.replace(/\{\{ACCOUNT_NUMBER\}\}/g, account.accountNumber);
      }

      // Simplify for list format
      const simplifiedIssue = issueText.split(".")[0] + ".";
      lines.push(`${index + 1}. ${account.creditorName}${account.accountNumber ? ` - ${account.accountNumber}` : ""}`);
      lines.push(`   ${simplifiedIssue}`);
    });
  }

  return lines.join("\n");
}

// =============================================================================
// STORY CONTEXT BUILDER
// =============================================================================

/**
 * Build story context from accounts
 */
function buildStoryContext(
  accounts: DisputeAccount[],
  flow: FlowType,
  round: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _client: ClientPersonalInfo
): StoryContext {
  // Get primary account for story context
  const primaryAccount = accounts[0];

  // Determine dispute type from account issues
  let disputeType: StoryContext["disputeType"] = "INACCURATE";

  if (primaryAccount?.issues && primaryAccount.issues.length > 0) {
    const issueType = determineIssueType(primaryAccount.issues);

    // Map issue type to story dispute type
    const issueToStoryType: Record<string, StoryContext["disputeType"]> = {
      notMine: "NOT_MINE",
      inaccurate: "INACCURATE",
      paid: "PAID",
      collection: "COLLECTION",
      tooOld: "TOO_OLD",
      latePayment: "INACCURATE",
      balance: "INACCURATE",
    };

    disputeType = issueToStoryType[issueType] || "INACCURATE";
  }

  // Override based on flow
  if (flow === "COLLECTION") {
    disputeType = "COLLECTION";
  } else if (flow === "CONSENT") {
    disputeType = "UNAUTHORIZED";
  }

  // Build client context based on account types and common scenarios
  // The story generator will use these to create relevant narratives
  const clientContext: StoryContext["clientContext"] = {
    hasFamily: true, // Most common - universal appeal
    isCarbuyer: primaryAccount?.accountType?.toLowerCase().includes("auto"),
    isHomebuyer: primaryAccount?.accountType?.toLowerCase().includes("mortgage"),
    isRenter: flow === "ACCURACY" && round === 1, // First-time disputes often about housing
  };

  return {
    disputeType,
    creditorName: primaryAccount?.creditorName || "the creditor",
    accountType: primaryAccount?.accountType,
    balance: primaryAccount?.balance,
    clientContext,
    flow: flow as "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO",
    round,
  };
}

// =============================================================================
// TONE DETERMINATION
// =============================================================================

/**
 * Determine tone based on round
 */
function determineTone(round: number): string {
  if (round === 1) return "HOPEFUL";
  if (round === 2) return "FRUSTRATED";
  if (round === 3) return "ANGRY";
  return "EXHAUSTED";
}

// =============================================================================
// MAIN GENERATOR
// =============================================================================

/**
 * Generate a complete human-first dispute letter
 */
export async function generateHumanFirstLetter(
  input: HumanLetterGenerationInput
): Promise<GeneratedHumanLetter> {
  const {
    client,
    accounts,
    cra,
    flow,
    round,
    lastDisputeDate,
    organizationId,
  } = input;

  log.info({ flow, round, cra, accountCount: accounts.length }, "Generating human-first letter");

  // Get template for this flow/round
  const template = getHumanFirstAmeliaTemplate(flow, round);
  if (!template) {
    throw new Error(`No human-first template found for ${flow} flow, round ${round}`);
  }

  const craInfo = CRA_ADDRESSES[cra];

  // Calculate letter date (30-day backdate for R1)
  const { letterDate, isBackdated, backdatedDays } = calculateLetterDate(round);

  // Generate header
  const header = generateHeader(client, cra, letterDate);

  // Build story context
  const storyContext = buildStoryContext(accounts, flow, round, client);

  // Generate story using AI
  const generatedStory = await generateRequiredStory(storyContext, organizationId);
  const storyParagraph = generatedStory.storyParagraph;

  // Generate follow-up opening for R2+
  let followUpOpening = "";
  if (round > 1 && template.followUpOpening) {
    followUpOpening = template.followUpOpening
      .replace(/\{\{PREVIOUS_DISPUTE_DATE\}\}/g, lastDisputeDate || "[previous dispute date]")
      .replace(/\{\{CREDITOR_NAME\}\}/g, accounts[0]?.creditorName || "the creditor");
    followUpOpening += "\n\n";
  }

  // Generate account list / issue section
  const issueSection = generateAccountList(accounts, template);

  // Get demand text
  const demandText = template.demandText;

  // Generate closing signature
  const closing = `Sincerely,

${client.fullName}`;

  // Get legal footer
  const legalFooter = template.legalFooter;

  // Assemble the letter
  const letterParts = [
    header,
    "",
    // Story comes first (the heart of human-first)
    storyParagraph,
    "",
    // Follow-up reference for R2+
    followUpOpening,
    // Issue section
    issueSection,
    "",
    // Demand
    demandText,
    "",
    // Closing
    closing,
    "",
    // Legal footer at the end (like fine print)
    legalFooter,
  ];

  // Clean up the content
  let content = letterParts
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Calculate content hash
  const contentHash = hashContent(content);

  // Determine tone
  const tone = determineTone(round);

  log.info({ contentHash, tone, storyHash: generatedStory.storyHash }, "Human-first letter generated");

  return {
    content,
    letterDate,
    isBackdated,
    backdatedDays,
    tone,
    flow,
    round,
    statute: template.statute,
    contentHash,
    storyUsed: storyParagraph,
    letterStyle: "HUMAN_FIRST",
  };
}

/**
 * Regenerate just the story for an existing letter
 */
export async function regenerateStory(
  input: Omit<HumanLetterGenerationInput, "regenerationFocus">
): Promise<string> {
  const { client, accounts, flow, round, organizationId } = input;

  const storyContext = buildStoryContext(accounts, flow, round, client);
  const generatedStory = await generateRequiredStory(storyContext, organizationId);

  return generatedStory.storyParagraph;
}

/**
 * Quick check if human-first templates are available for a flow
 */
export function hasHumanFirstTemplate(flow: FlowType, round: number): boolean {
  return getHumanFirstAmeliaTemplate(flow, round) !== undefined;
}
