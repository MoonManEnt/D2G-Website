/**
 * Dispute2Go PDF Parsing Engine
 *
 * Parses IdentityIQ credit reports using text extraction.
 * Updated to handle flat text format from pdfjs-dist extraction.
 */

import {
  ParseResult,
  ParsedAccountItem,
  ParseError,
  ParseWarning,
  CRA,
  AccountStatus,
  ConfidenceLevel,
  PARSE_ERROR_CODES,
  computeConfidenceLevel,
  FlowType,
} from "@/types";
import { generateFingerprint } from "./utils";

// Issue types that can be flagged on accounts
export interface AccountIssue {
  code: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  suggestedFlow: FlowType;
  fcraSection?: string;
}

// Extended parsed account with issues
export interface ParsedAccountWithIssues extends ParsedAccountItem {
  issues: AccountIssue[];
  suggestedFlow?: FlowType;
  isDisputable: boolean;
}

// Known creditor name patterns - these appear before "TransUnion Experian Equifax"
const KNOWN_CREDITOR_PATTERNS = [
  /([A-Z][A-Z0-9\/\-&'.\s]{2,30})\s+TransUnion\s+Experian\s+Equifax\s+Account\s*#:/g,
];

// Field extraction patterns for flat text
const FIELD_PATTERNS = {
  accountNumber: /Account\s*#:\s*(\S+)\s+(\S+)\s+(\S+)/,
  accountType: /Account\s+Type:\s*([A-Za-z]+)\s+([A-Za-z]+)\s+([A-Za-z]+)/,
  accountStatus: /Account\s+Status:\s*([A-Za-z]+)\s+([A-Za-z]+)\s+([A-Za-z]+)/,
  monthlyPayment: /Monthly\s+Payment:\s*\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)/,
  dateOpened: /Date\s+Opened:\s*(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/,
  balance: /Balance:\s*\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)/,
  highCredit: /High\s+Credit:\s*\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)/,
  creditLimit: /Credit\s+Limit:\s*\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)/,
  pastDue: /Past\s+Due:\s*\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)/,
  paymentStatus: /Payment\s+Status:\s*([A-Za-z0-9\s]+?)\s+([A-Za-z0-9\s]+?)\s+([A-Za-z0-9\s]+?)\s+Last/,
  lastReported: /Last\s+Reported:\s*(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/,
};

// Status mapping
const STATUS_MAP: Record<string, AccountStatus> = {
  "open": AccountStatus.OPEN,
  "current": AccountStatus.OPEN,
  "paid": AccountStatus.PAID,
  "closed": AccountStatus.CLOSED,
  "charged off": AccountStatus.CHARGED_OFF,
  "chargeoff": AccountStatus.CHARGED_OFF,
  "collection": AccountStatus.COLLECTION,
  "collections": AccountStatus.COLLECTION,
};

/**
 * Main parsing function
 */
export async function parseIdentityIQReport(fullText: string): Promise<ParseResult> {
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const accounts: ParsedAccountItem[] = [];

  // Check for text content
  if (!fullText || fullText.trim().length < 100) {
    return {
      success: false,
      pageCount: 0,
      accounts: [],
      errors: [{
        code: PARSE_ERROR_CODES.NO_TEXT_LAYER,
        message: "This PDF appears to be image-based or contains no extractable text.",
        details: { hint: "Please upload a native IdentityIQ export." },
      }],
      warnings: [],
    };
  }

  // Find account blocks by looking for creditor names followed by bureau headers
  const accountBlocks = extractAccountBlocks(fullText);

  console.log(`Found ${accountBlocks.length} account blocks`);

  for (let i = 0; i < accountBlocks.length; i++) {
    const block = accountBlocks[i];
    const parsedAccounts = parseAccountBlock(block.creditorName, block.text, i);

    for (const account of parsedAccounts) {
      const fingerprint = generateFingerprint(account.creditorName, account.maskedAccountId);

      // Check for duplicates
      const isDuplicate = accounts.some(
        a => a.fingerprint === fingerprint && a.cra === account.cra
      );

      if (!isDuplicate) {
        accounts.push({ ...account, fingerprint });
      } else {
        warnings.push({
          code: "DUPLICATE_ACCOUNT",
          message: `Duplicate: ${account.creditorName} (${account.cra})`,
          accountIndex: i,
        });
      }
    }
  }

  // Warn about low confidence
  accounts.forEach((account, index) => {
    if (account.confidenceScore < 45) {
      warnings.push({
        code: "LOW_CONFIDENCE",
        message: `Low confidence for ${account.creditorName} - manual review recommended`,
        accountIndex: index,
      });
    }
  });

  console.log(`Parsed ${accounts.length} accounts total`);

  return {
    success: accounts.length > 0,
    pageCount: Math.ceil(fullText.length / 3000),
    accounts,
    errors: accounts.length === 0 ? [{
      code: "NO_ACCOUNTS_FOUND",
      message: "No accounts could be parsed from this report. The format may not be recognized.",
    }] : errors,
    warnings,
  };
}

interface AccountBlock {
  creditorName: string;
  text: string;
  startIndex: number;
}

/**
 * Extract account blocks from the text
 */
function extractAccountBlocks(text: string): AccountBlock[] {
  const blocks: AccountBlock[] = [];

  // Pattern: CREDITOR_NAME followed by TransUnion Experian Equifax Account #:
  // Must start with a letter (not OK/numbers from payment history)
  const pattern = /(?:^|[^A-Z0-9])([A-Z][A-Z0-9\/\-&'.]+(?:\s+[A-Z][A-Z0-9\/\-&'.]+)*)\s+TransUnion\s+Experian\s+Equifax\s+Account\s*#:/g;

  let match;
  const matches: { creditorName: string; startIndex: number }[] = [];

  while ((match = pattern.exec(text)) !== null) {
    let creditorName = match[1].trim();

    // Clean up creditor name - remove leading OK sequences from payment history
    creditorName = creditorName.replace(/^(?:OK\s+)+/g, "").trim();
    creditorName = creditorName.replace(/^\d+\s+/g, "").trim();
    creditorName = creditorName.replace(/^K\s+/g, "").trim(); // stray K from OK

    // Skip false positives
    if (creditorName.length < 3 ||
        creditorName.includes("Total Accounts") ||
        creditorName.includes("Open Accounts") ||
        creditorName.includes("Summary") ||
        /^OK+$/.test(creditorName) ||
        /^\d+$/.test(creditorName)) {
      continue;
    }

    matches.push({
      creditorName,
      startIndex: match.index,
    });
  }

  // Deduplicate matches that have the same cleaned creditor name
  const seen = new Set<string>();
  const uniqueMatches = matches.filter(m => {
    const key = m.creditorName.toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Extract text blocks between matches
  for (let i = 0; i < uniqueMatches.length; i++) {
    const start = uniqueMatches[i].startIndex;
    const end = i < uniqueMatches.length - 1 ? uniqueMatches[i + 1].startIndex : text.length;
    const blockText = text.substring(start, Math.min(end, start + 2000));

    blocks.push({
      creditorName: uniqueMatches[i].creditorName,
      text: blockText,
      startIndex: start,
    });
  }

  return blocks;
}

/**
 * Parse a single account block into account items for each CRA
 */
function parseAccountBlock(creditorName: string, blockText: string, blockIndex: number): ParsedAccountItem[] {
  const accounts: ParsedAccountItem[] = [];
  const cras: CRA[] = [CRA.TRANSUNION, CRA.EXPERIAN, CRA.EQUIFAX];

  // Extract fields
  const accountNumbers = extractTripleValues(blockText, FIELD_PATTERNS.accountNumber);
  const accountTypes = extractTripleValues(blockText, FIELD_PATTERNS.accountType);
  const accountStatuses = extractTripleValues(blockText, FIELD_PATTERNS.accountStatus);
  const balances = extractTripleValues(blockText, FIELD_PATTERNS.balance);
  const pastDues = extractTripleValues(blockText, FIELD_PATTERNS.pastDue);
  const creditLimits = extractTripleValues(blockText, FIELD_PATTERNS.creditLimit);
  const highCredits = extractTripleValues(blockText, FIELD_PATTERNS.highCredit);
  const monthlyPayments = extractTripleValues(blockText, FIELD_PATTERNS.monthlyPayment);
  const datesOpened = extractTripleValues(blockText, FIELD_PATTERNS.dateOpened);
  const paymentStatuses = extractTripleValues(blockText, FIELD_PATTERNS.paymentStatus);
  const lastReportedDates = extractTripleValues(blockText, FIELD_PATTERNS.lastReported);

  // Create account for each CRA that has data
  for (let i = 0; i < cras.length; i++) {
    const accountNum = accountNumbers[i];

    // Skip if no account number for this CRA
    if (!accountNum || accountNum === "-" || accountNum === "$0.00") {
      continue;
    }

    const balance = parseNumber(balances[i]);
    const pastDue = parseNumber(pastDues[i]);
    const creditLimit = parseNumber(creditLimits[i]);
    const highBalance = parseNumber(highCredits[i]);
    const monthlyPayment = parseNumber(monthlyPayments[i]);
    const status = mapAccountStatus(accountStatuses[i]);

    // Calculate confidence
    const confidence = calculateConfidence({
      hasCreditorName: creditorName.length > 2,
      hasAccountId: accountNum.length > 3,
      hasBalance: balance !== undefined,
      hasStatus: !!accountStatuses[i],
      hasDates: !!datesOpened[i] || !!lastReportedDates[i],
      hasStructure: blockText.includes("Account #:") && blockText.includes("Balance:"),
    });

    accounts.push({
      creditorName: cleanCreditorName(creditorName),
      maskedAccountId: cleanAccountId(accountNum),
      cra: cras[i],
      accountType: accountTypes[i] || undefined,
      accountStatus: status,
      balance,
      pastDue,
      creditLimit,
      highBalance,
      monthlyPayment,
      dateOpened: datesOpened[i] || undefined,
      dateReported: lastReportedDates[i] || undefined,
      paymentStatus: paymentStatuses[i] || undefined,
      confidenceScore: confidence,
      rawExtractedData: {
        blockIndex,
        originalBlock: blockText.substring(0, 500),
      },
    });
  }

  return accounts;
}

/**
 * Extract three values (TransUnion, Experian, Equifax) from text using pattern
 */
function extractTripleValues(text: string, pattern: RegExp): string[] {
  const match = text.match(pattern);
  if (!match) return ["", "", ""];
  return [
    match[1]?.trim() || "",
    match[2]?.trim() || "",
    match[3]?.trim() || "",
  ];
}

function cleanCreditorName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function cleanAccountId(id: string): string {
  return id.trim().replace(/[^A-Za-z0-9*]/gi, "");
}

function mapAccountStatus(statusText: string | undefined): AccountStatus {
  if (!statusText) return AccountStatus.UNKNOWN;
  const normalized = statusText.toLowerCase().trim();

  for (const [key, value] of Object.entries(STATUS_MAP)) {
    if (normalized.includes(key)) {
      return value;
    }
  }

  if (normalized.includes("late") || normalized.includes("delinquent")) {
    return AccountStatus.CHARGED_OFF;
  }

  return AccountStatus.UNKNOWN;
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value || value === "-" || value === "") return undefined;
  const cleaned = value.replace(/[$,]/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

function calculateConfidence(factors: {
  hasCreditorName: boolean;
  hasAccountId: boolean;
  hasBalance: boolean;
  hasStatus: boolean;
  hasDates: boolean;
  hasStructure: boolean;
}): number {
  let total = 0;
  if (factors.hasCreditorName) total += 25;
  if (factors.hasAccountId) total += 20;
  if (factors.hasBalance) total += 15;
  if (factors.hasStatus) total += 15;
  if (factors.hasDates) total += 15;
  if (factors.hasStructure) total += 10;
  return total;
}

/**
 * Analyze parsed accounts for potential FCRA violations and issues
 */
export function analyzeAccountsForIssues(accounts: ParsedAccountItem[]): ParsedAccountWithIssues[] {
  const analyzedAccounts: ParsedAccountWithIssues[] = [];

  // Group accounts by creditor name for cross-bureau analysis
  const groupedByCreditor = new Map<string, ParsedAccountItem[]>();
  for (const account of accounts) {
    const key = account.creditorName.toUpperCase();
    if (!groupedByCreditor.has(key)) {
      groupedByCreditor.set(key, []);
    }
    groupedByCreditor.get(key)!.push(account);
  }

  // Analyze each account
  for (const account of accounts) {
    const issues: AccountIssue[] = [];
    const creditorAccounts = groupedByCreditor.get(account.creditorName.toUpperCase()) || [];

    // 1. Check for derogatory status
    if (account.accountStatus === AccountStatus.CHARGED_OFF) {
      issues.push({
        code: "DEROGATORY_CHARGEOFF",
        severity: "HIGH",
        description: "Account shows charge-off status - verify accuracy and date",
        suggestedFlow: FlowType.ACCURACY,
        fcraSection: "15 U.S.C. § 1681e(b)",
      });
    }

    if (account.accountStatus === AccountStatus.COLLECTION) {
      issues.push({
        code: "COLLECTION_ACCOUNT",
        severity: "HIGH",
        description: "Collection account - request debt validation",
        suggestedFlow: FlowType.COLLECTION,
        fcraSection: "15 U.S.C. § 1692g",
      });
    }

    // 2. Check for late payment indicators
    if (account.paymentStatus && /late|30|60|90|120|delinquent/i.test(account.paymentStatus)) {
      issues.push({
        code: "LATE_PAYMENT",
        severity: "HIGH",
        description: `Late payment reported: ${account.paymentStatus}`,
        suggestedFlow: FlowType.ACCURACY,
        fcraSection: "15 U.S.C. § 1681e(b)",
      });
    }

    // 3. Check for past due amounts
    if (account.pastDue && account.pastDue > 0) {
      issues.push({
        code: "PAST_DUE_AMOUNT",
        severity: "HIGH",
        description: `Past due amount of $${account.pastDue.toLocaleString()} reported`,
        suggestedFlow: FlowType.ACCURACY,
        fcraSection: "15 U.S.C. § 1681e(b)",
      });
    }

    // 4. Cross-bureau inconsistencies
    if (creditorAccounts.length > 1) {
      // Check balance inconsistency
      const balances = creditorAccounts.map(a => a.balance).filter(b => b !== undefined);
      if (balances.length > 1) {
        const uniqueBalances = new Set(balances);
        if (uniqueBalances.size > 1) {
          issues.push({
            code: "BALANCE_INCONSISTENCY",
            severity: "MEDIUM",
            description: `Balance differs across bureaus: ${Array.from(uniqueBalances).map(b => `$${b?.toLocaleString()}`).join(", ")}`,
            suggestedFlow: FlowType.ACCURACY,
            fcraSection: "15 U.S.C. § 1681e(b)",
          });
        }
      }

      // Check status inconsistency
      const statuses = creditorAccounts.map(a => a.accountStatus);
      const uniqueStatuses = new Set(statuses);
      if (uniqueStatuses.size > 1) {
        issues.push({
          code: "STATUS_INCONSISTENCY",
          severity: "MEDIUM",
          description: `Account status differs across bureaus: ${Array.from(uniqueStatuses).join(", ")}`,
          suggestedFlow: FlowType.ACCURACY,
          fcraSection: "15 U.S.C. § 1681e(b)",
        });
      }

      // Check account number inconsistency
      const accountNums = creditorAccounts.map(a => a.maskedAccountId);
      const uniqueNums = new Set(accountNums);
      if (uniqueNums.size > 1) {
        issues.push({
          code: "ACCOUNT_NUMBER_INCONSISTENCY",
          severity: "MEDIUM",
          description: "Account number differs across bureaus - possible duplicate or error",
          suggestedFlow: FlowType.ACCURACY,
          fcraSection: "15 U.S.C. § 1681e(b)",
        });
      }

      // Check date opened inconsistency
      const dates = creditorAccounts.map(a => a.dateOpened).filter(d => d !== undefined);
      const uniqueDates = new Set(dates);
      if (uniqueDates.size > 1) {
        issues.push({
          code: "DATE_INCONSISTENCY",
          severity: "LOW",
          description: `Date opened differs across bureaus: ${Array.from(uniqueDates).join(", ")}`,
          suggestedFlow: FlowType.ACCURACY,
          fcraSection: "15 U.S.C. § 1681e(b)",
        });
      }
    }

    // 5. Check for outdated accounts (>7 years for most items)
    if (account.dateOpened) {
      const openedDate = parseDate(account.dateOpened);
      if (openedDate) {
        const yearsOld = (Date.now() - openedDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
        if (yearsOld > 7 && account.accountStatus !== AccountStatus.OPEN) {
          issues.push({
            code: "POTENTIALLY_OUTDATED",
            severity: "HIGH",
            description: `Account is ${Math.floor(yearsOld)} years old - may exceed 7-year reporting limit`,
            suggestedFlow: FlowType.ACCURACY,
            fcraSection: "15 U.S.C. § 1681c(a)",
          });
        }
      }
    }

    // 6. Check for missing required information
    if (!account.dateOpened) {
      issues.push({
        code: "MISSING_DATE_OPENED",
        severity: "LOW",
        description: "Date opened is missing - required for accurate reporting",
        suggestedFlow: FlowType.ACCURACY,
        fcraSection: "15 U.S.C. § 1681e(b)",
      });
    }

    // 7. Check for student loan specific issues
    if (/student|ed\s*loan|dept\s*ed|dpt\s*ed|aidv|nelnet|navient|mohela/i.test(account.creditorName)) {
      if (account.accountStatus === AccountStatus.CHARGED_OFF ||
          (account.pastDue && account.pastDue > 0)) {
        issues.push({
          code: "STUDENT_LOAN_DEROGATORY",
          severity: "HIGH",
          description: "Student loan with derogatory status - verify rehabilitation or consolidation status",
          suggestedFlow: FlowType.ACCURACY,
          fcraSection: "15 U.S.C. § 1681e(b)",
        });
      }
    }

    // 8. Check for medical debt issues (FCRA restrictions on medical debt)
    if (/medical|hospital|clinic|health|doctor|physician/i.test(account.creditorName)) {
      issues.push({
        code: "MEDICAL_DEBT",
        severity: "MEDIUM",
        description: "Medical debt - verify compliance with medical debt reporting restrictions",
        suggestedFlow: FlowType.COLLECTION,
        fcraSection: "15 U.S.C. § 1681a(m)",
      });
    }

    // Determine suggested flow based on issues
    let suggestedFlow: FlowType | undefined;
    if (issues.length > 0) {
      // Prioritize: Collection > Accuracy > Consent
      if (issues.some(i => i.suggestedFlow === FlowType.COLLECTION)) {
        suggestedFlow = FlowType.COLLECTION;
      } else if (issues.some(i => i.suggestedFlow === FlowType.ACCURACY)) {
        suggestedFlow = FlowType.ACCURACY;
      } else {
        suggestedFlow = issues[0].suggestedFlow;
      }
    }

    analyzedAccounts.push({
      ...account,
      issues,
      suggestedFlow,
      isDisputable: issues.length > 0,
    });
  }

  return analyzedAccounts;
}

/**
 * Get summary of issues found across all accounts
 */
export function getIssuesSummary(accounts: ParsedAccountWithIssues[]): {
  totalAccounts: number;
  disputableAccounts: number;
  highSeverityIssues: number;
  mediumSeverityIssues: number;
  lowSeverityIssues: number;
  issuesByType: Record<string, number>;
  accountsByFlow: Record<string, number>;
} {
  const summary = {
    totalAccounts: accounts.length,
    disputableAccounts: 0,
    highSeverityIssues: 0,
    mediumSeverityIssues: 0,
    lowSeverityIssues: 0,
    issuesByType: {} as Record<string, number>,
    accountsByFlow: {} as Record<string, number>,
  };

  for (const account of accounts) {
    if (account.isDisputable) {
      summary.disputableAccounts++;
    }

    if (account.suggestedFlow) {
      summary.accountsByFlow[account.suggestedFlow] =
        (summary.accountsByFlow[account.suggestedFlow] || 0) + 1;
    }

    for (const issue of account.issues) {
      if (issue.severity === "HIGH") summary.highSeverityIssues++;
      if (issue.severity === "MEDIUM") summary.mediumSeverityIssues++;
      if (issue.severity === "LOW") summary.lowSeverityIssues++;

      summary.issuesByType[issue.code] = (summary.issuesByType[issue.code] || 0) + 1;
    }
  }

  return summary;
}

/**
 * Parse a date string in MM/DD/YYYY format
 */
function parseDate(dateStr: string): Date | null {
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const [, month, day, year] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

// =============================================================================
// PERSONAL INFORMATION EXTRACTION
// Required for Round 1 disputes per AMELIA Doctrine
// =============================================================================

export interface PersonalInfoExtraction {
  previousNames: string[];
  previousAddresses: string[];
  hardInquiries: ParsedInquiry[];
}

export interface ParsedInquiry {
  creditorName: string;
  inquiryDate: string;
  cra: CRA;
}

/**
 * Extract all personal information from IdentityIQ report for Round 1 disputes.
 * This includes: previous names, previous addresses, and hard inquiries.
 */
export function extractPersonalInfo(
  fullText: string,
  currentName: string,
  currentAddress: string
): PersonalInfoExtraction {
  return {
    previousNames: extractPreviousNamesFromReport(fullText, currentName),
    previousAddresses: extractPreviousAddressesFromReport(fullText, currentAddress),
    hardInquiries: extractHardInquiriesFromReport(fullText),
  };
}

/**
 * Extract previous name variations from IdentityIQ report.
 * IdentityIQ format: "Also Known As: NAME1, NAME2, NAME3"
 */
function extractPreviousNamesFromReport(fullText: string, currentName: string): string[] {
  const names: string[] = [];
  const normalizedCurrent = currentName.toUpperCase().replace(/\s+/g, " ").trim();

  // Pattern 1: "Also Known As" section
  const akaPatterns = [
    /Also\s+Known\s+As:?\s*([^\n]+)/gi,
    /AKA:?\s*([^\n]+)/gi,
    /Aliases?:?\s*([^\n]+)/gi,
    /Other\s+Names?:?\s*([^\n]+)/gi,
  ];

  for (const pattern of akaPatterns) {
    const matches = fullText.matchAll(pattern);
    for (const match of matches) {
      const nameList = match[1]
        .split(/[,;]/)
        .map(n => n.trim().toUpperCase())
        .filter(n => n.length > 2 && n !== normalizedCurrent);
      names.push(...nameList);
    }
  }

  // Pattern 2: Name variations in personal section
  const personalPattern = /Personal\s+(?:Information|Info|Data)[\s\S]*?Names?:?\s*([A-Z][A-Za-z\s,]+)/gi;
  const personalMatches = fullText.matchAll(personalPattern);
  for (const match of personalMatches) {
    const nameList = match[1]
      .split(/[,;]/)
      .map(n => n.trim().toUpperCase())
      .filter(n => n.length > 2 && n !== normalizedCurrent);
    names.push(...nameList);
  }

  // Deduplicate and clean
  const uniqueNames = [...new Set(names)];
  return uniqueNames.filter(n => {
    // Filter out obvious non-names
    if (/^\d+$/.test(n)) return false;
    if (n.length < 3) return false;
    if (n === normalizedCurrent) return false;
    return true;
  });
}

/**
 * Extract previous addresses from IdentityIQ report.
 */
function extractPreviousAddressesFromReport(fullText: string, currentAddress: string): string[] {
  const addresses: string[] = [];
  const normalizedCurrent = currentAddress.toUpperCase().replace(/\s+/g, " ").trim();

  // Pattern: Full address with street, city, state, zip
  const addressPatterns = [
    // Standard format: 123 Main St, City, ST 12345
    /(\d+\s+[A-Za-z0-9\s.,]+(?:ST|STREET|AVE|AVENUE|RD|ROAD|DR|DRIVE|LN|LANE|CT|COURT|BLVD|BOULEVARD|WAY|CIR|CIRCLE|PL|PLACE|TRL|TRAIL)[A-Za-z.,]*\s*(?:#?\s*\d+)?[,\s]+[A-Za-z\s]+[,\s]+[A-Z]{2}\s*\d{5}(?:-\d{4})?)/gi,
    // Simplified: Street City ST ZIP
    /(\d+\s+\w+\s+\w+[,\s]+[A-Za-z\s]+[,\s]+[A-Z]{2}\s+\d{5})/gi,
  ];

  for (const pattern of addressPatterns) {
    const matches = fullText.matchAll(pattern);
    for (const match of matches) {
      const addr = match[1].trim().toUpperCase().replace(/\s+/g, " ");
      if (addr.length > 15 && !addr.includes(normalizedCurrent.substring(0, 20))) {
        addresses.push(addr);
      }
    }
  }

  // Pattern for address history section
  const historyPattern = /(?:Address(?:es)?|Residence)\s+(?:History|Information)[\s\S]*?((?:\d+\s+[^\n]+\n?)+)/gi;
  const historyMatches = fullText.matchAll(historyPattern);
  for (const match of historyMatches) {
    const block = match[1];
    const lines = block.split("\n");
    for (const line of lines) {
      const normalized = line.trim().toUpperCase();
      // Must have numbers (street number or zip)
      if (/\d{5}/.test(normalized) && normalized.length > 15) {
        if (!normalized.includes(normalizedCurrent.substring(0, 20))) {
          addresses.push(normalized);
        }
      }
    }
  }

  // Deduplicate
  return [...new Set(addresses)].slice(0, 10); // Max 10 addresses
}

/**
 * Extract hard inquiries from IdentityIQ report.
 */
function extractHardInquiriesFromReport(fullText: string): ParsedInquiry[] {
  const inquiries: ParsedInquiry[] = [];
  const cras: CRA[] = [CRA.TRANSUNION, CRA.EXPERIAN, CRA.EQUIFAX];

  // Find inquiry sections for each CRA
  for (const cra of cras) {
    const craName = cra.charAt(0) + cra.slice(1).toLowerCase();

    // Pattern: Look for inquiries section per CRA
    const sectionPatterns = [
      new RegExp(`${craName}[\\s\\S]*?(?:Hard\\s+)?Inquir(?:y|ies)[:\\s]*([\\s\\S]*?)(?=(?:Experian|Equifax|TransUnion|Soft|Public|Accounts|$))`, "gi"),
      new RegExp(`Inquir(?:y|ies)[\\s\\S]*?${craName}[:\\s]*([\\s\\S]*?)(?=(?:Experian|Equifax|TransUnion|Soft|Public|$))`, "gi"),
    ];

    for (const pattern of sectionPatterns) {
      const sectionMatches = fullText.matchAll(pattern);

      for (const section of sectionMatches) {
        const sectionText = section[1];

        // Extract individual inquiries: "CREDITOR NAME MM/DD/YYYY"
        const inquiryPattern = /([A-Z][A-Z0-9\s\/&'.,-]{2,40})\s+(\d{2}\/\d{2}\/\d{4})/g;
        const lineMatches = sectionText.matchAll(inquiryPattern);

        for (const match of lineMatches) {
          const creditorName = match[1].trim().toUpperCase();
          const inquiryDate = match[2];

          // Filter out false positives
          if (
            creditorName.length > 2 &&
            !creditorName.includes("TRANSUNION") &&
            !creditorName.includes("EXPERIAN") &&
            !creditorName.includes("EQUIFAX") &&
            !creditorName.includes("BALANCE") &&
            !creditorName.includes("ACCOUNT")
          ) {
            inquiries.push({
              creditorName,
              inquiryDate,
              cra,
            });
          }
        }
      }
    }
  }

  // Also look for general inquiry section
  const generalPattern = /(?:Hard\s+)?Inquir(?:y|ies)[\s\S]*?TransUnion\s+Experian\s+Equifax[\s\S]*?((?:[A-Z].*?\d{2}\/\d{2}\/\d{4}[\s\S]*?)+?)(?=(?:Soft|Public|$))/gi;
  const generalMatches = fullText.matchAll(generalPattern);

  for (const match of generalMatches) {
    const block = match[1];
    // Parse triple-column inquiries
    const linePattern = /([A-Z][A-Z0-9\s\/&'.,-]+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})?\s*(\d{2}\/\d{2}\/\d{4})?/g;
    const lines = block.matchAll(linePattern);

    for (const line of lines) {
      const creditorName = line[1].trim().toUpperCase();
      const dates = [line[2], line[3], line[4]].filter(d => d);

      // Assign to CRAs based on column position
      if (dates[0]) {
        inquiries.push({ creditorName, inquiryDate: dates[0], cra: CRA.TRANSUNION });
      }
      if (dates[1]) {
        inquiries.push({ creditorName, inquiryDate: dates[1], cra: CRA.EXPERIAN });
      }
      if (dates[2]) {
        inquiries.push({ creditorName, inquiryDate: dates[2], cra: CRA.EQUIFAX });
      }
    }
  }

  // Deduplicate by creditor+date+cra
  const seen = new Set<string>();
  return inquiries.filter(inq => {
    const key = `${inq.creditorName}|${inq.inquiryDate}|${inq.cra}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export { FIELD_PATTERNS, extractPreviousNamesFromReport, extractPreviousAddressesFromReport, extractHardInquiriesFromReport };
