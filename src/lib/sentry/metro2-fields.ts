/**
 * Metro 2 Field Targeting
 *
 * Identifies disputable Metro 2 fields, detects cross-bureau discrepancies,
 * and generates targeted dispute language for specific data fields.
 */

import type { DisputeAccountData } from "@/lib/dispute-creation/types";
import type { Metro2Field, Metro2FieldCode, Metro2FieldTarget } from "./types";

// =============================================================================
// METRO 2 FIELD DATABASE
// =============================================================================

export const METRO2_FIELD_DATABASE: Metro2Field[] = [
  {
    code: "DOFD",
    name: "Date of First Delinquency",
    description: "The date the account first became 30+ days past due, leading to the current delinquency status. Critical for 7-year reporting clock.",
    disputeLanguageTemplate: "The Date of First Delinquency reported as {reported_value} does not match the actual first 30-day late occurrence. {reason}",
    commonIssues: [
      "Incorrect date extends reporting period beyond 7 years",
      "Re-aging: DOFD reset after account sold to new collector",
      "Different DOFD reported across bureaus for same account",
      "DOFD missing entirely on collection account",
    ],
    verificationChallenge: "Provide original account records showing the exact date of first delinquency as defined under 15 USC 1681c(a)(5)",
    relatedEOSCARCodes: ["105"],
  },
  {
    code: "BALANCE",
    name: "Current Balance",
    description: "The current outstanding balance on the account.",
    disputeLanguageTemplate: "The Balance reported as {reported_value} is inaccurate. {reason}",
    commonIssues: [
      "Paid in full but balance not reflecting zero",
      "Balance differs across bureaus for same account",
      "Includes disputed fees or unauthorized charges",
      "Settlement accepted but full balance still showing",
      "Balance increasing on closed account due to interest/fees",
    ],
    verificationChallenge: "Provide complete payment ledger showing how current balance was calculated, including all credits, payments, and adjustments",
    relatedEOSCARCodes: ["109", "012", "004"],
  },
  {
    code: "PAYMENT_RATING",
    name: "Payment Rating",
    description: "Monthly payment status indicator (0-9 scale). 0=current, 1=30 days late, 2=60, 3=90, 4=120, 5=150, 7=wage earner, 8=repossession, 9=charge-off.",
    disputeLanguageTemplate: "The payment rating for {reported_value} is reported incorrectly. {reason}",
    commonIssues: [
      "Late marker when payment was made on time",
      "Status code incorrect for account type",
      "Payment not credited within grace period",
      "Rating not updated after dispute resolution",
    ],
    verificationChallenge: "Provide monthly payment application records including date received, date credited, and the specific reporting criteria used to determine the payment rating",
    relatedEOSCARCodes: ["106", "008", "005"],
  },
  {
    code: "ACCOUNT_STATUS",
    name: "Account Status",
    description: "Current status code of the account (e.g., 11=Current, 13=Paid/Closed, 61=Paid Collection, 64=Active Collection, 71=Wage Earner, 78=Foreclosure, 80=Surrendered, 93=Account assigned to workout, 95=Charge-off).",
    disputeLanguageTemplate: "The Account Status Code {reported_value} should reflect {expected_value} as {reason}",
    commonIssues: [
      "Paid account still shows collection status",
      "Closed by consumer not indicated properly",
      "Account settled but still showing as active collection",
      "Status not updated after bankruptcy discharge",
      "Charge-off status remaining after payment in full",
    ],
    verificationChallenge: "Provide the complete account status history showing each status change with dates and the corresponding supporting documentation for the current status code",
    relatedEOSCARCodes: ["108", "003", "004"],
  },
  {
    code: "HIGH_CREDIT",
    name: "Highest Credit / Original Loan Amount",
    description: "The highest credit limit ever extended or the original loan amount.",
    disputeLanguageTemplate: "The High Credit amount of {reported_value} is incorrect. {reason}",
    commonIssues: [
      "Inflated amount not matching original agreement",
      "Different high credit amounts across bureaus",
      "Includes unauthorized fees in original amount",
      "Amount changed after credit limit decrease",
    ],
    verificationChallenge: "Provide the original signed agreement or credit application showing the exact credit limit or loan amount originally extended",
    relatedEOSCARCodes: ["111"],
  },
  {
    code: "DATE_OPENED",
    name: "Date Opened",
    description: "The date the account was originally opened.",
    disputeLanguageTemplate: "The Date Opened reported as {reported_value} is inaccurate. {reason}",
    commonIssues: [
      "Date reset when account sold to new collector",
      "Date does not match original account opening",
      "Different dates reported across bureaus",
      "Date changed during account transfer",
    ],
    verificationChallenge: "Provide the original account opening documentation showing the actual date the account was established",
    relatedEOSCARCodes: ["105"],
  },
  {
    code: "DATE_REPORTED",
    name: "Date Reported / Last Activity",
    description: "The date the information was last reported to the credit bureau.",
    disputeLanguageTemplate: "The Date Reported/Last Activity of {reported_value} appears incorrect. {reason}",
    commonIssues: [
      "Account still being reported as recent activity despite being old/closed",
      "Last activity date more recent than actual last activity",
      "Re-aging through continued reporting on resolved accounts",
    ],
    verificationChallenge: "Provide records showing the actual date of last legitimate account activity",
    relatedEOSCARCodes: ["105", "107"],
  },
];

// =============================================================================
// FIELD DETECTION ENGINE
// =============================================================================

/**
 * Detect Metro 2 fields that can be targeted for disputes based on
 * account data and cross-bureau comparisons.
 */
export function detectTargetableFields(
  account: DisputeAccountData,
  crossBureauAccounts?: DisputeAccountData[]
): Metro2FieldTarget[] {
  const targets: Metro2FieldTarget[] = [];

  // Check balance discrepancies
  if (account.balance !== null && account.balance !== undefined) {
    // Balance on paid/closed account
    if (
      account.accountStatus?.toUpperCase() === "PAID" &&
      account.balance > 0
    ) {
      const field = METRO2_FIELD_DATABASE.find((f) => f.code === "BALANCE")!;
      targets.push({
        field,
        accountId: account.id,
        creditorName: account.creditorName,
        reportedValue: `$${account.balance.toLocaleString()}`,
        expectedValue: "$0",
        discrepancyType: "LOGICAL_ERROR",
        discrepancyDetail: "Account marked as PAID but balance is not zero",
      });
    }

    // Cross-bureau balance comparison
    if (crossBureauAccounts?.length) {
      for (const crossAccount of crossBureauAccounts) {
        if (
          crossAccount.cra !== account.cra &&
          crossAccount.balance !== null &&
          crossAccount.balance !== account.balance
        ) {
          const field = METRO2_FIELD_DATABASE.find((f) => f.code === "BALANCE")!;
          targets.push({
            field,
            accountId: account.id,
            creditorName: account.creditorName,
            reportedValue: `$${account.balance.toLocaleString()}`,
            expectedValue: `$${crossAccount.balance.toLocaleString()} (as reported to ${crossAccount.cra})`,
            discrepancyType: "CROSS_BUREAU",
            discrepancyDetail: `Balance reported as $${account.balance.toLocaleString()} to ${account.cra} but $${crossAccount.balance.toLocaleString()} to ${crossAccount.cra}`,
            bureauSource: crossAccount.cra,
          });
        }
      }
    }
  }

  // Check account status discrepancies
  if (account.accountStatus) {
    if (crossBureauAccounts?.length) {
      for (const crossAccount of crossBureauAccounts) {
        if (
          crossAccount.cra !== account.cra &&
          crossAccount.accountStatus &&
          crossAccount.accountStatus !== account.accountStatus
        ) {
          const field = METRO2_FIELD_DATABASE.find((f) => f.code === "ACCOUNT_STATUS")!;
          targets.push({
            field,
            accountId: account.id,
            creditorName: account.creditorName,
            reportedValue: account.accountStatus,
            expectedValue: crossAccount.accountStatus,
            discrepancyType: "CROSS_BUREAU",
            discrepancyDetail: `Status reported as "${account.accountStatus}" to ${account.cra} but "${crossAccount.accountStatus}" to ${crossAccount.cra}`,
            bureauSource: crossAccount.cra,
          });
        }
      }
    }
  }

  // Check date opened discrepancies
  if (account.dateOpened) {
    if (crossBureauAccounts?.length) {
      for (const crossAccount of crossBureauAccounts) {
        if (
          crossAccount.cra !== account.cra &&
          crossAccount.dateOpened &&
          new Date(crossAccount.dateOpened).getTime() !== new Date(account.dateOpened).getTime()
        ) {
          const field = METRO2_FIELD_DATABASE.find((f) => f.code === "DATE_OPENED")!;
          const reported = new Date(account.dateOpened).toLocaleDateString();
          const cross = new Date(crossAccount.dateOpened).toLocaleDateString();
          targets.push({
            field,
            accountId: account.id,
            creditorName: account.creditorName,
            reportedValue: reported,
            expectedValue: cross,
            discrepancyType: "CROSS_BUREAU",
            discrepancyDetail: `Date Opened reported as ${reported} to ${account.cra} but ${cross} to ${crossAccount.cra}`,
            bureauSource: crossAccount.cra,
          });
        }
      }
    }
  }

  // Check for stale date reported
  if (account.dateReported) {
    const reportedDate = new Date(account.dateReported);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    if (reportedDate < sixMonthsAgo && account.accountStatus?.toUpperCase() !== "CLOSED") {
      const field = METRO2_FIELD_DATABASE.find((f) => f.code === "DATE_REPORTED")!;
      targets.push({
        field,
        accountId: account.id,
        creditorName: account.creditorName,
        reportedValue: reportedDate.toLocaleDateString(),
        discrepancyType: "OUTDATED",
        discrepancyDetail: `Last reported date is over 6 months old (${reportedDate.toLocaleDateString()}) but account is not closed`,
      });
    }
  }

  // Check payment status discrepancies
  if (account.paymentStatus) {
    if (crossBureauAccounts?.length) {
      for (const crossAccount of crossBureauAccounts) {
        if (
          crossAccount.cra !== account.cra &&
          crossAccount.paymentStatus &&
          crossAccount.paymentStatus !== account.paymentStatus
        ) {
          const field = METRO2_FIELD_DATABASE.find((f) => f.code === "PAYMENT_RATING")!;
          targets.push({
            field,
            accountId: account.id,
            creditorName: account.creditorName,
            reportedValue: account.paymentStatus,
            expectedValue: crossAccount.paymentStatus,
            discrepancyType: "CROSS_BUREAU",
            discrepancyDetail: `Payment status "${account.paymentStatus}" on ${account.cra} vs "${crossAccount.paymentStatus}" on ${crossAccount.cra}`,
            bureauSource: crossAccount.cra,
          });
        }
      }
    }
  }

  return targets;
}

// =============================================================================
// DISPUTE LANGUAGE GENERATOR
// =============================================================================

/**
 * Generate Metro 2 dispute language for a specific field.
 */
export function generateMetro2DisputeLanguage(
  field: Metro2Field,
  reportedValue: string,
  correctValue?: string,
  reason?: string
): string {
  let language = field.disputeLanguageTemplate
    .replace("{reported_value}", reportedValue)
    .replace("{expected_value}", correctValue || "[correct value]")
    .replace("{reason}", reason || "This information is inaccurate and does not reflect the true account status.");

  // Append verification challenge
  language += ` I am requesting that you ${field.verificationChallenge.charAt(0).toLowerCase()}${field.verificationChallenge.slice(1)}.`;

  return language;
}
