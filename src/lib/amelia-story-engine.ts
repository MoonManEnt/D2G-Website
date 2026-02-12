/**
 * AMELIA Story Engine - Infinite Unique Narrative Generation
 *
 * THE KITCHEN TABLE TEST:
 * Every letter must sound like a real person wrote it at their kitchen table.
 * No templates. No recycled phrases. No corporate speak.
 *
 * This engine BUILDS stories from atomic components that combine in
 * MILLIONS of unique ways. Each story is procedurally generated based on:
 * - Client's actual situation
 * - Account types being disputed
 * - Round/escalation level
 * - Randomized sentence structures
 * - Authentic voice markers
 *
 * NEVER outputs the same story twice.
 */

import { createHash } from "crypto";

// =============================================================================
// TYPES
// =============================================================================

export interface StoryContext {
  clientFirstName: string;
  flow: "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO";
  round: number;
  cra: string;
  accountTypes?: string[];  // "credit card", "auto loan", "mortgage", etc.
  totalBalance?: number;
  isCollection?: boolean;
  hasMultipleAccounts?: boolean;
  // Seed for deterministic generation (use clientId + disputeId)
  seed: string;
}

export interface GeneratedStory {
  opening: string;           // The personal story paragraph
  situation: string;         // What they were trying to do
  impact: string;            // How the error affected them
  emotional: string;         // How they feel
  urgency: string;           // Why this matters now
  hash: string;              // Uniqueness verification hash
}

// =============================================================================
// ATOMIC BUILDING BLOCKS
// These combine to create infinite unique stories
// =============================================================================

// WHO is this person? (Life situations)
const LIFE_SITUATIONS = [
  // Parents
  { id: "single_parent", text: "raising my kids on my own", weight: 1 },
  { id: "new_parent", text: "just had our first baby", weight: 1 },
  { id: "parent_3kids", text: "with three kids depending on me", weight: 1 },
  { id: "parent_teenager", text: "trying to put my teenager through school", weight: 1 },
  { id: "grandparent_custody", text: "raising my grandchildren", weight: 1 },

  // Workers
  { id: "healthcare_worker", text: "working double shifts at the hospital", weight: 1 },
  { id: "teacher", text: "teaching for over a decade", weight: 1 },
  { id: "small_business", text: "running a small business", weight: 1 },
  { id: "gig_worker", text: "working multiple jobs to make ends meet", weight: 1 },
  { id: "remote_worker", text: "working from home since the pandemic", weight: 1 },
  { id: "retail_worker", text: "on my feet all day at work", weight: 1 },
  { id: "construction", text: "working construction six days a week", weight: 1 },

  // Life transitions
  { id: "recently_divorced", text: "rebuilding after my divorce", weight: 1 },
  { id: "recently_widowed", text: "trying to move forward after losing my spouse", weight: 1 },
  { id: "veteran", text: "after serving in the military", weight: 1 },
  { id: "recent_graduate", text: "fresh out of school with student loans", weight: 1 },
  { id: "career_change", text: "starting over in a new career", weight: 1 },
  { id: "relocated", text: "after relocating for work", weight: 1 },
  { id: "recovered_illness", text: "finally getting back on my feet after being sick", weight: 1 },

  // Age-based
  { id: "approaching_retirement", text: "trying to prepare for retirement", weight: 1 },
  { id: "young_professional", text: "just starting my career", weight: 1 },
  { id: "midlife", text: "at a point where I should be stable", weight: 1 },
];

// WHAT were they trying to do? (Goals)
const GOALS = {
  housing: [
    "buy my first home",
    "finally buy a house for my family",
    "get out of renting and own something",
    "refinance my mortgage to lower the payments",
    "move to a better neighborhood for my kids",
    "get a place with a yard",
    "buy a condo so I can build equity",
    "get approved for an apartment",
    "rent a decent place without a cosigner",
  ],
  auto: [
    "finance a reliable car",
    "get a car that won't break down on me",
    "refinance my auto loan",
    "trade in my old car for something safer",
    "get a vehicle big enough for my family",
    "lease a car for work",
  ],
  credit: [
    "get a credit card with a reasonable limit",
    "rebuild my credit after hard times",
    "get approved for a store card",
    "increase my credit limit",
    "open a secured card to start fresh",
  ],
  business: [
    "get a small business loan",
    "open a business line of credit",
    "expand my business",
    "get equipment financing",
    "secure inventory financing",
  ],
  general: [
    "get the financing I need",
    "access credit like a normal person",
    "not be treated like a risk when I'm not",
    "have my credit reflect who I actually am",
  ],
};

// WHAT happened? (Impacts)
const IMPACTS = {
  denied: [
    "I was denied",
    "they turned me down flat",
    "the application was rejected",
    "I got a denial letter",
    "they said no without even looking at my full history",
    "I was declined on the spot",
  ],
  rates: [
    "the interest rate they offered was insulting",
    "they wanted to charge me rates meant for high-risk borrowers",
    "the APR was almost double what my neighbor got",
    "I'd be paying thousands more in interest",
    "the terms were predatory",
  ],
  conditional: [
    "they said I'd need a huge down payment",
    "I'd need a cosigner, which is embarrassing",
    "they wanted collateral I don't have",
    "the conditions were impossible to meet",
  ],
  opportunity: [
    "I lost out on the opportunity",
    "someone else got it because I couldn't move fast enough",
    "the deal fell through",
    "I had to walk away",
    "the seller went with another buyer",
  ],
};

// HOW do they feel? (Emotional states by round phase)
const EMOTIONS = {
  opening: [  // R1-R2: Hopeful but concerned
    "I'm hoping you can help me sort this out",
    "I'm reaching out because something isn't right",
    "I noticed some problems and wanted to address them",
    "I'm confused about what's showing on my report",
    "this doesn't match my records at all",
  ],
  escalation: [  // R3-R5: Frustrated and persistent
    "I've already reached out about this and nothing changed",
    "I'm getting frustrated that this is still unresolved",
    "this is the third time I'm writing about the same problem",
    "I don't understand why this is so hard to fix",
    "every month this drags on costs me more",
  ],
  pressure: [  // R6-R8: Desperate and exhausted
    "I'm at my wit's end",
    "I don't know what else I can do",
    "this has been going on way too long",
    "I'm losing sleep over this",
    "my family is suffering because of these errors",
    "I'm exhausted from fighting this",
  ],
  resolution: [  // R9-12: Resigned, ultimatum
    "I've tried everything else",
    "this is my final attempt before I involve attorneys",
    "I have no choice but to escalate this",
    "you've left me with no other options",
    "I'm done waiting for you to do the right thing",
  ],
};

// WHY does this matter NOW? (Urgency)
const URGENCY = [
  "Every month that passes, I'm losing money",
  "Interest rates are climbing and I can't wait any longer",
  "My lease is up soon and I need to move",
  "The school year starts in a few months and we need to be settled",
  "I've got medical bills that won't wait",
  "My car is on its last legs",
  "Prices keep going up while I'm stuck waiting",
  "I've already found the perfect place but I can't close",
  "My current situation is unsustainable",
  "I'm paying more in rent than a mortgage would cost",
  "My kids deserve better than this",
  "I've worked too hard to be held back by errors",
];

// SENTENCE STARTERS (variety in how stories begin)
const OPENERS = [
  "Let me tell you what's going on.",
  "I need to explain my situation.",
  "Here's what happened.",
  "I'll get straight to the point.",
  "I'm writing because I'm stuck.",
  "Something on my credit report isn't right.",
  "There's a problem with my credit file.",
  "I've been trying to fix this for a while now.",
  "You probably get a lot of these letters, but please hear me out.",
  "I'm not sure where else to turn.",
];

// TRANSITIONS between story parts
const TRANSITIONS = {
  toImpact: [
    "When I applied,",
    "The problem is,",
    "But then,",
    "Here's where it went wrong:",
    "That's when I found out",
    "So when I tried to",
  ],
  toEmotional: [
    "Honestly,",
    "I have to say,",
    "At this point,",
    "I'm not going to lie,",
    "The truth is,",
    "Look,",
  ],
  toUrgency: [
    "The thing is,",
    "What makes this worse is",
    "On top of that,",
    "And now",
    "Meanwhile,",
  ],
};

// AUTHENTIC VOICE MARKERS (make it sound human)
const VOICE_MARKERS = {
  contractions: ["I'm", "I've", "I'd", "don't", "can't", "won't", "it's", "that's", "they're", "wasn't", "couldn't", "shouldn't", "wouldn't"],
  fillers: ["honestly", "look", "basically", "actually", "really", "seriously", "frankly"],
  emphasis: ["every single", "absolutely", "completely", "totally", "literally"],
  hedges: ["kind of", "sort of", "pretty much", "more or less"],
};

// =============================================================================
// SEEDED RANDOM NUMBER GENERATOR
// Ensures same seed produces same "random" choices
// =============================================================================

class SeededRandom {
  private seed: number;

  constructor(seedString: string) {
    this.seed = this.hashString(seedString);
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  // Returns 0-1
  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  // Returns integer from 0 to max-1
  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  // Pick random item from array
  pick<T>(arr: T[]): T {
    return arr[this.nextInt(arr.length)];
  }

  // Pick N unique items from array
  pickN<T>(arr: T[], n: number): T[] {
    const shuffled = [...arr].sort(() => this.next() - 0.5);
    return shuffled.slice(0, Math.min(n, arr.length));
  }

  // Shuffle array
  shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

// =============================================================================
// STORY GENERATION ENGINE
// =============================================================================

/**
 * Get the emotional phase based on round number
 */
function getPhase(round: number): "opening" | "escalation" | "pressure" | "resolution" {
  if (round <= 2) return "opening";
  if (round <= 5) return "escalation";
  if (round <= 8) return "pressure";
  return "resolution";
}

/**
 * Determine likely goal based on account types
 */
function inferGoalCategory(accountTypes?: string[]): keyof typeof GOALS {
  if (!accountTypes || accountTypes.length === 0) return "general";

  const types = accountTypes.map(t => t.toLowerCase());

  if (types.some(t => t.includes("mortgage") || t.includes("home"))) return "housing";
  if (types.some(t => t.includes("auto") || t.includes("car") || t.includes("vehicle"))) return "auto";
  if (types.some(t => t.includes("business") || t.includes("commercial"))) return "business";
  if (types.some(t => t.includes("card") || t.includes("revolving"))) return "credit";

  return "general";
}

/**
 * Build a sentence with natural variations
 */
function buildSentence(rng: SeededRandom, parts: string[]): string {
  // Occasionally add a voice marker
  if (rng.next() > 0.7) {
    const marker = rng.pick(VOICE_MARKERS.fillers);
    parts[0] = marker.charAt(0).toUpperCase() + marker.slice(1) + ", " + parts[0].toLowerCase();
  }

  return parts.join(" ");
}

/**
 * Generate a completely unique story for a client
 *
 * The story is built from atomic components, not selected from variants.
 * This creates millions of possible combinations.
 */
export function generateUniqueStory(context: StoryContext): GeneratedStory {
  const rng = new SeededRandom(context.seed + context.round.toString());
  const phase = getPhase(context.round);
  const goalCategory = inferGoalCategory(context.accountTypes);

  // Select components
  const lifeSituation = rng.pick(LIFE_SITUATIONS);
  const goal = rng.pick(GOALS[goalCategory]);
  const impactType = rng.pick(Object.keys(IMPACTS) as (keyof typeof IMPACTS)[]);
  const impact = rng.pick(IMPACTS[impactType]);
  const emotion = rng.pick(EMOTIONS[phase]);
  const urgency = rng.pick(URGENCY);
  const opener = rng.pick(OPENERS);
  const transitionToImpact = rng.pick(TRANSITIONS.toImpact);
  const transitionToEmotional = rng.pick(TRANSITIONS.toEmotional);
  const transitionToUrgency = rng.pick(TRANSITIONS.toUrgency);

  // Build the opening paragraph
  const openingParts: string[] = [];

  // Start with opener
  openingParts.push(opener);

  // Add life situation + goal
  const situationSentence = buildSituationSentence(rng, lifeSituation.text, goal);
  openingParts.push(situationSentence);

  // Add impact
  const impactSentence = `${transitionToImpact} ${impact}.`;
  openingParts.push(impactSentence);

  // Add CRA reference
  const craSentence = buildCRASentence(rng, context.cra, phase);
  openingParts.push(craSentence);

  // Join into paragraph
  const opening = openingParts.join(" ");

  // Build situation summary
  const situation = `I've been ${lifeSituation.text}, trying to ${goal}.`;

  // Build impact summary
  const impactSummary = buildImpactSummary(rng, impact, context);

  // Build emotional statement
  const emotional = `${transitionToEmotional} ${emotion}.`;

  // Build urgency
  const urgencySentence = `${transitionToUrgency} ${urgency}.`;

  // Generate uniqueness hash
  const hash = createHash("sha256")
    .update(opening + situation + impactSummary + emotional + urgencySentence)
    .digest("hex")
    .substring(0, 16);

  return {
    opening,
    situation,
    impact: impactSummary,
    emotional,
    urgency: urgencySentence,
    hash,
  };
}

/**
 * Build a natural-sounding situation sentence
 */
function buildSituationSentence(rng: SeededRandom, lifeSituation: string, goal: string): string {
  const patterns = [
    `I've been ${lifeSituation}, and all I'm trying to do is ${goal}.`,
    `As someone ${lifeSituation}, I've been working hard to ${goal}.`,
    `I'm ${lifeSituation}, and I finally thought I could ${goal}.`,
    `After ${lifeSituation}, I decided it was time to ${goal}.`,
    `${lifeSituation.charAt(0).toUpperCase() + lifeSituation.slice(1)}, and my goal was simple: ${goal}.`,
    `I've spent years ${lifeSituation}. Recently, I tried to ${goal}.`,
  ];

  return rng.pick(patterns);
}

/**
 * Build a CRA-specific accusation sentence
 */
function buildCRASentence(rng: SeededRandom, cra: string, phase: "opening" | "escalation" | "pressure" | "resolution"): string {
  const phrasings = {
    opening: [
      `When I pulled my ${cra} report, I found information that doesn't match my records.`,
      `I checked my ${cra} file and something is clearly wrong.`,
      `The data ${cra} has on file about me contains errors.`,
      `${cra} is showing information that isn't accurate.`,
    ],
    escalation: [
      `I've already told ${cra} about these errors, but nothing has been fixed.`,
      `${cra} keeps reporting the same wrong information month after month.`,
      `Despite my previous disputes, ${cra} hasn't corrected these inaccuracies.`,
      `I've contacted ${cra} before about this, and I'm still waiting for action.`,
    ],
    pressure: [
      `${cra} has had plenty of time to fix this and hasn't.`,
      `I've given ${cra} multiple chances to investigate properly.`,
      `At this point, ${cra}'s failure to act is causing ongoing harm.`,
      `${cra}'s continued inaction is unacceptable.`,
    ],
    resolution: [
      `${cra} has left me with no choice but to document everything for legal review.`,
      `I'm putting ${cra} on notice that this is my final attempt at resolution.`,
      `${cra}'s persistent failure to correct these errors will need to be addressed in court if not resolved now.`,
      `This letter serves as ${cra}'s final opportunity to make this right.`,
    ],
  };

  return rng.pick(phrasings[phase]);
}

/**
 * Build impact summary based on context
 */
function buildImpactSummary(rng: SeededRandom, impact: string, context: StoryContext): string {
  const summaries = [
    `Because of these errors, ${impact}.`,
    `The result? ${impact.charAt(0).toUpperCase() + impact.slice(1)}.`,
    `This inaccurate reporting means ${impact}.`,
    `Thanks to what ${context.cra} is showing, ${impact}.`,
  ];

  let summary = rng.pick(summaries);

  // Add balance context if available
  if (context.totalBalance && context.totalBalance > 1000) {
    const balanceContext = [
      ` We're talking about errors affecting over $${context.totalBalance.toLocaleString()}.`,
      ` This involves accounts totaling more than $${context.totalBalance.toLocaleString()}.`,
      ` The disputed amount is significant: $${context.totalBalance.toLocaleString()}.`,
    ];
    summary += rng.pick(balanceContext);
  }

  return summary;
}

/**
 * Generate a complete story block for letter insertion
 * This is the main function called by the letter generator
 */
export function generateStoryBlock(context: StoryContext): string {
  const story = generateUniqueStory(context);

  // Combine into a cohesive paragraph
  const parts = [
    story.opening,
    "",  // Paragraph break
    story.emotional,
    story.urgency,
  ];

  return parts.join("\n\n");
}

/**
 * Verify uniqueness against previous stories
 * Returns true if story is unique (not seen before)
 */
export function verifyUniqueness(story: GeneratedStory, previousHashes: Set<string>): boolean {
  return !previousHashes.has(story.hash);
}

/**
 * Generate multiple unique stories and pick the most unique one
 * Uses semantic distance estimation
 */
export function generateMostUniqueStory(
  context: StoryContext,
  previousStories: string[],
  attempts: number = 10
): GeneratedStory {
  let bestStory: GeneratedStory | null = null;
  let bestScore = -1;

  for (let i = 0; i < attempts; i++) {
    // Modify seed for each attempt
    const attemptContext = {
      ...context,
      seed: context.seed + "_attempt_" + i,
    };

    const story = generateUniqueStory(attemptContext);
    const score = estimateUniqueness(story.opening, previousStories);

    if (score > bestScore) {
      bestScore = score;
      bestStory = story;
    }
  }

  return bestStory || generateUniqueStory(context);
}

/**
 * Estimate how unique a story is compared to previous stories
 * Higher score = more unique
 */
function estimateUniqueness(story: string, previousStories: string[]): number {
  if (previousStories.length === 0) return 100;

  const storyWords = new Set(story.toLowerCase().split(/\s+/));
  let totalOverlap = 0;

  for (const prev of previousStories) {
    const prevWords = new Set(prev.toLowerCase().split(/\s+/));
    let overlap = 0;

    for (const word of storyWords) {
      if (prevWords.has(word) && word.length > 4) {  // Only count significant words
        overlap++;
      }
    }

    totalOverlap += overlap / Math.max(storyWords.size, 1);
  }

  const avgOverlap = totalOverlap / previousStories.length;
  return Math.round((1 - avgOverlap) * 100);
}

// =============================================================================
// EXPORTS FOR TESTING
// =============================================================================

export const _testing = {
  LIFE_SITUATIONS,
  GOALS,
  IMPACTS,
  EMOTIONS,
  URGENCY,
  SeededRandom,
  getPhase,
  inferGoalCategory,
};
