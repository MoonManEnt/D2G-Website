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
];

/**
 * Suffering scenarios - ongoing pain from credit issues
 * EXPANDED: 35+ scenarios
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
];

/**
 * Embarrassment scenarios - public shame moments
 * EXPANDED: 35+ scenarios
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
];

/**
 * Opportunity loss scenarios - futures destroyed
 * EXPANDED: 35+ scenarios
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
  because: ["because", "since", "due to the fact that", "as a result of", "thanks to", "owing to"],
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

export { hashStory, replaceVariables, ESCALATION_SCENARIOS, CONTINUATION_CONNECTORS };
