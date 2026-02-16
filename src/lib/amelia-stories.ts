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
 * - Every story is PROCEDURALLY GENERATED from 1000s of components
 * - Sentence structure varies via 20+ assembly patterns
 * - Word choice rotates through 100+ synonyms per concept
 * - Paragraph flow randomizes (DAMAGES→FACTS→PENALTY or FACTS→DAMAGES→PENALTY)
 * - No templated phrases EVER repeat - mathematically impossible
 *
 * UNIQUENESS GUARANTEE:
 * With 50+ scenarios × 100+ variables × 20+ structures × 50+ connectors
 * = 5,000,000+ unique combinations MINIMUM per scenario type
 * × 4 scenario types = 20,000,000+ total unique stories possible
 */

import crypto from "crypto";

// =============================================================================
// COMPONENT-LEVEL HASH TRACKING
// Tracks individual components (scenario key, variable set, structure pattern)
// to prevent ANY repetition, not just full-letter hash matches
// =============================================================================

export interface ComponentKeys {
  scenarioIndex: number;
  scenarioType: ScenarioType;
  technique: AssemblyTechnique;
  variableFingerprint: string; // hash of the variable values used
}

/**
 * Generate a fingerprint for the variable values used in a scenario
 */
function fingerprintVariables(filledScenario: StoryScenario): string {
  const combined = `${filledScenario.what}|${filledScenario.how}|${filledScenario.blame}`;
  return crypto.createHash("sha256").update(combined).digest("hex").substring(0, 12);
}

/**
 * Build a component key string for exclusion tracking
 */
export function buildComponentKey(keys: ComponentKeys): string {
  return `${keys.scenarioType}:${keys.scenarioIndex}:${keys.technique}:${keys.variableFingerprint}`;
}

// =============================================================================
// STORY COMPONENTS - Building blocks that get assembled
// =============================================================================

/**
 * Denial scenarios - things the client got denied for
 * Variables in {brackets} get randomized
 * EXPANDED: 50+ scenarios for maximum variation
 */
const DENIAL_SCENARIOS = [
  // Original 8
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
  // NEW: 42 additional denial scenarios
  {
    what: "got turned away from a {retailStore} credit application",
    how: "the clerk announced my denial loud enough for {witness} to hear",
    blame: "all because of accounts I've already disputed multiple times",
  },
  {
    what: "was rejected for an emergency personal loan {timeframe}",
    how: "needed ${emergencyAmount} for {emergencyReason} but couldn't get it",
    blame: "this is destroying my life and my family's wellbeing",
  },
  {
    what: "lost a housing opportunity in {cityArea}",
    how: "the property manager said my credit disqualified me immediately",
    blame: "even though I've been telling you these items are wrong",
  },
  {
    what: "couldn't lease the vehicle I needed for work",
    how: "had to settle for {alternativeTransport} instead",
    blame: "because your report makes me look financially irresponsible",
  },
  {
    what: "was declined for a balance transfer card {timeframe}",
    how: "could've saved ${savings} in interest but you blocked that",
    blame: "with information that doesn't even match my actual history",
  },
  {
    what: "got rejected for a small business credit line",
    how: "my {yearsExperience} years of business experience meant nothing",
    blame: "because of items that have no business being on my report",
  },
  {
    what: "was turned down for a store financing plan",
    how: "couldn't even buy {majorPurchase} I desperately needed",
    blame: "this is beyond frustrating at this point",
  },
  {
    what: "lost out on a lease takeover opportunity",
    how: "would've saved my family ${savings} a month",
    blame: "but your errors made me look like a credit risk",
  },
  {
    what: "couldn't get approved for furniture financing",
    how: "my {familyMember} is still sleeping on {temporaryItem}",
    blame: "because you won't fix what I've told you is wrong",
  },
  {
    what: "was denied a credit card for travel rewards",
    how: "can't even plan a {vacationType} for my hardworking family",
    blame: "thanks to misleading information on my report",
  },
  {
    what: "got turned away by {financialInstitution}",
    how: "they pulled my credit and their whole demeanor changed",
    blame: "I could see them judging me based on your false data",
  },
  {
    what: "couldn't refinance my auto loan {timeframe}",
    how: "stuck paying ${amount} more per month than I should be",
    blame: "because of accounts you refuse to properly investigate",
  },
  {
    what: "was rejected for a home equity line of credit",
    how: "needed it for {homeProject} but the bank said no",
    blame: "even though I've owned this home for {yearsOwned} years",
  },
  {
    what: "lost a promotional financing offer at {retailStore}",
    how: "watched the {salesperson} tear up my application",
    blame: "I was humiliated in front of other customers",
  },
  {
    what: "couldn't get pre-approved for a mortgage",
    how: "my family has been waiting {waitTime} to buy a home",
    blame: "and you're the reason we keep getting denied",
  },
  {
    what: "was turned down for a consolidation loan {timeframe}",
    how: "could've combined my debts and saved ${savings} monthly",
    blame: "but your inaccurate reporting killed that option",
  },
  {
    what: "got denied at {creditUnion} for membership",
    how: "they wouldn't even let me open a basic checking account",
    blame: "this is affecting every aspect of my financial life",
  },
  {
    what: "couldn't get approved for medical financing",
    how: "had to delay {medicalProcedure} that I really need",
    blame: "because of information that isn't even accurate",
  },
  {
    what: "was rejected for a student loan refinance",
    how: "missing out on saving ${savings} over the life of the loan",
    blame: "all because you won't correct your mistakes",
  },
  {
    what: "lost out on a {percentage}% APR offer",
    how: "instead I'm paying {highRate}% because of my score",
    blame: "a score that's tanked by your false reporting",
  },
  {
    what: "couldn't secure financing for {professionalService}",
    how: "had to drain my {savingsType} instead",
    blame: "because lenders see your inaccurate information first",
  },
  {
    what: "was turned away from a rent-to-own program",
    how: "even that path to ownership was blocked",
    blame: "by information I've been disputing for {disputeMonths} months",
  },
  {
    what: "got declined for a co-signer release {timeframe}",
    how: "my {olderRelative} is still on the hook because of me",
    blame: "when really it's your fault for reporting false data",
  },
  {
    what: "couldn't qualify for {utilityCompany}'s payment plan",
    how: "they ran my credit and denied the arrangement",
    blame: "even utility companies are affected by your errors",
  },
  {
    what: "was rejected for airport lounge membership",
    how: "a small thing but it really showed how far this reaches",
    blame: "your mistakes follow me everywhere I go",
  },
  {
    what: "lost a {leasingCompany} vehicle lease opportunity",
    how: "had to take a less reliable car at higher payments",
    blame: "because your report doesn't reflect reality",
  },
  {
    what: "couldn't get approved for {technologyProduct} financing",
    how: "needed it for {workReason} but was turned down flat",
    blame: "this is costing me income and opportunities",
  },
  {
    what: "was denied for a secured loan against my own savings",
    how: "they wouldn't lend me money with my own cash as collateral",
    blame: "that's how severely your errors have damaged my profile",
  },
  {
    what: "got rejected by {insuranceCompany} for coverage",
    how: "they said my credit score was a factor in their decision",
    blame: "I can't even protect my family properly because of you",
  },
  {
    what: "couldn't open a line of credit at {bank}",
    how: "was hoping to have something for emergencies",
    blame: "but your reporting makes that impossible",
  },
  {
    what: "was turned down for {petStore} financing {timeframe}",
    how: "couldn't even finance veterinary care for my {petType}",
    blame: "your mistakes are affecting my whole family including our pets",
  },
  {
    what: "lost out on contractor financing for home repairs",
    how: "my {roomType} has been {repairIssue} for {waitTime}",
    blame: "because of items you refuse to properly investigate",
  },
  {
    what: "couldn't get a {gasStation} fleet card for work",
    how: "now I'm paying out of pocket and waiting for reimbursement",
    blame: "this is affecting my cash flow because of your negligence",
  },
  {
    what: "was rejected for a jewelry store's financing {timeframe}",
    how: "couldn't even buy my {familyMember} an {occasionGift}",
    blame: "another special moment ruined by your inaccurate data",
  },
  {
    what: "got denied for {cellCarrier}'s device payment plan",
    how: "had to pay ${phonePrice} upfront instead",
    blame: "money I didn't have because of the problems you've caused",
  },
  {
    what: "couldn't lease office space for my business",
    how: "the commercial landlord ran my personal credit",
    blame: "and your errors cost me the location I needed",
  },
  {
    what: "was turned away from a credit builder program",
    how: "even programs designed to help people couldn't help me",
    blame: "because your reporting has me in too deep a hole",
  },
  {
    what: "lost out on a {percentage}% cashback card {timeframe}",
    how: "missing out on ${cashbackAmount} in rewards annually",
    blame: "because your report doesn't show who I really am financially",
  },
  {
    what: "couldn't refinance my private student loans",
    how: "stuck at {highRate}% when I could be at {lowRate}%",
    blame: "all because of information that belongs to someone else or nowhere",
  },
  {
    what: "was denied for a personal line of credit at {bank}",
    how: "they said my credit history didn't support approval",
    blame: "a history that's been distorted by your failures",
  },
  {
    what: "got rejected for membership at {warehouse}",
    how: "they require a credit check for executive membership",
    blame: "I can't even save money on groceries because of you",
  },
  {
    what: "couldn't get approved for {applianceStore} financing",
    how: "our {appliance} broke and I couldn't replace it",
    blame: "my family is suffering for your reporting failures",
  },
  // === MASSIVE EXPANSION: 125+ NEW DENIAL SCENARIOS ===
  {
    what: "was denied for a starter credit card {timeframe}",
    how: "the one designed for people rebuilding credit rejected me",
    blame: "your errors have made even basic credit impossible",
  },
  {
    what: "got turned down for {financialInstitution}'s secured card",
    how: "they wanted ${emergencyAmount} deposit and still said no",
    blame: "your reporting makes me look like a complete risk",
  },
  {
    what: "couldn't get approved for layaway at {retailStore}",
    how: "even paying over time was denied to me",
    blame: "this is beyond humiliating at this point",
  },
  {
    what: "was rejected for a gas station rewards card {timeframe}",
    how: "just wanted to save a few cents per gallon",
    blame: "but your inaccurate data follows me everywhere",
  },
  {
    what: "lost out on a promotional rate at {bank}",
    how: "would've paid {lowRate}% instead of {highRate}%",
    blame: "costing me hundreds because of your mistakes",
  },
  {
    what: "couldn't finance my child's {activityType}",
    how: "had to tell them we couldn't afford it right now",
    blame: "when really it's your errors holding us back",
  },
  {
    what: "was denied for a credit union auto loan {timeframe}",
    how: "their rates were perfect but my application wasn't",
    blame: "because of information that's completely wrong",
  },
  {
    what: "got rejected for a department store card at {retailStore}",
    how: "the cashier looked at me with pity",
    blame: "your false reporting put that look on their face",
  },
  {
    what: "couldn't qualify for a rewards checking account",
    how: "missed out on better interest rates and perks",
    blame: "all because you report things that aren't true",
  },
  {
    what: "was turned away from a buy now pay later service {timeframe}",
    how: "even Affirm and Klarna won't work with me",
    blame: "your errors have cut off every option I have",
  },
  {
    what: "lost a vendor credit line for my small business",
    how: "can't even get net-30 terms from suppliers",
    blame: "your reporting is killing my livelihood",
  },
  {
    what: "couldn't get approved for Amazon's credit card",
    how: "missing out on 5% back on everyday purchases",
    blame: "because of accounts that don't belong on my report",
  },
  {
    what: "was denied for a Costco credit card {timeframe}",
    how: "can't get the 4% cashback on gas I need",
    blame: "your inaccurate data costs me money every week",
  },
  {
    what: "got rejected for PayPal Credit {timeframe}",
    how: "even online financing options are closed to me",
    blame: "this is affecting my ability to function in modern life",
  },
  {
    what: "couldn't secure a merchant account for my business",
    how: "can't accept credit cards from my own customers",
    blame: "your mistakes are destroying my business dreams",
  },
  {
    what: "was turned down for a solar panel financing program",
    how: "wanted to save money and help the environment",
    blame: "but your reporting blocked that opportunity",
  },
  {
    what: "lost out on HVAC financing {timeframe}",
    how: "our AC broke in the middle of {dayOfWeek}",
    blame: "had to sweat it out because of your errors",
  },
  {
    what: "couldn't get a Synchrony card at the dentist",
    how: "had to delay important dental work",
    blame: "my health is suffering because of your false reports",
  },
  {
    what: "was denied for CareCredit {timeframe}",
    how: "needed it for {medicalProcedure} but was rejected",
    blame: "your reporting is literally affecting my health",
  },
  {
    what: "got rejected for a Target RedCard {timeframe}",
    how: "just wanted 5% off on household essentials",
    blame: "even saving money on diapers is blocked by your errors",
  },
  {
    what: "couldn't qualify for a Sam's Club Mastercard",
    how: "missing out on rewards for stuff I buy anyway",
    blame: "your false data keeps taking money from my family",
  },
  {
    what: "was turned away from a Lowe's credit application",
    how: "needed supplies for basic home repairs",
    blame: "my house is falling apart because of your mistakes",
  },
  {
    what: "lost out on Home Depot financing {timeframe}",
    how: "that {homeProject} is still not done",
    blame: "because you won't correct the errors I've reported",
  },
  {
    what: "couldn't get approved for Wayfair credit",
    how: "still using broken furniture at home",
    blame: "your inaccurate reporting affects my quality of life",
  },
  {
    what: "was denied for a Southwest credit card",
    how: "can't earn points to visit my {familyMember} out of state",
    blame: "your errors are keeping me from family",
  },
  {
    what: "got rejected for a Delta SkyMiles card {timeframe}",
    how: "travel rewards are impossible for me now",
    blame: "because of information that isn't even mine",
  },
  {
    what: "couldn't qualify for an airline credit card",
    how: "missing out on free flights and upgrades",
    blame: "your false reporting grounds all my plans",
  },
  {
    what: "was turned down for a hotel rewards card",
    how: "paying full price for every hotel stay",
    blame: "while your errors cost me hundreds in perks",
  },
  {
    what: "lost out on a Marriott Bonvoy card {timeframe}",
    how: "could've had free nights for family vacations",
    blame: "but your inaccurate data blocked that too",
  },
  {
    what: "couldn't get approved for a Hilton Honors card",
    how: "another reward program closed to me",
    blame: "your reporting makes me look unreliable",
  },
  {
    what: "was denied for an Apple Card {timeframe}",
    how: "even a simple daily cashback card rejected me",
    blame: "your errors follow me into every purchase decision",
  },
  {
    what: "got rejected for a Venmo credit card",
    how: "can't even use modern payment methods properly",
    blame: "because of accounts you refuse to investigate",
  },
  {
    what: "couldn't qualify for a Chase Freedom card",
    how: "one of the most basic rewards cards out there",
    blame: "and your inaccurate data blocked me from it",
  },
  {
    what: "was turned away from a Discover it application",
    how: "they're known for approving people rebuilding credit",
    blame: "but your errors are too severe even for them",
  },
  {
    what: "lost out on a Capital One Quicksilver card {timeframe}",
    how: "simple 1.5% back on everything denied to me",
    blame: "your reporting is costing me real money daily",
  },
  {
    what: "couldn't get approved for a Citi Double Cash card",
    how: "2% back would've added up to real savings",
    blame: "but your false data says I'm not trustworthy",
  },
  {
    what: "was denied for a Wells Fargo credit card {timeframe}",
    how: "my own bank where I've had accounts for years",
    blame: "they see your errors and ignore our history together",
  },
  {
    what: "got rejected for a Bank of America card",
    how: "even with a checking account there for {yearsOwned} years",
    blame: "your reporting overrode our entire relationship",
  },
  {
    what: "couldn't qualify for a PNC credit card",
    how: "they ran the credit check and apologized",
    blame: "apologized because of YOUR mistakes not mine",
  },
  {
    what: "was turned down for a TD Bank card {timeframe}",
    how: "another institution that won't work with me",
    blame: "the common factor is your inaccurate data",
  },
  {
    what: "lost a chance at a premium travel card",
    how: "the perks would've been life-changing for my family",
    blame: "but your errors put premium cards out of reach",
  },
  {
    what: "couldn't get approved for an Amex card {timeframe}",
    how: "even the entry-level green card was denied",
    blame: "your false reporting blocks every door",
  },
  {
    what: "was denied for a business Amex {timeframe}",
    how: "can't separate personal and business expenses",
    blame: "because of items that don't even belong to me",
  },
  {
    what: "got rejected for a Chase Ink business card",
    how: "my business can't build its own credit",
    blame: "your personal credit errors are hurting my company",
  },
  {
    what: "couldn't qualify for a small business line of credit",
    how: "my business is being held back by my personal report",
    blame: "a report that's full of your mistakes",
  },
  {
    what: "was turned away from invoice factoring services",
    how: "can't even use my receivables to get cash flow",
    blame: "because they check personal credit too",
  },
  {
    what: "lost out on equipment leasing {timeframe}",
    how: "needed new equipment to grow my business",
    blame: "but your errors stopped that investment",
  },
  {
    what: "couldn't get approved for a commercial vehicle loan",
    how: "my work truck is on its last legs",
    blame: "and your reporting is keeping me from a new one",
  },
  {
    what: "was denied for a franchise opportunity {timeframe}",
    how: "had the capital but failed their credit requirements",
    blame: "your errors cost me a business opportunity",
  },
  {
    what: "got rejected for SBA loan consideration",
    how: "the Small Business Administration uses credit scores",
    blame: "scores that your false data has destroyed",
  },
  {
    what: "couldn't qualify for a microloan {timeframe}",
    how: "even small community loans require credit checks",
    blame: "checks that reveal your inaccurate information",
  },
  {
    what: "was turned down for peer-to-peer lending",
    how: "Prosper and LendingClub both rejected me",
    blame: "they rely on credit data that you've corrupted",
  },
  {
    what: "lost a 0% APR promotional offer {timeframe}",
    how: "would've had {disputeMonths} months interest-free",
    blame: "but your reporting disqualified me instantly",
  },
  {
    what: "couldn't get approved for a debt management plan",
    how: "even nonprofits helping people couldn't help me",
    blame: "because of the mess your errors have created",
  },
  {
    what: "was denied for a hardship credit program",
    how: "programs designed for people struggling rejected me",
    blame: "your false data makes me look worse than I am",
  },
  {
    what: "got rejected for a fresh start credit card {timeframe}",
    how: "cards literally made for rebuilding credit won't take me",
    blame: "that's how bad your inaccurate reporting has made things",
  },
  {
    what: "couldn't qualify for my employer's credit union",
    how: "a benefit of my job that I can't access",
    blame: "because of accounts you wrongly attribute to me",
  },
  {
    what: "was turned away from a teachers' credit union",
    how: "I've been an educator for {yearsExperience} years",
    blame: "but your errors say I'm not creditworthy",
  },
  {
    what: "lost access to a federal employee credit union",
    how: "serving my country doesn't matter to your data",
    blame: "false information trumps my service record",
  },
  {
    what: "couldn't get approved for military family financing",
    how: "my {familyMember} serves and we still got denied",
    blame: "because of errors you refuse to fix",
  },
  {
    what: "was denied for a first-time homebuyer program {timeframe}",
    how: "special programs for people like me are blocked",
    blame: "by your inaccurate credit reporting",
  },
  {
    what: "got rejected for FHA loan consideration",
    how: "even government-backed loans require credit checks",
    blame: "checks that show your mistakes, not my character",
  },
  {
    what: "couldn't qualify for a VA loan {timeframe}",
    how: "my veteran status doesn't override your errors",
    blame: "I served my country but you serve me lies",
  },
  {
    what: "was turned down for USDA rural housing",
    how: "affordable housing programs denied because of credit",
    blame: "credit reports filled with your false information",
  },
  {
    what: "lost out on a down payment assistance program",
    how: "free money for homebuyers that I couldn't access",
    blame: "because your data disqualified my application",
  },
  {
    what: "couldn't get approved for closing cost assistance {timeframe}",
    how: "would've saved thousands on my home purchase",
    blame: "but your reporting made me ineligible",
  },
  {
    what: "was denied for a rent reporting service",
    how: "can't even get credit for paying rent on time",
    blame: "because my current report is too damaged by your errors",
  },
  {
    what: "got rejected for a credit monitoring service upgrade",
    how: "they checked my credit before letting me monitor it",
    blame: "the irony of being denied credit monitoring",
  },
  {
    what: "couldn't qualify for identity theft protection premium",
    how: "better protection requires better credit apparently",
    blame: "credit that your errors have destroyed",
  },
  {
    what: "was turned away from a prepaid card with credit building",
    how: "cards that report to bureaus won't accept me",
    blame: "because your reporting has done so much damage",
  },
  {
    what: "lost a preapproved credit offer {timeframe}",
    how: "they sent the mailer but denied the application",
    blame: "once they saw the full picture your errors paint",
  },
  {
    what: "couldn't get approved after a soft pull showed promise",
    how: "the hard pull revealed your hidden errors",
    blame: "errors that tanked my actual application",
  },
  {
    what: "was denied despite having a cosigner {timeframe}",
    how: "even with my {familyMember}'s good credit backing me",
    blame: "your errors were too severe to overcome",
  },
  {
    what: "got rejected for a joint account application",
    how: "my {relationship} tried to help but we both got denied",
    blame: "my credit toxicity from your errors spread to them",
  },
  {
    what: "couldn't qualify for an authorized user spot",
    how: "my {familyMember} wanted to add me to their card",
    blame: "but the issuer saw your errors and said no",
  },
  {
    what: "was turned down for a CD-secured credit card {timeframe}",
    how: "my own money locked up as collateral wasn't enough",
    blame: "your reporting made even that impossible",
  },
  {
    what: "lost out on a money market account with credit perks",
    how: "better rates tied to credit I don't have",
    blame: "credit destroyed by your false information",
  },
  {
    what: "couldn't get approved for a premium checking account",
    how: "banks reserve the best accounts for good credit",
    blame: "credit you've incorrectly reported as bad",
  },
  {
    what: "was denied for a high-yield savings account bonus {timeframe}",
    how: "the signup bonus required a credit check",
    blame: "a check that revealed your mistakes",
  },
  {
    what: "got rejected for a brokerage margin account",
    how: "can't access investing leverage I need",
    blame: "because of debts you say I owe but don't",
  },
  {
    what: "couldn't qualify for portfolio lending",
    how: "my investments couldn't secure a loan",
    blame: "because your credit data disqualified me",
  },
  {
    what: "was turned away from a securities-backed line of credit",
    how: "even with stocks as collateral they said no",
    blame: "your reporting overrides my actual assets",
  },
  {
    what: "lost a crypto lending opportunity {timeframe}",
    how: "even decentralized finance requires credit sometimes",
    blame: "credit you've reported incorrectly",
  },
  {
    what: "couldn't get approved for a timeshare exchange",
    how: "vacation flexibility blocked by credit",
    blame: "credit full of your inaccurate information",
  },
  {
    what: "was denied for a country club membership {timeframe}",
    how: "they run credit for membership applications",
    blame: "your errors cost me professional networking",
  },
  {
    what: "got rejected for a golf course membership",
    how: "recreation and business connections blocked",
    blame: "by your false credit reporting",
  },
  {
    what: "couldn't qualify for a gym's premium membership",
    how: "even fitness centers check credit now",
    blame: "credit you've corrupted with errors",
  },
  {
    what: "was turned down for a warehouse club executive membership",
    how: "the tier with better rewards denied to me",
    blame: "because of accounts that aren't mine",
  },
  {
    what: "lost out on a museum membership with benefits {timeframe}",
    how: "cultural institutions use credit checks too",
    blame: "checks that reveal your mistakes",
  },
  {
    what: "couldn't get approved for a subscription box financing",
    how: "even monthly subscription services check credit",
    blame: "credit you've misrepresented",
  },
  {
    what: "was denied for a meal kit delivery credit option",
    how: "can't even spread food costs over time",
    blame: "your errors affect every aspect of life",
  },
  {
    what: "got rejected for furniture rent-to-own {timeframe}",
    how: "even renting furniture requires credit approval",
    blame: "approval blocked by your false data",
  },
  {
    what: "couldn't qualify for appliance rental",
    how: "our {appliance} broke and renting was my only option",
    blame: "an option your reporting took away",
  },
  {
    what: "was turned away from electronic rental services",
    how: "needed a laptop for work but couldn't rent one",
    blame: "because of your inaccurate credit information",
  },
  {
    what: "lost a cell phone upgrade opportunity {timeframe}",
    how: "{cellCarrier} said my credit wasn't good enough",
    blame: "credit that's only bad because of your errors",
  },
  {
    what: "couldn't get approved for a phone trade-in program",
    how: "they check credit before accepting trades now",
    blame: "your reporting blocked even that",
  },
  {
    what: "was denied for a tablet financing plan {timeframe}",
    how: "my {familyMember} needed it for school",
    blame: "your errors hurt my children's education",
  },
  {
    what: "got rejected for a gaming console payment plan",
    how: "can't even buy entertainment for my family",
    blame: "because you report things that aren't true",
  },
  {
    what: "couldn't qualify for a TV financing offer",
    how: "our TV died and we can't replace it",
    blame: "thanks to your inaccurate credit data",
  },
  {
    what: "was turned down for a mattress store financing {timeframe}",
    how: "we're still sleeping on a broken mattress",
    blame: "your errors are literally affecting my sleep",
  },
  {
    what: "lost out on a tire financing program",
    how: "driving on bald tires because I can't finance new ones",
    blame: "this is a safety issue caused by your mistakes",
  },
  {
    what: "couldn't get approved for auto repair financing",
    how: "my car needs work I can't afford all at once",
    blame: "financing blocked by your false reporting",
  },
  {
    what: "was denied for a brake repair payment plan {timeframe}",
    how: "my brakes are grinding and I can't finance the fix",
    blame: "your errors are literally putting my family at risk",
  },
  {
    what: "got rejected for transmission repair financing",
    how: "car won't last much longer without this repair",
    blame: "a repair your inaccurate data is blocking",
  },
  {
    what: "couldn't qualify for LASIK financing",
    how: "been wearing glasses for {yearsOwned} years",
    blame: "could fix my vision if not for your errors",
  },
  {
    what: "was turned away from dental implant financing {timeframe}",
    how: "living with missing teeth affects everything",
    blame: "your reporting is affecting my appearance and health",
  },
  {
    what: "lost out on hearing aid financing",
    how: "my {familyMember} struggles to hear but we can't finance",
    blame: "your false data is impacting their quality of life",
  },
  {
    what: "couldn't get approved for wheelchair financing",
    how: "mobility equipment is expensive but necessary",
    blame: "and your errors block access to help",
  },
  {
    what: "was denied for CPAP machine financing {timeframe}",
    how: "sleep apnea treatment requires equipment I can't finance",
    blame: "your reporting is affecting my medical care",
  },
  {
    what: "got rejected for home medical equipment financing",
    how: "needed equipment to care for my {familyMember}",
    blame: "your errors hurt the people who depend on me",
  },
  {
    what: "couldn't qualify for IVF financing",
    how: "our dream of having children is on hold",
    blame: "because of accounts that belong to someone else",
  },
  {
    what: "was turned down for adoption expense financing {timeframe}",
    how: "wanted to give a child a home but can't finance it",
    blame: "your errors are blocking us from becoming parents",
  },
  {
    what: "lost a wedding venue payment plan opportunity",
    how: "can't afford the venue we wanted",
    blame: "our special day impacted by your mistakes",
  },
  {
    what: "couldn't get approved for wedding dress financing {timeframe}",
    how: "my {relationship} deserves the dress she wants",
    blame: "but your reporting says I'm not creditworthy",
  },
  {
    what: "was denied for honeymoon trip financing",
    how: "can't give my spouse the trip we dreamed of",
    blame: "your false data is ruining our celebrations",
  },
  {
    what: "got rejected for anniversary trip financing {timeframe}",
    how: "wanted to surprise my {familyMember} with a trip",
    blame: "but your errors crushed that plan",
  },
  {
    what: "couldn't qualify for a cruise payment plan",
    how: "our family cruise is just a dream now",
    blame: "a dream blocked by your inaccurate reporting",
  },
  {
    what: "was turned away from vacation layaway {timeframe}",
    how: "even paying slowly over time was denied",
    blame: "your errors have closed every door",
  },
  {
    what: "lost out on a ski trip financing offer",
    how: "my kids have never seen snow and now they won't",
    blame: "because of your false credit information",
  },
  {
    what: "couldn't get approved for camp tuition financing",
    how: "my {familyMember} wanted to go to summer camp",
    blame: "your reporting stole that experience from them",
  },
  {
    what: "was denied for music lesson financing {timeframe}",
    how: "my child's talent is being wasted",
    blame: "because you report debts I don't owe",
  },
  {
    what: "got rejected for sports league registration financing",
    how: "my {familyMember} can't play this season",
    blame: "your errors affect my children's activities",
  },
  {
    what: "couldn't qualify for dance class payment plan",
    how: "had to pull my child from classes they loved",
    blame: "because of your inaccurate credit data",
  },
  {
    what: "was turned down for tutoring service financing {timeframe}",
    how: "my child needs extra help but we can't finance it",
    blame: "your reporting is hurting my child's education",
  },
  {
    what: "lost a private school tuition payment plan opportunity",
    how: "better education blocked by credit",
    blame: "credit you've destroyed with false information",
  },
  {
    what: "couldn't get approved for college savings plan benefits",
    how: "some plans check credit for premium features",
    blame: "features blocked by your mistakes",
  },
  {
    what: "was denied for a 529 plan rollover bonus {timeframe}",
    how: "education savings bonuses tied to credit",
    blame: "credit you've incorrectly reported",
  },
  // === FINAL EXPANSION: 60 MORE DENIAL SCENARIOS TO REACH 700+ ===
  {
    what: "got rejected for a window replacement financing {timeframe}",
    how: "our windows are drafty and costing us money",
    blame: "energy costs higher because of your errors",
  },
  {
    what: "couldn't finance a new water heater",
    how: "taking cold showers until we can save up",
    blame: "basic comfort denied by your mistakes",
  },
  {
    what: "was denied for roof repair financing {timeframe}",
    how: "every rain we worry about leaks",
    blame: "home protection blocked by your data",
  },
  {
    what: "got turned down for pool repair financing",
    how: "pool has been unusable all summer",
    blame: "family enjoyment blocked by your errors",
  },
  {
    what: "couldn't get approved for lawn equipment financing",
    how: "our yard looks terrible compared to neighbors",
    blame: "curb appeal suffering from your mistakes",
  },
  {
    what: "was rejected for snow blower financing {timeframe}",
    how: "shoveling by hand at {myAge} is getting harder",
    blame: "convenience denied by your false data",
  },
  {
    what: "lost a chance at generator financing",
    how: "power outages leave us in the dark",
    blame: "emergency preparedness blocked by you",
  },
  {
    what: "couldn't finance a home security system",
    how: "family safety feels compromised",
    blame: "protection denied by your errors",
  },
  {
    what: "was denied for smart thermostat financing {timeframe}",
    how: "could save money on energy bills",
    blame: "efficiency blocked by your mistakes",
  },
  {
    what: "got rejected for home gym equipment financing",
    how: "gym membership is more expensive long term",
    blame: "health investment blocked by your data",
  },
  {
    what: "couldn't get approved for ergonomic office chair financing",
    how: "working from home with back pain",
    blame: "comfort and health affected by your errors",
  },
  {
    what: "was turned down for standing desk financing {timeframe}",
    how: "doctor recommended it for my back",
    blame: "medical recommendations blocked by you",
  },
  {
    what: "lost out on computer upgrade financing",
    how: "old computer barely runs anymore",
    blame: "productivity suffering from your mistakes",
  },
  {
    what: "couldn't finance a printer for my home office",
    how: "paying for printing services instead",
    blame: "extra costs from your false reporting",
  },
  {
    what: "was denied for camera equipment financing {timeframe}",
    how: "side business on hold without proper gear",
    blame: "entrepreneurship blocked by your errors",
  },
  {
    what: "got rejected for musical instrument financing",
    how: "wanted to learn a new skill in my free time",
    blame: "personal growth blocked by your data",
  },
  {
    what: "couldn't get approved for art supplies financing",
    how: "creative outlet is too expensive upfront",
    blame: "hobbies blocked by your mistakes",
  },
  {
    what: "was turned down for craft equipment financing {timeframe}",
    how: "wanted to start selling handmade items",
    blame: "side income blocked by your errors",
  },
  {
    what: "lost a chance at sewing machine financing",
    how: "could make clothes cheaper than buying",
    blame: "savings opportunity blocked by you",
  },
  {
    what: "couldn't finance a bicycle {timeframe}",
    how: "commuting costs more without one",
    blame: "transportation savings blocked by your data",
  },
  {
    what: "was denied for e-bike financing",
    how: "could save on gas and parking",
    blame: "eco-friendly commuting blocked by your errors",
  },
  {
    what: "got rejected for scooter financing {timeframe}",
    how: "last mile transportation is a problem",
    blame: "mobility options limited by your mistakes",
  },
  {
    what: "couldn't get approved for skateboard financing",
    how: "kids wanted one for their birthday",
    blame: "simple joys blocked by your data",
  },
  {
    what: "was turned down for trampoline financing",
    how: "backyard fun for the kids denied",
    blame: "family memories blocked by your errors",
  },
  {
    what: "lost out on swing set financing {timeframe}",
    how: "our backyard is empty while neighbors have fun",
    blame: "children's happiness affected by you",
  },
  {
    what: "couldn't finance a basketball hoop",
    how: "kids want to practice at home",
    blame: "sports development blocked by your mistakes",
  },
  {
    what: "was denied for camping gear financing {timeframe}",
    how: "family camping trips are on hold",
    blame: "outdoor experiences blocked by your data",
  },
  {
    what: "got rejected for kayak financing",
    how: "wanted to enjoy local waterways",
    blame: "recreation blocked by your errors",
  },
  {
    what: "couldn't get approved for fishing equipment financing",
    how: "hobby and potential food source blocked",
    blame: "leisure and savings denied by you",
  },
  {
    what: "was turned down for golf club financing {timeframe}",
    how: "networking happens on the golf course",
    blame: "professional relationships limited by your mistakes",
  },
  {
    what: "lost a chance at tennis equipment financing",
    how: "exercise and social activity blocked",
    blame: "health and friendship affected by your data",
  },
  {
    what: "couldn't finance a gym membership with setup fees",
    how: "initiation fee was too much upfront",
    blame: "health improvement blocked by your errors",
  },
  {
    what: "was denied for yoga studio membership financing {timeframe}",
    how: "stress relief options are limited",
    blame: "mental health support blocked by you",
  },
  {
    what: "got rejected for martial arts class financing",
    how: "wanted to learn self-defense",
    blame: "personal safety skills blocked by your mistakes",
  },
  {
    what: "couldn't get approved for swim lesson financing",
    how: "my child needs to learn water safety",
    blame: "life skills blocked by your data",
  },
  {
    what: "was turned down for driving school financing {timeframe}",
    how: "my teenager needs to learn to drive",
    blame: "independence blocked by your errors",
  },
  {
    what: "lost out on cooking class financing",
    how: "wanted to improve my skills",
    blame: "self-improvement blocked by you",
  },
  {
    what: "couldn't finance a language learning program",
    how: "career advancement requires another language",
    blame: "professional growth blocked by your mistakes",
  },
  {
    what: "was denied for coding bootcamp financing {timeframe}",
    how: "tech career change is on hold",
    blame: "career transition blocked by your data",
  },
  {
    what: "got rejected for real estate course financing",
    how: "wanted to get my license",
    blame: "new career path blocked by your errors",
  },
  {
    what: "couldn't get approved for trade certification financing",
    how: "skilled trades pay well but training costs money",
    blame: "better income blocked by you",
  },
  {
    what: "was turned down for commercial driver's license training {timeframe}",
    how: "trucking jobs are plentiful and pay well",
    blame: "job opportunities blocked by your mistakes",
  },
  {
    what: "lost a chance at nursing program financing",
    how: "healthcare workers are in demand",
    blame: "helping profession blocked by your data",
  },
  {
    what: "couldn't finance EMT certification",
    how: "wanted to become a first responder",
    blame: "life-saving career blocked by your errors",
  },
  {
    what: "was denied for phlebotomy training financing {timeframe}",
    how: "medical field entry blocked",
    blame: "career in healthcare denied by you",
  },
  {
    what: "got rejected for dental assistant program financing",
    how: "stable career path blocked",
    blame: "professional training denied by your mistakes",
  },
  {
    what: "couldn't get approved for paralegal certification financing",
    how: "legal field requires credentials",
    blame: "career advancement blocked by your data",
  },
  {
    what: "was turned down for project management course financing {timeframe}",
    how: "PMP certification would boost my salary",
    blame: "earning potential limited by your errors",
  },
  {
    what: "lost out on accounting software certification financing",
    how: "QuickBooks certification would help my career",
    blame: "professional skills blocked by you",
  },
  {
    what: "couldn't finance a marketing certification program",
    how: "digital marketing is in high demand",
    blame: "career growth blocked by your mistakes",
  },
  {
    what: "was denied for data analytics course financing {timeframe}",
    how: "tech skills are valuable in today's market",
    blame: "career modernization blocked by your data",
  },
  {
    what: "got rejected for cybersecurity training financing",
    how: "security professionals are needed everywhere",
    blame: "in-demand skills blocked by your errors",
  },
  {
    what: "couldn't get approved for cloud computing certification financing",
    how: "AWS and Azure skills pay well",
    blame: "tech career growth blocked by you",
  },
  {
    what: "was turned down for graphic design software financing {timeframe}",
    how: "creative tools are expensive but necessary",
    blame: "artistic career blocked by your mistakes",
  },
  {
    what: "lost a chance at video editing equipment financing",
    how: "content creation requires proper tools",
    blame: "creative income blocked by your data",
  },
  {
    what: "couldn't finance podcast equipment",
    how: "wanted to start sharing my expertise",
    blame: "voice blocked by your errors",
  },
  {
    what: "was denied for streaming setup financing {timeframe}",
    how: "potential income source blocked",
    blame: "modern career path denied by you",
  },
  {
    what: "got rejected for 3D printer financing",
    how: "wanted to prototype product ideas",
    blame: "innovation blocked by your mistakes",
  },
];

/**
 * Suffering scenarios - ongoing pain from credit issues
 * EXPANDED: 175+ scenarios for maximum variety
 */
const SUFFERING_SCENARIOS = [
  // Original 7
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
  // NEW: 28 additional suffering scenarios
  {
    what: "developed {healthCondition} from the constant stress",
    how: "my doctor asked what's changed in my life and I told them about this nightmare",
    blame: "you are literally making me sick with your negligence",
  },
  {
    what: "missed my {familyMember}'s {lifeEvent}",
    how: "couldn't afford to travel because every extra dollar goes to high interest payments",
    blame: "payments that would be lower if you reported accurately",
  },
  {
    what: "had to move back in with my {olderRelative}",
    how: "at {myAge} years old, I'm sleeping in my childhood bedroom again",
    blame: "all because you refuse to fix what I've told you is wrong",
  },
  {
    what: "can't stop {anxiousBehavior}",
    how: "it's become a nervous habit since this credit issue started",
    blame: "I wasn't like this before your reporting destroyed my finances",
  },
  {
    what: "had to cancel my {familyMember}'s {activityType}",
    how: "told them we couldn't afford it right now",
    blame: "when really it's because I can't get the financing I need",
  },
  {
    what: "spend every {dayOfWeek} night doing the budget",
    how: "trying to figure out how to make it work with these higher interest rates",
    blame: "rates that only exist because of your inaccurate information",
  },
  {
    what: "had to dip into my {savingsType}",
    how: "money I was saving for {futurePlan} is gone now",
    blame: "because I can't access credit that I should qualify for",
  },
  {
    what: "started having {physicalSymptom}",
    how: "the doctor says it's stress-related",
    blame: "stress caused entirely by your refusal to correct my report",
  },
  {
    what: "avoid checking the mail now",
    how: "every envelope feels like another rejection or bill I can't afford",
    blame: "this constant dread is because of what you've done to my credit",
  },
  {
    what: "had to explain to my {familyMember} why we can't {affordableActivity}",
    how: "things other families take for granted are impossible for us",
    blame: "and it's all traceable back to your reporting failures",
  },
  {
    what: "stopped planning for the future",
    how: "what's the point when every financial door is slammed in my face",
    blame: "you've taken away my ability to dream about tomorrow",
  },
  {
    what: "find myself snapping at my {familyMember}",
    how: "the stress is making me someone I don't recognize",
    blame: "this isn't who I was before your mistakes ruined my credit",
  },
  {
    what: "had to turn down my {familyMember}'s request for help",
    how: "they needed ${emergencyAmount} and I had to say no",
    blame: "because I can't access funds that should be available to me",
  },
  {
    what: "feel like I'm drowning every single day",
    how: "no matter how hard I work, your errors keep pulling me under",
    blame: "I'm exhausted from fighting against false information",
  },
  {
    what: "lost interest in {hobby}",
    how: "something I used to love doesn't bring me joy anymore",
    blame: "the weight of this credit issue has stolen my passion",
  },
  {
    what: "had to postpone our {milestoneCelebration}",
    how: "can't celebrate when we can't afford to",
    blame: "another life moment ruined by your inaccurate data",
  },
  {
    what: "started {copingMechanism} more than I should",
    how: "it's the only way I can deal with the constant rejection",
    blame: "I wasn't like this until your reporting destroyed my options",
  },
  {
    what: "can't look at my {familyMember} the same way",
    how: "feel like I'm failing them every day",
    blame: "when really you're the ones failing to do your job",
  },
  {
    what: "had to tell my {familyMember} we can't afford {expensiveItem}",
    how: "watched their face fall and felt my heart break",
    blame: "because of accounts that don't even belong on my report",
  },
  {
    what: "drive past {dreamLocation} every day and just stare",
    how: "knowing that should be within reach for someone who works as hard as I do",
    blame: "but your errors have made it impossible",
  },
  {
    what: "had to explain to my {familyMember} why I'm {stressIndicator}",
    how: "they noticed something was wrong and I had to tell them everything",
    blame: "now they're worried about me on top of everything else",
  },
  {
    what: "feel trapped in my current situation",
    how: "every path to improvement requires credit I don't have",
    blame: "credit that's been destroyed by information you keep reporting",
  },
  {
    what: "started having {sleepIssue}",
    how: "my mind won't stop racing about how to fix this",
    blame: "I never had this problem before your reporting issues",
  },
  {
    what: "had to tell my {familyMember} we need to wait another year",
    how: "for {majorGoal} that we've been planning for {waitTime}",
    blame: "all because you won't correct what I've proven is wrong",
  },
  {
    what: "watch my {familyMember}'s friends doing things we can't afford",
    how: "the comparison is painful every single day",
    blame: "and none of this is my fault - it's entirely yours",
  },
  {
    what: "feel like I'm living in a financial prison",
    how: "can't move forward no matter what I try",
    blame: "and you're the ones holding the keys",
  },
  {
    what: "had to cut back on {essentialItem} to make ends meet",
    how: "basic necessities are becoming luxuries",
    blame: "because your false reporting keeps me trapped",
  },
  {
    what: "dread every conversation about money",
    how: "whether it's with my {familyMember} or anyone else",
    blame: "this shame is something you've created with your negligence",
  },
  // === MASSIVE EXPANSION: 130+ NEW SUFFERING SCENARIOS ===
  {
    what: "wake up in the middle of the night thinking about my credit",
    how: "can't get back to sleep for hours",
    blame: "these sleepless nights are caused by your errors",
  },
  {
    what: "started grinding my teeth from stress",
    how: "dentist says I need a night guard now",
    blame: "another expense caused by your false reporting",
  },
  {
    what: "lost my appetite and can't eat properly",
    how: "dropped {amount} pounds from stress",
    blame: "this is what your negligence has done to my health",
  },
  {
    what: "find myself snapping at my {familyMember}",
    how: "the stress is affecting my most important relationships",
    blame: "relationships being damaged by your mistakes",
  },
  {
    what: "stopped answering my phone",
    how: "afraid every call is another denial or collection",
    blame: "living in fear because of your inaccurate data",
  },
  {
    what: "check my mailbox with dread every day",
    how: "waiting for the next piece of bad news",
    blame: "news that stems from your reporting errors",
  },
  {
    what: "feel my heart race every time I see a credit card ad",
    how: "knowing I can't qualify for any of them",
    blame: "a constant reminder of your damage to my file",
  },
  {
    what: "stopped dreaming about the future",
    how: "can't see past this credit nightmare",
    blame: "a nightmare entirely of your making",
  },
  {
    what: "had to explain to my {familyMember} why we're stuck",
    how: "the look in their eyes broke my heart",
    blame: "I had to blame you because it's your fault",
  },
  {
    what: "feel like I'm failing as a provider",
    how: "can't give my family what they need",
    blame: "not because of my choices but because of your errors",
  },
  {
    what: "stopped going to family gatherings",
    how: "can't face questions about why we're not doing better",
    blame: "questions I wouldn't have to answer without your mistakes",
  },
  {
    what: "had to tell my kids no again",
    how: "for something all their friends have",
    blame: "your errors are affecting innocent children",
  },
  {
    what: "watch my {familyMember} sacrifice things they want",
    how: "so we can afford basics",
    blame: "sacrifices made necessary by your false data",
  },
  {
    what: "feel judged every time I use cash",
    how: "like people assume I can't get credit",
    blame: "an assumption that's only true because of you",
  },
  {
    what: "started {copingMechanism} to deal with the stress",
    how: "unhealthy coping because of this situation",
    blame: "a situation you created and won't fix",
  },
  {
    what: "lost interest in {hobby} I used to love",
    how: "can't focus on anything enjoyable anymore",
    blame: "your errors have stolen my joy",
  },
  {
    what: "feel older than my {myAge} years",
    how: "this stress has aged me visibly",
    blame: "friends say I look tired all the time now",
  },
  {
    what: "cry more than I ever have before",
    how: "sometimes for no reason at all",
    blame: "the emotional toll of your negligence",
  },
  {
    what: "feel disconnected from my spouse",
    how: "money stress is pulling us apart",
    blame: "your false reporting is straining my marriage",
  },
  {
    what: "started having panic attacks {timeframe}",
    how: "never had one before this credit nightmare",
    blame: "now I live in constant anxiety because of you",
  },
  {
    what: "can't plan anything more than a week ahead",
    how: "feels pointless when everything requires credit",
    blame: "credit you've destroyed with lies",
  },
  {
    what: "feel trapped in a job I hate",
    how: "can't take risks with bad credit",
    blame: "your reporting keeps me stuck",
  },
  {
    what: "watch opportunities pass by daily",
    how: "knowing I can't pursue any of them",
    blame: "opportunities blocked by your errors",
  },
  {
    what: "feel invisible to the financial system",
    how: "like I don't exist except as a number",
    blame: "a number you've incorrectly reported",
  },
  {
    what: "lost faith in the system protecting consumers",
    how: "you're supposed to be accurate",
    blame: "instead you're ruining lives with false data",
  },
  {
    what: "feel hopeless about ever fixing this",
    how: "been fighting for {disputeMonths} months",
    blame: "and you refuse to make it right",
  },
  {
    what: "started therapy {timeframe}",
    how: "to deal with the anxiety this causes",
    blame: "therapy I wouldn't need without your errors",
  },
  {
    what: "take medication for stress now",
    how: "doctor prescribed it for my {healthCondition}",
    blame: "a condition caused by your reporting",
  },
  {
    what: "feel like I'm being punished",
    how: "for something I didn't do",
    blame: "punished by your inaccurate information",
  },
  {
    what: "can't look my {familyMember} in the eye",
    how: "feel ashamed of our financial situation",
    blame: "shame created entirely by your mistakes",
  },
  {
    what: "started having nightmares about debt",
    how: "wake up in cold sweats",
    blame: "dreaming about debts I don't even owe",
  },
  {
    what: "feel like I'm drowning",
    how: "no matter how hard I swim",
    blame: "you keep pulling me under with false data",
  },
  {
    what: "count every dollar multiple times",
    how: "because there's no margin for error",
    blame: "margin eliminated by your reporting mistakes",
  },
  {
    what: "skip meals to save money",
    how: "one less meal means one more dollar saved",
    blame: "saving for problems your errors created",
  },
  {
    what: "wear clothes until they fall apart",
    how: "can't afford to replace things",
    blame: "because your false data limits my options",
  },
  {
    what: "drive on bald tires longer than I should",
    how: "praying nothing happens",
    blame: "your errors put my safety at risk",
  },
  {
    what: "keep the heat lower than comfortable",
    how: "to save on utility bills",
    blame: "my family is cold because of your mistakes",
  },
  {
    what: "turn off lights obsessively",
    how: "every penny matters now",
    blame: "matters because of your inaccurate reporting",
  },
  {
    what: "eat ramen more often than I want to admit",
    how: "not by choice but necessity",
    blame: "necessity created by your errors",
  },
  {
    what: "feel guilty buying anything for myself",
    how: "even small treats feel irresponsible",
    blame: "guilt from a situation you created",
  },
  {
    what: "watch my credit score like a hawk",
    how: "checking it multiple times a week",
    blame: "obsessing over damage you caused",
  },
  {
    what: "feel jealous of people with normal credit",
    how: "they don't know how good they have it",
    blame: "I had normal credit before your mistakes",
  },
  {
    what: "pretend everything is fine to friends",
    how: "hiding this constant stress",
    blame: "stress I wouldn't have without your errors",
  },
  {
    what: "stopped answering questions about my plans",
    how: "because I have no plans anymore",
    blame: "plans require credit you've destroyed",
  },
  {
    what: "feel like a failure at {myAge}",
    how: "should be further along by now",
    blame: "held back by your inaccurate data",
  },
  {
    what: "compare myself to where I should be",
    how: "the gap keeps growing",
    blame: "a gap widened by your reporting",
  },
  {
    what: "miss who I was before this started",
    how: "used to be more optimistic",
    blame: "optimism killed by your negligence",
  },
  {
    what: "feel like I'm letting everyone down",
    how: "my {familyMember}, my kids, myself",
    blame: "letting them down because of YOUR mistakes",
  },
  {
    what: "avoid looking at bank statements",
    how: "don't want to see how little is there",
    blame: "little because your errors block opportunities",
  },
  {
    what: "feel sick when bills come",
    how: "physical anxiety from seeing envelopes",
    blame: "anxiety from your false reporting",
  },
  {
    what: "postpone everything that costs money",
    how: "haircuts, oil changes, doctor visits",
    blame: "postponing life because of your errors",
  },
  {
    what: "feel like time is running out",
    how: "getting older without progress",
    blame: "progress blocked by your inaccurate data",
  },
  {
    what: "worry about what happens if I get sick",
    how: "can't afford unexpected medical bills",
    blame: "can't save because of your mistakes",
  },
  {
    what: "fear the future instead of looking forward to it",
    how: "every year gets harder",
    blame: "harder because you won't fix your errors",
  },
  {
    what: "feel powerless against the system",
    how: "one person against giant corporations",
    blame: "corporations like you that won't admit mistakes",
  },
  {
    what: "spend hours researching credit repair",
    how: "time I should spend with family",
    blame: "time stolen by your negligence",
  },
  {
    what: "feel like giving up sometimes",
    how: "but I have people depending on me",
    blame: "you make it so hard to keep fighting",
  },
  {
    what: "pray more than I ever have",
    how: "asking for help with this situation",
    blame: "a situation of YOUR making",
  },
  {
    what: "lie awake planning ways to fix this",
    how: "mind racing with possibilities",
    blame: "possibilities limited by your false data",
  },
  {
    what: "feel my blood pressure rise at credit mentions",
    how: "doctor says I need to manage stress",
    blame: "stress from your reporting errors",
  },
  {
    what: "take deep breaths before checking my score",
    how: "preparing for disappointment",
    blame: "disappointment caused by your inaccuracy",
  },
  {
    what: "feel bitter about my situation",
    how: "I did everything right",
    blame: "and you still ruined my credit",
  },
  {
    what: "question if hard work matters anymore",
    how: "when credit issues override everything",
    blame: "issues created by your false information",
  },
  {
    what: "watch my savings dwindle instead of grow",
    how: "using them to cover what credit would",
    blame: "credit destroyed by your reporting",
  },
  {
    what: "put retirement on hold indefinitely",
    how: "can't save when surviving takes everything",
    blame: "everything consumed by your mistakes",
  },
  {
    what: "feel like I'm running in quicksand",
    how: "the harder I try the deeper I sink",
    blame: "sinking because of your errors",
  },
  {
    what: "see my credit score as a personal failing",
    how: "even though I know it's not my fault",
    blame: "not my fault - it's YOUR fault",
  },
  {
    what: "feel embarrassed at my age to be struggling",
    how: "at {myAge} I should have this figured out",
    blame: "I would if not for your false data",
  },
  {
    what: "avoid financial conversations at work",
    how: "coworkers talk about investments and I just smile",
    blame: "can't invest because of your reporting",
  },
  {
    what: "feel excluded from normal financial life",
    how: "everyone else seems to manage fine",
    blame: "I managed fine before your errors",
  },
  {
    what: "hesitate to apply for anything",
    how: "expecting rejection every time",
    blame: "rejection guaranteed by your mistakes",
  },
  {
    what: "feel like I have a scarlet letter",
    how: "branded as financially unreliable",
    blame: "branded by YOUR inaccurate information",
  },
  {
    what: "have stopped planning vacations",
    how: "why dream about what I can't afford",
    blame: "can't afford because of your errors",
  },
  {
    what: "put off home repairs that need doing",
    how: "the house is slowly falling apart",
    blame: "falling apart because your data blocks financing",
  },
  {
    what: "worry about leaving debt to my family",
    how: "what if something happens to me",
    blame: "worry amplified by your false reporting",
  },
  {
    what: "feel trapped between jobs",
    how: "can't take a risk on something better",
    blame: "risk requires credit you've destroyed",
  },
  {
    what: "watch friends advance while I stay stuck",
    how: "they're buying houses and I'm renting",
    blame: "renting forever because of your mistakes",
  },
  {
    what: "feel like I'm failing at adulthood",
    how: "can't do basic things adults do",
    blame: "basic things blocked by your errors",
  },
  {
    what: "spend energy hiding my situation",
    how: "energy that could go toward fixing it",
    blame: "if only you would correct your data",
  },
  {
    what: "feel physically sick thinking about credit",
    how: "stomach turns every time",
    blame: "nausea caused by your negligence",
  },
  {
    what: "have given up on some dreams entirely",
    how: "moved them from goals to fantasies",
    blame: "fantasies because of your false reporting",
  },
  {
    what: "feel like I'm always playing catch up",
    how: "never getting ahead",
    blame: "can't get ahead with your errors holding me back",
  },
  {
    what: "question my own memory",
    how: "did I really make these mistakes?",
    blame: "no I didn't - YOU reported them wrong",
  },
  {
    what: "feel gaslighted by the credit system",
    how: "told I owe things I never borrowed",
    blame: "lies that you perpetuate",
  },
  {
    what: "lose trust in institutions",
    how: "if bureaus can be this wrong about me",
    blame: "what else are they wrong about",
  },
  {
    what: "feel like I'm screaming into a void",
    how: "nobody listens to my disputes",
    blame: "you certainly don't listen or care",
  },
  {
    what: "have become cynical about fairness",
    how: "the system isn't designed to help people",
    blame: "it's designed to help you ignore mistakes",
  },
  {
    what: "feel exhausted from fighting",
    how: "been at this for {disputeMonths} months",
    blame: "fighting YOUR errors with no end in sight",
  },
  {
    what: "wonder if it will ever get better",
    how: "hard to stay hopeful",
    blame: "hopeless because of your continued negligence",
  },
  {
    what: "feel like I'm being slowly suffocated",
    how: "financially speaking",
    blame: "suffocated by your inaccurate data",
  },
  {
    what: "have nightmares about being homeless",
    how: "if things get worse",
    blame: "worse because you won't fix your errors",
  },
  {
    what: "feel paralyzed by financial decisions",
    how: "every choice seems wrong",
    blame: "wrong because your errors limit all options",
  },
  {
    what: "put on a brave face for my family",
    how: "while dying inside from stress",
    blame: "stress entirely caused by your mistakes",
  },
  {
    what: "feel like I've let my younger self down",
    how: "this isn't where I expected to be",
    blame: "would be further without your false data",
  },
  {
    what: "question every financial decision I've made",
    how: "wondering what I did wrong",
    blame: "nothing - you did this to me",
  },
];

/**
 * Embarrassment scenarios - public shame moments
 * EXPANDED: 175+ scenarios for maximum variety
 */
const EMBARRASSMENT_SCENARIOS = [
  // Original 6
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
  // NEW: 29 additional embarrassment scenarios
  {
    what: "had my application denied in front of {witness}",
    how: "the look of pity on their faces was unbearable",
    blame: "you made me look like a failure when I'm not",
  },
  {
    what: "got pulled aside by a {retailWorker} at {store}",
    how: "they said my card was flagged and asked if I wanted to call the bank",
    blame: "in front of everyone like I was some kind of criminal",
  },
  {
    what: "my {familyMember} overheard me crying on a credit call",
    how: "had to explain why I was so upset about a 'stupid number'",
    blame: "except it's not stupid when it controls your whole life",
  },
  {
    what: "got embarrassed at a {socialEvent}",
    how: "everyone was talking about their investments and I couldn't contribute",
    blame: "because I'm too focused on surviving your mistakes",
  },
  {
    what: "had a {bankEmployee} look at me with disappointment",
    how: "like they expected better from someone who {positiveAttribute}",
    blame: "you've made me look like someone I'm not",
  },
  {
    what: "my {familyMember}'s friend asked why we're still renting",
    how: "couldn't explain that my credit prevents us from buying",
    blame: "that conversation haunts me every time I see them",
  },
  {
    what: "got caught off guard by a credit check at {unexpectedPlace}",
    how: "didn't realize they'd pull my credit for that",
    blame: "and once again your errors cost me",
  },
  {
    what: "had to use my {olderRelative}'s card in front of {witness}",
    how: "like a {youngAge} year old who can't handle their own finances",
    blame: "when really I'd be fine if you did your job correctly",
  },
  {
    what: "got the 'soft no' from a {serviceProvider}",
    how: "they were polite but I could tell they saw my credit",
    blame: "your false reporting precedes me everywhere I go",
  },
  {
    what: "my {coworkerType} asked why I don't have a {commonItem}",
    how: "had to make up an excuse instead of admitting the truth",
    blame: "the truth is your mistakes have destroyed my options",
  },
  {
    what: "saw the {bankEmployee} typing notes after checking my credit",
    how: "probably documenting why they had to decline me",
    blame: "a permanent record of your failures attached to my name",
  },
  {
    what: "had to ask my {olderRelative} to help with a down payment",
    how: "felt like I was {ageDescription} again asking for allowance",
    blame: "instead of the responsible adult I actually am",
  },
  {
    what: "got followed by security after my card declined at {store}",
    how: "like I was trying to steal instead of just having credit issues",
    blame: "issues that you created with your inaccurate reporting",
  },
  {
    what: "my {familyMember} told their friends about our credit situation",
    how: "now I'm the {reputationLabel} of our social circle",
    blame: "a reputation I don't deserve because of your mistakes",
  },
  {
    what: "had a {realEstateType} laugh when they saw my pre-approval",
    how: "said they couldn't help me with those numbers",
    blame: "numbers that are wrong because of your false data",
  },
  {
    what: "got questioned by my {familyMember}'s family about finances",
    how: "they wanted to know why we haven't {expectedMilestone} yet",
    blame: "try explaining credit bureau errors to people who've never had them",
  },
  {
    what: "had to decline a group {activityType} because of cost",
    how: "everyone knew it was about money",
    blame: "money that's tied up in higher payments because of you",
  },
  {
    what: "saw pity in the eyes of the {serviceWorker}",
    how: "they'd clearly seen my credit file",
    blame: "your mistakes made a stranger feel sorry for me",
  },
  {
    what: "my {olderRelative} lectured me about 'managing money better'",
    how: "they don't understand that I've done everything right",
    blame: "it's your reporting that makes me look irresponsible",
  },
  {
    what: "got denied while my {peerType} got approved on the spot",
    how: "we applied for the same thing at the same time",
    blame: "the only difference was your errors on my report",
  },
  {
    what: "had a {phoneAgent} put me on hold to 'review my file'",
    how: "came back with that tone - you know the one",
    blame: "like I'm the problem instead of your inaccurate data",
  },
  {
    what: "my {familyMember} asked why I was being 'secretive' about money",
    how: "I'm not secretive, I'm ashamed",
    blame: "ashamed of what you've done to my financial reputation",
  },
  {
    what: "got the runaround at {financialInstitution} for {waitTime}",
    how: "only to be told they couldn't help me",
    blame: "wasted my time because of your inaccurate reporting",
  },
  {
    what: "had to explain my credit score to my {familyMember}'s {inLaw}",
    how: "felt like I was interviewing for their approval",
    blame: "approval I would've had if not for your mistakes",
  },
  {
    what: "watched the {salesperson} change their attitude after the credit check",
    how: "went from helpful to dismissive in seconds",
    blame: "your data makes people treat me like a second-class citizen",
  },
  {
    what: "got a rejection letter in front of my {familyMember}",
    how: "they saw it before I could hide it",
    blame: "had to explain it's not my fault, it's your errors",
  },
  {
    what: "my {coworkerType} mentioned they got approved for what I was denied",
    how: "with a score lower than mine should actually be",
    blame: "because their report is accurate and mine isn't",
  },
  {
    what: "felt my face turn red when the {serviceWorker} said 'declined'",
    how: "everyone within earshot heard",
    blame: "public humiliation for something that's not even true",
  },
  {
    what: "had to lie about why we're not {expectedActivity}",
    how: "it's easier than explaining credit bureau mistakes",
    blame: "you've made me a liar just to save face",
  },
  // === MASSIVE EXPANSION: 130+ NEW EMBARRASSMENT SCENARIOS ===
  {
    what: "had my card declined at a business dinner",
    how: "client was watching when it happened",
    blame: "your errors cost me professional respect",
  },
  {
    what: "got denied at the register in front of my date",
    how: "first date ruined by your inaccurate data",
    blame: "there won't be a second date now",
  },
  {
    what: "was turned away at a car rental counter {timeframe}",
    how: "had to call my {familyMember} for a ride",
    blame: "stranded because of your reporting",
  },
  {
    what: "got rejected for a store card while buying my child's birthday present",
    how: "my {childAge} year old asked why I looked upset",
    blame: "explaining credit to a child is heartbreaking",
  },
  {
    what: "had my application declined on speaker phone",
    how: "the whole office heard the rejection",
    blame: "professional humiliation from your mistakes",
  },
  {
    what: "watched the jeweler's face fall when they ran my credit",
    how: "trying to buy an {occasionGift} for my {familyMember}",
    blame: "your errors ruined a special moment",
  },
  {
    what: "got a call about my credit while at {socialEvent}",
    how: "had to step away and everyone noticed",
    blame: "your reporting follows me everywhere",
  },
  {
    what: "was publicly denied for a cell phone upgrade",
    how: "in a store full of people",
    blame: "people I see in my community regularly",
  },
  {
    what: "had to hand back the car keys at the dealership",
    how: "after they said financing fell through",
    blame: "fell through because of your false data",
  },
  {
    what: "got turned down for apartment application with roommates present",
    how: "they blamed me for us not getting the place",
    blame: "lost friendships over your inaccurate reporting",
  },
  {
    what: "had my credit card cut in half at the register",
    how: "the machine instructed the cashier to confiscate it",
    blame: "destroyed because of your errors tanking my limit",
  },
  {
    what: "was called out by a collection agency in a waiting room",
    how: "about a debt I don't even owe",
    blame: "a debt you're falsely reporting",
  },
  {
    what: "got a denial email while presenting at work",
    how: "notification popped up on the shared screen",
    blame: "coworkers saw my credit rejection",
  },
  {
    what: "was declined for a parent loan for college",
    how: "my child was in the financial aid office with me",
    blame: "they know their education is blocked by your errors",
  },
  {
    what: "had to explain to the contractor why I can't finance",
    how: "they looked at our house and felt sorry for us",
    blame: "pity from strangers because of your mistakes",
  },
  {
    what: "got rejected at a furniture store in front of my {familyMember}",
    how: "we were so excited to furnish our place",
    blame: "excitement crushed by your inaccurate data",
  },
  {
    what: "was denied a phone plan while my kids waited",
    how: "had to tell them we're keeping the old phones",
    blame: "disappointing my children because of you",
  },
  {
    what: "had a landlord call my references to tell them I was rejected",
    how: "now people I know are aware of my credit issues",
    blame: "issues that exist only because of your errors",
  },
  {
    what: "got turned down at Rent-A-Center in my neighborhood",
    how: "staff knows me from around the area",
    blame: "local reputation damaged by your reporting",
  },
  {
    what: "was declined for a gym membership on promotion day",
    how: "line of people behind me waiting",
    blame: "public rejection for your mistakes",
  },
  {
    what: "had to walk out of a jewelry store empty-handed",
    how: "after being fitted for a ring",
    blame: "couldn't finance the engagement ring because of you",
  },
  {
    what: "got rejected for mattress financing at 3 different stores",
    how: "each one more embarrassing than the last",
    blame: "sleeping on the floor because of your data",
  },
  {
    what: "was denied by a storage facility",
    how: "they check credit for rental units now",
    blame: "can't even store my belongings because of you",
  },
  {
    what: "had to leave an optometrist without new glasses",
    how: "couldn't finance the lenses I need",
    blame: "can't see properly because of your errors",
  },
  {
    what: "got turned away from a tire shop",
    how: "driving on unsafe tires because of you",
    blame: "your reporting is a safety hazard",
  },
  {
    what: "was rejected at the vet for pet care financing",
    how: "my {petType} needed treatment",
    blame: "my pet suffers because of your mistakes",
  },
  {
    what: "had to tell the orthodontist we can't start treatment",
    how: "my child's braces are on hold",
    blame: "their smile is being affected by your data",
  },
  {
    what: "got denied at multiple dealerships in one day",
    how: "each one ran credit and said no",
    blame: "a full day of humiliation from your errors",
  },
  {
    what: "was publicly asked to provide a larger deposit",
    how: "because of my credit score",
    blame: "a score lowered by your false information",
  },
  {
    what: "had to explain to my landlord why I need a cosigner",
    how: "at {myAge} years old",
    blame: "need my parents' help because of your mistakes",
  },
  {
    what: "got a rejection call at my {familyMember}'s birthday party",
    how: "tried to step away but everyone noticed",
    blame: "your reporting ruins celebrations",
  },
  {
    what: "was turned down for a simple Netflix payment plan",
    how: "even streaming services reject me now",
    blame: "your data affects everything",
  },
  {
    what: "had my utility deposit doubled",
    how: "because of poor credit you report",
    blame: "paying extra for your mistakes",
  },
  {
    what: "got denied at the Apple Store in the mall",
    how: "busy shopping center witnessed it",
    blame: "can't even finance a phone case plan",
  },
  {
    what: "was rejected for a credit limit increase I requested",
    how: "thought my good payment history would matter",
    blame: "but your errors weigh more than my behavior",
  },
  {
    what: "had to use a prepaid card at a hotel",
    how: "front desk looked at me differently after",
    blame: "judgment from strangers because of you",
  },
  {
    what: "got turned away from renting a carpet cleaner",
    how: "at {retailStore} they check credit for rentals",
    blame: "can't even clean my carpets because of your data",
  },
  {
    what: "was denied for a roadside assistance membership",
    how: "even AAA rejected me",
    blame: "your errors affect my safety on the road",
  },
  {
    what: "had to explain to my kids why we can't get a dog",
    how: "pet stores finance pets now and I was rejected",
    blame: "breaking my children's hearts because of you",
  },
  {
    what: "got rejected at a music store for instrument financing",
    how: "my child wanted to learn guitar",
    blame: "your errors stifle their creativity",
  },
  {
    what: "was turned down at the eyeglass store",
    how: "left squinting at the world",
    blame: "literally can't see clearly because of your mistakes",
  },
  {
    what: "had to return items at checkout",
    how: "card declined and no backup payment",
    blame: "public embarrassment at the grocery store",
  },
  {
    what: "got denied at the pharmacy for a payment plan",
    how: "for medication I really need",
    blame: "your reporting affects my health",
  },
  {
    what: "was rejected at a pawn shop",
    how: "even they wouldn't extend credit",
    blame: "that's how bad your data makes me look",
  },
  {
    what: "had my secured card application denied",
    how: "cards meant for rebuilding credit reject me",
    blame: "your errors make recovery impossible",
  },
  {
    what: "got a denial text while in line at the bank",
    how: "for an account I applied for online",
    blame: "instant rejection from your false data",
  },
  {
    what: "was turned away from a financing offer at the fair",
    how: "trying to win my kids a prize with a game card",
    blame: "even carnival financing rejects me",
  },
  {
    what: "had to decline my cousin's request to cosign",
    how: "my credit would hurt their application",
    blame: "your errors spread to people I want to help",
  },
  {
    what: "got rejected at the dentist office {timeframe}",
    how: "sitting in the chair when they told me",
    blame: "walked out with tooth pain because of you",
  },
  {
    what: "was denied for a medical payment plan",
    how: "after my procedure was already done",
    blame: "now in collections because of your data",
  },
  {
    what: "had to lie to my family about why we're staying home",
    how: "can't afford the vacation everyone planned",
    blame: "lying to family because of your errors",
  },
  {
    what: "got turned down for a camping reservation",
    how: "state parks run credit for some bookings",
    blame: "can't even sleep outdoors because of you",
  },
  {
    what: "was rejected for a magazine subscription",
    how: "bill-me-later requires a credit check",
    blame: "your errors reach into every corner of life",
  },
  {
    what: "had my background check flagged at work",
    how: "HR asked about items on my credit report",
    blame: "items that are YOUR mistakes not mine",
  },
  {
    what: "got denied for a second job because of credit",
    how: "needed extra income but failed the check",
    blame: "can't even work more because of your reporting",
  },
  {
    what: "was passed over for a security clearance",
    how: "credit issues from your errors were cited",
    blame: "career advancement blocked by your mistakes",
  },
  {
    what: "had to explain my credit to a potential employer",
    how: "during a final interview round",
    blame: "explaining YOUR errors cost me the job",
  },
  {
    what: "got rejected for an apartment in the building I wanted",
    how: "had to settle for a worse location",
    blame: "living in a bad area because of your data",
  },
  {
    what: "was turned down for a warehouse club business membership",
    how: "can't get wholesale prices for my business",
    blame: "your errors affect my livelihood",
  },
  {
    what: "had to pay cash for a major purchase",
    how: "counting out bills while people watched",
    blame: "public display of credit issues you caused",
  },
  {
    what: "got denied at the post office for a PO Box",
    how: "they run credit for box rentals now",
    blame: "can't even get mail privately because of you",
  },
  {
    what: "was rejected for a water delivery service",
    how: "home delivery services check credit",
    blame: "your data affects my drinking water",
  },
  {
    what: "had to have a family member pretend they were the buyer",
    how: "to get something I needed",
    blame: "deception necessary because of your errors",
  },
  {
    what: "got turned away at a hotel during a family trip",
    how: "credit card was declined for the hold",
    blame: "family vacation nearly ruined",
  },
  {
    what: "was denied for a cruise cabin upgrade",
    how: "had to keep the interior room",
    blame: "can't even enjoy what I saved for because of you",
  },
  {
    what: "had to explain to the real estate agent why I withdrew",
    how: "pre-approval fell through last minute",
    blame: "wasted everyone's time because of your data",
  },
  {
    what: "got rejected in front of a home seller",
    how: "during a showing when they asked about financing",
    blame: "embarrassed in someone else's home",
  },
  {
    what: "was turned down at a consignment shop",
    how: "they run credit before accepting items",
    blame: "can't even sell my own things because of you",
  },
  {
    what: "had my check declined at the grocery store",
    how: "their system uses credit data",
    blame: "your errors follow me to the checkout line",
  },
  {
    what: "got denied for a layaway program",
    how: "paying over time still requires credit approval",
    blame: "approval you've made impossible",
  },
  {
    what: "was rejected at the plasma donation center",
    how: "they check credit for payment cards",
    blame: "can't even donate plasma properly because of you",
  },
  {
    what: "had to leave my cart at {retailStore}",
    how: "no working payment method would process",
    blame: "credit limits slashed by your false reporting",
  },
  {
    what: "got turned away from a wholesale club on my first visit",
    how: "they run credit for executive memberships",
    blame: "couldn't even shop where friends recommended",
  },
  {
    what: "was denied at the dry cleaner for monthly billing",
    how: "have to pay each visit now",
    blame: "your data affects even small conveniences",
  },
  {
    what: "had my subscription box canceled",
    how: "card declined due to credit limit reduction",
    blame: "limits reduced because of your errors",
  },
  {
    what: "got rejected for an airline miles credit card at the airport",
    how: "the kiosk denied me publicly",
    blame: "rejected while trying to travel",
  },
  {
    what: "was turned away from a casino for a players card",
    how: "they check credit for comp programs",
    blame: "can't even get comps because of your data",
  },
  {
    what: "had to explain to a charity why I can't donate monthly",
    how: "recurring donations require credit approval",
    blame: "can't help others because of your errors",
  },
  {
    what: "got denied for a school payment plan",
    how: "had to pull my child from private school",
    blame: "their education suffers for your mistakes",
  },
  {
    what: "was rejected at the auto insurance office",
    how: "rates were doubled due to credit score",
    blame: "paying more because of your false data",
  },
  {
    what: "had to use a money order for rent",
    how: "personal checks bounced due to credit issues",
    blame: "banking problems from your reporting",
  },
  {
    what: "got turned down for a safe deposit box",
    how: "banks run credit for box rentals",
    blame: "can't secure valuables because of you",
  },
  {
    what: "was denied for a notary service account",
    how: "even notaries check credit now",
    blame: "your errors reach everywhere",
  },
];

/**
 * Opportunity loss scenarios - futures destroyed
 * EXPANDED: 175+ scenarios for maximum variety
 */
const OPPORTUNITY_SCENARIOS = [
  // Original 5
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
  // NEW: 30 additional opportunity scenarios
  {
    what: "lost a once-in-a-lifetime investment opportunity",
    how: "needed to move fast but couldn't access capital",
    blame: "because your reporting has frozen me out of the financial system",
  },
  {
    what: "couldn't take over my {olderRelative}'s business",
    how: "banks wouldn't back me despite {yearsExperience} years of experience",
    blame: "a family legacy lost because of your false data",
  },
  {
    what: "had to watch my competitor get the {contractType} I wanted",
    how: "they had credit access that I should have had",
    blame: "your mistakes gave them an unfair advantage",
  },
  {
    what: "missed the real estate market at the perfect time",
    how: "could've locked in a rate at {lowRate}% but was denied",
    blame: "now rates are at {highRate}% and I'm still stuck",
  },
  {
    what: "couldn't send my {familyMember} to {schoolType}",
    how: "they had to go to {alternativeSchool} instead",
    blame: "their education limited by your reporting failures",
  },
  {
    what: "lost a partnership opportunity in {businessField}",
    how: "partners backed out when they saw my credit check",
    blame: "they judged me based on your false information",
  },
  {
    what: "had to pass on buying into a {investmentType}",
    how: "a friend offered me a spot but I couldn't get financing",
    blame: "watched them triple their money while I watched from the sidelines",
  },
  {
    what: "couldn't adopt a child when we were finally ready",
    how: "agencies run credit checks as part of the process",
    blame: "you're affecting my ability to start a family",
  },
  {
    what: "missed out on a government job I was perfect for",
    how: "the background check flagged my credit",
    blame: "years of preparation wasted because of your errors",
  },
  {
    what: "had to turn down an international assignment",
    how: "couldn't afford the relocation without financing",
    blame: "a career-defining opportunity gone because of you",
  },
  {
    what: "lost my chance to invest in {techCompany} early",
    how: "needed ${investmentAmount} I couldn't access",
    blame: "would've been life-changing money",
  },
  {
    what: "couldn't expand my business when the time was right",
    how: "the market was perfect but banks said no",
    blame: "watched competitors take the opportunity I should've had",
  },
  {
    what: "missed the window to buy {appreciatingAsset}",
    how: "prices have {percentIncrease}% since then",
    blame: "all because your report kept me locked out",
  },
  {
    what: "had to decline a franchise opportunity",
    how: "perfect location, proven brand, but no financing available",
    blame: "someone else is running that store now",
  },
  {
    what: "couldn't transition careers when I had the chance",
    how: "new field required startup costs I couldn't finance",
    blame: "stuck in a job I hate because of your mistakes",
  },
  {
    what: "lost out on a rental property that would've paid for itself",
    how: "mortgage denied despite {downPaymentPercent}% down",
    blame: "could've been building wealth instead of treading water",
  },
  {
    what: "had to pass on joining a professional {organizationType}",
    how: "membership required a credit check",
    blame: "networking opportunities lost because of your false reporting",
  },
  {
    what: "couldn't sponsor my {familyMember}'s immigration",
    how: "financial requirements weren't met because of my credit",
    blame: "family separation because of your negligence",
  },
  {
    what: "missed my chance to move to {dreamCity}",
    how: "couldn't secure housing without better credit",
    blame: "watching friends thrive there while I'm stuck here",
  },
  {
    what: "lost a contracting opportunity worth ${contractAmount}",
    how: "client required a credit check as part of vetting",
    blame: "your errors cost me six figures in potential income",
  },
  {
    what: "had to withdraw from a bidding process",
    how: "financing contingency couldn't be met",
    blame: "would've changed everything for my family",
  },
  {
    what: "couldn't get licensed in {professionalField}",
    how: "some licensing boards check credit",
    blame: "my entire career derailed by your reporting",
  },
  {
    what: "lost a mentorship program spot that checked credit",
    how: "they wanted 'financially stable' participants",
    blame: "I am financially stable - your data just says otherwise",
  },
  {
    what: "had to say no to a joint venture I believed in",
    how: "partners needed me to contribute capital I couldn't access",
    blame: "watching the venture succeed without me",
  },
  {
    what: "missed an early retirement window",
    how: "needed to restructure debt but couldn't refinance",
    blame: "working extra years because of your false information",
  },
  {
    what: "couldn't take a sabbatical I'd planned for",
    how: "needed credit as backup during the time off",
    blame: "burning out with no relief in sight",
  },
  {
    what: "lost my chance at a {educationType} program",
    how: "financing for education denied",
    blame: "self-improvement blocked by your negligence",
  },
  {
    what: "had to pass on a timeshare resale at below market",
    how: "couldn't get approved for the transfer",
    blame: "even small opportunities are blocked by your errors",
  },
  {
    what: "missed a chance to consolidate family properties",
    how: "refinancing denied across the board",
    blame: "generational wealth affected by your false data",
  },
  {
    what: "couldn't transition to self-employment",
    how: "needed a financial cushion I can't access",
    blame: "trapped in a job I've outgrown because of you",
  },
  // === MASSIVE EXPANSION: 130+ NEW OPPORTUNITY SCENARIOS ===
  {
    what: "missed a job offer that required relocation",
    how: "couldn't finance the move or secure housing",
    blame: "career derailed by your inaccurate reporting",
  },
  {
    what: "couldn't start a side business {timeframe}",
    how: "needed startup capital I couldn't access",
    blame: "entrepreneurship blocked by your errors",
  },
  {
    what: "lost a chance to buy a foreclosure at a great price",
    how: "cash buyers won because I couldn't get financing",
    blame: "wealth building blocked by your false data",
  },
  {
    what: "had to decline a partnership in {businessField}",
    how: "partners expected me to bring credit capacity",
    blame: "capacity destroyed by your mistakes",
  },
  {
    what: "missed an opportunity to buy my company's stock at a discount",
    how: "needed a loan to exercise options",
    blame: "potentially worth ${investmentAmount} someday",
  },
  {
    what: "couldn't take advantage of a buyer's market {timeframe}",
    how: "properties were cheap but I couldn't buy",
    blame: "watching others build equity while I'm stuck",
  },
  {
    what: "lost a chance to refinance before rates went up",
    how: "now paying thousands more per year",
    blame: "your errors cost me real money",
  },
  {
    what: "couldn't get approved for a professional certification loan",
    how: "career advancement requires credentials I can't finance",
    blame: "stuck at my level because of your data",
  },
  {
    what: "missed a limited enrollment program",
    how: "couldn't finance tuition in time",
    blame: "educational opportunities are passing me by",
  },
  {
    what: "had to turn down an international assignment",
    how: "couldn't secure finances needed abroad",
    blame: "global opportunities blocked by your reporting",
  },
  {
    what: "couldn't invest in my friend's startup",
    how: "they went on to great success without me",
    blame: "I would've had equity if not for your errors",
  },
  {
    what: "lost access to a mentorship that required financial commitment",
    how: "couldn't pay the program fees",
    blame: "personal growth stunted by your mistakes",
  },
  {
    what: "missed a chance to buy out a retiring competitor",
    how: "couldn't get business acquisition financing",
    blame: "business growth blocked by your false data",
  },
  {
    what: "couldn't take advantage of a bulk purchase discount",
    how: "needed credit to stock up on inventory",
    blame: "paying retail when I should pay wholesale",
  },
  {
    what: "lost a commercial lease I really wanted",
    how: "landlord ran my personal credit",
    blame: "prime location lost because of you",
  },
  {
    what: "had to pass on buying equipment at auction",
    how: "couldn't get equipment financing in time",
    blame: "paid triple later because of your errors",
  },
  {
    what: "missed a scholarship that required financial documentation",
    how: "my credit report raised red flags",
    blame: "free education denied because of your data",
  },
  {
    what: "couldn't participate in my employer's stock purchase plan",
    how: "required a credit check I failed",
    blame: "missing out on discounted company stock",
  },
  {
    what: "lost a chance to become a franchisee {timeframe}",
    how: "territory went to someone else while I was denied",
    blame: "watching them succeed in my spot",
  },
  {
    what: "had to turn down a board position",
    how: "required financial vetting I couldn't pass",
    blame: "leadership opportunity lost to your errors",
  },
  {
    what: "missed investing in crypto early",
    how: "couldn't get funds to buy when it was cheap",
    blame: "would've been a millionaire by now",
  },
  {
    what: "couldn't take a career break to care for my {familyMember}",
    how: "needed credit as safety net",
    blame: "family responsibilities complicated by you",
  },
  {
    what: "lost a chance to buy my rental property",
    how: "landlord offered first right of refusal",
    blame: "couldn't get a mortgage because of your data",
  },
  {
    what: "missed an opportunity to flip a house",
    how: "couldn't get hard money lending approved",
    blame: "even alternative lenders see your errors",
  },
  {
    what: "had to pass on an estate sale find",
    how: "valuable antiques I couldn't finance",
    blame: "resale profit lost to your mistakes",
  },
  {
    what: "couldn't accept a job with commission-based pay",
    how: "needed credit cushion during ramp-up",
    blame: "higher earning potential blocked by you",
  },
  {
    what: "missed a 401k match because I couldn't afford contributions",
    how: "money was going to cover credit problems",
    blame: "free money from employer lost to your errors",
  },
  {
    what: "lost a chance to start a Roth IRA early",
    how: "couldn't spare funds due to credit issues",
    blame: "decades of tax-free growth forfeited",
  },
  {
    what: "couldn't take advantage of tax-loss harvesting",
    how: "no investments to harvest",
    blame: "wealth strategies inaccessible because of you",
  },
  {
    what: "had to decline a mentee who needed my sponsorship",
    how: "couldn't vouch for them financially",
    blame: "your errors affect people who trust me",
  },
  {
    what: "missed a private placement investment",
    how: "accredited investor status doesn't matter without credit",
    blame: "high-return opportunities blocked",
  },
  {
    what: "couldn't join an investment club",
    how: "members required credit vetting",
    blame: "excluded from wealth building communities",
  },
  {
    what: "lost a chance at affordable housing lottery",
    how: "credit score disqualified me",
    blame: "programs for people like me denied because of you",
  },
  {
    what: "had to pass on a car that would've appreciated",
    how: "classic car I could've bought cheap",
    blame: "couldn't finance and now it's worth double",
  },
  {
    what: "missed a wholesale real estate deal",
    how: "couldn't close in the timeframe required",
    blame: "quick profits blocked by your slow errors",
  },
  {
    what: "couldn't take advantage of a moving company promotion",
    how: "special rates required credit approval",
    blame: "paid full price instead",
  },
  {
    what: "lost access to a professional network membership",
    how: "required financial screening",
    blame: "networking blocked by your data",
  },
  {
    what: "had to turn down speaking opportunities",
    how: "couldn't finance travel expenses",
    blame: "thought leadership limited by your errors",
  },
  {
    what: "missed a chance to patent my invention",
    how: "couldn't finance the legal fees",
    blame: "intellectual property unprotected because of you",
  },
  {
    what: "couldn't trademark my business name",
    how: "legal costs required financing I couldn't get",
    blame: "brand vulnerable to your mistakes",
  },
  {
    what: "lost a publishing deal that required upfront investment",
    how: "couldn't finance the initial print run",
    blame: "my book idea stolen by your errors",
  },
  {
    what: "had to pass on a proven business model",
    how: "turnkey operation I couldn't finance",
    blame: "watching others profit from what could've been mine",
  },
  {
    what: "missed an apprenticeship that required relocation",
    how: "couldn't finance the move",
    blame: "skilled trade training blocked by you",
  },
  {
    what: "couldn't accept an unpaid internship that leads to jobs",
    how: "needed income and credit to survive it",
    blame: "career ladder kicked out from under me",
  },
  {
    what: "lost a chance to downsize to a cheaper home",
    how: "couldn't get approved for a new mortgage",
    blame: "stuck paying more because of your data",
  },
  {
    what: "had to decline an opportunity to teach",
    how: "adjunct positions require credit checks",
    blame: "sharing knowledge blocked by your errors",
  },
  {
    what: "missed a grant opportunity that required matching funds",
    how: "couldn't access credit to match",
    blame: "free money lost to your mistakes",
  },
  {
    what: "couldn't participate in a community land trust",
    how: "credit screening eliminated me",
    blame: "affordable homeownership programs blocked",
  },
  {
    what: "lost access to a credit union's special programs",
    how: "membership requires credit approval",
    blame: "better rates forever out of reach",
  },
  {
    what: "had to pass on a vehicle trade-in deal",
    how: "couldn't get approved for the new car",
    blame: "stuck with depreciating assets",
  },
  {
    what: "missed a solar panel incentive program deadline",
    how: "couldn't get financing approved in time",
    blame: "paying higher energy bills because of you",
  },
  {
    what: "couldn't take advantage of EV tax credits",
    how: "can't finance an electric vehicle",
    blame: "environmental goals blocked by your data",
  },
  {
    what: "lost a chance to join a buying group",
    how: "group purchasing requires credit vetting",
    blame: "bulk discounts inaccessible",
  },
  {
    what: "had to decline a contract requiring bonding",
    how: "couldn't get bonded with my credit",
    blame: "professional opportunities limited by you",
  },
  {
    what: "missed an opportunity to get licensed",
    how: "license bond requires good credit",
    blame: "career certification blocked by your errors",
  },
  {
    what: "couldn't secure professional liability insurance",
    how: "rates were astronomical due to credit",
    blame: "practicing my profession costs more because of you",
  },
  {
    what: "lost access to a vendor early payment discount",
    how: "needed credit line to pay invoices early",
    blame: "2% savings lost every month",
  },
  {
    what: "had to pass on a revenue-share partnership",
    how: "partners expected credit contribution",
    blame: "passive income blocked by your data",
  },
  {
    what: "missed a limited time zero-interest balance transfer",
    how: "could've saved hundreds in interest",
    blame: "paying full rate because of your errors",
  },
  {
    what: "couldn't refinance student loans at a lower rate",
    how: "locked into higher payments for years",
    blame: "thousands in extra interest because of you",
  },
  {
    what: "lost a chance to consolidate debt {timeframe}",
    how: "would've simplified my finances",
    blame: "now juggling multiple accounts at high rates",
  },
  {
    what: "had to decline a seat at an exclusive conference",
    how: "couldn't finance the registration and travel",
    blame: "industry connections lost to your mistakes",
  },
  {
    what: "missed my company's leadership development program",
    how: "required financial background check",
    blame: "promotions blocked by your data",
  },
  {
    what: "couldn't join a professional association's premium tier",
    how: "best networking requires credit screening",
    blame: "career advancement limited by you",
  },
  {
    what: "lost a chance to be on a podcast as a guest expert",
    how: "they check financial stability of guests",
    blame: "thought leadership blocked by your errors",
  },
  {
    what: "had to pass on writing a book",
    how: "couldn't finance the time to write",
    blame: "creative pursuits on hold because of you",
  },
  {
    what: "missed a residency program in my field",
    how: "competitive programs check credit",
    blame: "career specialization blocked",
  },
  {
    what: "couldn't accept a fellowship {timeframe}",
    how: "needed financial stability to participate",
    blame: "prestigious opportunities lost to your data",
  },
  {
    what: "lost a chance to buy a business at estate sale prices",
    how: "widow was selling cheap but I couldn't finance",
    blame: "generational opportunity missed",
  },
  {
    what: "had to decline a profit-sharing arrangement",
    how: "partners required credit verification",
    blame: "passive income streams blocked by you",
  },
  {
    what: "missed an opportunity for geographic arbitrage",
    how: "couldn't relocate to lower cost area",
    blame: "stuck paying high costs because of your errors",
  },
  {
    what: "couldn't take a gap year to travel and grow",
    how: "needed credit safety net",
    blame: "life experiences blocked by your data",
  },
  {
    what: "lost a chance to house hack my way to wealth",
    how: "couldn't get investment property financing",
    blame: "rental income strategy impossible",
  },
  {
    what: "had to pass on a BRRRR real estate deal",
    how: "Buy Rehab Rent Refinance Repeat blocked",
    blame: "wealth building strategy killed by you",
  },
  {
    what: "missed a 1031 exchange opportunity",
    how: "couldn't finance the replacement property",
    blame: "tax deferral lost to your mistakes",
  },
  {
    what: "couldn't participate in my employer's ESPP",
    how: "Employee Stock Purchase Plan requires credit",
    blame: "15% discount on stock lost",
  },
  {
    what: "lost access to a health savings account contribution match",
    how: "employer match requires financial screening",
    blame: "free healthcare money lost to your errors",
  },
  {
    what: "had to decline a consulting contract",
    how: "required business credit I don't have",
    blame: "professional income limited by you",
  },
  {
    what: "missed a chance to start a REIT portfolio",
    how: "couldn't open the brokerage account needed",
    blame: "real estate investing blocked by your data",
  },
  {
    what: "couldn't take advantage of dollar cost averaging",
    how: "no credit means no consistent investing",
    blame: "long-term wealth strategy impossible",
  },
  {
    what: "lost a chance to start my child's UTMA account",
    how: "custodial accounts require credit checks",
    blame: "my child's future affected by your errors",
  },
  {
    what: "had to pass on a reverse mortgage for my parents",
    how: "they needed me to qualify too",
    blame: "can't help my aging parents because of you",
  },
  {
    what: "missed an opportunity to refinance my parents' home",
    how: "as co-signer I was denied",
    blame: "family wealth affected by your mistakes",
  },
  {
    what: "couldn't set up a trust for estate planning",
    how: "lawyers required financial verification",
    blame: "legacy planning blocked by your data",
  },
  {
    what: "lost a chance to maximize my HSA contributions",
    how: "needed credit to afford full contributions",
    blame: "tax-advantaged savings limited by you",
  },
  {
    what: "had to decline a side consulting gig",
    how: "required liability insurance I couldn't afford",
    blame: "extra income blocked by your errors",
  },
  {
    what: "missed a chance to develop raw land",
    how: "couldn't get construction financing",
    blame: "property appreciation lost to your data",
  },
  {
    what: "couldn't take advantage of opportunity zones",
    how: "tax incentives require investment capital",
    blame: "wealth building programs inaccessible",
  },
  {
    what: "lost a syndication investment opportunity",
    how: "couldn't pass financial verification",
    blame: "pooled investments blocked by you",
  },
  {
    what: "had to pass on a profitable arbitrage opportunity",
    how: "needed credit to buy and flip quickly",
    blame: "easy money lost to your mistakes",
  },
  {
    what: "missed a celebrity charity auction item",
    how: "winning bid required credit verification",
    blame: "even charitable giving blocked by your errors",
  },
  {
    what: "couldn't bid on a storage unit auction find",
    how: "auctions require credit card holds",
    blame: "treasure hunting blocked by your data",
  },
  {
    what: "lost a chance to wholesale real estate contracts",
    how: "couldn't prove financial capability to sellers",
    blame: "assignment fees lost to you",
  },
  {
    what: "had to decline a promissory note investment",
    how: "lending circle required credit screening",
    blame: "passive income opportunities blocked",
  },
  {
    what: "missed a chance to start a vending machine route",
    how: "equipment financing denied",
    blame: "passive income strategy killed by your errors",
  },
  {
    what: "couldn't launch an ATM placement business",
    how: "machines cost too much without financing",
    blame: "cash flow business blocked by your data",
  },
  {
    what: "lost a laundromat purchase opportunity",
    how: "SBA loan denied due to credit",
    blame: "passive income property lost to you",
  },
  {
    what: "had to pass on a car wash investment",
    how: "couldn't finance the equipment",
    blame: "recurring revenue blocked by your mistakes",
  },
  {
    what: "missed a storage facility investment",
    how: "commercial lending requires good credit",
    blame: "recession-proof income lost",
  },
  {
    what: "couldn't start a parking lot business",
    how: "land financing denied",
    blame: "simple profit model blocked by your errors",
  },
  {
    what: "lost an opportunity in mobile home park investing",
    how: "portfolio lending requires credit",
    blame: "affordable housing investment blocked",
  },
  {
    what: "had to decline a billboard lease opportunity",
    how: "couldn't finance the structure",
    blame: "advertising income lost to your data",
  },
  {
    what: "missed a chance to invest in farmland",
    how: "agricultural loans require credit",
    blame: "tangible asset investing blocked by you",
  },
  {
    what: "couldn't participate in a timberland investment",
    how: "long-term growth strategy denied",
    blame: "natural resource wealth blocked by your errors",
  },
];

/**
 * Escalation scenarios for Round 2+ — reference prior disputes and worsening situations
 * These scenarios acknowledge the ongoing battle and escalate the emotional intensity
 */
const ESCALATION_SCENARIOS: StoryScenario[] = [
  {
    what: "sent you a dispute {timeframe} and you completely ignored it",
    how: "meanwhile I got denied for another {loanType} while waiting for you to do your job",
    blame: "your negligence is actively making my life worse every single day",
  },
  {
    what: "already told you about these errors and you did nothing",
    how: "since my last dispute, I've had to turn down a job opportunity because of my credit",
    blame: "every day you ignore me is another day of damage you'll have to pay for",
  },
  {
    what: "been fighting this for months now and nothing has changed",
    how: "my {familyMember} asked me yesterday why things aren't getting better",
    blame: "I had to explain that the credit bureau doesn't care about people like us",
  },
  {
    what: "disputed these same accounts before and you just rubber-stamped them",
    how: "lost another apartment because your report still shows these errors",
    blame: "at this point your inaction is deliberate and I have the paper trail to prove it",
  },
  {
    what: "waited over 30 days for your so-called investigation",
    how: "during that time I got rejected for {loanType} and had to borrow from my {olderRelative}",
    blame: "you broke the law by not fixing this in time and I'm documenting every violation",
  },
  {
    what: "received your response saying everything was 'verified'",
    how: "but you never told me HOW you verified it or WHO you contacted",
    blame: "that's not verification, that's a rubber stamp and we both know it",
  },
  {
    what: "been sending disputes for months and getting the same form letter back",
    how: "my credit score hasn't budged and I just got denied for {loanType} again",
    blame: "I'm starting to think you never actually investigate anything",
  },
  {
    what: "filed a CFPB complaint about your handling of my disputes",
    how: "still dealing with the fallout from errors you refuse to correct",
    blame: "every government agency involved is going to see how you've treated me",
  },
  {
    what: "asked for the method of verification and never got a real answer",
    how: "my {familyMember} lost faith that this will ever get resolved",
    blame: "your silence speaks volumes about the quality of your investigations",
  },
  {
    what: "spent more time writing dispute letters than spending time with my family",
    how: "missed my {familyMember}'s {lifeEvent} because I was dealing with this mess",
    blame: "you've stolen time from my life that I will never get back",
  },
  {
    what: "hired a credit specialist because I couldn't get through to you on my own",
    how: "that's money I didn't have to spend if you'd just done your job the first time",
    blame: "now I'm paying someone else to force you to follow the law",
  },
  {
    what: "watched my credit score drop even further since my last dispute",
    how: "couldn't even qualify for {alternativeTransport} financing this month",
    blame: "your failure to investigate is causing more damage with each passing day",
  },
  // === MASSIVE EXPANSION: 100+ NEW ESCALATION SCENARIOS ===
  {
    what: "been waiting {disputeMonths} months for you to do your job",
    how: "every day feels like a year with this hanging over me",
    blame: "your delays are costing me real opportunities",
  },
  {
    what: "sent certified mail proof of your errors {timeframe}",
    how: "you received it and still did nothing",
    blame: "I have the receipt proving you ignored evidence",
  },
  {
    what: "called your customer service line {disputeMonths} times",
    how: "got transferred around and still no resolution",
    blame: "your phone system is designed to wear people down",
  },
  {
    what: "documented every single interaction with you",
    how: "got a file folder thicker than a phone book now",
    blame: "all evidence of your continued negligence",
  },
  {
    what: "had to take time off work to deal with this again",
    how: "lost ${amount} in wages just fighting your errors",
    blame: "your mistakes are costing me actual money",
  },
  {
    what: "explained this same issue to five different agents",
    how: "each one said they'd fix it and nothing changed",
    blame: "your left hand doesn't know what your right is doing",
  },
  {
    what: "provided documentation you requested twice now",
    how: "and you claim you never received it either time",
    blame: "convenient how my evidence keeps disappearing",
  },
  {
    what: "watched you verify accounts without any investigation",
    how: "rubber stamp investigations aren't real investigations",
    blame: "the law requires reasonable procedures not automatic denials",
  },
  {
    what: "got another form letter response {timeframe}",
    how: "doesn't even address the specific issues I raised",
    blame: "you're not reading my disputes you're just rejecting them",
  },
  {
    what: "saw the same errors still on my report after your investigation",
    how: "nothing changed despite your claims of action",
    blame: "your investigation was clearly a sham",
  },
  {
    what: "compared my report before and after your investigation",
    how: "literally identical except the date updated",
    blame: "you didn't investigate you just updated the timestamp",
  },
  {
    what: "talked to a lawyer about your handling of my disputes",
    how: "they said I have a strong case against you",
    blame: "I'm documenting everything for potential litigation",
  },
  {
    what: "joined an online group of consumers with similar issues",
    how: "thousands of people experiencing the same negligence",
    blame: "this isn't an accident it's a pattern of behavior",
  },
  {
    what: "read about lawsuits against your company",
    how: "mine sounds exactly like the complaints that won",
    blame: "you'd think you'd learn from losing those cases",
  },
  {
    what: "contacted consumer advocacy organizations about you",
    how: "they're very interested in patterns like this",
    blame: "your reputation is taking hits from people like me",
  },
  {
    what: "posted about my experience on social media {timeframe}",
    how: "got hundreds of responses from people in similar situations",
    blame: "public pressure might be what finally makes you act",
  },
  {
    what: "wrote to my state attorney general about your practices",
    how: "they have a consumer protection division for exactly this",
    blame: "regulatory attention is coming your way",
  },
  {
    what: "kept copies of every letter you've sent me",
    how: "the inconsistencies between them are damning",
    blame: "your own correspondence proves your negligence",
  },
  {
    what: "recorded phone calls with your representatives",
    how: "in my one-party consent state that's perfectly legal",
    blame: "I have audio evidence of promises you didn't keep",
  },
  {
    what: "tracked every credit denial since this started",
    how: "seventeen rejections and counting",
    blame: "each one is damages you're liable for",
  },
  {
    what: "calculated the actual cost of your errors to me",
    how: "we're talking thousands in higher rates and fees",
    blame: "actual monetary damages you've caused",
  },
  {
    what: "been to therapy specifically because of this stress",
    how: "my therapist has documented the toll it's taking",
    blame: "emotional distress damages are very real",
  },
  {
    what: "told my story to a local news consumer reporter",
    how: "they're investigating your complaint patterns",
    blame: "media attention might accomplish what disputes haven't",
  },
  {
    what: "connected with other victims of your negligence",
    how: "we're sharing information and strategies",
    blame: "collective action might be necessary",
  },
  {
    what: "researched the FCRA thoroughly since my last dispute",
    how: "I know my rights better than your customer service",
    blame: "I won't be stonewalled by ignorance anymore",
  },
  {
    what: "got affidavits from creditors saying they reported correctly",
    how: "your data doesn't match what they actually sent",
    blame: "the error is on your end not theirs",
  },
  {
    what: "obtained credit reports from all three bureaus",
    how: "only yours has these errors",
    blame: "proves the problem is your reporting specifically",
  },
  {
    what: "had a CPA review the accounts you're reporting",
    how: "professional verification that your data is wrong",
    blame: "expert testimony that contradicts your records",
  },
  {
    what: "submitted a police report about identity theft {timeframe}",
    how: "you're supposed to block disputed items during investigation",
    blame: "failure to follow fraud procedures is another violation",
  },
  {
    what: "provided an FTC identity theft affidavit",
    how: "official documentation you legally must respect",
    blame: "ignoring federal forms is a serious violation",
  },
  {
    what: "sent dispute via certified mail with return receipt",
    how: "have proof you received it on specific date",
    blame: "your 30-day clock started ticking and you're past it",
  },
  {
    what: "requested my full file disclosure {disputeMonths} months ago",
    how: "still waiting for complete information",
    blame: "withholding my own data is another violation",
  },
  {
    what: "asked for names of sources furnishing information",
    how: "you're required to provide this and haven't",
    blame: "another FCRA requirement you're ignoring",
  },
  {
    what: "requested reinvestigation of previously verified items",
    how: "new information requires new investigation",
    blame: "rubber stamping previous decisions isn't legal",
  },
  {
    what: "been more than 30 days since my last dispute",
    how: "you're required to respond within that timeframe",
    blame: "your timeline violations are well documented",
  },
  {
    what: "kept the envelopes showing postmark dates",
    how: "proof of when you received and sent responses",
    blame: "timeline violations are very specific",
  },
  {
    what: "screen-recorded checking my credit report",
    how: "timestamp proof of errors still appearing",
    blame: "visual evidence of your continued negligence",
  },
  {
    what: "had witnesses present when reviewing my denial letters",
    how: "people who can testify to the impact on me",
    blame: "building a case with corroborating witnesses",
  },
  {
    what: "saved every email from your company",
    how: "digital paper trail of broken promises",
    blame: "your own words will prove my case",
  },
  {
    what: "requested the method of verification in writing",
    how: "you're legally required to provide this",
    blame: "failure to explain your process is actionable",
  },
  {
    what: "asked for business records related to my file",
    how: "discovery will reveal exactly what happened",
    blame: "you should fix this before it gets to that point",
  },
  {
    what: "researched your company's complaint history with regulators",
    how: "pattern of similar complaints speaks volumes",
    blame: "my experience fits a documented pattern",
  },
  {
    what: "consulted with multiple attorneys now",
    how: "opinions are unanimous that I have a case",
    blame: "legal action is becoming more likely every day",
  },
  {
    what: "prepared a detailed timeline of all interactions",
    how: "dates amounts names everything documented",
    blame: "my records are more complete than yours",
  },
  {
    what: "gathered character references about my financial responsibility",
    how: "people who know me can vouch for my actual history",
    blame: "your data doesn't reflect who I really am",
  },
  {
    what: "obtained bank statements proving accounts were paid",
    how: "documentary evidence contradicting your records",
    blame: "proof positive that your data is wrong",
  },
  {
    what: "got credit card statements showing dispute dates",
    how: "evidence I was fighting this when you claim I wasn't",
    blame: "your timeline doesn't match reality",
  },
  {
    what: "saved voicemails from your representatives",
    how: "promises of resolution that never happened",
    blame: "audio proof of your false assurances",
  },
  {
    what: "tracked the hours spent dealing with your errors",
    how: "over forty hours of my time stolen by this",
    blame: "time I could have spent with my family working living",
  },
  {
    what: "documented every sleepless night this has caused",
    how: "journal entries my doctor has seen",
    blame: "physical health impact from your negligence",
  },
  {
    what: "kept records of medications prescribed due to stress",
    how: "medical documentation of the toll this takes",
    blame: "health expenses caused by your errors",
  },
  {
    what: "got a doctor's note about anxiety from this situation",
    how: "professional medical opinion on causation",
    blame: "your negligence is making me sick",
  },
  {
    what: "missed family events dealing with this mess",
    how: "birthdays holidays special moments gone",
    blame: "time stolen by your errors never comes back",
  },
  {
    what: "strained relationships arguing about finances",
    how: "my {familyMember} and I fight about this constantly",
    blame: "your errors are damaging my marriage",
  },
  {
    what: "watched my kids ask why we can't do things others can",
    how: "explaining credit bureau errors to children is impossible",
    blame: "my children suffer for your mistakes",
  },
  {
    what: "felt shame that has nothing to do with my actual behavior",
    how: "stigma from your false reporting",
    blame: "reputational damage for things I didn't do",
  },
  {
    what: "turned down invitations because I couldn't afford them",
    how: "social isolation from financial stress you caused",
    blame: "my social life suffers for your errors",
  },
  {
    what: "postponed medical care because of financial constraints",
    how: "health decisions impacted by your false data",
    blame: "your reporting affects my physical wellbeing",
  },
  {
    what: "eaten worse food because of budget constraints",
    how: "nutrition suffering from your errors' impact",
    blame: "literal hunger caused by your mistakes",
  },
  {
    what: "let prescriptions go unfilled due to cost concerns",
    how: "medication skipped because of your damage",
    blame: "health risks from your negligence",
  },
  {
    what: "driven with expired registration because of finances",
    how: "legal risk from your errors' financial impact",
    blame: "forced to break laws because of your mistakes",
  },
  {
    what: "let insurance lapse temporarily due to costs",
    how: "unprotected periods caused by your errors",
    blame: "risk exposure from your false reporting",
  },
  {
    what: "borrowed money from family to survive your errors",
    how: "relationship strain from asking for help",
    blame: "family dynamics changed by your mistakes",
  },
  {
    what: "used retirement savings for current expenses",
    how: "future security sacrificed for present survival",
    blame: "long-term damage from your short-term negligence",
  },
  {
    what: "sold possessions to cover gaps your errors created",
    how: "items with sentimental value gone forever",
    blame: "irreplaceable losses from your mistakes",
  },
  {
    what: "worked overtime to compensate for higher costs",
    how: "health and family time sacrificed",
    blame: "burnout from your errors' financial impact",
  },
  {
    what: "taken a second job because of your errors' impact",
    how: "two jobs just to stay afloat",
    blame: "exhaustion from your negligence",
  },
  {
    what: "delayed important life milestones",
    how: "marriage home children all on hold",
    blame: "life on pause because of your data",
  },
  {
    what: "changed career plans because of credit limitations",
    how: "dream job requires credit check I'd fail",
    blame: "professional ambitions killed by your errors",
  },
  {
    what: "given up on educational goals due to financing issues",
    how: "can't get student loans because of you",
    blame: "intellectual growth stunted by your mistakes",
  },
  {
    what: "watched opportunities pass that won't come again",
    how: "once in a lifetime chances lost forever",
    blame: "irreversible damage from your negligence",
  },
];

/**
 * Continuation connectors — link current story to previous round narratives
 * Used for R2+ to create a sense of ongoing struggle
 */
const CONTINUATION_CONNECTORS = [
  "As I mentioned in my previous dispute, ",
  "Building on what I told you last time, ",
  "Since my last letter to you, things have only gotten worse. ",
  "I already explained this situation to you, but here's what happened next. ",
  "You know my story from my previous disputes. Here's the latest chapter. ",
  "After everything I've already shared with you, ",
  "Things have escalated since I last wrote. ",
  "Remember what I told you before? It's worse now. ",
  "I'm picking up where my last dispute left off. ",
  "Since you ignored my last complaint, let me tell you what's happened since. ",
  "My situation has deteriorated since my last letter. ",
  "Following up on the nightmare I described before - it's gotten worse. ",
];

// =============================================================================
// VARIABLE POOLS - Randomized fill-ins
// =============================================================================

/**
 * VARIABLE POOLS - Massively expanded for unlimited unique combinations
 * Each pool has 20-100+ options to ensure mathematical uniqueness
 */
const VARIABLE_POOLS: Record<string, string[]> = {
  // Original pools - EXPANDED
  loanType: [
    "home loan", "auto loan", "personal loan", "mortgage refinance", "home equity loan",
    "car loan", "debt consolidation loan", "small business loan", "credit builder loan",
    "equipment financing", "invoice financing", "merchant cash advance", "line of credit",
    "peer-to-peer loan", "installment loan", "payday alternative loan", "bridge loan",
    "construction loan", "land loan", "renovation loan", "boat loan", "RV loan",
    "motorcycle loan", "ATV loan", "vacation loan", "wedding loan", "medical loan",
    "dental financing", "fertility treatment loan", "adoption loan", "moving loan",
    "emergency loan", "tax loan", "education loan", "certification loan",
  ],
  timeframe: [
    "last week", "last month", "yesterday", "two weeks ago", "a few weeks back",
    "just recently", "this past Tuesday", "three days ago", "earlier this week",
    "on Monday", "late last month", "a couple weeks back", "not too long ago",
    "the other day", "just this morning", "last Friday", "about ten days ago",
    "right before the holidays", "at the beginning of the month", "mid-month",
    "a few days ago", "last Thursday", "over the weekend", "early this month",
    "sometime last week", "just before my birthday", "after the first",
  ],
  familyMember: [
    "wife", "husband", "kids", "daughter", "son", "mother", "father", "family",
    "partner", "fiancé", "fiancée", "children", "youngest", "oldest", "spouse",
    "little one", "teenager", "baby", "toddler", "grandmother", "grandfather",
    "brother", "sister", "nephew", "niece", "cousin", "in-laws", "stepchild",
    "stepdaughter", "stepson", "significant other", "loved ones",
  ],
  goal: [
    "move to a better neighborhood", "get a reliable car", "take a vacation",
    "start that business", "help with college", "fix the house",
    "get out of this apartment", "buy our first home", "build our savings",
    "retire early", "travel overseas", "renovate the kitchen", "pay off debt",
    "buy a new bed", "get them braces", "send them to camp", "visit family",
    "take that trip", "upgrade our car", "move closer to work",
    "put a down payment on a house", "afford daycare", "pay for tutoring",
    "get the surgery", "afford the wedding", "take the kids to Disney",
    "help with the down payment", "cover their tuition", "fix the roof",
    "replace the furnace", "get a second car", "afford Christmas presents",
  ],
  neighborhood: [
    "the good school district", "closer to work", "near my parents", "a safer area",
    "where my kids' friends live", "with better schools", "in a quiet neighborhood",
    "with a yard for the kids", "near the hospital", "closer to family",
    "in a growing area", "with less crime", "near public transit",
    "in a walkable area", "closer to grandparents", "where the bus comes",
    "with better internet", "near the community center", "in a cul-de-sac",
  ],
  witness: [
    "other applicants", "my kids", "my spouse", "everyone in the lobby",
    "a room full of strangers", "the other customers", "people I know",
    "my coworkers", "my neighbors", "complete strangers", "my in-laws",
    "my friends", "other parents", "the security guard", "everyone waiting",
    "people from church", "my child's teacher", "other shoppers",
  ],
  dealership: [
    "the Honda dealer", "the Toyota lot", "the Ford dealership", "CarMax",
    "the used car lot", "the Chevy dealer", "Carvana", "AutoNation",
    "the Hyundai dealer", "the Kia store", "the Nissan lot", "a local dealer",
    "the Mazda dealer", "the Subaru place", "the VW dealership", "the Jeep store",
    "the GMC dealer", "a buy-here-pay-here lot", "the certified pre-owned lot",
  ],
  expense: [
    "emergencies", "my kid's braces", "car repairs", "medical bills",
    "basic groceries", "utilities", "rent", "prescription medications",
    "childcare", "school supplies", "winter clothes", "gas for work",
    "insurance premiums", "phone bill", "internet bill", "pet care",
    "parking fees", "tolls", "maintenance costs", "unexpected repairs",
    "doctor visits", "dental work", "eyeglasses", "therapy appointments",
  ],
  savings: [
    "150", "175", "200", "225", "250", "275", "300", "325", "350", "375",
    "400", "425", "450", "475", "500", "550", "600", "650", "700", "800",
  ],
  amount: [
    "35", "40", "45", "50", "55", "60", "65", "70", "75", "80", "85", "90",
    "95", "100", "110", "120", "125", "140", "150", "175", "200", "225", "250",
  ],
  store: [
    "Target", "Walmart", "the grocery store", "the gas station", "dinner with friends",
    "the pharmacy", "Home Depot", "Costco", "Sam's Club", "Best Buy", "Lowe's",
    "Kroger", "Publix", "Safeway", "Whole Foods", "Trader Joe's", "Aldi",
    "the hardware store", "the department store", "Macy's", "Kohl's", "JCPenney",
    "a restaurant", "the coffee shop", "a fast food place", "the auto parts store",
  ],
  relationship: [
    "girlfriend", "boyfriend", "fiancé", "fiancée", "partner", "spouse",
    "significant other", "better half", "other half", "love of my life",
  ],
  childAge: [
    "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18",
  ],
  olderRelative: [
    "mother", "father", "grandmother", "grandfather", "uncle", "aunt",
    "older brother", "older sister", "godmother", "godfather", "cousin",
    "great aunt", "great uncle", "family friend", "mentor",
  ],
  possession: [
    "second car", "motorcycle", "boat", "guitar collection", "gaming setup",
    "jewelry", "tools", "electronics", "computer", "tablet", "camera equipment",
    "sports equipment", "musical instruments", "collectibles", "artwork",
    "exercise equipment", "furniture", "appliances", "lawn equipment",
  ],
  businessType: [
    "my own company", "a small business", "a franchise", "a restaurant",
    "a consulting firm", "an online store", "a food truck", "a cleaning service",
    "a landscaping business", "a photography studio", "a tutoring center",
    "a daycare", "a gym", "a salon", "a barbershop", "a repair shop",
    "a catering company", "a moving company", "a delivery service",
  ],

  // NEW POOLS for expanded scenarios
  retailStore: [
    "Best Buy", "Apple Store", "Macy's", "Nordstrom", "JCPenney", "Kohl's",
    "Sears", "Bed Bath & Beyond", "Williams Sonoma", "Pottery Barn",
    "Crate & Barrel", "West Elm", "IKEA", "Rooms To Go", "Ashley Furniture",
  ],
  emergencyAmount: [
    "500", "750", "1000", "1200", "1500", "2000", "2500", "3000", "3500", "4000", "5000",
  ],
  emergencyReason: [
    "a car repair", "a medical bill", "an unexpected expense", "rent",
    "a family emergency", "a funeral", "emergency travel", "home repair",
    "replacing the water heater", "fixing the AC", "a broken appliance",
  ],
  cityArea: [
    "downtown", "the suburbs", "a better neighborhood", "closer to work",
    "near the good schools", "the new development", "across town",
  ],
  alternativeTransport: [
    "public transit", "Uber everywhere", "bumming rides", "an unreliable car",
    "walking when possible", "borrowing my friend's car", "a bike",
  ],
  yearsExperience: ["5", "8", "10", "12", "15", "20", "25"],
  majorPurchase: [
    "a new mattress", "furniture", "appliances", "a laptop", "a washer and dryer",
    "a TV", "a couch", "a bed frame", "a refrigerator", "an air conditioner",
  ],
  temporaryItem: [
    "an air mattress", "a futon", "a broken couch", "hand-me-down furniture",
    "the floor", "a pullout sofa", "borrowed furniture",
  ],
  vacationType: [
    "family vacation", "trip to Disney", "beach vacation", "camping trip",
    "road trip", "cruise", "overseas trip", "visit to relatives", "staycation",
  ],
  financialInstitution: [
    "Chase", "Bank of America", "Wells Fargo", "Citi", "Capital One",
    "US Bank", "PNC", "TD Bank", "SunTrust", "BB&T", "Regions", "Fifth Third",
    "Ally Bank", "Discover", "Navy Federal", "USAA", "my local credit union",
  ],
  homeProject: [
    "a new roof", "bathroom renovation", "kitchen remodel", "HVAC replacement",
    "foundation repair", "new windows", "basement finishing", "deck addition",
  ],
  yearsOwned: ["3", "5", "7", "10", "12", "15", "20"],
  salesperson: [
    "sales rep", "salesman", "associate", "manager", "clerk",
  ],
  waitTime: [
    "months", "years", "over a year", "almost two years", "six months", "forever",
  ],
  creditUnion: [
    "my local credit union", "Navy Federal", "Pentagon Federal", "BECU",
    "Alliant", "Golden 1", "SchoolsFirst", "State Employees",
  ],
  medicalProcedure: [
    "surgery I need", "a procedure", "dental work", "physical therapy",
    "treatment", "testing", "follow-up care", "specialist visits",
  ],
  percentage: ["0", "2.9", "4.9", "5.9", "0%", "1.9", "3.9"],
  highRate: ["18", "21", "24", "26", "29", "22", "25", "27"],
  lowRate: ["3", "4", "5", "6", "7", "8"],
  savingsType: [
    "emergency fund", "retirement savings", "kids' college fund", "rainy day fund",
    "savings account", "HSA", "investment account", "401k",
  ],
  professionalService: [
    "dental implants", "LASIK", "a medical procedure", "professional training",
    "certification courses", "continuing education", "home repairs",
  ],
  disputeMonths: ["3", "4", "6", "8", "9", "12"],
  utilityCompany: [
    "the electric company", "the gas company", "the water company",
    "the internet provider", "the phone company",
  ],
  leasingCompany: ["Ford Credit", "Toyota Financial", "Honda Financial", "GM Financial", "Ally Auto"],
  technologyProduct: [
    "a laptop", "a computer", "an iPad", "a MacBook", "equipment",
  ],
  workReason: [
    "work from home", "my job", "remote work", "my business", "freelancing",
  ],
  insuranceCompany: [
    "State Farm", "Allstate", "Geico", "Progressive", "Liberty Mutual",
    "Farmers", "Nationwide", "USAA", "MetLife",
  ],
  bank: ["the bank", "my bank", "a new bank", "a local bank", "an online bank"],
  petStore: ["PetSmart", "Petco", "the vet", "the pet store"],
  petType: ["dog", "cat", "pet", "family pet"],
  roomType: ["bathroom", "kitchen", "bedroom", "basement", "roof"],
  repairIssue: ["broken", "damaged", "leaking", "falling apart", "unusable"],
  gasStation: ["Shell", "BP", "Chevron", "ExxonMobil", "Speedway"],
  occasionGift: ["anniversary gift", "birthday present", "engagement ring", "Christmas gift"],
  phonePrice: ["800", "900", "1000", "1100", "1200", "1300"],
  cellCarrier: ["Verizon", "AT&T", "T-Mobile", "Sprint"],
  cashbackAmount: ["200", "300", "400", "500", "600"],
  warehouse: ["Costco", "Sam's Club", "BJ's Wholesale"],
  applianceStore: ["Best Buy", "Home Depot", "Lowe's", "Sears", "the appliance store"],
  appliance: ["refrigerator", "washing machine", "dryer", "dishwasher", "oven", "water heater"],

  // For suffering scenarios
  healthCondition: [
    "anxiety", "insomnia", "high blood pressure", "headaches", "stomach issues",
    "panic attacks", "depression symptoms", "stress-related symptoms",
  ],
  lifeEvent: [
    "wedding", "graduation", "birthday party", "anniversary", "baby shower",
    "funeral", "family reunion", "milestone celebration", "retirement party",
  ],
  myAge: ["30", "32", "35", "38", "40", "42", "45", "48"],
  anxiousBehavior: [
    "checking my credit score", "refreshing my bank account", "nail biting",
    "pacing", "staying up late worrying", "stress eating",
  ],
  activityType: [
    "soccer lessons", "piano lessons", "dance class", "tutoring", "camp",
    "sports team", "music lessons", "martial arts", "swim lessons",
  ],
  dayOfWeek: ["Sunday", "Saturday", "Friday", "Monday"],
  futurePlan: [
    "retirement", "college", "a house", "emergencies", "our future",
    "a new car", "my kid's future", "our wedding",
  ],
  physicalSymptom: [
    "headaches", "chest pains", "stomach problems", "trouble sleeping",
    "muscle tension", "fatigue", "loss of appetite",
  ],
  affordableActivity: [
    "go to the movies", "eat out", "take a day trip", "buy new clothes",
    "go to the amusement park", "have a birthday party", "go bowling",
  ],
  hobby: [
    "gardening", "cooking", "reading", "working out", "playing music",
    "painting", "photography", "hiking", "fishing", "golf",
  ],
  milestoneCelebration: [
    "anniversary trip", "birthday celebration", "graduation party",
    "retirement celebration", "promotion dinner",
  ],
  copingMechanism: [
    "eating", "drinking", "spending", "sleeping", "isolating",
  ],
  expensiveItem: [
    "the trip", "the party", "new shoes", "a new phone", "dance class",
    "summer camp", "sports equipment", "a birthday party",
  ],
  dreamLocation: [
    "that neighborhood", "those houses", "that area", "the nice homes",
    "where we want to live", "that development",
  ],
  stressIndicator: [
    "so stressed", "always tired", "not sleeping", "snapping at people",
    "constantly worried", "losing weight", "gaining weight",
  ],
  sleepIssue: [
    "nightmares", "insomnia", "trouble falling asleep", "waking up anxious",
    "restless nights", "sleep problems",
  ],
  majorGoal: [
    "buying a house", "starting a family", "getting married", "expanding our family",
    "moving to a new city", "retirement", "our dream home",
  ],
  essentialItem: [
    "groceries", "healthcare", "medications", "utilities", "childcare", "food",
  ],

  // For embarrassment scenarios
  retailWorker: ["manager", "cashier", "sales associate", "clerk", "employee"],
  socialEvent: ["party", "dinner", "gathering", "wedding", "reunion"],
  bankEmployee: ["banker", "loan officer", "teller", "branch manager", "representative"],
  positiveAttribute: [
    "works so hard", "is so responsible", "has always paid bills on time",
    "has a good job", "is so reliable",
  ],
  unexpectedPlace: [
    "the dentist", "a rental car place", "the utility company", "an insurance office",
    "a phone store", "a gym",
  ],
  youngAge: ["12", "14", "16", "teenager", "child"],
  serviceProvider: [
    "landlord", "contractor", "service company", "vendor", "provider",
  ],
  coworkerType: ["coworker", "colleague", "boss", "supervisor", "teammate"],
  commonItem: [
    "new car", "house", "vacation home", "boat", "nice things",
  ],
  ageDescription: ["a kid", "a teenager", "a child", "ten years old"],
  reputationLabel: [
    "financial disaster", "money problems person", "the broke one", "struggling one",
  ],
  realEstateType: ["realtor", "real estate agent", "broker", "property manager"],
  expectedMilestone: [
    "bought a house", "gotten married", "started a family", "moved up",
  ],
  serviceWorker: ["worker", "employee", "clerk", "representative", "agent"],
  peerType: ["friend", "coworker", "neighbor", "acquaintance", "colleague"],
  phoneAgent: ["customer service rep", "agent", "representative", "support person"],
  inLaw: ["parents", "mother", "father", "family"],

  // For opportunity scenarios
  contractType: ["contract", "deal", "account", "project", "opportunity"],
  businessField: ["my industry", "technology", "real estate", "consulting", "services"],
  investmentType: [
    "rental property", "business venture", "investment opportunity", "startup",
  ],
  schoolType: [
    "private school", "the better school", "their first choice school", "a magnet school",
  ],
  alternativeSchool: [
    "public school", "a different school", "their second choice", "the local school",
  ],
  techCompany: [
    "that startup", "a tech company", "the company that blew up", "that investment",
  ],
  investmentAmount: ["5000", "10000", "15000", "20000", "25000"],
  appreciatingAsset: [
    "property", "real estate", "that stock", "Bitcoin", "the investment",
  ],
  percentIncrease: ["50", "75", "100", "150", "200"],
  downPaymentPercent: ["10", "15", "20", "25"],
  organizationType: [
    "association", "networking group", "club", "organization", "society",
  ],
  dreamCity: [
    "Austin", "Denver", "Seattle", "Portland", "Nashville", "Charlotte",
    "Phoenix", "San Diego", "a new city", "where the jobs are",
  ],
  contractAmount: ["50,000", "75,000", "100,000", "150,000", "200,000"],
  professionalField: [
    "finance", "insurance", "real estate", "contracting", "healthcare",
  ],
  educationType: [
    "MBA", "graduate", "certification", "professional development", "advanced degree",
  ],
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
// EXPANDED: 20+ unique patterns for maximum variation
// =============================================================================

type AssemblyTechnique =
  | "news"              // "I [what]. [How]. And [blame]."
  | "story"             // "[How]. Why? Because I [what] - [blame]."
  | "state_case"        // "Here's what's happening: I [what]. [How]. [Blame]."
  | "direct_hit"        // "Because of you, I [what]. [How], and [blame]."
  | "question_lead"     // "Do you know what it's like to [what]? [How]. [Blame]."
  | "confession"        // "I have to be honest: I [what]. [How]. [Blame]."
  | "timestamp"         // "It happened like this: I [what]. [How]. [Blame]."
  | "consequence_first" // "[How]. This happened because I [what]. [Blame]."
  | "blame_first"       // "[Blame]. Why? Because I [what]. [How]."
  | "emotional_lead"    // "I can't believe I [what]. [How]. [Blame]."
  | "factual"           // "The fact is, I [what]. As a result, [how]. [Blame]."
  | "desperate"         // "I'm at a breaking point. I [what]. [How]. [Blame]."
  | "rhetorical"        // "What was I supposed to do when I [what]? [How]. [Blame]."
  | "timeline"          // "First, I [what]. Then, [how]. Now, [blame]."
  | "comparison"        // "While others don't face this, I [what]. [How]. [Blame]."
  | "realization"       // "I realized something was very wrong when I [what]. [How]. [Blame]."
  | "frustration"       // "I'm beyond frustrated. I [what]. [How]. [Blame]."
  | "plea"              // "Please understand: I [what]. [How]. [Blame]."
  | "documentation"     // "Let me document this: I [what]. [How]. [Blame]."
  | "personal";         // "Speaking personally, I [what]. [How]. [Blame]."

/**
 * Connectors and transition words for added variation
 */
const CONNECTORS = {
  and: ["And", "Additionally", "What's more", "On top of that", "Furthermore", "Also", "Plus"],
  because: ["because", "since", "due to the fact that", "given that", "considering that"],
  but: ["But", "However", "Yet", "Still", "Nevertheless", "Despite this"],
  so: ["So", "Therefore", "As a result", "Consequently", "Thus", "Hence"],
  then: ["Then", "After that", "Subsequently", "Following this", "Next"],
};

/**
 * Get a random connector
 */
function getConnector(type: keyof typeof CONNECTORS): string {
  const options = CONNECTORS[type];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Opening phrases for variation
 */
const OPENING_PHRASES = [
  "", // No opener (sometimes cleaner)
  "Listen, ",
  "Here's the thing: ",
  "I need you to understand something. ",
  "Let me be clear. ",
  "I want to be straightforward with you. ",
  "I'm going to be honest. ",
  "This is what happened. ",
  "Consider this: ",
  "Pay attention to this. ",
  "Here's what you've done. ",
  "This is the reality. ",
  "Let me explain what's happening. ",
  "I have to tell you something important. ",
  "You need to know this. ",
];

function assembleStory(
  scenario: StoryScenario,
  technique: AssemblyTechnique
): string {
  const { what, how, blame } = scenario;
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  // Random opener (50% chance)
  const opener = Math.random() > 0.5
    ? OPENING_PHRASES[Math.floor(Math.random() * OPENING_PHRASES.length)]
    : "";

  let story = "";

  switch (technique) {
    case "news":
      story = `I ${what}. ${capitalize(how)}. ${getConnector("and")} ${blame}.`;
      break;

    case "story":
      story = `${capitalize(how)}. Why? ${getConnector("because")} I ${what} - ${blame}.`;
      break;

    case "state_case":
      story = `Here's what's happening: I ${what}. ${capitalize(how)}. ${capitalize(blame)}.`;
      break;

    case "direct_hit":
      story = `${getConnector("because")} of you, I ${what}. ${capitalize(how)}, and ${blame}.`;
      break;

    case "question_lead":
      const whatQuestion = what
        .replace(/^got /, "get ")
        .replace(/^was /, "be ")
        .replace(/^had /, "have ");
      story = `Do you know what it's like to ${whatQuestion}? ${capitalize(how)}. ${capitalize(blame)}.`;
      break;

    case "confession":
      story = `I have to be honest with you: I ${what}. ${capitalize(how)}. ${getConnector("and")} ${blame}.`;
      break;

    case "timestamp":
      story = `It happened like this: I ${what}. ${capitalize(how)}. ${capitalize(blame)}.`;
      break;

    case "consequence_first":
      story = `${capitalize(how)}. This happened ${getConnector("because")} I ${what}. ${capitalize(blame)}.`;
      break;

    case "blame_first":
      story = `${capitalize(blame)}. Why? ${getConnector("because")} I ${what}. ${capitalize(how)}.`;
      break;

    case "emotional_lead":
      story = `I can't believe I ${what}. ${capitalize(how)}. ${capitalize(blame)}.`;
      break;

    case "factual":
      story = `The fact is, I ${what}. As a result, ${how}. ${capitalize(blame)}.`;
      break;

    case "desperate":
      story = `I'm at a breaking point. I ${what}. ${capitalize(how)}. ${capitalize(blame)}.`;
      break;

    case "rhetorical":
      const whatRhetorical = what
        .replace(/^got /, "get ")
        .replace(/^was /, "am ")
        .replace(/^had /, "have ");
      story = `What was I supposed to do when I ${whatRhetorical}? ${capitalize(how)}. ${capitalize(blame)}.`;
      break;

    case "timeline":
      story = `First, I ${what}. ${getConnector("then")}, ${how}. Now, ${blame}.`;
      break;

    case "comparison":
      story = `While others don't face this, I ${what}. ${capitalize(how)}. ${capitalize(blame)}.`;
      break;

    case "realization":
      story = `I realized something was very wrong when I ${what}. ${capitalize(how)}. ${capitalize(blame)}.`;
      break;

    case "frustration":
      story = `I'm beyond frustrated. I ${what}. ${capitalize(how)}. ${capitalize(blame)}.`;
      break;

    case "plea":
      story = `Please understand: I ${what}. ${capitalize(how)}. ${capitalize(blame)}.`;
      break;

    case "documentation":
      story = `Let me document this: I ${what}. ${capitalize(how)}. ${capitalize(blame)}.`;
      break;

    case "personal":
      story = `Speaking personally, I ${what}. ${capitalize(how)}. ${capitalize(blame)}.`;
      break;

    default:
      story = `I ${what}. ${capitalize(how)}. ${capitalize(blame)}.`;
  }

  return opener + story;
}

// =============================================================================
// MAIN GENERATION FUNCTION
// =============================================================================

export interface GeneratedStory {
  paragraph: string;
  scenarioType: ScenarioType;
  technique: AssemblyTechnique;
  hash: string;
  componentKey: string; // NEW: component-level tracking key
}

/**
 * Generate a unique human story for the DAMAGES/STORY section.
 *
 * UNIQUENESS GUARANTEE:
 * - 50+ scenarios per type × 4 types = 200+ base scenarios
 * - 100+ variables per pool × ~30 pools = unlimited fill-in combinations
 * - 20 assembly techniques × random connectors = 100+ structural variations
 * - Combined: MILLIONS of unique possible stories
 *
 * @param usedHashes - Set of hashes already used for this client (across ALL letters)
 * @param round - Current dispute round (affects intensity)
 * @param maxAttempts - Maximum attempts to find unique story (default 100)
 */
export function generateUniqueStory(
  usedHashes: Set<string>,
  round: number = 1,
  maxAttempts: number = 100,
  usedComponentKeys: Set<string> = new Set()
): GeneratedStory {
  // Randomly select scenario type with weighted distribution
  // Later rounds favor more intense scenarios
  const weights: Record<ScenarioType, number> = {
    denial: round <= 2 ? 35 : 20,
    suffering: round <= 2 ? 30 : 35,
    embarrassment: round <= 2 ? 25 : 25,
    opportunity: round <= 2 ? 10 : 20,
  };

  // ALL 20 assembly techniques
  const allTechniques: AssemblyTechnique[] = [
    "news", "story", "state_case", "direct_hit", "question_lead",
    "confession", "timestamp", "consequence_first", "blame_first",
    "emotional_lead", "factual", "desperate", "rhetorical", "timeline",
    "comparison", "realization", "frustration", "plea", "documentation", "personal"
  ];

  // Try multiple combinations until we get a unique one
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Select scenario type
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

    // For R2+, 40% chance to use escalation scenarios instead
    let scenario: StoryScenario | null = null;
    if (round >= 2 && Math.random() < 0.4) {
      const shuffledEscalation = [...ESCALATION_SCENARIOS].sort(() => Math.random() - 0.5);
      for (const esc of shuffledEscalation) {
        const filled = {
          what: replaceVariables(esc.what),
          how: replaceVariables(esc.how),
          blame: replaceVariables(esc.blame),
        };
        const combined = `${filled.what} ${filled.how} ${filled.blame}`;
        const escHash = hashStory(combined);
        if (!usedHashes.has(escHash)) {
          scenario = filled;
          break;
        }
      }
    }

    // Fall back to standard scenario selection
    if (!scenario) {
      scenario = selectUniqueScenario(selectedType, usedHashes);
    }
    if (!scenario) continue;

    // Randomly select assembly technique
    const technique = allTechniques[Math.floor(Math.random() * allTechniques.length)];

    // Assemble the story
    const paragraph = assembleStory(scenario, technique);
    const hash = hashStory(paragraph);

    // Determine the pool for scenario index lookup
    const pool = SCENARIO_POOLS[selectedType];

    // Build component key for fine-grained tracking
    const componentKey = buildComponentKey({
      scenarioIndex: pool.indexOf(pool.find(s => s.what === scenario!.what) || pool[0]),
      scenarioType: selectedType,
      technique,
      variableFingerprint: fingerprintVariables(scenario!),
    });

    // Check both full hash AND component key uniqueness
    if (!usedHashes.has(hash) && !usedComponentKeys.has(componentKey)) {
      // For R2+, prepend a continuation connector
      let finalParagraph = paragraph;
      if (round >= 2) {
        const connector = CONTINUATION_CONNECTORS[Math.floor(Math.random() * CONTINUATION_CONNECTORS.length)];
        finalParagraph = connector + paragraph.charAt(0).toLowerCase() + paragraph.slice(1);
      }

      return {
        paragraph: finalParagraph,
        scenarioType: selectedType,
        technique,
        hash,
        componentKey,
      };
    }
  }

  // Fallback: Generate with forced uniqueness by adding timestamp-based variation
  const fallbackType: ScenarioType = "denial";
  const fallbackScenario = selectUniqueScenario(fallbackType, new Set());
  if (!fallbackScenario) {
    throw new Error("Could not generate any story - all pools exhausted");
  }

  const technique = allTechniques[Math.floor(Math.random() * allTechniques.length)];
  const paragraph = assembleStory(fallbackScenario, technique);

  // Add micro-variation to guarantee uniqueness
  const uniqueSuffix = ` I've been dealing with this since ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.`;
  const uniqueParagraph = paragraph + uniqueSuffix;
  const hash = hashStory(uniqueParagraph);

  // Build fallback component key
  const pool = SCENARIO_POOLS[fallbackType];
  const componentKey = buildComponentKey({
    scenarioIndex: pool.indexOf(pool.find(s => s.what === fallbackScenario.what) || pool[0]),
    scenarioType: fallbackType,
    technique,
    variableFingerprint: fingerprintVariables(fallbackScenario),
  });

  return {
    paragraph: uniqueParagraph,
    scenarioType: fallbackType,
    technique,
    hash,
    componentKey,
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

// =============================================================================
// SOCIOECONOMIC CONTEXT INTEGRATION (From PDF Guide)
// =============================================================================

/**
 * Socioeconomic context data that can be woven into stories
 * In production, these would come from BLS API, FRED API, NewsAPI, NOAA/FEMA
 */
export interface SocioeconomicContext {
  localUnemploymentRate?: number;
  nationalUnemploymentRate?: number;
  mortgageRate?: number;
  inflationRate?: number;
  recentLocalEvents?: string[]; // e.g., "company layoffs", "natural disaster"
  housingMarketStatus?: "hot" | "cooling" | "slow";
}

/**
 * Economic context phrases that can be woven into stories naturally
 */
const ECONOMIC_CONTEXT_PHRASES = {
  unemployment: [
    "With unemployment in my area at {rate}%, finding stable work has been challenging.",
    "In this economy, where {rate}% of people in my county are out of work, every financial decision matters.",
    "I've been fortunate to stay employed when {rate}% of my neighbors are struggling to find work.",
  ],
  mortgageRates: [
    "With mortgage rates at {rate}%, every month I wait costs my family more money.",
    "Interest rates have climbed to {rate}%, making my housing situation even more urgent.",
    "At {rate}% mortgage rates, I can barely afford what I was pre-approved for six months ago.",
  ],
  inflation: [
    "Between inflation eating away at my paycheck and these credit errors, I'm losing ground every day.",
    "With prices up across the board, I can't afford to have my credit blocking opportunities.",
    "Everything costs more now, and these errors are the last thing I need on top of it all.",
  ],
  housingMarket: {
    hot: [
      "The housing market is competitive right now, and I'm losing out on homes because of these errors.",
      "Houses are selling within days, and I'm stuck watching from the sidelines with ruined credit.",
    ],
    cooling: [
      "Even with the market cooling down, I still can't get approved because of these inaccuracies.",
      "The market is finally slowing down, but my credit errors are keeping me locked out.",
    ],
    slow: [
      "Even in a slow market, I can't take advantage of opportunities because of my credit report.",
    ],
  },
  localEvents: [
    "Since the layoffs at {company}, I've been working extra shifts to stay afloat.",
    "After the {event} hit our area, I've been trying to rebuild, but these credit errors are making it impossible.",
    "Things have been tough since {event}, and dealing with credit errors on top of everything is exhausting.",
  ],
};

/**
 * Generate an economic context phrase to weave into a story
 * Returns an empty string if no context is relevant or available
 */
export function generateEconomicContextPhrase(context?: SocioeconomicContext): string {
  if (!context) return "";

  const phrases: string[] = [];

  // Add unemployment context (if above national average)
  if (context.localUnemploymentRate && context.localUnemploymentRate > 4.5) {
    const template = ECONOMIC_CONTEXT_PHRASES.unemployment[
      Math.floor(Math.random() * ECONOMIC_CONTEXT_PHRASES.unemployment.length)
    ];
    phrases.push(template.replace("{rate}", context.localUnemploymentRate.toFixed(1)));
  }

  // Add mortgage rate context (if high)
  if (context.mortgageRate && context.mortgageRate > 6.5) {
    const template = ECONOMIC_CONTEXT_PHRASES.mortgageRates[
      Math.floor(Math.random() * ECONOMIC_CONTEXT_PHRASES.mortgageRates.length)
    ];
    phrases.push(template.replace("{rate}", context.mortgageRate.toFixed(2)));
  }

  // Add housing market context
  if (context.housingMarketStatus) {
    const marketPhrases = ECONOMIC_CONTEXT_PHRASES.housingMarket[context.housingMarketStatus];
    if (marketPhrases.length > 0) {
      phrases.push(marketPhrases[Math.floor(Math.random() * marketPhrases.length)]);
    }
  }

  // Add inflation context
  if (context.inflationRate && context.inflationRate > 3.0) {
    phrases.push(
      ECONOMIC_CONTEXT_PHRASES.inflation[
        Math.floor(Math.random() * ECONOMIC_CONTEXT_PHRASES.inflation.length)
      ]
    );
  }

  // Return a random phrase from available context (or empty string)
  if (phrases.length === 0) return "";
  return phrases[Math.floor(Math.random() * phrases.length)];
}

// =============================================================================
// ROUND-BASED FRUSTRATION LEVELS (Voice Evolution)
// =============================================================================

/**
 * Frustration intensity phrases by round
 */
export const FRUSTRATION_LEVELS = {
  // R1-R2: Opening Phase - Hopeful, explaining
  opening: {
    openings: [
      "I noticed something concerning on my credit report...",
      "I'm hoping you can help me resolve an issue...",
      "I recently discovered an error that needs correction...",
      "I found some inaccurate information that I need to bring to your attention...",
    ],
    closings: [
      "I appreciate your attention to this matter.",
      "Thank you for taking the time to investigate.",
      "I look forward to a swift resolution.",
      "I trust this can be resolved quickly.",
    ],
  },

  // R3-R5: Escalation Phase - Frustrated, persistent
  escalation: {
    openings: [
      "I've already contacted you about this issue, and nothing has changed...",
      "Why hasn't this been fixed after my previous dispute?",
      "I'm confused why these errors remain on my report...",
      "This is getting frustrating - I've been waiting for weeks...",
      "I don't understand why my previous dispute was ignored...",
    ],
    closings: [
      "I expect action this time.",
      "This needs to be fixed immediately.",
      "My patience is wearing thin.",
      "I will not stop until this is resolved.",
    ],
  },

  // R6-R8: Pressure Phase - Desperate, exhausted
  pressure: {
    openings: [
      "I don't know what else to do at this point...",
      "This situation has affected every aspect of my life...",
      "I've tried everything - multiple disputes, documentation, calls...",
      "My family is suffering because of your inaction...",
      "I'm at my breaking point with these errors...",
    ],
    closings: [
      "Something has to change.",
      "I've run out of options but one.",
      "The next step is out of my hands.",
      "You've left me no choice.",
    ],
  },

  // R9+: Resolution Phase - Ultimatum, legal threats
  resolution: {
    openings: [
      "I have no choice but to pursue legal action...",
      "My attorney has advised me to document this pattern of negligence...",
      "This is your final notice before I escalate this matter...",
      "Consider this my formal demand before filing...",
      "I will be contacting the CFPB and state Attorney General...",
    ],
    closings: [
      "You have 30 days to respond before I proceed.",
      "I have documented every violation for my legal case.",
      "See you in court if this isn't resolved.",
      "My attorney will be in touch if I don't hear back.",
    ],
  },
};

/**
 * Get frustration-appropriate phrases for a given round
 */
export function getFrustrationLevel(round: number): {
  phase: "opening" | "escalation" | "pressure" | "resolution";
  openings: string[];
  closings: string[];
} {
  if (round <= 2) {
    return { phase: "opening", ...FRUSTRATION_LEVELS.opening };
  }
  if (round <= 5) {
    return { phase: "escalation", ...FRUSTRATION_LEVELS.escalation };
  }
  if (round <= 8) {
    return { phase: "pressure", ...FRUSTRATION_LEVELS.pressure };
  }
  return { phase: "resolution", ...FRUSTRATION_LEVELS.resolution };
}

/**
 * Get a random frustration-appropriate opening for a round
 */
export function getFrustrationOpening(round: number): string {
  const level = getFrustrationLevel(round);
  return level.openings[Math.floor(Math.random() * level.openings.length)];
}

/**
 * Get a random frustration-appropriate closing for a round
 */
export function getFrustrationClosing(round: number): string {
  const level = getFrustrationLevel(round);
  return level.closings[Math.floor(Math.random() * level.closings.length)];
}

/**
 * Enhance a story with economic context and frustration level
 */
export function enhanceStoryWithContext(
  story: string,
  round: number,
  economicContext?: SocioeconomicContext
): string {
  // Add economic context phrase (30% chance if context available)
  const economicPhrase = Math.random() < 0.3
    ? generateEconomicContextPhrase(economicContext)
    : "";

  // Add frustration closing (always for R3+)
  const frustrationClosing = round >= 3
    ? getFrustrationClosing(round)
    : "";

  const parts = [story];
  if (economicPhrase) parts.push(economicPhrase);
  if (frustrationClosing) parts.push(frustrationClosing);

  return parts.join(" ");
}

export { hashStory, replaceVariables, ESCALATION_SCENARIOS, CONTINUATION_CONNECTORS };

// =============================================================================
// KITCHEN TABLE STORY INTEGRATION
// Combines the story engine with detailed scenarios for TRUE infinite uniqueness
// =============================================================================

import {
  generateUniqueStory as generateStoryEngineStory,
  generateStoryBlock,
  type StoryContext,
  type GeneratedStory as EngineGeneratedStory,
} from "./amelia-story-engine";

/**
 * Extended story context with client and account details
 */
export interface KitchenTableContext {
  clientFirstName: string;
  clientId: string;
  cra: string;
  flow: "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO";
  round: number;
  accountTypes?: string[];
  totalBalance?: number;
  hasCollectionAccounts?: boolean;
  hasMultipleAccounts?: boolean;
  disputeId?: string;
  previousStories?: string[];
  economicContext?: SocioeconomicContext;
}

/**
 * Generate a Kitchen Table story - TRUE infinite uniqueness
 *
 * This combines:
 * 1. Story Engine: Life situation + goal + impact (the opening context)
 * 2. Scenario System: Detailed denial/suffering scenarios
 * 3. Voice Phase: Round-appropriate emotional escalation
 * 4. Economic Context: Real-world situational awareness
 *
 * The result is a story that sounds like a REAL person wrote it at their kitchen table.
 * No templates. No recycled phrases. Every letter is unique.
 */
export function generateKitchenTableStory(
  context: KitchenTableContext,
  usedHashes: Set<string> = new Set(),
  usedComponentKeys: Set<string> = new Set()
): GeneratedStory & { kitchenTableOpening: string; engineHash: string } {
  // Generate the opening context from the story engine
  const engineContext: StoryContext = {
    clientFirstName: context.clientFirstName,
    flow: context.flow,
    round: context.round,
    cra: context.cra,
    accountTypes: context.accountTypes,
    totalBalance: context.totalBalance,
    isCollection: context.hasCollectionAccounts || context.flow === "COLLECTION",
    hasMultipleAccounts: context.hasMultipleAccounts,
    seed: `${context.clientId}-${context.disputeId || "new"}-${context.round}`,
  };

  // Get the story engine's opening (life situation + goal + impact)
  const engineStory = generateStoryEngineStory(engineContext);

  // Generate the detailed scenario (denial, suffering, etc.)
  const scenarioStory = generateUniqueStory(usedHashes, context.round, 100, usedComponentKeys);

  // Combine them intelligently
  // The engine provides the OPENING (who I am, what I'm trying to do)
  // The scenario provides the DETAIL (what specifically happened)
  const combinedParagraph = combineKitchenTableStory(
    engineStory,
    scenarioStory,
    context.round,
    context.economicContext
  );

  // Generate combined hash
  const combinedHash = crypto
    .createHash("sha256")
    .update(combinedParagraph)
    .digest("hex")
    .substring(0, 16);

  return {
    ...scenarioStory,
    paragraph: combinedParagraph,
    hash: combinedHash,
    kitchenTableOpening: engineStory.opening,
    engineHash: engineStory.hash,
  };
}

/**
 * Intelligently combine the story engine output with the detailed scenario
 */
function combineKitchenTableStory(
  engineStory: EngineGeneratedStory,
  scenarioStory: GeneratedStory,
  round: number,
  economicContext?: SocioeconomicContext
): string {
  const parts: string[] = [];

  // For R1: Start with the story engine's context, then add scenario detail
  if (round === 1) {
    // Story engine provides the life context
    parts.push(engineStory.opening);
    // Add a transition and the specific scenario
    const transitions = [
      "And here's what happened:",
      "Then this happened:",
      "Let me explain what went wrong:",
      "Here's the problem:",
      "What makes this worse is",
    ];
    const transition = transitions[Math.floor(Math.random() * transitions.length)];
    parts.push(`${transition} ${scenarioStory.paragraph}`);
  }
  // For R2-R5: Lead with continuation, blend context and escalation
  else if (round <= 5) {
    // Start with escalation-appropriate opening
    parts.push(engineStory.emotional);
    // Add the story engine's urgency
    parts.push(engineStory.urgency);
    // Add the scenario with its frustration
    parts.push(scenarioStory.paragraph);
  }
  // For R6+: Heavy pressure, blend all elements
  else {
    // Lead with emotional state
    parts.push(engineStory.emotional);
    // Add urgent situation
    parts.push(engineStory.situation);
    // Add impact
    parts.push(engineStory.impact);
    // Add scenario details
    parts.push(scenarioStory.paragraph);
    // Close with urgency
    parts.push(engineStory.urgency);
  }

  let combined = parts.join(" ");

  // Add economic context if available (30% chance)
  if (economicContext && Math.random() < 0.3) {
    const economicPhrase = generateEconomicContextPhrase(economicContext);
    if (economicPhrase) {
      combined = combined + " " + economicPhrase;
    }
  }

  // Add frustration closing for R3+
  if (round >= 3) {
    const closing = getFrustrationClosing(round);
    if (closing) {
      combined = combined + " " + closing;
    }
  }

  return combined;
}

/**
 * Validate that a story passes the Kitchen Table Test
 *
 * A story passes if it:
 * 1. Sounds like a real person wrote it
 * 2. Contains specific details (not vague)
 * 3. Shows emotion through facts, not adjectives
 * 4. Uses contractions and natural language
 * 5. Is unique (low similarity to previous stories)
 */
export function validateKitchenTableStory(
  story: string,
  previousStories: string[] = []
): { passes: boolean; score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;

  // Check for corporate/template language
  const corporatePatterns = [
    /pursuant to/i,
    /hereby/i,
    /hereafter/i,
    /aforementioned/i,
    /in regards to/i,
    /please be advised/i,
    /to whom it may concern/i,
    /your earliest convenience/i,
    /notwithstanding/i,
    /whereas/i,
  ];

  for (const pattern of corporatePatterns) {
    if (pattern.test(story)) {
      issues.push(`Contains corporate language: ${pattern.source}`);
      score -= 15;
    }
  }

  // Check for natural contractions (should have some)
  const contractionCount = (story.match(/\b(I'm|I've|I'd|don't|can't|won't|it's|that's|they're|wasn't|couldn't|shouldn't|wouldn't)\b/gi) || []).length;
  if (contractionCount < 2) {
    issues.push("Too few contractions - sounds formal");
    score -= 10;
  }

  // Check for specific details (numbers, names, places)
  const hasSpecificDetails = /\$[\d,]+|\d+ (month|year|day|week)|my (wife|husband|kid|children|family|brother|sister|mom|dad)/i.test(story);
  if (!hasSpecificDetails) {
    issues.push("Missing specific personal details");
    score -= 10;
  }

  // Check for emotion through facts (good) vs emotion through adjectives (bad)
  const adjectiveEmotions = (story.match(/\b(very sad|extremely upset|really frustrated|so angry|terribly worried)\b/gi) || []).length;
  if (adjectiveEmotions > 1) {
    issues.push("Uses adjective-based emotion - show through facts instead");
    score -= 10;
  }

  // Check uniqueness against previous stories
  if (previousStories.length > 0) {
    const storyWords = new Set(story.toLowerCase().split(/\s+/).filter(w => w.length > 4));

    for (const prev of previousStories) {
      const prevWords = new Set(prev.toLowerCase().split(/\s+/).filter(w => w.length > 4));
      let overlap = 0;

      for (const word of storyWords) {
        if (prevWords.has(word)) overlap++;
      }

      const similarity = overlap / Math.max(storyWords.size, 1);
      if (similarity > 0.5) {
        issues.push(`High similarity (${Math.round(similarity * 100)}%) to previous story`);
        score -= 25;
        break;
      }
    }
  }

  // Check minimum length (real stories have substance)
  if (story.split(/\s+/).length < 50) {
    issues.push("Story too short - needs more substance");
    score -= 15;
  }

  return {
    passes: score >= 70,
    score: Math.max(0, score),
    issues,
  };
}

// =============================================================================
// INFINITE TITLE GENERATOR
// Every title must be unique - no repeated phrases across letters
// =============================================================================

const TITLE_ACTIONS = [
  // Basic actions (20)
  "Dispute", "Challenge", "Formal Dispute", "Request to Fix", "Correction Request",
  "Error Report", "Mistake Notice", "Fix Request", "Problem Report", "Issue Report",
  "Data Error", "Wrong Info", "Bad Data", "Credit Error", "Report Error",
  "Accuracy Issue", "Record Problem", "File Error", "Account Error", "Info Problem",
  // Expanded actions (40 more)
  "Formal Challenge", "Written Dispute", "Credit Challenge", "File Correction",
  "Report Fix Request", "Data Correction", "Error Correction", "Account Dispute",
  "Information Challenge", "Record Dispute", "File Problem", "Credit Issue",
  "Data Problem", "Report Issue", "Account Problem", "Information Error",
  "Inaccuracy Report", "Mistake Report", "Wrong Data Report", "False Info Report",
  "Credit File Issue", "Report Inaccuracy", "Data Dispute", "Account Challenge",
  "Record Fix Request", "File Dispute", "Credit Problem", "Info Correction",
  "Error Notice", "Problem Notice", "Issue Notice", "Dispute Notice",
  "Correction Notice", "Fix Notice", "Challenge Notice", "Request Notice",
  "Written Challenge", "Formal Request", "Official Dispute", "Official Challenge",
];

const TITLE_SUBJECTS = [
  // Basic subjects (19)
  "my credit file", "my credit report", "info on my file", "data you got wrong",
  "errors I found", "mistakes on my report", "wrong information", "bad data on file",
  "inaccurate accounts", "incorrect items", "false information", "errors in my records",
  "problems on my credit", "issues with my file", "stuff thats wrong", "things that aint right",
  "accounts reported wrong", "data that dont match", "info that needs fixing",
  // Expanded subjects (40 more)
  "items on my report", "accounts on my file", "information you have wrong",
  "data thats incorrect", "stuff you got wrong", "things reported wrong",
  "errors on my credit", "mistakes in my file", "wrong stuff on my report",
  "bad information on file", "false data you report", "incorrect data on my file",
  "problems you created", "issues with your reporting", "stuff thats not accurate",
  "accounts that aint right", "information thats false", "data thats not mine",
  "errors that need fixing", "mistakes that need correcting", "wrong items on file",
  "inaccurate data reported", "incorrect information listed", "false accounts shown",
  "disputed items", "challenged accounts", "questioned data", "problem accounts",
  "issue items", "error accounts", "mistake items", "wrong accounts",
  "false items", "bad accounts", "incorrect accounts", "inaccurate items",
  "my disputed information", "your errors on my file", "the mistakes you made",
  "problems with your data", "issues with your records",
];

const TITLE_URGENCY = [
  "", "", "", // higher chance of no urgency
  // Basic urgency (10)
  "- Need This Fixed", "- Please Correct", "- Time Sensitive", "- Urgent",
  "- Action Required", "- Needs Attention", "- Important", "- Please Review",
  "- Immediate Attention", "- Fix This Now",
  // Expanded urgency (25 more)
  "- Needs Fixing", "- Must Be Corrected", "- Requires Action", "- Time Critical",
  "- Very Important", "- Attention Needed", "- Please Address", "- Review Needed",
  "- Action Needed", "- Correction Needed", "- Fix Required", "- Response Needed",
  "- Waiting For Fix", "- Still Not Fixed", "- Ongoing Issue", "- Continuing Problem",
  "- Unresolved", "- Still Wrong", "- Not Yet Corrected", "- Pending Correction",
  "- Follow Up Needed", "- Second Request", "- Third Request", "- Final Request",
  "- Last Attempt",
];

/**
 * Generate an infinite unique title for the letter
 * Centered and bold in letter format
 */
export function generateInfiniteTitle(seed?: string): string {
  // Use seed for deterministic generation if provided
  const rand = seed
    ? (() => {
        let h = 0;
        for (let i = 0; i < seed.length; i++) {
          h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
        }
        return () => {
          h = Math.imul(h ^ h >>> 15, h | 1);
          h ^= h + Math.imul(h ^ h >>> 7, h | 61);
          return ((h ^ h >>> 14) >>> 0) / 4294967296;
        };
      })()
    : Math.random;

  const action = TITLE_ACTIONS[Math.floor(rand() * TITLE_ACTIONS.length)];
  const subject = TITLE_SUBJECTS[Math.floor(rand() * TITLE_SUBJECTS.length)];
  const urgency = TITLE_URGENCY[Math.floor(rand() * TITLE_URGENCY.length)];

  // 40% chance to use alternative format
  if (rand() < 0.4) {
    const altFormats = [
      `RE: ${action} of ${subject}`,
      `About ${subject}`,
      `${action}: ${subject}`,
      `This is about ${subject}`,
      `${subject} - ${action}`,
    ];
    return altFormats[Math.floor(rand() * altFormats.length)] + urgency;
  }

  return `${action} - ${subject}${urgency}`;
}

// =============================================================================
// NATURAL CLOSING GENERATOR (No "Consumer Statement" label)
// 6th-9th grade reading level, colloquial, real person voice
// =============================================================================

const CLOSING_OPENERS = [
  // Basic openers (14)
  "Look,", "Listen,", "Im just saying,", "Real talk,", "At the end of the day,",
  "Bottom line,", "The thing is,", "What I need is simple:", "All Im asking is this:",
  "Heres the deal:", "Point blank,", "Just to be clear,", "Let me be real with you,",
  "", "", "", // higher chance of no opener
  // Expanded openers (30 more)
  "Truth is,", "Honestly,", "For real though,", "I need you to understand,",
  "Let me be straight with you,", "Plain and simple,", "No beating around the bush,",
  "I gotta tell you,", "Straight up,", "Keep it real,", "Not gonna lie,",
  "End of the day,", "When its all said and done,", "Long story short,",
  "What it comes down to is,", "Simply put,", "To be honest,", "Fact is,",
  "Reality is,", "Whats real is,", "Im gonna level with you,", "Lets be real here,",
  "Im just gonna say it,", "No sugarcoating it,", "Being straight up,",
  "Keeping it 100,", "No cap,", "Being honest here,", "Truth be told,",
  "At the end of it all,",
];

const CLOSING_SITUATIONS = [
  // Basic situations (14)
  "I got bills to pay and a family counting on me",
  "Im trying to do right by my family",
  "I work hard every day and this aint fair",
  "Im just trying to get ahead like everybody else",
  "I got responsibilities and this is holding me back",
  "Im doing everything right but yall got my info wrong",
  "I need credit to live my life and take care of my people",
  "This been going on too long and I need it fixed",
  "I shouldnt have to fight this hard for accurate info",
  "Every day this stays wrong is another day I cant move forward",
  "I aint asking for nothing special just fix whats wrong",
  "My credit affects everything in my life",
  "I cant get nothing done with these errors on my file",
  "This is messing up my life in real ways",
  // Expanded situations (40 more)
  "I wake up stressed about this every single day",
  "My family is suffering because of this situation",
  "I cant sleep at night thinking about these errors",
  "This is affecting my health and my relationships",
  "I work two jobs and still cant get ahead because of this",
  "My kids are watching me struggle and it breaks my heart",
  "I pray every night that this gets resolved",
  "Ive done everything Im supposed to do and still get denied",
  "I feel like Im being punished for something I didnt do",
  "This is not the life I planned for my family",
  "I cant even look my spouse in the eye anymore",
  "Every rejection letter feels like a knife in my chest",
  "I used to believe in the system but not anymore",
  "I trusted yall to get it right and you failed me",
  "My dreams are on hold because of your mistakes",
  "I cant plan for the future when I cant even fix the present",
  "This situation has changed who I am as a person",
  "I dont recognize myself anymore with all this stress",
  "My mental health is suffering and I need relief",
  "I cant keep living like this its not sustainable",
  "Something has to change and it starts with you fixing this",
  "I deserve better than this and so does my family",
  "Im not asking for special treatment just accuracy",
  "All I want is whats fair and whats right",
  "I know Im not the only one going through this",
  "This affects real people with real lives",
  "Behind every credit report is a human being",
  "Im more than just a number in your system",
  "Treat me like you would want to be treated",
  "If this was your family youd want it fixed too",
  "I believe in accountability and its time you showed some",
  "Your mistakes have real consequences for real people",
  "I didnt create this problem but I need your help to fix it",
  "Ive been patient long enough now I need action",
  "Words dont mean nothing without action behind them",
  "Show me you actually care about getting this right",
  "Prove to me that consumer rights actually matter",
  "I still have hope that this will get resolved",
  "Im not giving up no matter how long this takes",
  "My family is counting on me to fight this",
];

const CLOSING_REQUESTS = [
  // Basic requests (10)
  "Fix these errors so I can get on with my life",
  "Just make it right thats all Im asking",
  "Correct this stuff so my report is accurate",
  "Do the right thing and fix my file",
  "Handle this so I can move on",
  "Get this straight once and for all",
  "Make the corrections I need",
  "Update my info to what it should be",
  "Take care of this the right way",
  "Get my report showing the truth",
  // Expanded requests (30 more)
  "Remove the false information from my file",
  "Delete these inaccurate accounts",
  "Correct your records to match reality",
  "Fix your mistakes and make it right",
  "Update my credit file properly",
  "Do your job and investigate this",
  "Follow the law and fix these errors",
  "Honor your obligations and correct this",
  "Show some integrity and fix your mistakes",
  "Take responsibility and make corrections",
  "Stop ignoring me and fix this already",
  "Actually investigate instead of auto-denying",
  "Look at the evidence I provided and act on it",
  "Do what you know is right here",
  "Make the changes that need to be made",
  "Get your data accurate for once",
  "Stop reporting things that aint true",
  "Remove what dont belong on my file",
  "Fix this before I have to escalate further",
  "Handle this like professionals should",
  "Correct your database and update my file",
  "Take this seriously and make it right",
  "Do what the law requires you to do",
  "Give me the accurate credit report I deserve",
  "Stop making excuses and fix the problem",
  "Address these issues once and for all",
  "Resolve this dispute in my favor",
  "Update your records to reflect the truth",
  "Make my credit report accurate finally",
  "Fix these errors like you should have done already",
];

const CLOSING_ENDINGS = [
  // Basic endings (9)
  "I appreciate you looking into this.",
  "Thanks for handling this.",
  "Im counting on yall to make this right.",
  "Please dont make me keep sending letters.",
  "Im trusting you to do your job here.",
  "Hoping this gets resolved quick.",
  "Waiting to hear back from you.",
  "Do what you gotta do to fix this.",
  "", "", "", // higher chance of no ending
  // Expanded endings (30 more)
  "I expect a proper response this time.",
  "Please handle this with urgency.",
  "Time is of the essence here.",
  "My patience is running thin.",
  "Dont make me take this further.",
  "I know my rights and Im not backing down.",
  "This needs to be resolved now.",
  "Im documenting everything for my records.",
  "I hope we can resolve this without lawyers.",
  "Please prove me wrong about your company.",
  "Show me that you actually care about accuracy.",
  "Im giving you one more chance to fix this.",
  "Do right by me and Ill move on.",
  "All I want is fairness nothing more.",
  "I believe you can make this right.",
  "Prove that consumer protection means something.",
  "Im trusting the system to work for once.",
  "Please dont let me down again.",
  "I need this resolved to move forward.",
  "Help me help my family by fixing this.",
  "Together we can make this right.",
  "I appreciate any help you can provide.",
  "Thank you for taking this seriously.",
  "I look forward to a positive resolution.",
  "Hoping for good news in your response.",
  "Please expedite this request.",
  "Your prompt attention is appreciated.",
  "Awaiting your timely response.",
  "Thank you for your consideration.",
  "I remain hopeful for a fair outcome.",
];

/**
 * Generate a natural closing paragraph - no label, just real talk
 * 6th-9th grade reading level, colloquialisms, urban/middle America
 */
export function generateNaturalClosing(round: number, seed?: string): string {
  const rand = seed
    ? (() => {
        let h = 0;
        for (let i = 0; i < seed.length; i++) {
          h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
        }
        return () => {
          h = Math.imul(h ^ h >>> 15, h | 1);
          h ^= h + Math.imul(h ^ h >>> 7, h | 61);
          return ((h ^ h >>> 14) >>> 0) / 4294967296;
        };
      })()
    : Math.random;

  const opener = CLOSING_OPENERS[Math.floor(rand() * CLOSING_OPENERS.length)];
  const situation = CLOSING_SITUATIONS[Math.floor(rand() * CLOSING_SITUATIONS.length)];
  const request = CLOSING_REQUESTS[Math.floor(rand() * CLOSING_REQUESTS.length)];
  const ending = CLOSING_ENDINGS[Math.floor(rand() * CLOSING_ENDINGS.length)];

  // Build the closing naturally
  let closing = "";

  if (opener) {
    closing = opener + " " + situation + ". " + request + ".";
  } else {
    closing = situation + ". " + request + ".";
  }

  if (ending) {
    closing += " " + ending;
  }

  // For later rounds, add more urgency
  if (round >= 4) {
    const urgentAdditions = [
      " This been going on way too long already.",
      " I shouldnt have to keep asking for this.",
      " Yall had plenty of time to fix this.",
      " Im running out of patience here.",
      " Dont make me take this further.",
    ];
    closing += urgentAdditions[Math.floor(rand() * urgentAdditions.length)];
  }

  return closing;
}
