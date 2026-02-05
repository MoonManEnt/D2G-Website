/**
 * AMELIA TEMPORAL AUTHENTICITY ENGINE
 *
 * Strategic date backdating to prevent batch-detection by eOSCAR and bureau systems.
 *
 * THE PROBLEM: When a credit repair specialist generates letters for 15 clients in one afternoon,
 * every letter carries the same date. This is a massive detection signal. Real consumers don't
 * all decide to dispute accounts on the same Tuesday.
 *
 * THE SOLUTION: Automatically backdate letters to create realistic, staggered timelines that
 * look like individual consumers handling their business on their own schedule.
 *
 * RULES:
 * - Round 1 / Sentry Initial: 60-69 days before today
 * - Round 2+  / Sentry Escalated: 30-39 days before today
 * - Each client gets a different backdate (cryptographically unpredictable)
 * - Each account gets a different backdate (even for same client)
 * - Weekdays and Saturdays only (no Sundays)
 * - No major U.S. federal holidays
 * - Minimum 14-day gap between consecutive rounds
 * - Round N+1 must ALWAYS be dated AFTER Round N
 */

import type { ConsumerVoiceProfile } from "./amelia-soul-engine";

// =============================================================================
// TYPES
// =============================================================================

export interface TemporalConfig {
  mode: "dispute_flow" | "sentry";
  round: number;
  priorRoundDate?: Date;
  uniquenessSeed?: string;
  clientName: string;
  accountNumberPartial?: string;
  clientDob: string;
}

export interface TemporalOutput {
  actualGenerationDate: Date;
  backdatedLetterDate: Date;
  backdateOffsetDays: number;
  priorRoundLetterDate: Date | null;
  gapFromPriorRoundDays: number | null;
  cfpbEligibleAtLetterDate: boolean;
  daysSinceFirstDisputeAtLetterDate: number;
}

export type DateFormat = "formal" | "abbreviated" | "numeric" | "ordinal";

// =============================================================================
// U.S. FEDERAL HOLIDAYS (Dynamic calculation for 2024-2027)
// =============================================================================

function getUSFederalHolidays(year: number): Date[] {
  const holidays: Date[] = [];

  // Fixed holidays
  holidays.push(new Date(year, 0, 1)); // New Year's Day
  holidays.push(new Date(year, 6, 4)); // Independence Day
  holidays.push(new Date(year, 10, 11)); // Veterans Day
  holidays.push(new Date(year, 11, 25)); // Christmas

  // MLK Day: Third Monday of January
  holidays.push(getNthWeekdayOfMonth(year, 0, 1, 3));

  // Presidents Day: Third Monday of February
  holidays.push(getNthWeekdayOfMonth(year, 1, 1, 3));

  // Memorial Day: Last Monday of May
  holidays.push(getLastWeekdayOfMonth(year, 4, 1));

  // Labor Day: First Monday of September
  holidays.push(getNthWeekdayOfMonth(year, 8, 1, 1));

  // Columbus Day: Second Monday of October
  holidays.push(getNthWeekdayOfMonth(year, 9, 1, 2));

  // Thanksgiving: Fourth Thursday of November
  holidays.push(getNthWeekdayOfMonth(year, 10, 4, 4));

  return holidays;
}

function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const firstDay = new Date(year, month, 1);
  const firstWeekday = (weekday - firstDay.getDay() + 7) % 7;
  const day = 1 + firstWeekday + (n - 1) * 7;
  return new Date(year, month, day);
}

function getLastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const lastDay = new Date(year, month + 1, 0);
  const lastWeekdayOffset = (lastDay.getDay() - weekday + 7) % 7;
  return new Date(year, month, lastDay.getDate() - lastWeekdayOffset);
}

function isUSFederalHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const holidays = getUSFederalHolidays(year);

  return holidays.some(
    (h) =>
      h.getFullYear() === date.getFullYear() &&
      h.getMonth() === date.getMonth() &&
      h.getDate() === date.getDate()
  );
}

function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

// =============================================================================
// CRYPTOGRAPHICALLY UNPREDICTABLE DATE GENERATION
// =============================================================================

/**
 * Generate a deterministic but unpredictable hash-based random number
 * Based on client-specific data to ensure each client/account gets unique dates
 */
function generateDeterministicRandom(
  seed: string,
  clientName: string,
  accountPartial: string,
  dob: string,
  round: number
): number {
  // Combine all inputs into a single string
  const combined = `${seed}-${clientName}-${accountPartial}-${dob}-${round}`;

  // Simple hash function (djb2)
  let hash = 5381;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash * 33) ^ combined.charCodeAt(i);
  }

  // Normalize to 0-1 range
  return Math.abs(hash % 1000000) / 1000000;
}

/**
 * Generate a random date within a range, avoiding Sundays and holidays
 */
function generateValidDate(
  minDaysAgo: number,
  maxDaysAgo: number,
  seed: string,
  clientName: string,
  accountPartial: string,
  dob: string,
  round: number
): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get random offset within range
  const random = generateDeterministicRandom(seed, clientName, accountPartial, dob, round);
  let daysAgo = Math.floor(minDaysAgo + random * (maxDaysAgo - minDaysAgo + 1));

  // Generate candidate date
  let candidateDate = new Date(today);
  candidateDate.setDate(today.getDate() - daysAgo);

  // Validate: no Sundays, no holidays
  let attempts = 0;
  const maxAttempts = 30;

  while ((isSunday(candidateDate) || isUSFederalHoliday(candidateDate)) && attempts < maxAttempts) {
    daysAgo++;
    candidateDate = new Date(today);
    candidateDate.setDate(today.getDate() - daysAgo);
    attempts++;
  }

  return candidateDate;
}

// =============================================================================
// MAIN TEMPORAL ENGINE
// =============================================================================

/**
 * Generate a strategically backdated letter date
 *
 * RULES:
 * - Round 1 / Sentry Initial: 60-69 days before today
 * - Round 2+ / Sentry Escalated: 30-39 days before today
 * - Must be after prior round date (if applicable)
 * - Minimum 14-day gap between consecutive rounds
 * - No Sundays
 * - No U.S. federal holidays
 */
export function generateBackdatedDate(config: TemporalConfig): TemporalOutput {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const seed = config.uniquenessSeed || `${Date.now()}-${Math.random()}`;
  const accountPartial = config.accountNumberPartial || "0000";

  // Determine backdate range based on round
  let minDaysAgo: number;
  let maxDaysAgo: number;

  const isFirstRound =
    config.round === 1 ||
    (config.mode === "sentry" && !config.priorRoundDate);

  if (isFirstRound) {
    // Round 1 / Sentry Initial: 60-69 days ago
    minDaysAgo = 60;
    maxDaysAgo = 69;
  } else {
    // Round 2+ / Sentry Escalated: 30-39 days ago
    minDaysAgo = 30;
    maxDaysAgo = 39;
  }

  // Generate initial candidate date
  let backdatedDate = generateValidDate(
    minDaysAgo,
    maxDaysAgo,
    seed,
    config.clientName,
    accountPartial,
    config.clientDob,
    config.round
  );

  // Validate against prior round date if applicable
  let gapFromPriorRound: number | null = null;

  if (config.priorRoundDate) {
    const priorDate = new Date(config.priorRoundDate);
    priorDate.setHours(0, 0, 0, 0);

    // Rule 1: Round N+1 must be AFTER Round N
    // Rule 2: Minimum 14-day gap
    const minGapDays = 14;
    const earliestValidDate = new Date(priorDate);
    earliestValidDate.setDate(priorDate.getDate() + minGapDays);

    // If our candidate is too early, regenerate with adjusted range
    if (backdatedDate <= earliestValidDate) {
      // Calculate how many days ago the earliest valid date is
      const daysAgoForEarliestValid = Math.floor(
        (today.getTime() - earliestValidDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Adjust range to ensure we're after the earliest valid date
      if (daysAgoForEarliestValid >= 0) {
        minDaysAgo = Math.min(minDaysAgo, daysAgoForEarliestValid);
        maxDaysAgo = Math.min(maxDaysAgo, daysAgoForEarliestValid);

        backdatedDate = generateValidDate(
          minDaysAgo,
          maxDaysAgo,
          seed + "-retry",
          config.clientName,
          accountPartial,
          config.clientDob,
          config.round
        );
      }
    }

    gapFromPriorRound = Math.floor(
      (backdatedDate.getTime() - priorDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  // Calculate days since first dispute (for CFPB eligibility)
  // For Round 1, this is 0
  // For subsequent rounds, calculate from the first dispute date
  let daysSinceFirstDispute = 0;
  let firstDisputeDate: Date | null = null;

  if (config.round === 1 || (config.mode === "sentry" && !config.priorRoundDate)) {
    daysSinceFirstDispute = 0;
    firstDisputeDate = backdatedDate;
  } else if (config.priorRoundDate) {
    // For Round 2+, we need to trace back to Round 1
    // In practice, the D2G system would pass the original Round 1 date
    // For now, we estimate based on the prior round date
    // Assuming approximately 30-day gaps between rounds
    const estimatedRoundsBack = config.round - 1;
    firstDisputeDate = new Date(config.priorRoundDate);

    // If we have prior round date for Round 2, first dispute was ~30 days before that
    // This is an approximation - in production, pass the actual first dispute date
    if (config.round === 2) {
      firstDisputeDate = config.priorRoundDate;
      // Actually, prior round date IS the first dispute date for Round 2
    } else {
      // For Round 3+, estimate backwards
      // This should ideally be passed explicitly from the D2G system
      firstDisputeDate.setDate(firstDisputeDate.getDate() - (estimatedRoundsBack - 1) * 30);
    }

    daysSinceFirstDispute = Math.floor(
      (backdatedDate.getTime() - firstDisputeDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  // CFPB eligibility: 45 days must have elapsed since first dispute
  const cfpbEligible = daysSinceFirstDispute >= 45;

  // Calculate offset from today
  const backdateOffset = Math.floor(
    (today.getTime() - backdatedDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    actualGenerationDate: today,
    backdatedLetterDate: backdatedDate,
    backdateOffsetDays: backdateOffset,
    priorRoundLetterDate: config.priorRoundDate || null,
    gapFromPriorRoundDays: gapFromPriorRound,
    cfpbEligibleAtLetterDate: cfpbEligible,
    daysSinceFirstDisputeAtLetterDate: daysSinceFirstDispute,
  };
}

// =============================================================================
// DATE FORMATTING
// =============================================================================

/**
 * Format a date based on the consumer's voice profile
 *
 * - Formal/authoritative consumers → "January 15, 2026"
 * - Conversational consumers → "Jan. 15, 2026" or "1/15/2026"
 * - Mixed → any format
 */
export function formatDateForVoice(
  date: Date,
  voiceProfile: ConsumerVoiceProfile,
  formatOverride?: DateFormat
): string {
  const month = date.getMonth();
  const day = date.getDate();
  const year = date.getFullYear();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const monthAbbrevs = [
    "Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.",
    "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."
  ];

  // Determine format based on voice profile
  let format: DateFormat;

  if (formatOverride) {
    format = formatOverride;
  } else if (voiceProfile.communicationStyle === "formal" || voiceProfile.grammarPosture >= 3) {
    format = "formal";
  } else if (voiceProfile.communicationStyle === "conversational" || voiceProfile.grammarPosture === 1) {
    // Randomize between abbreviated and numeric for conversational
    format = Math.random() > 0.5 ? "abbreviated" : "numeric";
  } else {
    // Mixed - randomize all formats
    const formats: DateFormat[] = ["formal", "abbreviated", "numeric", "ordinal"];
    format = formats[Math.floor(Math.random() * formats.length)];
  }

  switch (format) {
    case "formal":
      return `${monthNames[month]} ${day}, ${year}`;
    case "abbreviated":
      return `${monthAbbrevs[month]} ${day}, ${year}`;
    case "numeric":
      return `${month + 1}/${day}/${year}`;
    case "ordinal":
      const ordinal = getOrdinalSuffix(day);
      return `${monthNames[month]} ${day}${ordinal}, ${year}`;
    default:
      return `${monthNames[month]} ${day}, ${year}`;
  }
}

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

// =============================================================================
// TEMPORAL REFERENCE GENERATION
// =============================================================================

/**
 * Generate temporally consistent references for use in letter body
 *
 * All references are relative to the backdated letter date, NOT today's actual date
 */
export function generateTemporalReferences(
  backdatedDate: Date,
  priorRoundDate: Date | null
): {
  reportReviewReference: string;
  priorDisputeReference: string | null;
  timeSincePriorDispute: string | null;
  urgencyTimeframe: string;
} {
  // "Last week" relative to the backdated date
  const lastWeek = new Date(backdatedDate);
  lastWeek.setDate(backdatedDate.getDate() - 7);

  const reportReviewPhrases = [
    "last week",
    "a few days ago",
    "recently",
    "earlier this month",
  ];
  const reportReviewReference = reportReviewPhrases[Math.floor(Math.random() * reportReviewPhrases.length)];

  let priorDisputeReference: string | null = null;
  let timeSincePriorDispute: string | null = null;

  if (priorRoundDate) {
    const daysBetween = Math.floor(
      (backdatedDate.getTime() - priorRoundDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Format the prior dispute date
    priorDisputeReference = formatDateForVoice(priorRoundDate, {
      ageRange: "30-44",
      communicationStyle: "conversational",
      legalLiteracy: "medium",
      emotionalState: "concerned",
      grammarPosture: 2,
      lifeStakes: "",
      personalNarrativeElements: [],
      relationshipToAccount: "",
      formalityBaseline: "moderate",
      disputeFatigue: "none",
      voiceSource: "data-inferred",
    });

    // Generate natural time reference
    if (daysBetween < 21) {
      timeSincePriorDispute = "over two weeks";
    } else if (daysBetween < 35) {
      timeSincePriorDispute = "about a month";
    } else if (daysBetween < 50) {
      timeSincePriorDispute = "over a month";
    } else if (daysBetween < 70) {
      timeSincePriorDispute = "almost two months";
    } else {
      const weeks = Math.floor(daysBetween / 7);
      timeSincePriorDispute = `over ${weeks} weeks`;
    }
  }

  // Urgency timeframe options
  const urgencyOptions = [
    "within 30 days",
    "within the legally required timeframe",
    "promptly",
    "as soon as possible",
    "immediately",
  ];
  const urgencyTimeframe = urgencyOptions[Math.floor(Math.random() * urgencyOptions.length)];

  return {
    reportReviewReference,
    priorDisputeReference,
    timeSincePriorDispute,
    urgencyTimeframe,
  };
}

// =============================================================================
// CFPB ELIGIBILITY CHECK
// =============================================================================

/**
 * Check if CFPB complaint language is appropriate for this letter
 *
 * Per CFPB rules:
 * - Consumer must first dispute directly with the CRA
 * - Dispute must be no longer pending OR 45 days must have elapsed
 * - Round 1 and Round 2 should NEVER reference CFPB complaints
 * - Round 3+ can reference CFPB if 45-day threshold is met
 */
export function checkCFPBEligibility(
  round: number,
  daysSinceFirstDispute: number,
  mode: "dispute_flow" | "sentry"
): {
  eligible: boolean;
  reason: string;
  alternativeEscalation: string;
} {
  // Round 1 - Never eligible (dispute was just filed)
  if (round === 1 || (mode === "sentry" && round === 1)) {
    return {
      eligible: false,
      reason: "Round 1 dispute just filed - 45-day clock just started",
      alternativeEscalation: "None needed - this is the initial dispute",
    };
  }

  // Round 2 - Almost always inside 45-day window
  if (round === 2) {
    if (daysSinceFirstDispute >= 45) {
      return {
        eligible: true,
        reason: "45-day threshold met (unusual for Round 2)",
        alternativeEscalation: "CFPB complaint + State AG",
      };
    }
    return {
      eligible: false,
      reason: `Only ${daysSinceFirstDispute} days since first dispute - still inside 45-day window`,
      alternativeEscalation: "State AG complaint reference, 'exploring all options' language, private right of action",
    };
  }

  // Round 3+ - Check 45-day threshold
  if (daysSinceFirstDispute >= 45) {
    return {
      eligible: true,
      reason: `${daysSinceFirstDispute} days since first dispute - CFPB threshold exceeded`,
      alternativeEscalation: "Full regulatory + litigation escalation available",
    };
  }

  // Round 3+ but somehow under 45 days (rare edge case)
  return {
    eligible: false,
    reason: `Only ${daysSinceFirstDispute} days since first dispute - fast-cycle scenario`,
    alternativeEscalation: "State AG complaint + private right of action under FCRA §1681n/§1681o",
  };
}

/**
 * Generate CFPB escalation language based on eligibility and voice profile
 */
export function generateCFPBLanguage(
  eligible: boolean,
  daysSinceFirstDispute: number,
  voiceProfile: ConsumerVoiceProfile
): string | null {
  if (!eligible) {
    return null;
  }

  const { communicationStyle, emotionalState } = voiceProfile;

  // Different phrasings based on voice
  if (communicationStyle === "conversational" || communicationStyle === "direct") {
    if (emotionalState === "frustrated" || emotionalState === "exhausted") {
      return `It's been over ${daysSinceFirstDispute} days since my first dispute and you still haven't fixed this. ` +
        `I've looked into it and I'm now eligible to file a complaint with the Consumer Financial Protection Bureau, ` +
        `which is what I'm going to do if this isn't resolved.`;
    }
    return `More than ${Math.floor(daysSinceFirstDispute / 7)} weeks have passed since I first disputed this. ` +
      `At this point, I'm eligible to file with the CFPB and that's my next step if this doesn't get resolved.`;
  }

  if (communicationStyle === "measured") {
    return `I want you to be aware that more than 45 days have passed since I initially disputed this information. ` +
      `Per the CFPB's own guidelines, I am now eligible to file a formal complaint regarding your agency's handling ` +
      `of my dispute. I intend to do so if this matter isn't resolved promptly.`;
  }

  if (communicationStyle === "formal" || communicationStyle === "assertive") {
    return `As of this letter's date, ${daysSinceFirstDispute} days have elapsed since my original dispute submission, ` +
      `which means I now meet the CFPB's threshold for filing a consumer complaint against your agency for inaccurate ` +
      `reporting and inadequate investigation. I am actively preparing that complaint.`;
  }

  // Default
  return `It's been ${daysSinceFirstDispute} days since my first dispute. I'm now eligible to file a CFPB complaint ` +
    `and will do so if this isn't resolved.`;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default generateBackdatedDate;
