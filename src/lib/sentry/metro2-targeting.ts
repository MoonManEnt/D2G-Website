/**
 * SENTRY METRO 2 FIELD TARGETING SYSTEM
 *
 * Enables precise, field-level dispute language targeting specific
 * Metro 2 data fields instead of generic "this is inaccurate" statements.
 *
 * STRATEGY:
 * - Challenge specific fields by name (DOFD, Balance, Payment Rating)
 * - Generate precise dispute language for each field
 * - Detect cross-bureau discrepancies automatically
 * - Force specific verification procedures
 */

import type {
  Metro2Field,
  Metro2FieldDispute,
  Metro2Discrepancy,
  SentryCRA,
  SentryAccountItem,
} from "@/types/sentry";

// =============================================================================
// METRO 2 FIELD DATABASE
// =============================================================================

export const METRO2_FIELD_DATABASE: Metro2Field[] = [
  {
    code: "DOFD",
    name: "Date of First Delinquency",
    description:
      "The date of the first 30-day delinquency leading to charge-off or collection. Determines when 7-year reporting period begins.",
    disputeLanguageTemplate:
      "The Date of First Delinquency reported as {reported_value} does not match the actual first 30-day late occurrence{reason_suffix}.",
    commonIssues: [
      "Incorrect date extends reporting period",
      "Re-aging of debt",
      "Different dates across bureaus",
      "Date changed after sale to collector",
    ],
    verificationChallenge:
      "Provide original account records showing the exact date payment first became 30 days past due, including the original account ledger from the original creditor.",
  },
  {
    code: "DATE_OPENED",
    name: "Date Opened / Date of Account",
    description: "The date the account was originally opened or established.",
    disputeLanguageTemplate:
      "The Date Opened reported as {reported_value} is incorrect{reason_suffix}.",
    commonIssues: [
      "Date changed after account sale",
      "Original open date lost",
      "Discrepancy across bureaus",
    ],
    verificationChallenge:
      "Provide the original account agreement or application showing the actual date the account was opened.",
  },
  {
    code: "DATE_CLOSED",
    name: "Date Closed",
    description: "The date the account was closed.",
    disputeLanguageTemplate:
      "The Date Closed reported as {reported_value} is inaccurate{reason_suffix}.",
    commonIssues: [
      "Closure not reflected",
      "Wrong closure date",
      "Consumer-initiated closure not noted",
    ],
    verificationChallenge:
      "Provide documentation showing the actual date and method of account closure.",
  },
  {
    code: "BALANCE",
    name: "Current Balance",
    description: "The amount currently owed on the account.",
    disputeLanguageTemplate:
      "The Balance reported as {reported_value} is inaccurate{reason_suffix}.",
    commonIssues: [
      "Paid in full not reflected",
      "Balance differs across bureaus",
      "Includes disputed fees",
      "Post-discharge balance shown",
    ],
    verificationChallenge:
      "Provide complete payment ledger showing how current balance was calculated, including all payments received and their posting dates.",
  },
  {
    code: "HIGH_CREDIT",
    name: "Highest Credit / Original Loan Amount",
    description:
      "The highest balance ever reached or the original loan amount.",
    disputeLanguageTemplate:
      "The High Credit amount of {reported_value} is incorrect{reason_suffix}.",
    commonIssues: [
      "Inflated amount",
      "Different across bureaus",
      "Includes unauthorized fees",
      "Wrong original loan amount",
    ],
    verificationChallenge:
      "Provide original account agreement showing credit limit or loan amount, and account history showing highest balance reached.",
  },
  {
    code: "CREDIT_LIMIT",
    name: "Credit Limit",
    description: "The maximum credit available on revolving accounts.",
    disputeLanguageTemplate:
      "The Credit Limit reported as {reported_value} is inaccurate{reason_suffix}.",
    commonIssues: [
      "Limit reduced without notice",
      "Wrong limit reported",
      "Discrepancy across bureaus",
    ],
    verificationChallenge:
      "Provide account statements or terms showing the actual credit limit.",
  },
  {
    code: "PAYMENT_RATING",
    name: "Payment Rating / Payment Status",
    description:
      "Monthly payment status indicator (Current, 30, 60, 90, 120, 150, 180 days late, etc.).",
    disputeLanguageTemplate:
      "The payment rating for {month_year} is reported as {reported_value} but payment was made on time{reason_suffix}.",
    commonIssues: [
      "Late marker when payment was on time",
      "Payment not credited timely",
      "Status code incorrect",
      "Payment posting delay",
    ],
    verificationChallenge:
      "Provide proof of payment receipt and posting date for the disputed month, including bank statement or cleared check.",
  },
  {
    code: "ACCOUNT_STATUS",
    name: "Account Status Code",
    description:
      "Current status of the account (Open, Closed, Paid, Collection, Charge-off, etc.).",
    disputeLanguageTemplate:
      "The Account Status Code {reported_value} should reflect {correct_value}{reason_suffix}.",
    commonIssues: [
      "Paid account still shows collection",
      "Closed by consumer not indicated",
      "Status not updated after payment",
      "Wrong status code",
    ],
    verificationChallenge:
      "Provide documentation showing current account status and date of status change.",
  },
  {
    code: "PAST_DUE",
    name: "Amount Past Due",
    description: "The amount currently past due.",
    disputeLanguageTemplate:
      "The Past Due Amount reported as {reported_value} is incorrect{reason_suffix}.",
    commonIssues: [
      "Should be zero after payment",
      "Amount inflated",
      "Includes disputed charges",
    ],
    verificationChallenge:
      "Provide current account statement showing actual past due amount calculation.",
  },
  {
    code: "PAYMENT_HISTORY",
    name: "24-Month Payment History Profile",
    description: "The 24-month grid showing payment status for each month.",
    disputeLanguageTemplate:
      "The 24-month payment history contains inaccuracies{reason_suffix}.",
    commonIssues: [
      "Late markers on months paid on time",
      "Missing payment credits",
      "Incorrect status codes",
    ],
    verificationChallenge:
      "Provide complete 24-month payment ledger with receipt dates for each payment, matching against reported history.",
  },
  {
    code: "REMARKS",
    name: "Special Comment / Remarks",
    description: "Special comments or consumer statement attached to account.",
    disputeLanguageTemplate:
      "The remarks on this account are inaccurate or incomplete{reason_suffix}.",
    commonIssues: [
      "Consumer dispute notation missing",
      "Incorrect special comment",
      "Statement not displayed",
    ],
    verificationChallenge:
      "Provide documentation of any special circumstances or confirm consumer statement is displayed.",
  },
  {
    code: "ORIGINAL_CREDITOR",
    name: "Original Creditor Name",
    description: "The name of the original creditor (for collection accounts).",
    disputeLanguageTemplate:
      "The Original Creditor is incorrectly reported as {reported_value}{reason_suffix}.",
    commonIssues: [
      "Wrong original creditor",
      "Original creditor unknown",
      "Name changed after sale",
    ],
    verificationChallenge:
      "Provide complete chain of assignment documentation showing original creditor and all subsequent transfers.",
  },
];

// =============================================================================
// FIELD TARGETING FUNCTIONS
// =============================================================================

/**
 * Get the Metro 2 field database
 */
export function getMetro2FieldDatabase(): Metro2Field[] {
  return METRO2_FIELD_DATABASE;
}

/**
 * Get a specific Metro 2 field by code
 */
export function getMetro2Field(code: string): Metro2Field | undefined {
  return METRO2_FIELD_DATABASE.find(
    (f) => f.code === code || f.code === code.toUpperCase()
  );
}

/**
 * Generate dispute language for a specific field
 */
export function generateMetro2DisputeLanguage(
  field: Metro2Field,
  reportedValue: string,
  correctValue?: string,
  reason?: string,
  monthYear?: string
): string {
  let language = field.disputeLanguageTemplate;

  // Replace template variables
  language = language.replace("{reported_value}", reportedValue);

  if (correctValue) {
    language = language.replace("{correct_value}", correctValue);
  }

  if (monthYear) {
    language = language.replace("{month_year}", monthYear);
  }

  // Build reason suffix
  let reasonSuffix = "";
  if (reason) {
    reasonSuffix = `. ${reason}`;
  } else if (correctValue) {
    reasonSuffix = `. The correct value should be ${correctValue}`;
  }

  language = language.replace("{reason_suffix}", reasonSuffix);

  return language;
}

/**
 * Create a Metro 2 field dispute object
 */
export function createFieldDispute(
  fieldCode: string,
  reportedValue: string,
  correctValue?: string,
  reason?: string
): Metro2FieldDispute | null {
  const field = getMetro2Field(fieldCode);
  if (!field) return null;

  return {
    field,
    reportedValue,
    correctValue,
    reason,
    generatedLanguage: generateMetro2DisputeLanguage(
      field,
      reportedValue,
      correctValue,
      reason
    ),
  };
}

/**
 * Detect discrepancies in a field across bureaus
 */
export function detectFieldDiscrepancies(
  account: SentryAccountItem
): Metro2Discrepancy[] {
  const discrepancies: Metro2Discrepancy[] = [];

  if (!account.crossBureauData || account.crossBureauData.length < 2) {
    return discrepancies;
  }

  const bureauData = account.crossBureauData;

  // Check DOFD
  const dofdValues = bureauData
    .filter((d) => d.dofd)
    .map((d) => ({ cra: d.cra, value: d.dofd! }));
  if (dofdValues.length > 1) {
    const uniqueValues = new Set(dofdValues.map((v) => v.value));
    if (uniqueValues.size > 1) {
      discrepancies.push({
        field: "DOFD",
        fieldName: "Date of First Delinquency",
        values: dofdValues,
        isDiscrepancy: true,
      });
    }
  }

  // Check Balance
  const balanceValues = bureauData
    .filter((d) => d.balance !== undefined)
    .map((d) => ({ cra: d.cra, value: String(d.balance) }));
  if (balanceValues.length > 1) {
    const uniqueValues = new Set(balanceValues.map((v) => v.value));
    if (uniqueValues.size > 1) {
      discrepancies.push({
        field: "BALANCE",
        fieldName: "Current Balance",
        values: balanceValues,
        isDiscrepancy: true,
      });
    }
  }

  // Check Date Opened
  const dateOpenedValues = bureauData
    .filter((d) => d.dateOpened)
    .map((d) => ({ cra: d.cra, value: d.dateOpened! }));
  if (dateOpenedValues.length > 1) {
    const uniqueValues = new Set(dateOpenedValues.map((v) => v.value));
    if (uniqueValues.size > 1) {
      discrepancies.push({
        field: "DATE_OPENED",
        fieldName: "Date Opened",
        values: dateOpenedValues,
        isDiscrepancy: true,
      });
    }
  }

  // Check Account Status
  const statusValues = bureauData
    .filter((d) => d.accountStatus)
    .map((d) => ({ cra: d.cra, value: d.accountStatus! }));
  if (statusValues.length > 1) {
    const uniqueValues = new Set(statusValues.map((v) => v.value.toLowerCase()));
    if (uniqueValues.size > 1) {
      discrepancies.push({
        field: "ACCOUNT_STATUS",
        fieldName: "Account Status",
        values: statusValues,
        isDiscrepancy: true,
      });
    }
  }

  return discrepancies;
}

/**
 * Generate dispute language for cross-bureau discrepancies
 */
export function generateDiscrepancyLanguage(
  discrepancy: Metro2Discrepancy
): string {
  const field = getMetro2Field(discrepancy.field);
  if (!field) {
    return `The ${discrepancy.fieldName} is reporting inconsistently across bureaus.`;
  }

  const valueList = discrepancy.values
    .map((v) => `${v.cra}: ${v.value}`)
    .join(", ");

  return `The ${field.name} is reporting inconsistent values across bureaus (${valueList}). Under FCRA's maximum accuracy standard, information must be consistent. This discrepancy proves at least one bureau is reporting inaccurate data.`;
}

/**
 * Get recommended fields to dispute based on account type
 */
export function getRecommendedFields(
  accountType?: string,
  isCollection?: boolean
): Metro2Field[] {
  // Collections should target DOFD, Balance, Original Creditor
  if (isCollection || accountType?.toLowerCase().includes("collection")) {
    return METRO2_FIELD_DATABASE.filter((f) =>
      ["DOFD", "BALANCE", "ACCOUNT_STATUS", "ORIGINAL_CREDITOR"].includes(
        f.code
      )
    );
  }

  // Charge-offs should target DOFD, Balance, Status
  if (accountType?.toLowerCase().includes("charge")) {
    return METRO2_FIELD_DATABASE.filter((f) =>
      ["DOFD", "BALANCE", "ACCOUNT_STATUS", "DATE_CLOSED"].includes(f.code)
    );
  }

  // Late payments should target Payment Rating, Payment History
  if (
    accountType?.toLowerCase().includes("late") ||
    accountType?.toLowerCase().includes("delinquent")
  ) {
    return METRO2_FIELD_DATABASE.filter((f) =>
      ["PAYMENT_RATING", "PAYMENT_HISTORY", "PAST_DUE"].includes(f.code)
    );
  }

  // Default accuracy fields
  return METRO2_FIELD_DATABASE.filter((f) =>
    ["DOFD", "BALANCE", "PAYMENT_RATING", "ACCOUNT_STATUS"].includes(f.code)
  );
}

/**
 * Build a complete account list entry with Metro 2 targeting
 */
export function buildAccountListEntry(
  creditorName: string,
  maskedAccountId: string | undefined,
  fieldDisputes: Metro2FieldDispute[]
): string {
  let entry = `• ${creditorName}`;
  if (maskedAccountId) {
    entry += ` (Account ending ${maskedAccountId})`;
  }
  entry += "\n";

  for (const dispute of fieldDisputes) {
    entry += `  - ${dispute.generatedLanguage}\n`;
  }

  return entry;
}

/**
 * Get verification challenge language for selected fields
 */
export function getVerificationChallenges(
  fieldCodes: string[]
): { field: string; challenge: string }[] {
  return fieldCodes
    .map((code) => {
      const field = getMetro2Field(code);
      if (field) {
        return {
          field: field.name,
          challenge: field.verificationChallenge,
        };
      }
      return null;
    })
    .filter((c): c is { field: string; challenge: string } => c !== null);
}
