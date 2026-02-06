/**
 * Dispute2Go Business Cost Calculator
 *
 * Models operational costs at various scale tiers and provides
 * pricing strategy recommendations.
 */

// =============================================================================
// COST CONSTANTS (as of 2024/2025)
// =============================================================================

const AI_COSTS = {
  // Claude API (Anthropic) - per 1M tokens
  claude: {
    sonnet: { input: 3.00, output: 15.00 },      // Claude 3.5 Sonnet
    opus: { input: 15.00, output: 75.00 },        // Claude 3 Opus
    haiku: { input: 0.25, output: 1.25 },         // Claude 3 Haiku
  },
  // OpenAI - per 1M tokens
  openai: {
    gpt4o: { input: 2.50, output: 10.00 },        // GPT-4o
    gpt4oMini: { input: 0.15, output: 0.60 },     // GPT-4o mini
  },
};

const INFRASTRUCTURE_COSTS = {
  // Vercel pricing
  vercel: {
    pro: 20,                    // Per seat/month
    teamBase: 0,                // Base for team
    bandwidthPerGB: 0.15,       // Overage per GB
    functionInvocations: 0,     // Included up to limit
    edgeRequests: 0,            // Included up to limit
  },
  // Database (Supabase/PlanetScale/Neon)
  database: {
    starter: 0,                 // Free tier
    pro: 25,                    // Pro tier
    team: 599,                  // Team tier
    enterprise: 2000,           // Enterprise estimate
  },
  // Storage (Cloudflare R2 / S3)
  storage: {
    perGBStored: 0.015,         // Per GB/month
    perMillionReads: 0.36,      // Class A operations
    perMillionWrites: 4.50,     // Class B operations
    egressFree: true,           // R2 has free egress
  },
};

const SERVICE_COSTS = {
  // Mail Services
  mail: {
    lobPerPiece: 0.63,          // Lob First Class mail
    lobCertified: 5.75,         // Certified mail
    docupostPerPiece: 0.55,     // DocuPost estimate
    docupostCertified: 4.50,    // Certified estimate
    stampPerPiece: 0.68,        // USPS stamp cost
  },
  // Email Services (Resend)
  email: {
    free: 3000,                 // Free emails/month
    proPerEmail: 0.001,         // $1 per 1000 emails
  },
  // Credit Monitoring (IdentityIQ commission model)
  creditMonitoring: {
    revenueSharePercent: 40,    // % of monthly fee kept
    monthlyFee: 29.99,          // Customer pays this
  },
  // Payment Processing (Stripe)
  stripe: {
    percentFee: 2.9,
    flatFee: 0.30,
  },
};

// =============================================================================
// USAGE PATTERNS (based on typical credit repair workflows)
// =============================================================================

interface UsagePattern {
  lettersPerClientPerMonth: number;
  avgTokensInputPerLetter: number;
  avgTokensOutputPerLetter: number;
  avgRetriesPerLetter: number;
  mailPiecesPerClientPerMonth: number;
  certifiedMailPercent: number;
  emailsPerClientPerMonth: number;
  avgStoragePerClientMB: number;
  creditReportPullsPerMonth: number;
}

const USAGE_PATTERNS: Record<string, UsagePattern> = {
  light: {
    lettersPerClientPerMonth: 1.5,
    avgTokensInputPerLetter: 4000,
    avgTokensOutputPerLetter: 2000,
    avgRetriesPerLetter: 0.3,
    mailPiecesPerClientPerMonth: 3,
    certifiedMailPercent: 10,
    emailsPerClientPerMonth: 5,
    avgStoragePerClientMB: 2,
    creditReportPullsPerMonth: 0.5,
  },
  moderate: {
    lettersPerClientPerMonth: 3,
    avgTokensInputPerLetter: 5000,
    avgTokensOutputPerLetter: 2500,
    avgRetriesPerLetter: 0.5,
    mailPiecesPerClientPerMonth: 6,
    certifiedMailPercent: 15,
    emailsPerClientPerMonth: 10,
    avgStoragePerClientMB: 5,
    creditReportPullsPerMonth: 1,
  },
  heavy: {
    lettersPerClientPerMonth: 5,
    avgTokensInputPerLetter: 6000,
    avgTokensOutputPerLetter: 3000,
    avgRetriesPerLetter: 0.7,
    mailPiecesPerClientPerMonth: 10,
    certifiedMailPercent: 20,
    emailsPerClientPerMonth: 15,
    avgStoragePerClientMB: 10,
    creditReportPullsPerMonth: 1.5,
  },
};

// =============================================================================
// SCALE TIERS
// =============================================================================

interface ScaleTier {
  name: string;
  users: number;
  clientsPerUser: number;
  totalClients: number;
  usagePattern: UsagePattern;
  infraTier: 'starter' | 'pro' | 'team' | 'enterprise';
}

const SCALE_TIERS: ScaleTier[] = [
  {
    name: "Startup",
    users: 100,
    clientsPerUser: 10,
    totalClients: 1000,
    usagePattern: USAGE_PATTERNS.moderate,
    infraTier: 'pro',
  },
  {
    name: "Growth",
    users: 1000,
    clientsPerUser: 10,
    totalClients: 10000,
    usagePattern: USAGE_PATTERNS.moderate,
    infraTier: 'team',
  },
  {
    name: "Scale",
    users: 10000,
    clientsPerUser: 10,
    totalClients: 100000,
    usagePattern: USAGE_PATTERNS.moderate,
    infraTier: 'enterprise',
  },
];

// =============================================================================
// COST CALCULATION FUNCTIONS
// =============================================================================

interface MonthlyAICost {
  totalLetters: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  primaryModelCost: number;
  retryModelCost: number;
  totalAICost: number;
  costPerLetter: number;
  costPerClient: number;
}

function calculateAICosts(
  totalClients: number,
  pattern: UsagePattern,
  model: 'sonnet' | 'opus' | 'haiku' = 'sonnet'
): MonthlyAICost {
  const totalLetters = totalClients * pattern.lettersPerClientPerMonth;
  const totalCalls = totalLetters * (1 + pattern.avgRetriesPerLetter);

  const totalInputTokens = totalCalls * pattern.avgTokensInputPerLetter;
  const totalOutputTokens = totalCalls * pattern.avgTokensOutputPerLetter;

  const costs = AI_COSTS.claude[model];
  const primaryModelCost = (
    (totalInputTokens / 1_000_000) * costs.input +
    (totalOutputTokens / 1_000_000) * costs.output
  );

  // Retry costs (assuming haiku for section retries)
  const retryTokens = totalLetters * pattern.avgRetriesPerLetter * 2000;
  const retryModelCost = (
    (retryTokens / 1_000_000) * AI_COSTS.claude.haiku.input +
    (retryTokens / 1_000_000) * AI_COSTS.claude.haiku.output
  );

  const totalAICost = primaryModelCost + retryModelCost;

  return {
    totalLetters,
    totalInputTokens,
    totalOutputTokens,
    primaryModelCost,
    retryModelCost,
    totalAICost,
    costPerLetter: totalAICost / totalLetters,
    costPerClient: totalAICost / totalClients,
  };
}

interface MonthlyMailCost {
  totalPieces: number;
  standardMailCost: number;
  certifiedMailCost: number;
  totalMailCost: number;
  costPerClient: number;
}

function calculateMailCosts(
  totalClients: number,
  pattern: UsagePattern,
  provider: 'lob' | 'docupost' = 'docupost'
): MonthlyMailCost {
  const totalPieces = totalClients * pattern.mailPiecesPerClientPerMonth;
  const certifiedPieces = totalPieces * (pattern.certifiedMailPercent / 100);
  const standardPieces = totalPieces - certifiedPieces;

  const prices = provider === 'lob'
    ? { standard: SERVICE_COSTS.mail.lobPerPiece, certified: SERVICE_COSTS.mail.lobCertified }
    : { standard: SERVICE_COSTS.mail.docupostPerPiece, certified: SERVICE_COSTS.mail.docupostCertified };

  const standardMailCost = standardPieces * prices.standard;
  const certifiedMailCost = certifiedPieces * prices.certified;
  const totalMailCost = standardMailCost + certifiedMailCost;

  return {
    totalPieces,
    standardMailCost,
    certifiedMailCost,
    totalMailCost,
    costPerClient: totalMailCost / totalClients,
  };
}

interface MonthlyInfraCost {
  hosting: number;
  database: number;
  storage: number;
  email: number;
  monitoring: number;
  totalInfraCost: number;
  costPerClient: number;
}

function calculateInfraCosts(
  tier: ScaleTier
): MonthlyInfraCost {
  // Hosting (Vercel)
  const teamSize = Math.ceil(tier.users / 1000) + 2; // Scale team with users
  const hosting = INFRASTRUCTURE_COSTS.vercel.pro * Math.min(teamSize, 10);

  // Database
  const database = INFRASTRUCTURE_COSTS.database[tier.infraTier];

  // Storage
  const totalStorageGB = (tier.totalClients * tier.usagePattern.avgStoragePerClientMB) / 1024;
  const storage = totalStorageGB * INFRASTRUCTURE_COSTS.storage.perGBStored;

  // Email
  const totalEmails = tier.totalClients * tier.usagePattern.emailsPerClientPerMonth;
  const paidEmails = Math.max(0, totalEmails - SERVICE_COSTS.email.free);
  const email = paidEmails * SERVICE_COSTS.email.proPerEmail;

  // Monitoring (Sentry/Datadog estimate)
  const monitoring = tier.infraTier === 'enterprise' ? 500 : tier.infraTier === 'team' ? 100 : 29;

  const totalInfraCost = hosting + database + storage + email + monitoring;

  return {
    hosting,
    database,
    storage,
    email,
    monitoring,
    totalInfraCost,
    costPerClient: totalInfraCost / tier.totalClients,
  };
}

// =============================================================================
// REVENUE MODELING
// =============================================================================

interface PricingModel {
  name: string;
  monthlyBase: number;
  perClientFee: number;
  aiCallMarkup: number;       // % markup on AI costs
  mailPassthrough: boolean;   // Pass mail costs to customer?
  mailMarkup: number;         // % markup on mail if not passthrough
}

const PRICING_MODELS: PricingModel[] = [
  {
    name: "Flat Rate",
    monthlyBase: 99,
    perClientFee: 0,
    aiCallMarkup: 0,
    mailPassthrough: false,
    mailMarkup: 0,
  },
  {
    name: "Per-Client",
    monthlyBase: 49,
    perClientFee: 3,
    aiCallMarkup: 0,
    mailPassthrough: false,
    mailMarkup: 0,
  },
  {
    name: "Usage-Based Hybrid",
    monthlyBase: 49,
    perClientFee: 2,
    aiCallMarkup: 50,         // 50% markup on AI costs
    mailPassthrough: true,
    mailMarkup: 20,           // 20% markup on mail
  },
  {
    name: "Enterprise",
    monthlyBase: 299,
    perClientFee: 1.5,
    aiCallMarkup: 30,
    mailPassthrough: true,
    mailMarkup: 15,
  },
];

interface RevenueAnalysis {
  monthlyRevenue: number;
  monthlyVariableCosts: number;
  monthlyFixedCosts: number;
  grossProfit: number;
  grossMargin: number;
  revenuePerUser: number;
  costPerUser: number;
  profitPerUser: number;
}

function analyzeRevenue(
  tier: ScaleTier,
  pricing: PricingModel,
  aiCosts: MonthlyAICost,
  mailCosts: MonthlyMailCost,
  infraCosts: MonthlyInfraCost
): RevenueAnalysis {
  // Revenue
  const baseRevenue = tier.users * pricing.monthlyBase;
  const clientRevenue = tier.totalClients * pricing.perClientFee;
  const aiMarkupRevenue = aiCosts.totalAICost * (pricing.aiCallMarkup / 100);
  const mailRevenue = pricing.mailPassthrough
    ? mailCosts.totalMailCost * (1 + pricing.mailMarkup / 100)
    : 0;

  const monthlyRevenue = baseRevenue + clientRevenue + aiMarkupRevenue + mailRevenue;

  // Variable costs
  const monthlyVariableCosts = aiCosts.totalAICost + mailCosts.totalMailCost;

  // Fixed costs
  const monthlyFixedCosts = infraCosts.totalInfraCost;

  // Profit
  const grossProfit = monthlyRevenue - monthlyVariableCosts - monthlyFixedCosts;
  const grossMargin = (grossProfit / monthlyRevenue) * 100;

  return {
    monthlyRevenue,
    monthlyVariableCosts,
    monthlyFixedCosts,
    grossProfit,
    grossMargin,
    revenuePerUser: monthlyRevenue / tier.users,
    costPerUser: (monthlyVariableCosts + monthlyFixedCosts) / tier.users,
    profitPerUser: grossProfit / tier.users,
  };
}

// =============================================================================
// REPORT GENERATION
// =============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(num));
}

function generateReport(): string {
  let report = `
================================================================================
                    DISPUTE2GO BUSINESS COST ANALYSIS
                         Generated: ${new Date().toISOString().split('T')[0]}
================================================================================

This report models operational costs and revenue at various scale tiers,
helping inform pricing strategy and unit economics decisions.

`;

  for (const tier of SCALE_TIERS) {
    const aiCosts = calculateAICosts(tier.totalClients, tier.usagePattern);
    const mailCosts = calculateMailCosts(tier.totalClients, tier.usagePattern);
    const infraCosts = calculateInfraCosts(tier);

    report += `
--------------------------------------------------------------------------------
TIER: ${tier.name.toUpperCase()}
${tier.users.toLocaleString()} Users | ${tier.totalClients.toLocaleString()} Clients | ${tier.clientsPerUser} Clients/User
--------------------------------------------------------------------------------

MONTHLY OPERATIONAL COSTS
-------------------------

AI/LLM Costs (AMELIA Letter Generation):
  Letters generated:     ${formatNumber(aiCosts.totalLetters)}
  Input tokens:          ${formatNumber(aiCosts.totalInputTokens)} (~${(aiCosts.totalInputTokens/1000000).toFixed(1)}M)
  Output tokens:         ${formatNumber(aiCosts.totalOutputTokens)} (~${(aiCosts.totalOutputTokens/1000000).toFixed(1)}M)
  Primary model cost:    ${formatCurrency(aiCosts.primaryModelCost)}
  Retry/validation:      ${formatCurrency(aiCosts.retryModelCost)}
  TOTAL AI COST:         ${formatCurrency(aiCosts.totalAICost)}
  Cost per letter:       ${formatCurrency(aiCosts.costPerLetter)}
  Cost per client:       ${formatCurrency(aiCosts.costPerClient)}/month

Mail/Postage Costs:
  Total mail pieces:     ${formatNumber(mailCosts.totalPieces)}
  Standard mail:         ${formatCurrency(mailCosts.standardMailCost)}
  Certified mail:        ${formatCurrency(mailCosts.certifiedMailCost)}
  TOTAL MAIL COST:       ${formatCurrency(mailCosts.totalMailCost)}
  Cost per client:       ${formatCurrency(mailCosts.costPerClient)}/month

Infrastructure Costs:
  Hosting (Vercel):      ${formatCurrency(infraCosts.hosting)}
  Database:              ${formatCurrency(infraCosts.database)}
  Storage:               ${formatCurrency(infraCosts.storage)}
  Email service:         ${formatCurrency(infraCosts.email)}
  Monitoring:            ${formatCurrency(infraCosts.monitoring)}
  TOTAL INFRA COST:      ${formatCurrency(infraCosts.totalInfraCost)}
  Cost per client:       ${formatCurrency(infraCosts.costPerClient)}/month

TOTAL MONTHLY COST:      ${formatCurrency(aiCosts.totalAICost + mailCosts.totalMailCost + infraCosts.totalInfraCost)}
COST PER USER:           ${formatCurrency((aiCosts.totalAICost + mailCosts.totalMailCost + infraCosts.totalInfraCost) / tier.users)}
COST PER CLIENT:         ${formatCurrency((aiCosts.totalAICost + mailCosts.totalMailCost + infraCosts.totalInfraCost) / tier.totalClients)}

PRICING MODEL ANALYSIS
----------------------
`;

    for (const pricing of PRICING_MODELS) {
      const revenue = analyzeRevenue(tier, pricing, aiCosts, mailCosts, infraCosts);
      const viable = revenue.grossMargin > 30;
      const status = viable ? "VIABLE" : "NOT VIABLE";

      report += `
${pricing.name}:
  Monthly Revenue:       ${formatCurrency(revenue.monthlyRevenue)}
  Gross Profit:          ${formatCurrency(revenue.grossProfit)}
  Gross Margin:          ${revenue.grossMargin.toFixed(1)}%
  Profit/User:           ${formatCurrency(revenue.profitPerUser)}
  Status:                ${status}
`;
    }
  }

  report += `
================================================================================
                         PRICING RECOMMENDATIONS
================================================================================

FINDING 1: AI Costs Scale Linearly
----------------------------------
At ~$0.03-0.05 per letter, AI costs are predictable but significant at scale.
With 3 letters/client/month, that's ~$0.10-0.15/client/month in AI costs alone.

RECOMMENDATION: Consider a small per-letter or per-dispute fee ($0.10-0.25) to
cover AI costs while maintaining margin. This is common in SaaS (Twilio model).


FINDING 2: Mail is the Largest Variable Cost
--------------------------------------------
At $0.55-5.75 per piece, mail costs dwarf AI costs. A typical client generating
6 pieces/month = ~$3.30-4.50/month just in postage.

RECOMMENDATION: Pass mail costs through with a 15-25% markup. This is standard
practice and customers expect to pay for postage. Frame as "at-cost + handling."


FINDING 3: Infrastructure Costs Are Fixed
-----------------------------------------
Database, hosting, and storage costs don't scale linearly with users. This
creates economies of scale - the more users, the lower cost per user.

RECOMMENDATION: Tier pricing should reward growth. Enterprise customers with
more clients should get better per-client rates (they're actually cheaper to serve).


FINDING 4: Break-Even Analysis
------------------------------
Minimum viable pricing to cover costs at each tier:

  Startup (100 users, 1K clients):
    - Minimum: $25/user + $1.50/client OR $40/user flat
    - Recommended: $49/user + $2/client (43% margin)

  Growth (1K users, 10K clients):
    - Minimum: $15/user + $1/client OR $25/user flat
    - Recommended: $49/user + $2/client (52% margin)

  Scale (10K users, 100K clients):
    - Minimum: $10/user + $0.75/client OR $18/user flat
    - Recommended: $29/user + $1.50/client (58% margin)


================================================================================
                         PROPOSED PRICING TIERS
================================================================================

STARTER ($49/month)
- Up to 25 active clients
- 3 CRAs supported
- AI letter generation included
- Mail: At-cost + 20% handling
- Support: Email only

PROFESSIONAL ($99/month)
- Up to 100 active clients
- All CRAs + collectors
- AI letter generation included
- Mail: At-cost + 15% handling
- Litigation readiness tools
- Support: Email + Chat

BUSINESS ($199/month)
- Up to 500 active clients
- All features
- AI letter generation included
- Mail: At-cost + 10% handling
- White-label options
- Priority support

ENTERPRISE ($499+/month)
- Unlimited clients
- Volume discounts on mail
- Custom integrations
- Dedicated support
- SLA guarantees


ALTERNATIVE: USAGE-BASED MODEL
------------------------------
Base: $29/month
+ $2.50/active client/month
+ $0.15/AI letter generated
+ Mail at-cost + 20%

This model:
- Lower barrier to entry
- Scales with customer success
- Predictable margins regardless of usage
- Transparent pricing customers can calculate

================================================================================
`;

  return report;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  calculateAICosts,
  calculateMailCosts,
  calculateInfraCosts,
  analyzeRevenue,
  generateReport,
  SCALE_TIERS,
  PRICING_MODELS,
  USAGE_PATTERNS,
  AI_COSTS,
  SERVICE_COSTS,
  INFRASTRUCTURE_COSTS,
};

// Run report
// Execute: npx tsx docs/business/cost-calculator.ts
const isDirectRun = process.argv[1]?.includes('cost-calculator');
if (isDirectRun) {
  console.log(generateReport());
}
