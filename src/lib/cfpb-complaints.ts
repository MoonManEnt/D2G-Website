import {
  buildDamagesSection,
  buildFactsSection,
  buildPenaltySection,
  getUsedContentHashes,
  type DisputeAccount,
  type DisputeFlow as AmeliaDisputeFlow,
} from "./amelia";

export type DisputeFlow = "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO";

export interface CFPBComplaintData {
  clientName: string;
  clientId?: string; // Added for duplication checking
  cra: "TRANSUNION" | "EXPERIAN" | "EQUIFAX";
  accounts: Array<{
    creditorName: string;
    accountNumber?: string;
    balance?: string; // String formatted balance "$1,234"
    issue: string;
  }>;
  round: number;
  flow: DisputeFlow;
  previousDisputeDate?: string;
  daysSinceDispute?: number;
}

// CFPB Product Categories
export const CFPB_PRODUCT = "Credit reporting or other personal consumer reports";
export const CFPB_SUB_PRODUCT = "Credit reporting";

// Helper to sanitize balance string to number
function parseBalance(balanceStr?: string): number | undefined {
  if (!balanceStr) return undefined;
  // Remove non-numeric chars except period
  const num = parseFloat(balanceStr.replace(/[^0-9.]/g, ""));
  return isNaN(num) ? undefined : num;
}

// ============================================================================
// MAIN GENERATOR FUNCTION (Dynamic / Amelia Powered)
// ============================================================================

export async function generateCFPBComplaint(data: CFPBComplaintData): Promise<{
  product: string;
  subProduct: string;
  issue: string;
  subIssue: string;
  companyName: string;
  narrative: string;
  desiredResolution: string;
}> {
  const craFullNames: Record<string, string> = {
    TRANSUNION: "TransUnion",
    EXPERIAN: "Experian",
    EQUIFAX: "Equifax Information Services LLC",
  };

  const craName = craFullNames[data.cra];

  // 1. Get used content hashes to avoid duplication (if clientId provided)
  const usedHashes = data.clientId
    ? await getUsedContentHashes(data.clientId)
    : new Set<string>();

  // 2. Prepare accounts for Amelia
  const ameliaAccounts: DisputeAccount[] = data.accounts.map((acc) => ({
    creditorName: acc.creditorName,
    accountNumber: acc.accountNumber,
    balance: parseBalance(acc.balance),
    issues: [acc.issue], // Map single issue to array
  }));

  // 3. Prepare previous history for context
  const previousHistory = {
    previousRounds: data.round > 1 ? Array.from({ length: data.round - 1 }, (_, i) => i + 1) : [],
    previousResponses: [], // We don't have exact response text here, but that's ok
    daysWithoutResponse: data.daysSinceDispute || 30,
  };

  // 4. Generate Sections using Amelia Builders
  const damagesSection = buildDamagesSection(data.round, usedHashes, previousHistory);

  // Cast flow to Amelia flow (safe as they define same strings for standard flows)
  // Collection/Combo/Accuracy/Consent match.
  const factsSection = buildFactsSection(
    data.flow as AmeliaDisputeFlow,
    ameliaAccounts,
    data.round,
    usedHashes
  );

  const penaltySection = buildPenaltySection(data.round, usedHashes, previousHistory);

  // 5. Account List Formatting
  // We use a simplified account list for the narrative body or rely on Amelia's standard way?
  // The original CFPB code had a `formatAccountList`. Amelia has `buildAccountsList`.
  // Let's use Amelia's dynamic list builder for variety.
  // Wait, `formatAccountList` in original included specific Issue text per account.
  // Amelia's `buildAccountsList` includes issues too.
  // We'll construct a clean list ourselves to ensure it fits CFPB 4000 char limit style if needed,
  // but Amelia's builders are fine. Let's manually format to match the "Complaint" style 
  // which often wants clear separation.

  const accountListText = data.accounts
    .map((acc, i) => {
      let line = `${i + 1}. ${acc.creditorName}`;
      if (acc.accountNumber) line += ` (Account: ${acc.accountNumber})`;
      line += `\n   Issue: ${acc.issue}`;
      return line;
    })
    .join("\n\n");


  // 6. Assemble Narrative
  // CFPB Narrative = Story (Damages) + Account List + Legal Arguments (Facts)
  // We want to weave them together.

  const narrative = `${damagesSection}\n\nI am disputing the following accounts:\n\n${accountListText}\n\n${factsSection}`;

  // 7. Select Issue/Sub-issue category (Static for now based on Flow, or map dynamically)
  let issue = "Incorrect information on your report";
  let subIssue = "Information belongs to someone else";

  if (data.flow === "COLLECTION") {
    issue = "Problem with a credit reporting company's investigation into an existing problem";
    subIssue = "Their investigation did not fix an error on your report";
  } else if (data.flow === "CONSENT") {
    issue = "Improper use of your report";
    subIssue = "Reporting company used your report improperly";
  }

  return {
    product: CFPB_PRODUCT,
    subProduct: CFPB_SUB_PRODUCT,
    issue,
    subIssue,
    companyName: craName,
    narrative: narrative,
    desiredResolution: penaltySection,
  };
}

// Generate a formatted complaint ready for copy/paste
// NOTE: Now async because generateCFPBComplaint is async
export async function formatCFPBComplaintForCopy(data: CFPBComplaintData): Promise<string> {
  const complaint = await generateCFPBComplaint(data);

  return `════════════════════════════════════════════════════════════════
CFPB COMPLAINT - READY TO FILE AT CONSUMERFINANCE.GOV/COMPLAINT
════════════════════════════════════════════════════════════════

STEP 1: SELECT PRODUCT
────────────────────────────────────────────────────────────────
Product: ${complaint.product}
Sub-product: ${complaint.subProduct}

STEP 2: SELECT ISSUE
────────────────────────────────────────────────────────────────
Issue: ${complaint.issue}
Sub-issue: ${complaint.subIssue}

STEP 3: COMPANY INFORMATION
────────────────────────────────────────────────────────────────
Company Name: ${complaint.companyName}

STEP 4: WHAT HAPPENED? (Copy everything below this line)
────────────────────────────────────────────────────────────────
${complaint.narrative}

STEP 5: DESIRED RESOLUTION (Copy everything below this line)
────────────────────────────────────────────────────────────────
${complaint.desiredResolution}

════════════════════════════════════════════════════════════════
IMPORTANT FILING INSTRUCTIONS:
────────────────────────────────────────────────────────────────
1. Go to: https://www.consumerfinance.gov/complaint/
2. Click "Start a new complaint"
3. Select "Credit reporting or other personal consumer reports"
4. Follow the prompts using the information above
5. Copy/paste the narrative and resolution into the appropriate fields
6. Attach any supporting documents (dispute letters, screenshots)
7. SAVE YOUR CONFIRMATION NUMBER

The company has 15 days to respond to CFPB complaints.
You can track your complaint at the CFPB website.
════════════════════════════════════════════════════════════════`;
}
