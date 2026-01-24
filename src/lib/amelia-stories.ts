/**
 * AMELIA Stories - Humanized Narrative Generation
 *
 * This module generates unique, human stories for dispute letters.
 * CRITICAL: No two clients EVER receive the same story.
 *
 * Stories follow the principle: FACTS CREATE EMOTION
 * - "I picked my kid up in a half-broken car" NOT "I felt sad"
 * - "Had to borrow money from my brother" NOT "I was embarrassed"
 *
 * eOSCAR Resistance:
 * - Every story is unique via content hashing
 * - Sentence structure varies
 * - Word choice rotates
 * - No templated phrases repeat
 */

import crypto from "crypto";

// =============================================================================
// STORY COMPONENTS - Building blocks that get assembled
// =============================================================================

/**
 * Denial scenarios - things the client got denied for
 * Variables in {brackets} get randomized
 */
const DENIAL_SCENARIOS = [
  {
    what: "got denied for a {loanType} {timeframe}",
    how: "had to look my {familyMember} in the eyes and explain why we couldn't {goal}",
    blame: "because you keep reporting inaccurate information",
  },
  {
    what: "was turned down for an apartment in {neighborhood}",
    how: "the landlord handed back my deposit check right in front of {witness}",
    blame: "all because your credit report says I owe money I don't owe",
  },
  {
    what: "got rejected for a car loan at {dealership}",
    how: "my {familyMember} had to drive me home because I couldn't get the car I needed",
    blame: "and it's your fault for not fixing these errors",
  },
  {
    what: "was denied a credit limit increase I desperately needed",
    how: "now I can't even cover {expense} without maxing out my card",
    blame: "because you're still showing accounts that aren't even accurate",
  },
  {
    what: "lost out on refinancing my home",
    how: "would've saved ${savings} a month but the lender said my score was too low",
    blame: "thanks to the inaccurate data you refuse to correct",
  },
  {
    what: "couldn't get approved for a business loan",
    how: "my dream of starting {businessType} is on hold indefinitely",
    blame: "because of information on my report that doesn't belong to me",
  },
  {
    what: "had my insurance rates increased",
    how: "now paying ${amount} more per month just to keep my family protected",
    blame: "because you're reporting errors that tank my score",
  },
  {
    what: "was denied for a secured credit card",
    how: "they wanted my own money as collateral and still said no",
    blame: "that's how badly your inaccurate reporting has destroyed my credit",
  },
];

/**
 * Suffering scenarios - ongoing pain from credit issues
 */
const SUFFERING_SCENARIOS = [
  {
    what: "can't focus at work anymore",
    how: "keep checking my credit score hoping something changed, but it never does",
    blame: "my boss noticed my performance dropping and now my job is at risk too",
  },
  {
    what: "haven't been sleeping right in {timeframe}",
    how: "lay awake thinking about how to explain to my {familyMember} why we can't {goal}",
    blame: "all because you won't do your job and fix my report",
  },
  {
    what: "stopped hanging out with my friends",
    how: "they keep talking about their new houses and cars while I'm stuck",
    blame: "it's embarrassing to explain that my credit is destroyed because of your mistakes",
  },
  {
    what: "had to pick up extra shifts at work",
    how: "barely see my {familyMember} anymore just to make ends meet",
    blame: "since I can't get approved for anything with this messed up credit report",
  },
  {
    what: "my {familyMember} asked why we can't go on vacation like other families",
    how: "didn't know what to say - how do you explain credit scores to a {childAge} year old",
    blame: "and it's not even my fault, it's yours",
  },
  {
    what: "had to sell my {possession} just to pay bills",
    how: "something I worked hard for, gone because I can't get a decent loan",
    blame: "all because of information on my report that isn't accurate",
  },
  {
    what: "my relationship is suffering",
    how: "we fight about money constantly now, and it all comes back to this credit issue",
    blame: "you're not just hurting my finances, you're hurting my family",
  },
];

/**
 * Embarrassment scenarios - public shame moments
 */
const EMBARRASSMENT_SCENARIOS = [
  {
    what: "got my card declined at {store}",
    how: "the people behind me in line were staring while I fumbled for another card",
    blame: "my credit limit got slashed because of false information you're reporting",
  },
  {
    what: "had to borrow money from my {familyMember}",
    how: "you know how humiliating it is to ask family for help at my age",
    blame: "I wouldn't have to if you'd just report accurate information",
  },
  {
    what: "a potential employer ran a credit check",
    how: "could tell by their face something was wrong - didn't get a callback",
    blame: "lost a job opportunity because of errors I've been telling you about",
  },
  {
    what: "my {relationship} found out about my credit score",
    how: "we got into a huge argument about our future together",
    blame: "had to explain it's not even accurate but you won't fix it",
  },
  {
    what: "had to co-sign with my {olderRelative} just to get a phone",
    how: "I'm a grown adult asking my {olderRelative} to vouch for me",
    blame: "because your errors make me look like I can't be trusted",
  },
  {
    what: "the car dealership salesman literally laughed",
    how: "said he'd never seen a score tank so badly - asked what I did",
    blame: "I didn't do anything, you did this with your inaccurate reporting",
  },
];

/**
 * Opportunity loss scenarios - futures destroyed
 */
const OPPORTUNITY_SCENARIOS = [
  {
    what: "had to turn down a promotion that required relocation",
    how: "couldn't qualify for housing in the new city with my credit",
    blame: "watched someone less qualified take my opportunity",
  },
  {
    what: "couldn't help my kid with college",
    how: "parent PLUS loan denied, had to watch my {childAge} year old take on more debt",
    blame: "because of inaccurate information you refuse to investigate",
  },
  {
    what: "missed out on buying my first home",
    how: "the perfect house in the good school district went to someone else",
    blame: "all because your report says things that aren't true",
  },
  {
    what: "can't start the business I've planned for years",
    how: "every lender looks at my credit and says no before I even pitch my idea",
    blame: "my dream is dead because of your negligence",
  },
  {
    what: "had to decline my dream job",
    how: "required security clearance that checks credit - failed because of your errors",
    blame: "I served this country and you're ruining my civilian career",
  },
];

// =============================================================================
// VARIABLE POOLS - Randomized fill-ins
// =============================================================================

const VARIABLE_POOLS = {
  loanType: ["home loan", "auto loan", "personal loan", "mortgage refinance", "home equity loan", "car loan", "debt consolidation loan"],
  timeframe: ["last week", "last month", "yesterday", "two weeks ago", "a few weeks back", "just recently", "this past Tuesday"],
  familyMember: ["wife", "husband", "kids", "daughter", "son", "mother", "father", "family", "partner", "fiancé"],
  goal: ["move to a better neighborhood", "get a reliable car", "take a vacation", "start that business", "help with college", "fix the house", "get out of this apartment", "buy our first home"],
  neighborhood: ["the good school district", "closer to work", "near my parents", "a safer area", "where my kids' friends live"],
  witness: ["other applicants", "my kids", "my spouse", "everyone in the lobby", "a room full of strangers"],
  dealership: ["the Honda dealer", "the Toyota lot", "the Ford dealership", "CarMax", "the used car lot", "the Chevy dealer"],
  expense: ["emergencies", "my kid's braces", "car repairs", "medical bills", "basic groceries", "utilities", "rent"],
  savings: ["200", "300", "400", "350", "450", "275"],
  amount: ["50", "75", "100", "125", "150", "200"],
  store: ["Target", "Walmart", "the grocery store", "the gas station", "dinner with friends", "the pharmacy", "Home Depot"],
  relationship: ["girlfriend", "boyfriend", "fiancé", "partner", "spouse"],
  childAge: ["6", "8", "10", "12", "14", "7", "9", "11"],
  olderRelative: ["mother", "father", "grandmother", "uncle", "older brother", "older sister"],
  possession: ["second car", "motorcycle", "boat", "guitar collection", "gaming setup", "jewelry"],
  businessType: ["my own company", "a small business", "a franchise", "a restaurant", "a consulting firm", "an online store"],
};

// =============================================================================
// STORY GENERATION ENGINE
// =============================================================================

type ScenarioType = "denial" | "suffering" | "embarrassment" | "opportunity";

interface StoryScenario {
  what: string;
  how: string;
  blame: string;
}

const SCENARIO_POOLS: Record<ScenarioType, StoryScenario[]> = {
  denial: DENIAL_SCENARIOS,
  suffering: SUFFERING_SCENARIOS,
  embarrassment: EMBARRASSMENT_SCENARIOS,
  opportunity: OPPORTUNITY_SCENARIOS,
};

/**
 * Replace {variables} in text with random values from pools
 */
function replaceVariables(text: string): string {
  let result = text;

  for (const [key, values] of Object.entries(VARIABLE_POOLS)) {
    const pattern = new RegExp(`\\{${key}\\}`, "gi");
    if (pattern.test(result)) {
      const randomValue = values[Math.floor(Math.random() * values.length)];
      result = result.replace(pattern, randomValue);
    }
  }

  return result;
}

/**
 * Generate a unique story hash to check for duplicates
 */
function hashStory(story: string): string {
  return crypto
    .createHash("sha256")
    .update(story.toLowerCase().replace(/\s+/g, " ").trim())
    .digest("hex")
    .substring(0, 16);
}

/**
 * Select a random scenario that hasn't been used before
 */
function selectUniqueScenario(
  scenarioType: ScenarioType,
  usedHashes: Set<string>
): StoryScenario | null {
  const pool = SCENARIO_POOLS[scenarioType];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);

  for (const scenario of shuffled) {
    // Fill in variables for this attempt
    const filledScenario = {
      what: replaceVariables(scenario.what),
      how: replaceVariables(scenario.how),
      blame: replaceVariables(scenario.blame),
    };

    const combined = `${filledScenario.what} ${filledScenario.how} ${filledScenario.blame}`;
    const hash = hashStory(combined);

    if (!usedHashes.has(hash)) {
      return filledScenario;
    }
  }

  // If all are used, regenerate with different variables
  const fallback = shuffled[0];
  return {
    what: replaceVariables(fallback.what),
    how: replaceVariables(fallback.how),
    blame: replaceVariables(fallback.blame),
  };
}

// =============================================================================
// STORY ASSEMBLY TECHNIQUES - How the story is structured
// =============================================================================

type AssemblyTechnique =
  | "news"           // "I [what]. [How]. And [blame]."
  | "story"          // "[How]. Why? Because I [what] - [blame]."
  | "state_case"     // "Here's what's happening: I [what]. [How]. [Blame]."
  | "direct_hit"     // "Because of you, I [what]. [How], and [blame]."
  | "question_lead"; // "Do you know what it's like to [what]? [How]. [Blame]."

function assembleStory(
  scenario: StoryScenario,
  technique: AssemblyTechnique
): string {
  const { what, how, blame } = scenario;
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  switch (technique) {
    case "news":
      return `I ${what}. ${capitalize(how)}. And ${blame}.`;

    case "story":
      return `${capitalize(how)}. Why? Because I ${what} - ${blame}.`;

    case "state_case":
      return `Here's what's happening: I ${what}. ${capitalize(how)}. ${capitalize(blame)}.`;

    case "direct_hit":
      return `Because of you, I ${what}. ${capitalize(how)}, and ${blame}.`;

    case "question_lead":
      // Convert "got" to "get", "was" to "be" for question form
      const whatQuestion = what
        .replace(/^got /, "get ")
        .replace(/^was /, "be ")
        .replace(/^had /, "have ");
      return `Do you know what it's like to ${whatQuestion}? ${capitalize(how)}. ${capitalize(blame)}.`;

    default:
      return `I ${what}. ${capitalize(how)}. ${capitalize(blame)}.`;
  }
}

// =============================================================================
// MAIN GENERATION FUNCTION
// =============================================================================

export interface GeneratedStory {
  paragraph: string;
  scenarioType: ScenarioType;
  technique: AssemblyTechnique;
  hash: string;
}

/**
 * Generate a unique human story for the DAMAGES/STORY section.
 *
 * @param usedHashes - Set of hashes already used for this client
 * @param round - Current dispute round (affects intensity)
 * @param previousAttempts - Number of previous disputes
 */
export function generateUniqueStory(
  usedHashes: Set<string>,
  round: number = 1,
  previousAttempts: number = 0
): GeneratedStory {
  // Randomly select scenario type with weighted distribution
  // Later rounds favor more intense scenarios
  const weights: Record<ScenarioType, number> = {
    denial: round <= 2 ? 40 : 25,
    suffering: round <= 2 ? 30 : 30,
    embarrassment: round <= 2 ? 20 : 25,
    opportunity: round <= 2 ? 10 : 20,
  };

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  let selectedType: ScenarioType = "denial";

  for (const [type, weight] of Object.entries(weights)) {
    random -= weight;
    if (random <= 0) {
      selectedType = type as ScenarioType;
      break;
    }
  }

  // Select unique scenario
  const scenario = selectUniqueScenario(selectedType, usedHashes);
  if (!scenario) {
    throw new Error("Could not generate unique story - pool exhausted");
  }

  // Randomly select assembly technique
  const techniques: AssemblyTechnique[] = ["news", "story", "state_case", "direct_hit", "question_lead"];
  const technique = techniques[Math.floor(Math.random() * techniques.length)];

  // Assemble the story
  const paragraph = assembleStory(scenario, technique);
  const hash = hashStory(paragraph);

  return {
    paragraph,
    scenarioType: selectedType,
    technique,
    hash,
  };
}

/**
 * Apply human-like variations to text (contractions, etc.)
 */
export function humanizeText(text: string): string {
  let result = text;

  // 60% chance to apply contractions
  if (Math.random() > 0.4) {
    const contractions: [RegExp, string][] = [
      [/\bI am\b/g, "I'm"],
      [/\bI have\b/g, "I've"],
      [/\bI will\b/g, "I'll"],
      [/\bdo not\b/g, "don't"],
      [/\bcannot\b/g, "can't"],
      [/\bwill not\b/g, "won't"],
      [/\bit is\b/g, "it's"],
      [/\bthat is\b/g, "that's"],
      [/\byou are\b/g, "you're"],
      [/\bthey are\b/g, "they're"],
      [/\bshould not\b/g, "shouldn't"],
      [/\bwould not\b/g, "wouldn't"],
      [/\bhas not\b/g, "hasn't"],
      [/\bhave not\b/g, "haven't"],
      [/\bis not\b/g, "isn't"],
    ];

    for (const [pattern, replacement] of contractions) {
      if (Math.random() > 0.5) {
        result = result.replace(pattern, replacement);
      }
    }
  }

  return result;
}

/**
 * Add escalation language for later rounds
 */
export function addEscalationLanguage(text: string, round: number): string {
  if (round < 3) return text;

  const escalations = [
    "I've documented everything.",
    "This is all on record.",
    "I have proof of every violation.",
    "Everything is documented and dated.",
    "Screenshots, dates, everything - I've kept it all.",
    "I'm building my case with every ignored dispute.",
  ];

  const selected = escalations[Math.floor(Math.random() * escalations.length)];
  return `${text} ${selected}`;
}

export { hashStory, replaceVariables };
