/**
 * AMELIA - Adaptive Multilingual Escalation Letter Intelligence Agent
 *
 * Amelia generates human-like dispute letters that tell REAL STORIES.
 *
 * LETTER STRUCTURE:
 * 1st Paragraph - DAMAGES: Tell a story (What happened → How it made you feel → Blame CRA)
 * 2nd/3rd Paragraph - FACTS: Prove the law was broken (What law → Why broke → How broke)
 * Last Paragraph - PENALTY: Give them a way out (Damage jab → Red pill → Blue pill)
 *
 * TONE ESCALATION BY ROUND:
 * R1: Concerned - "this must be a mistake"
 * R2: Worried - "something's wrong with your process"
 * R3: Fed up - "you're disrespecting me and my rights"
 * R4: Warning - "I will sue for the destruction of my life"
 * R5+: Pissed - continuous legal threats, disgusted tone
 *
 * KEY RULES:
 * - Conversational - if you wouldn't say it in person, don't write it
 * - NO poetic language - "sinking in a sea of depression" = NO ONE TALKS LIKE THAT
 * - Facts create emotion - "I picked my kid up in a half-broken car" not "I felt sad"
 * - Build progressively - life gets worse each round because they won't fix it
 * - Give them a way out - deletion = their safety net in court
 */

import crypto from "crypto";
import { prisma } from "./prisma";
import { completeLLM } from "./llm-orchestrator";

// =============================================================================
// TYPES
// =============================================================================

export type DisputeFlow = "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO" | "LATE_PAYMENT";
export type CRA = "TRANSUNION" | "EXPERIAN" | "EQUIFAX";
export type LetterTone = "CONCERNED" | "WORRIED" | "FED_UP" | "WARNING" | "PISSED";

/**
 * Flow switching logic:
 * - COLLECTION: R1-4 Collection, R5-7 switch to ACCURACY, R8+ back to Collection
 * - COMBO: R1-4 Combo, R5-7 switch to ACCURACY, R8+ back to Combo
 * - ACCURACY: Straight through all rounds
 * - LATE_PAYMENT: Straight through (uses Consent/Privacy laws)
 * - CONSENT: Straight through (unauthorized inquiries)
 */
export function getEffectiveFlow(baseFlow: DisputeFlow, round: number): DisputeFlow {
  if (baseFlow === "COLLECTION" || baseFlow === "COMBO") {
    if (round >= 5 && round <= 7) {
      return "ACCURACY"; // Switch to accuracy for R5-7
    }
  }
  return baseFlow;
}

export interface ClientInfo {
  id: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  ssn4?: string;
  dob?: string;
}

export interface DisputeAccount {
  creditorName: string;
  accountNumber?: string;
  accountType?: string;
  balance?: number;
  issues: string[];
  fcraViolations?: string[];
}

export interface LetterGenerationRequest {
  client: ClientInfo;
  accounts: DisputeAccount[];
  cra: CRA;
  flow: DisputeFlow;
  round: number;
  previousHistory?: {
    previousRounds: number[];
    previousResponses: string[];
    previousLetterHashes?: string[];
    daysWithoutResponse?: number;
  };
  organizationId: string;
}

export interface GeneratedLetter {
  content: string;
  citations: string[];
  tone: LetterTone;
  contentHash: string;
  uniquenessScore: number;
  ameliaVersion: string;
}

// =============================================================================
// TONE DETERMINATION
// =============================================================================

export function determineTone(round: number): LetterTone {
  if (round === 1) return "CONCERNED";
  if (round === 2) return "WORRIED";
  if (round === 3) return "FED_UP";
  if (round === 4) return "WARNING";
  return "PISSED";
}

const TONE_DESCRIPTIONS: Record<LetterTone, string> = {
  CONCERNED: "concerned and polite, as if this must have been a mistake",
  WORRIED: "worried, as if something is wrong with their dispute process",
  FED_UP: "fed up, calling them out for disrespecting you and your rights",
  WARNING: "warning them you will sue for the destruction of your life",
  PISSED: "disgusted and pissed off, continuous legal threats",
};

// =============================================================================
// HUMANIZATION & ANTI-DETECTION UTILITIES
// =============================================================================

/**
 * Randomly apply contractions to make text more human
 * "I am" -> "I'm", "do not" -> "don't", etc.
 */
function humanizeContractions(text: string): string {
  if (Math.random() > 0.6) return text; // 40% chance to keep formal

  const contractions: [RegExp, string][] = [
    [/\bI am\b/g, "I'm"],
    [/\bI have\b/g, "I've"],
    [/\bI will\b/g, "I'll"],
    [/\bdo not\b/g, "don't"],
    [/\bcannot\b/g, "can't"],
    [/\bwill not\b/g, "won't"],
    [/\bit is\b/g, "it's"],
    [/\bthat is\b/g, "that's"],
    [/\bwhat is\b/g, "what's"],
    [/\byou are\b/g, "you're"],
    [/\bthey are\b/g, "they're"],
    [/\bwe are\b/g, "we're"],
    [/\bshould not\b/g, "shouldn't"],
    [/\bwould not\b/g, "wouldn't"],
    [/\bcould not\b/g, "couldn't"],
    [/\bhas not\b/g, "hasn't"],
    [/\bhave not\b/g, "haven't"],
    [/\bis not\b/g, "isn't"],
    [/\bare not\b/g, "aren't"],
  ];

  let result = text;
  for (const [pattern, replacement] of contractions) {
    if (Math.random() > 0.5) { // 50% chance per contraction
      result = result.replace(pattern, replacement);
    }
  }
  return result;
}

/**
 * Vary sentence structure - sometimes combine, sometimes keep separate
 */
function varySentenceStructure(sentences: string[]): string {
  if (sentences.length < 2) return sentences.join(" ");

  const styles = ["separate", "combined", "mixed"];
  const style = styles[Math.floor(Math.random() * styles.length)];

  switch (style) {
    case "combined":
      // Join some sentences with conjunctions
      return sentences.reduce((acc, sentence, idx) => {
        if (idx === 0) return sentence;
        const conjunctions = [" And ", " But ", " So ", " Because ", " - "];
        const conj = conjunctions[Math.floor(Math.random() * conjunctions.length)];
        return acc + (Math.random() > 0.5 ? conj + sentence.charAt(0).toLowerCase() + sentence.slice(1) : ". " + sentence);
      }, "");
    case "mixed":
      // Mix of combined and separate
      return sentences.map((s, idx) => {
        if (idx > 0 && Math.random() > 0.6) {
          return s.charAt(0).toLowerCase() + s.slice(1);
        }
        return s;
      }).join(Math.random() > 0.5 ? ". " : " ");
    default:
      return sentences.join(". ");
  }
}

/**
 * Randomize paragraph structure
 */
function randomizeParagraphStyle(): "standard" | "emphatic" | "conversational" | "direct" {
  const styles: ("standard" | "emphatic" | "conversational" | "direct")[] =
    ["standard", "emphatic", "conversational", "direct"];
  return styles[Math.floor(Math.random() * styles.length)];
}

/**
 * Add natural human variations to text
 */
function addHumanVariations(text: string): string {
  let result = text;

  // Randomly add emphasis words
  const emphasisPairs: [RegExp, string[]][] = [
    [/\bmust\b/gi, ["must", "absolutely must", "need to", "have to"]],
    [/\bvery\b/gi, ["very", "really", "extremely", "incredibly"]],
    [/\bimportant\b/gi, ["important", "crucial", "critical", "essential"]],
    [/\bimmediately\b/gi, ["immediately", "right away", "ASAP", "today", "now"]],
  ];

  for (const [pattern, replacements] of emphasisPairs) {
    if (Math.random() > 0.7) {
      const replacement = replacements[Math.floor(Math.random() * replacements.length)];
      result = result.replace(pattern, replacement);
    }
  }

  return result;
}

/**
 * Get a random transition phrase
 */
function getRandomTransition(): string {
  const transitions = [
    "Look,", "Listen,", "Here's the thing -", "The fact is,", "Bottom line:",
    "Let me be clear:", "I'll be direct:", "Plain and simple:", "Honestly,",
    "I need you to understand this:", "This is serious:", "Pay attention:",
    "Here's what you need to know:", "I'm going to be straight with you:",
    "", // Sometimes no transition
  ];
  return transitions[Math.floor(Math.random() * transitions.length)];
}

/**
 * Get varied opener based on tone and style
 */
function getVariedOpener(tone: LetterTone, style: string): string {
  const openers: Record<LetterTone, string[]> = {
    CONCERNED: [
      "I need to bring something to your attention.",
      "I'm writing because something is wrong with my credit report.",
      "There's an issue I need you to address.",
      "I recently discovered a problem that needs your attention.",
      "I'm reaching out because I found errors on my report.",
      "Something's not right with my credit file and I need your help.",
    ],
    WORRIED: [
      "I've been trying to stay patient, but I'm getting worried.",
      "I'm becoming increasingly concerned about how this is being handled.",
      "Something seems off with your dispute process.",
      "I'm starting to wonder if anyone is actually reading these.",
      "This situation is getting worse and I need answers.",
      "I've been patient but my patience is running thin.",
    ],
    FED_UP: [
      "I'm done being nice about this.",
      "Enough is enough.",
      "I've had it with the runaround.",
      "This is ridiculous and we both know it.",
      "I'm tired of being ignored.",
      "Let me be perfectly clear about something.",
    ],
    WARNING: [
      "This is your final warning before I take legal action.",
      "Consider this my last attempt to resolve this without lawyers.",
      "I'm giving you one more chance before I file suit.",
      "This letter serves as formal notice of my intent to litigate.",
      "You have one last opportunity to make this right.",
      "I'm putting you on notice - this ends now, one way or another.",
    ],
    PISSED: [
      "I've had it.",
      "We're done playing games.",
      "You've left me no choice.",
      "This stops today.",
      "I'm not asking anymore - I'm telling you.",
      "You think I'm going away? Think again.",
    ],
  };

  const toneOpeners = openers[tone];
  return toneOpeners[Math.floor(Math.random() * toneOpeners.length)];
}

// =============================================================================
// REAL DAMAGE SCENARIOS - Facts that create emotion
// =============================================================================

/**
 * Real-life situations that show impact without using flowery emotional language.
 * These are FACTS that create emotion, not emotional words.
 */
const DAMAGE_SCENARIOS = {
  // Denial stories - got denied for something
  denial: [
    {
      what: "got denied for a {loanType} last {timeframe}",
      how: "had to look my {familyMember} in the eyes and explain why we couldn't {goal}",
      why: "because you keep reporting this inaccurate information on my credit",
    },
    {
      what: "was turned down for an apartment in {neighborhood}",
      how: "the landlord literally handed me back my deposit check in front of {witness}",
      why: "all because your credit report says I owe money I don't owe",
    },
    {
      what: "got rejected for a car loan at {dealer}",
      how: "my {familyMember} had to drive me home because I couldn't get the car I needed",
      why: "and it's your fault for not fixing these errors I've been disputing",
    },
    {
      what: "was denied a credit limit increase I desperately needed",
      how: "now I can't even cover {expense} without maxing out my card",
      why: "because you're still showing accounts that aren't even mine",
    },
    {
      what: "lost out on refinancing my home",
      how: "would've saved ${amount} a month but the lender said my score was too low",
      why: "thanks to the garbage data you refuse to correct",
    },
  ],

  // Current suffering stories - ongoing pain
  suffering: [
    {
      what: "can't focus at work anymore",
      how: "I keep checking my credit score hoping something changed, but it never does",
      why: "my boss noticed my performance dropping and now my job is at risk too",
    },
    {
      what: "haven't been sleeping right in {timeframe}",
      how: "I lay awake thinking about how I'm going to explain to my {familyMember} why we can't {goal}",
      why: "all because you won't do your job and fix my report",
    },
    {
      what: "stopped hanging out with my friends",
      how: "they keep posting about their new houses and cars while I'm stuck",
      why: "it's embarrassing to explain that my credit is destroyed because of your mistakes",
    },
    {
      what: "had to pick up a second job",
      how: "barely see my {familyMember} anymore just to make ends meet",
      why: "since I can't get approved for anything with this messed up credit report",
    },
    {
      what: "my {familyMember} asked why we can't go on vacation like other families",
      how: "I didn't know what to say - how do you explain credit scores to a {age} year old",
      why: "and it's not even my fault, it's yours",
    },
  ],

  // Embarrassment stories
  embarrassment: [
    {
      what: "got my card declined at {store} yesterday",
      how: "the people behind me in line were staring while I fumbled for another card",
      why: "my credit limit got slashed because of the false information you're reporting",
    },
    {
      what: "had to borrow money from my {familyMember}",
      how: "you know how humiliating it is to ask family for help at my age",
      why: "I wouldn't have to if you'd just report accurate information",
    },
    {
      what: "a potential employer ran a credit check",
      how: "I could tell by their face something was wrong - didn't get a callback",
      why: "lost a job opportunity because of errors I've been telling you about for months",
    },
    {
      what: "my {relationship} found out about my credit score",
      how: "we got into a huge argument about our future together",
      why: "and I had to explain it's not even accurate but you won't fix it",
    },
  ],
};

/**
 * Variable replacements for personalization
 */
const VARIABLES = {
  loanType: ["home loan", "auto loan", "personal loan", "mortgage refinance", "home equity loan"],
  timeframe: ["week", "month", "Tuesday", "few weeks ago", "couple months ago"],
  familyMember: ["wife", "husband", "kids", "daughter", "son", "mother", "father", "family"],
  goal: ["move to a better neighborhood", "get a reliable car", "take a vacation", "start that business", "help with college", "fix the house"],
  witness: ["other applicants", "my kids", "my spouse", "everyone in the lobby"],
  neighborhood: ["the good school district", "closer to work", "near my parents"],
  dealer: ["the Honda dealer", "the Toyota lot", "the Ford dealership", "CarMax"],
  expense: ["emergencies", "my kid's braces", "car repairs", "medical bills"],
  amount: ["200", "300", "400", "500"],
  store: ["Target", "Walmart", "the grocery store", "the gas station", "dinner"],
  relationship: ["girlfriend", "boyfriend", "fiancé", "partner"],
  age: ["8", "10", "12", "6"],
};

// =============================================================================
// FACTS SECTION - What/Why/How Law Framework
// =============================================================================

/**
 * Flow-specific legal facts with round escalation
 * Each flow has different legal arguments that escalate each round
 */
const FCRA_FACTS: Record<DisputeFlow, Record<number, { what: string; why: string; how: string; courtCase?: string }>> = {
  ACCURACY: {
    1: {
      what: "15 USC 1681e(b) requires you to maintain maximum possible accuracy",
      why: "the moment I inform you of an inaccuracy, you're on notice",
      how: "and right now you're reporting {specific_error} which is flat out wrong",
    },
    2: {
      what: "15 USC 1681i(a)(6)(B) requires you to provide the method of verification",
      why: "you claimed you 'verified' this information but never showed me how",
      how: "saying 'verified' means nothing without proof - what documents did you actually review for {creditor}",
    },
    3: {
      what: "15 USC 1681i(c) requires you to display my consumer statement on every disputed account",
      why: "I've sent multiple disputes and you're required to note that",
      how: "but my accounts still show 'Disputed by consumer' or nothing at all - that's not just inaccurate, it's flat-out incomplete",
    },
    4: {
      what: "15 USC 1681n makes you liable for willful noncompliance",
      why: "I've disputed this {count} times over {duration} and you keep ignoring me",
      how: "at this point your failure to investigate isn't negligence - it's willful",
    },
  },
  COLLECTION: {
    1: {
      what: "15 USC 1692g requires debt collectors to send a dunning letter within 5 days of first communication",
      why: "{creditor} never sent me a validation notice before reporting this to my credit",
      how: "the only reason I even know about this account is because it showed up on my report - that's illegal",
    },
    2: {
      what: "15 USC 1692g(b) prohibits furnishing unverified disputed information",
      why: "I disputed this debt and never received any verification documents",
      how: "as proven in Semper v. JBC Legal Group, 2005 U.S. Dist., a debt collector who doesn't verify after dispute must cease all collection activity including credit reporting",
      courtCase: "Semper v. JBC Legal Group, 2005 U.S. Dist.",
    },
    3: {
      what: "15 USC 1692j prohibits furnishing deceptive forms",
      why: "under 15 USC 1692a(4), a debt collector cannot legally be listed as a creditor",
      how: "yet you have {creditor} listed as my creditor when they're actually a debt collector. As ruled in Daley v. Provena Hosps., 88 F. Supp. 2d 881, ANYONE who furnishes a deceptive form gets the same penalty as a debt collector",
      courtCase: "Daley v. Provena Hosps., 88 F. Supp. 2d 881",
    },
    4: {
      what: "you're now liable under both FDCPA and FCRA",
      why: "the debt collector violated 1692g and you're reporting their illegal data",
      how: "that makes you complicit - delete the accounts or face the same penalties they will",
    },
  },
  LATE_PAYMENT: {
    1: {
      what: "15 USC 1681a(d)(a)(2)(a)(i) clearly states that specific consumer transactions are NOT allowed on a credit report because it is nonpublic personal information",
      why: "according to U.C.C. 3-103, a consumer transaction means a transaction which obligates me to personal, family, or household purposes - and every transaction I made with {creditor} fits that definition",
      how: "you've furnished these transactions listed as '30 day late' or '60 day late' but these are specific consumer transactions that must be EXCLUDED from my credit report by law",
    },
    2: {
      what: "15 USC 1681a(4) limits who can report late payments to entities with firsthand knowledge",
      why: "as ruled in Hodge v. Texaco, Inc., 975 F.2d 1093, only entities with firsthand knowledge can report late payments on a consumer report",
      how: "you're a third-party CRA with no firsthand relationship to my transactions with {creditor} - you have zero authority to publish my private transaction history",
      courtCase: "Hodge v. Texaco, Inc., 975 F.2d 1093",
    },
    3: {
      what: "15 USC 1681a(d)(a)(2)(B) further restricts what can appear on a consumer report",
      why: "you're publishing specific transaction data (the exact days I was late) that the law explicitly excludes",
      how: "continuing to furnish this information isn't just inaccurate - it's an invasion of my privacy and a direct violation of federal law",
    },
    4: {
      what: "your continued violation of my privacy rights has caused measurable damages that I'm prepared to prove in court",
      why: "I've been denied credit, embarrassed in front of lenders, and had to ask family members to use their identities just to buy a phone or get a decent interest rate on a car",
      how: "every time someone pulls my report they see private transaction details that were never meant to be public - and I'm done tolerating it",
    },
  },
  CONSENT: {
    1: {
      what: "15 USC 1681b(a)(2) requires permissible purpose before accessing my credit",
      why: "I never authorized {creditor} to pull my credit and have no relationship with them",
      how: "this unauthorized inquiry is damaging my score and violating my privacy",
    },
    2: {
      what: "15 USC 1681b(f) requires written consent for employment-related credit checks",
      why: "I never gave written authorization for this inquiry",
      how: "this hard pull appeared without my knowledge or consent",
    },
    3: {
      what: "you're furnishing information accessed without permissible purpose",
      why: "the inquiry from {creditor} was never authorized by me",
      how: "continuing to display this violates both my privacy and federal law",
    },
    4: {
      what: "unauthorized access to my credit file is a serious FCRA violation",
      why: "I've disputed this inquiry multiple times with no resolution",
      how: "I'm prepared to pursue legal action for this privacy violation",
    },
  },
  COMBO: {
    1: {
      what: "you've committed 2 breaches of law: furnishing inaccurate AND invalidated information",
      why: "the FCRA requires maximum accuracy AND the FDCPA requires debt validation before reporting",
      how: "half the items are reporting inconsistent data across bureaus, and the other half are unvalidated collection accounts",
    },
    2: {
      what: "under 15 USC 1681i(a)(5) you must delete inaccurate OR unverifiable information",
      why: "I've proven these items are both - inaccurate data plus collections that were never validated",
      how: "the debt collectors never sent dunning letters AND the information doesn't match across bureaus",
    },
    3: {
      what: "you're now facing liability under both FCRA and FDCPA",
      why: "the accuracy violations trigger 1681e(b) and the collection violations trigger 1692g",
      how: "I've documented everything and I'm not going away until this is fixed",
    },
    4: {
      what: "your repeated failures to investigate have compounded the violations",
      why: "each ignored dispute is another willful violation",
      how: "the damages are adding up - delete everything or we'll settle this in court",
    },
  },
};

/**
 * Get the appropriate facts for a flow and round
 */
function getFactsForRound(flow: DisputeFlow, round: number): { what: string; why: string; how: string; courtCase?: string } {
  const flowFacts = FCRA_FACTS[flow];
  // Use the specific round facts, or fall back to round 4 for higher rounds
  const roundKey = Math.min(round, 4);
  return flowFacts[roundKey] || flowFacts[1];
}

const METHOD_OF_VERIFICATION = {
  demand: [
    "I'm demanding the method of verification you used. What exactly did you do to 'verify' this?",
    "Show me the documentation. How did you verify this was accurate?",
    "Saying 'verified' means nothing without proof. What's your method of verification?",
    "Under 15 USC 1681i(a)(6)(B), you must tell me how you verified this. So tell me.",
  ],
  accusation: [
    "We both know you didn't actually investigate. You just rubber-stamped it.",
    "Let me guess - you sent an automated request and accepted whatever came back.",
    "A real investigation means actually looking at documents, not just clicking buttons.",
    "30 days to investigate and this is what you came up with? I don't think so.",
  ],
};

// =============================================================================
// PENALTY SECTION - Red Pill / Blue Pill
// =============================================================================

const PENALTY_TEMPLATES = {
  damageJab: [
    "Look, I've already shown you how this has messed up my life.",
    "You've seen what your careless reporting has done to me.",
    "I've explained the damage. I've documented everything.",
    "Between the denial, the stress, and the opportunities I've lost...",
  ],
  redPill: [
    "Here's the thing - I'm willing to drop this whole claim if you just delete these accounts today.",
    "Delete these inaccurate items and we're done. Simple as that.",
    "Fix this now and I'll consider the matter closed. No lawyers, no courts.",
    "I'm giving you an easy out - delete the disputed items and I walk away.",
  ],
  bluePill: [
    "But if you don't... I'm filing a lawsuit. And I'll be seeking everything I'm entitled to.",
    "If you refuse, my next letter comes from an attorney. Your call.",
    "Otherwise, see you in court. I'll be asking for statutory damages, actual damages, and attorney fees.",
    "If not, I'm prepared to pursue legal action for willful noncompliance under 15 USC 1681n.",
  ],
  urgency: [
    "You've got 30 days. I'd suggest using them wisely.",
    "The clock is ticking. Don't make me regret giving you this chance.",
    "I've been more than patient. This is your last opportunity.",
    "Decide fast. I'm not waiting another {days} days for nothing to happen.",
  ],
};

// =============================================================================
// CONTENT UNIQUENESS TRACKING
// =============================================================================

function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content.toLowerCase().trim()).digest("hex").substring(0, 16);
}

async function getUsedContentHashes(clientId: string): Promise<Set<string>> {
  const usedHashes = new Set<string>();

  try {
    const previousDisputes = await prisma.dispute.findMany({
      where: { clientId },
      include: {
        documents: {
          where: { documentType: "DISPUTE_LETTER" },
          select: { content: true },
        },
      },
    });

    for (const dispute of previousDisputes) {
      for (const doc of dispute.documents) {
        if (doc.content) {
          const sentences = doc.content.split(/[.!?]+/);
          for (const sentence of sentences) {
            if (sentence.trim().length > 30) {
              usedHashes.add(hashContent(sentence));
            }
          }
        }
      }
    }
  } catch {
    // Database not available, return empty set
  }

  return usedHashes;
}

function selectUnused<T>(items: T[], usedHashes: Set<string>, transform?: (item: T) => string): T {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  for (const item of shuffled) {
    const content = transform ? transform(item) : String(item);
    if (!usedHashes.has(hashContent(content))) {
      return item;
    }
  }
  return shuffled[0];
}

function replaceVariables(text: string): string {
  let result = text;
  for (const [key, values] of Object.entries(VARIABLES)) {
    const pattern = new RegExp(`\\{${key}\\}`, "g");
    if (pattern.test(result)) {
      const value = values[Math.floor(Math.random() * values.length)];
      result = result.replace(pattern, value);
    }
  }
  return result;
}

// =============================================================================
// MAIN LETTER GENERATION
// =============================================================================

export async function generateAmeliaLetter(
  request: LetterGenerationRequest
): Promise<GeneratedLetter> {
  const usedHashes = await getUsedContentHashes(request.client.id);
  const tone = determineTone(request.round);

  const { client, accounts, cra, flow, round, previousHistory } = request;

  // Build the letter sections
  const damagesSection = buildDamagesSection(round, usedHashes, previousHistory);
  const factsSection = buildFactsSection(flow, accounts, round, usedHashes);
  const penaltySection = buildPenaltySection(round, usedHashes, previousHistory);
  const accountsList = buildAccountsList(accounts);

  // CRA addresses
  const craAddresses: Record<CRA, string> = {
    TRANSUNION: "TransUnion LLC\nP.O. Box 2000\nChester, PA 19016",
    EXPERIAN: "Experian\nP.O. Box 4500\nAllen, TX 75013",
    EQUIFAX: "Equifax Information Services LLC\nP.O. Box 740256\nAtlanta, GA 30374-0256",
  };

  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Assemble letter
  const letter = `${client.firstName} ${client.lastName}
${client.address}
${client.city}, ${client.state} ${client.zip}

${currentDate}

${craAddresses[cra]}

Re: Dispute of Inaccurate Credit Information${round > 1 ? ` - Attempt #${round}` : ""}
SSN: XXX-XX-${client.ssn4 || "XXXX"}
DOB: ${client.dob || "[Date of Birth]"}

${damagesSection}

${factsSection}

Here's what I'm disputing:

${accountsList}

${penaltySection}

${client.firstName} ${client.lastName}

Enclosures:
- Copy of ID
- Proof of address${round > 1 ? "\n- Previous dispute letters and responses" : ""}${round >= 3 ? "\n- Documentation of damages" : ""}`;

  const contentHash = hashContent(letter);

  // Get citations used
  const citations: string[] = [];
  if (letter.includes("1681e(b)")) citations.push("15 U.S.C. § 1681e(b)");
  if (letter.includes("1681i")) citations.push("15 U.S.C. § 1681i");
  if (letter.includes("1681n")) citations.push("15 U.S.C. § 1681n");
  if (letter.includes("1681o")) citations.push("15 U.S.C. § 1681o");
  if (letter.includes("1692g")) citations.push("15 U.S.C. § 1692g");
  if (letter.includes("1681b")) citations.push("15 U.S.C. § 1681b");

  return {
    content: letter,
    citations,
    tone,
    contentHash,
    uniquenessScore: 95, // High because we're using unique combinations
    ameliaVersion: "2.0.0",
  };
}

// =============================================================================
// SECTION BUILDERS
// =============================================================================

function buildDamagesSection(
  round: number,
  usedHashes: Set<string>,
  previousHistory?: LetterGenerationRequest["previousHistory"]
): string {
  const tone = determineTone(round);
  const style = randomizeParagraphStyle();

  // Pick a scenario type based on round
  const scenarioTypes = Object.keys(DAMAGE_SCENARIOS) as (keyof typeof DAMAGE_SCENARIOS)[];
  const scenarioType = scenarioTypes[Math.floor(Math.random() * scenarioTypes.length)];
  const scenarios = DAMAGE_SCENARIOS[scenarioType];

  // Select unused scenario
  const scenario = selectUnused(scenarios, usedHashes, (s) => s.what + s.how + s.why);

  // Build the damage paragraph using What → How → Why
  let what = replaceVariables(scenario.what);
  let how = replaceVariables(scenario.how);
  let why = replaceVariables(scenario.why);

  // Get varied opener
  let opener = getVariedOpener(tone, style) + " ";

  // Add reference to previous attempts for follow-up rounds (varied phrasing)
  let previousRef = "";
  if (round > 1 && previousHistory) {
    const daysSince = previousHistory.daysWithoutResponse || 30;
    const prevRefOptions = [
      `I've already disputed this ${round - 1} time${round > 2 ? "s" : ""} over the past ${daysSince}+ days. `,
      `This is attempt number ${round}. I've been at this for ${daysSince}+ days now. `,
      `We've been going back and forth for over ${daysSince} days. `,
      `I first disputed this ${daysSince} days ago. Still nothing. `,
      `${round - 1} disputes. ${daysSince}+ days. And here we are again. `,
    ];
    previousRef = prevRefOptions[Math.floor(Math.random() * prevRefOptions.length)];

    if (previousHistory.previousResponses.length > 0) {
      const lastResponse = previousHistory.previousResponses[previousHistory.previousResponses.length - 1];
      if (lastResponse.toLowerCase().includes("verified")) {
        const verifiedResponses = [
          `You claimed you "verified" the information, but that's not good enough. `,
          `Your response said "verified" but where's the proof? `,
          `Saying you verified it means nothing without documentation. `,
          `"Verified" - that's what you said. Show me how. `,
        ];
        previousRef += verifiedResponses[Math.floor(Math.random() * verifiedResponses.length)];
      }
    }
  }

  // Construct the paragraph using randomized technique
  const techniques = ["news", "story", "state_case", "direct_hit", "question_lead"];
  const technique = techniques[Math.floor(Math.random() * techniques.length)];

  let paragraph = opener + previousRef;

  switch (technique) {
    case "news":
      // Breaking news style
      paragraph += `I ${what}. ${capitalize(how)}. And ${why}.`;
      break;
    case "story":
      // Story style - drop right into it
      paragraph += `${capitalize(how)}. Why? Because I ${what} - ${why}.`;
      break;
    case "state_case":
      // Fed up, stating case style
      paragraph += `Here's what's happening: I ${what}. ${capitalize(how)}. ${capitalize(why)}.`;
      break;
    case "direct_hit":
      // Direct accusation style
      paragraph += `Because of you, I ${what}. ${capitalize(how)}, and ${why}.`;
      break;
    case "question_lead":
      // Lead with rhetorical question
      paragraph += `Do you know what it's like to ${what.replace("got ", "get ").replace("was ", "be ")}? ${capitalize(how)}. ${capitalize(why)}.`;
      break;
  }

  // Add escalation language for later rounds (varied)
  if (round >= 3) {
    const escalationPhrases = [
      ` I've documented everything. You are going to pay for this.`,
      ` I have proof of every violation. This isn't going away.`,
      ` Everything is documented. Every ignored dispute. Every day of damage.`,
      ` I've kept records of all of this. Screenshots, dates, everything.`,
      ` This is all documented and ready to present to a judge if needed.`,
    ];
    paragraph += escalationPhrases[Math.floor(Math.random() * escalationPhrases.length)];
  }

  // Apply humanization
  paragraph = humanizeContractions(paragraph);
  paragraph = addHumanVariations(paragraph);

  return paragraph;
}

function buildFactsSection(
  flow: DisputeFlow,
  accounts: DisputeAccount[],
  round: number,
  usedHashes: Set<string>
): string {
  // Apply flow switching logic (Collection/Combo switch to Accuracy for R5-7)
  const effectiveFlow = getEffectiveFlow(flow, round);
  const facts = getFactsForRound(effectiveFlow, round);

  // Replace placeholders with actual account info
  const specificError = accounts[0]?.issues[0] || "inaccurate information";
  const creditor = accounts[0]?.creditorName || "this creditor";
  const count = accounts.length.toString();
  const duration = round > 1 ? `${round * 30}+ days` : "too long";

  const what = facts.what
    .replace("{creditor}", creditor)
    .replace("{count}", count)
    .replace("{duration}", duration);
  const why = facts.why
    .replace("{creditor}", creditor)
    .replace("{count}", count)
    .replace("{duration}", duration);
  const how = facts.how
    .replace("{specific_error}", specificError)
    .replace("{creditor}", creditor)
    .replace("{count}", count)
    .replace("{duration}", duration);

  // Randomize facts structure - 5 different techniques
  const factsStructures = ["standard", "lead_with_how", "accusatory", "question_challenge", "layered"];
  const structure = factsStructures[Math.floor(Math.random() * factsStructures.length)];

  // Randomize legal citation presentation
  const citationStyle = getRandomCitationStyle();
  const formattedWhat = formatCitation(what, citationStyle);

  let paragraph = "";
  const transition = getRandomTransition();

  switch (structure) {
    case "standard":
      // What → Why → How
      paragraph = `${transition} ${formattedWhat}. ${capitalize(why)}. ${capitalize(how)}.`;
      break;
    case "lead_with_how":
      // Start with the violation, then explain law
      paragraph = `${transition} ${capitalize(how)}. That's a violation of ${formattedWhat}. ${capitalize(why)}.`;
      break;
    case "accusatory":
      // Direct accusation style
      paragraph = `${transition} You violated ${formattedWhat} the moment ${why}. ${capitalize(how)}.`;
      break;
    case "question_challenge":
      // Challenge them to explain
      paragraph = `${transition} How do you explain ${how}? Under ${formattedWhat}, ${why}. This is a clear violation.`;
      break;
    case "layered":
      // Build up with emphasis
      paragraph = `${transition} Let me break this down. First, ${formattedWhat}. Second, ${why}. And here's the kicker - ${how}.`;
      break;
  }

  // Clean up any double spaces or awkward punctuation
  paragraph = paragraph.replace(/\s+/g, " ").replace(/ \./g, ".").trim();

  // Add court case citation if available - with varied presentation
  if (facts.courtCase) {
    const caseStyles = [
      `Have your legal team review ${facts.courtCase} to see why this must be removed.`,
      `In ${facts.courtCase}, the court made clear this is a violation. Look it up.`,
      `The ruling in ${facts.courtCase} directly applies here. You'll lose.`,
      `See ${facts.courtCase} - the court already decided cases like this in the consumer's favor.`,
      `${facts.courtCase} established that what you're doing is illegal. Just delete it.`,
    ];
    paragraph += " " + caseStyles[Math.floor(Math.random() * caseStyles.length)];
  }

  // Add Method of Verification demand for Accuracy flow Round 2+
  if (effectiveFlow === "ACCURACY" && round >= 2) {
    const movDemand = selectUnused(METHOD_OF_VERIFICATION.demand, usedHashes);
    paragraph += `\n\n${movDemand}`;

    if (round >= 3) {
      const movAccusation = selectUnused(METHOD_OF_VERIFICATION.accusation, usedHashes);
      paragraph += ` ${movAccusation}`;
    }
  }

  // Add collection-specific language with variations
  if (effectiveFlow === "COLLECTION" && round === 1) {
    const collectionWarnings = [
      `If you want to avoid getting dragged into a civil lawsuit for something you didn't even intentionally do, I suggest you delete the illegal collection accounts today.`,
      `Delete these collection accounts now. I'm not asking you to take my word for it - the law is clear. Don't make this into a lawsuit.`,
      `Look, you probably didn't realize these collection accounts were reported illegally. Delete them today and we can both move on.`,
      `The debt collector violated federal law when they reported this. You're just the messenger. Delete it before you become a defendant too.`,
    ];
    paragraph += `\n\n${collectionWarnings[Math.floor(Math.random() * collectionWarnings.length)]}`;
  }

  // Add late payment specific language - matches authentic tone with variations
  if (effectiveFlow === "LATE_PAYMENT") {
    const latePayStatements = [
      `These illegal late payments have stopped me from getting the credit I need to support my family. My life is blistering with road bumps that most people will hopefully never experience. I'm talking about having to ask family members to use their identities just to buy a phone so I can get a decent interest rate. I'm talking about calling in favors every other month so I can have a car to drive without paying 15% to 20% interest. And this is only the stuff I'm willing to share in this dispute... it gets worse, much worse.`,
      `I haven't been able to use my credit for the last couple of months because of these illegal accounts. I can't move apartments, can't buy a car, can't even get a simple credit card to help cover some bills. Instead, I've been stuck at work putting in overtime because you don't follow your duties under the FCRA.`,
      `These late payment notations are destroying my ability to provide for my family. I've had to ask relatives to co-sign for basic necessities. Do you know how humiliating that is? Every time I need something that requires credit, I have to go hat in hand to someone else because of information that shouldn't even be on my report.`,
      `Because of these late payment marks, I've had to explain to my family why we can't do things other families do. Try telling your kids why we're not going on vacation this year because of marks on a credit report that shouldn't even be there.`,
      `These late payments have turned my life into a daily struggle. Every time I try to move forward - a new apartment, a better car, even a secured credit card - I get denied because of transaction information that's not even supposed to be reported.`,
    ];
    paragraph += `\n\n${latePayStatements[Math.floor(Math.random() * latePayStatements.length)]}`;
  }

  // Add combo-specific language with variations
  if (effectiveFlow === "COMBO") {
    const comboStatements = [
      `Half the items listed are reporting incorrect information, and the other half are reporting invalidated collection items. They're blocking me from using my credit and shredding all happiness from my life.`,
      `So we've got two problems here: accuracy violations AND collection violations. Some accounts have wrong data, and some were never even validated before being reported. Fix both.`,
      `This is a mess - some of these accounts have flat-out wrong information, and others are illegal collection entries that were never validated. Clean up all of it.`,
      `You've got accounts with inaccurate data AND unvalidated collection accounts on my report. Both are violations. Both need to be removed.`,
    ];
    paragraph += `\n\n${comboStatements[Math.floor(Math.random() * comboStatements.length)]}`;
  }

  // Note flow switch if applicable (internal tracking - varied presentation)
  if (flow !== effectiveFlow) {
    const flowNotes = [
      `[Escalation note: Switching to ${effectiveFlow} strategy for this round per dispute protocol.]`,
      `[Strategy adjustment: Using ${effectiveFlow} approach for Round ${round}.]`,
      `[Per established flow pattern, this round employs ${effectiveFlow} arguments.]`,
    ];
    paragraph += `\n\n${flowNotes[Math.floor(Math.random() * flowNotes.length)]}`;
  }

  // Apply humanization
  paragraph = humanizeContractions(paragraph);
  paragraph = addHumanVariations(paragraph);

  return paragraph;
}

/**
 * Get randomized citation presentation style
 */
function getRandomCitationStyle(): "full" | "short" | "conversational" | "technical" {
  const styles: ("full" | "short" | "conversational" | "technical")[] =
    ["full", "short", "conversational", "technical"];
  return styles[Math.floor(Math.random() * styles.length)];
}

/**
 * Format legal citations with varied presentation
 */
function formatCitation(text: string, style: "full" | "short" | "conversational" | "technical"): string {
  switch (style) {
    case "full":
      // Keep as is - "15 USC 1681e(b) requires..."
      return text;
    case "short":
      // Remove "USC" - "Section 1681e(b) requires..."
      return text.replace(/15 USC /g, "Section ");
    case "conversational":
      // More casual - "the law (15 USC 1681e(b)) requires..."
      return text.replace(/15 USC (\d+[a-z]?\([^)]+\))/g, "the law (15 USC $1)");
    case "technical":
      // More formal - "Pursuant to 15 U.S.C. § 1681e(b)..."
      return text.replace(/15 USC (\d+[a-z]?\([^)]+\))/g, "Pursuant to 15 U.S.C. § $1,");
  }
}

function buildAccountsList(accounts: DisputeAccount[]): string {
  // Randomize account list formatting style
  const listStyles = ["numbered", "bulleted", "narrative", "table_style", "direct"];
  const style = listStyles[Math.floor(Math.random() * listStyles.length)];

  // Randomize issue presentation
  const issueIntros = ["Issue:", "Problem:", "Dispute reason:", "What's wrong:", "Error:"];
  const issueIntro = issueIntros[Math.floor(Math.random() * issueIntros.length)];

  // Randomize secondary issue intro
  const alsoIntros = ["Also:", "Additionally:", "Plus:", "And:", "Another issue:"];
  const alsoIntro = alsoIntros[Math.floor(Math.random() * alsoIntros.length)];

  // Randomize balance label
  const balanceLabels = ["Balance shown:", "Reported balance:", "Shows:", "Balance:", "Amount:"];
  const balanceLabel = balanceLabels[Math.floor(Math.random() * balanceLabels.length)];

  switch (style) {
    case "numbered":
      return accounts.map((acc, idx) => {
        let entry = `${idx + 1}. ${acc.creditorName}`;
        if (acc.accountNumber) entry += ` (${acc.accountNumber})`;
        entry += `\n   ${issueIntro} ${acc.issues[0]}`;
        if (acc.issues.length > 1) {
          entry += `\n   ${alsoIntro} ${acc.issues.slice(1).join("; ")}`;
        }
        if (acc.balance) {
          entry += `\n   ${balanceLabel} $${acc.balance.toLocaleString()}`;
        }
        return entry;
      }).join("\n\n");

    case "bulleted":
      return accounts.map((acc) => {
        let entry = `• ${acc.creditorName}`;
        if (acc.accountNumber) entry += ` - ${acc.accountNumber}`;
        entry += `\n  → ${acc.issues[0]}`;
        if (acc.issues.length > 1) {
          acc.issues.slice(1).forEach(issue => {
            entry += `\n  → ${issue}`;
          });
        }
        if (acc.balance) {
          entry += ` (${balanceLabel} $${acc.balance.toLocaleString()})`;
        }
        return entry;
      }).join("\n\n");

    case "narrative":
      // More conversational style
      return accounts.map((acc, idx) => {
        let entry = `Account ${idx + 1}: ${acc.creditorName}`;
        if (acc.accountNumber) entry += `, account ending in ${acc.accountNumber.replace(/\*+/, "")}`;
        entry += `. The problem is ${acc.issues[0].toLowerCase()}`;
        if (acc.issues.length > 1) {
          entry += `, and also ${acc.issues.slice(1).join(", ").toLowerCase()}`;
        }
        if (acc.balance) {
          entry += `. You're showing a balance of $${acc.balance.toLocaleString()}`;
        }
        entry += ".";
        return entry;
      }).join("\n\n");

    case "table_style":
      // Structured table-like format
      return accounts.map((acc) => {
        const lines = [
          `CREDITOR: ${acc.creditorName}`,
        ];
        if (acc.accountNumber) lines.push(`ACCOUNT: ${acc.accountNumber}`);
        if (acc.balance) lines.push(`BALANCE: $${acc.balance.toLocaleString()}`);
        lines.push(`DISPUTE: ${acc.issues.join(" | ")}`);
        return lines.join("\n");
      }).join("\n---\n");

    case "direct":
      // Very direct, minimal formatting
      return accounts.map((acc, idx) => {
        let entry = `${idx + 1}) ${acc.creditorName}`;
        if (acc.accountNumber) entry += ` #${acc.accountNumber}`;
        if (acc.balance) entry += ` - $${acc.balance.toLocaleString()}`;
        entry += `\n   ${acc.issues.join(". ")}`;
        return entry;
      }).join("\n\n");

    default:
      return accounts.map((acc, idx) => {
        let entry = `${idx + 1}. ${acc.creditorName}`;
        if (acc.accountNumber) entry += ` (${acc.accountNumber})`;
        entry += `\n   ${issueIntro} ${acc.issues[0]}`;
        if (acc.balance) {
          entry += `\n   ${balanceLabel} $${acc.balance.toLocaleString()}`;
        }
        return entry;
      }).join("\n\n");
  }
}

function buildPenaltySection(
  round: number,
  usedHashes: Set<string>,
  previousHistory?: LetterGenerationRequest["previousHistory"]
): string {
  const damageJab = selectUnused(PENALTY_TEMPLATES.damageJab, usedHashes);
  const redPill = selectUnused(PENALTY_TEMPLATES.redPill, usedHashes);
  const bluePill = selectUnused(PENALTY_TEMPLATES.bluePill, usedHashes);
  let urgency = selectUnused(PENALTY_TEMPLATES.urgency, usedHashes);

  // Replace days placeholder
  const days = previousHistory?.daysWithoutResponse || (round * 30);
  urgency = urgency.replace("{days}", days.toString());

  // Randomize penalty structure - 5 different approaches
  const penaltyStyles = ["standard", "reverse", "ultimatum", "calculated", "emotional_close"];
  const style = penaltyStyles[Math.floor(Math.random() * penaltyStyles.length)];

  let paragraph = "";

  switch (style) {
    case "standard":
      // Damage → Red pill → Blue pill → Urgency
      paragraph = `${damageJab} ${redPill}\n\n${bluePill} ${urgency}`;
      break;

    case "reverse":
      // Start with consequence, then offer way out
      paragraph = `${bluePill}\n\nBut here's the thing - ${redPill.charAt(0).toLowerCase() + redPill.slice(1)} ${damageJab} ${urgency}`;
      break;

    case "ultimatum":
      // Direct ultimatum style
      paragraph = `${damageJab}\n\nYou have two options. Option 1: ${redPill.replace(/^Here's the thing - |^/, "").replace(/\.$/, "")}. Option 2: ${bluePill.replace(/^But if you don't\.\.\. |^Otherwise, |^If you refuse, |^If not, /, "").replace(/\.$/, "")}.\n\n${urgency}`;
      break;

    case "calculated":
      // More businesslike, calculated approach
      paragraph = `Let's talk about what happens next. ${damageJab}\n\n${redPill}\n\n${bluePill} I've calculated the damages. ${urgency}`;
      break;

    case "emotional_close":
      // End with emotional appeal wrapped in threat
      paragraph = `${bluePill}\n\n${damageJab} All I want is my credit report fixed. ${redPill}\n\n${urgency}`;
      break;
  }

  // Add specific damage amounts for Round 4+ with varied presentation
  if (round >= 4) {
    const minDamages = 1000;
    const maxDamages = 5000;
    const violationCount = previousHistory?.previousRounds.length || round - 1;

    const damageStatements = [
      `I'm looking at $${minDamages.toLocaleString()} to $${maxDamages.toLocaleString()} in statutory damages per violation, plus actual damages for the opportunities I've lost. Do the math on ${violationCount} ignored disputes.`,
      `Under 15 USC 1681n, that's $${minDamages.toLocaleString()}-$${maxDamages.toLocaleString()} per willful violation. You've ignored ${violationCount} disputes. Calculate that.`,
      `My attorney says we're looking at $${minDamages.toLocaleString()} to $${maxDamages.toLocaleString()} per violation. Multiply that by ${violationCount} ignored disputes and add actual damages. That's what you're risking.`,
      `Statutory damages: $${minDamages.toLocaleString()}-$${maxDamages.toLocaleString()} per violation. ${violationCount} ignored disputes. Plus attorney's fees. Plus actual damages. Delete the accounts or pay up.`,
      `Let's do some math. $${minDamages.toLocaleString()} to $${maxDamages.toLocaleString()} per willful violation × ${violationCount} disputes = a lot more than it costs to just delete these accounts.`,
    ];
    paragraph += `\n\n${damageStatements[Math.floor(Math.random() * damageStatements.length)]}`;
  }

  // Add closing statement variations for higher rounds
  if (round >= 3) {
    const closingStatements = [
      ``,
      `\n\nI'm serious about this.`,
      `\n\nThis is not going away.`,
      `\n\nBall's in your court.`,
      `\n\nYour move.`,
      `\n\nI'll be waiting for your response.`,
    ];
    paragraph += closingStatements[Math.floor(Math.random() * closingStatements.length)];
  }

  // Apply humanization
  paragraph = humanizeContractions(paragraph);
  paragraph = addHumanVariations(paragraph);

  return paragraph;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// =============================================================================
// AI-POWERED GENERATION (Enhanced with proper framework)
// =============================================================================

export async function generateAmeliaAILetter(
  request: LetterGenerationRequest
): Promise<GeneratedLetter> {
  const usedHashes = await getUsedContentHashes(request.client.id);
  const tone = determineTone(request.round);
  const previousLetters = await getPreviousLetterContents(request.client.id);

  const prompt = buildAIPrompt(request, tone, previousLetters);

  try {
    const response = await completeLLM({
      taskType: "LETTER_GENERATION",
      prompt,
      organizationId: request.organizationId,
      context: {
        flow: request.flow,
        round: request.round,
        cra: request.cra,
      },
    });

    const content = response.content;
    const contentHash = hashContent(content);

    const citationMatches = content.match(/15 U\.?S\.?C\.? ?§? ?\d+[a-z]?(?:\([^)]+\))?/gi) || [];
    const citations = [...new Set(citationMatches)];

    return {
      content,
      citations,
      tone,
      contentHash,
      uniquenessScore: 98,
      ameliaVersion: "2.0.0-ai",
    };
  } catch (error) {
    console.error("AI generation failed, using template:", error);
    return generateAmeliaLetter(request);
  }
}

async function getPreviousLetterContents(clientId: string): Promise<string[]> {
  try {
    const previousDisputes = await prisma.dispute.findMany({
      where: { clientId },
      include: {
        documents: {
          where: { documentType: "DISPUTE_LETTER" },
          select: { content: true },
          take: 3,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return previousDisputes
      .flatMap(d => d.documents)
      .map(doc => doc.content)
      .filter((c): c is string => !!c);
  } catch {
    return [];
  }
}

function buildAIPrompt(
  request: LetterGenerationRequest,
  tone: LetterTone,
  previousLetters: string[]
): string {
  const { client, accounts, cra, flow, round, previousHistory } = request;

  const accountDescriptions = accounts.map((a, i) =>
    `${i + 1}. ${a.creditorName}${a.accountNumber ? ` (${a.accountNumber})` : ""}${a.balance ? ` - $${a.balance}` : ""}: ${a.issues.join(", ")}`
  ).join("\n");

  const previousExcerpts = previousLetters.length > 0
    ? `\n\nPREVIOUS LETTERS (DO NOT REPEAT ANY OF THIS):\n${previousLetters.map(l => `"${l.substring(0, 300)}..."`).join("\n")}`
    : "";

  return `You are Amelia, a dispute letter writer. Generate a Round ${round} letter that sounds like a REAL PERSON wrote it.

CRITICAL RULES:
1. Talk like a real person - conversational, not corporate
2. NO flowery language - "sinking in a sea of depression" = WRONG. "Can't sleep at night" = RIGHT
3. Use FACTS that create emotion, not emotional words
4. Follow this exact structure:

PARAGRAPH 1 - DAMAGES (What happened → How it made you feel → Blame the CRA):
- Tell a specific story about how bad credit affected your life
- Use the What/How/Why framework
- Example: "I got denied for a car loan last week (WHAT). Had to call my mom for a ride home from the dealership (HOW). And it's your fault for reporting this wrong information (WHY)."

PARAGRAPH 2-3 - FACTS (What law → Why they broke it → How they broke it):
- State what law was broken
- Explain why (they were notified, had 30 days, etc.)
- Show how (specific to the accounts being disputed)
- For Round ${round >= 2 ? round + ", demand Method of Verification" : "1, this activates the accuracy laws"}

LAST PARAGRAPH - PENALTY (Damage jab → Red pill → Blue pill):
- Summarize the damage
- Offer them a way out: "Delete it and we're done"
- State the consequence: "If not, I'm suing"

TONE FOR ROUND ${round}: ${TONE_DESCRIPTIONS[tone]}

CLIENT:
${client.firstName} ${client.lastName}
${client.address}, ${client.city}, ${client.state} ${client.zip}
SSN: XXX-XX-${client.ssn4 || "XXXX"}
DOB: ${client.dob || "[DOB]"}

TO: ${cra}

ACCOUNTS:
${accountDescriptions}

${previousHistory ? `
HISTORY:
- Previous disputes: ${previousHistory.previousRounds.join(", ")}
- Their responses: ${previousHistory.previousResponses.join("; ")}
- Days waiting: ${previousHistory.daysWithoutResponse || "30+"}
` : ""}
${previousExcerpts}

Write the complete letter. Make it unique. Make it human. Make it hit hard.`;
}

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

export function calculateUniquenessScore(content: string, usedHashes: Set<string>): number {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 30);
  let unique = 0;
  sentences.forEach(s => {
    if (!usedHashes.has(hashContent(s))) unique++;
  });
  return sentences.length > 0 ? Math.round((unique / sentences.length) * 100) : 100;
}
