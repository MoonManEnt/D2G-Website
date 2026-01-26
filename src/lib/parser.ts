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
  PaymentHistory,
  PaymentHistoryEntry,
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
// These patterns handle the three-column format: TransUnion | Experian | Equifax
const FIELD_PATTERNS = {
  // Basic identifiers
  accountNumber: /Account\s*#:\s*(\S+)\s+(\S+)\s+(\S+)/,
  accountType: /Account\s+Type:\s*([A-Za-z\s]+?)\s{2,}([A-Za-z\s]+?)\s{2,}([A-Za-z\s]+?)(?:\s*$|\s+Account)/m,
  accountTypeDetail: /Account\s+Type\s*-\s*Detail:\s*([A-Za-z\s]+?)\s{2,}([A-Za-z\s]+?)\s{2,}([A-Za-z\s]+?)(?:\s*$|\s+Bureau)/m,
  bureauCode: /Bureau\s+Code:\s*([A-Za-z\s]+?)\s{2,}([A-Za-z\s]+?)\s{2,}([A-Za-z\s]+?)(?:\s*$|\s+Account)/m,
  accountStatus: /Account\s+Status:\s*([A-Za-z]+)\s+([A-Za-z]+)\s+([A-Za-z]+)/,

  // Financial fields
  monthlyPayment: /Monthly\s+Payment:\s*\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)/,
  balance: /Balance:\s*\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)/,
  numberOfMonths: /No\.\s*of\s+Months\s*\(terms\):\s*(\d+)\s+(\d+)\s+(\d+)/,
  highCredit: /High\s+Credit:\s*\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)/,
  creditLimit: /Credit\s+Limit:\s*\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)/,
  pastDue: /Past\s+Due:\s*\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)/,

  // Status and dates
  paymentStatus: /Payment\s+Status:\s*([A-Za-z0-9\/\s]+?)\s{2,}([A-Za-z0-9\/\s]+?)\s{2,}([A-Za-z0-9\/\s]+?)(?:\s*$|\s+Last)/m,
  lastReported: /Last\s+Reported:\s*(\d{2}\/\d{2}\/\d{4}|\-)\s+(\d{2}\/\d{2}\/\d{4}|\-)\s+(\d{2}\/\d{2}\/\d{4}|\-)/,
  dateOpened: /Date\s+Opened:\s*(\d{2}\/\d{2}\/\d{4}|\-)\s+(\d{2}\/\d{2}\/\d{4}|\-)\s+(\d{2}\/\d{2}\/\d{4}|\-)/,
  dateLastActive: /Date\s+Last\s+Active:\s*(\d{2}\/\d{2}\/\d{4}|\-)\s+(\d{2}\/\d{2}\/\d{4}|\-)\s+(\d{2}\/\d{2}\/\d{4}|\-)/,
  dateOfLastPayment: /Date\s+of\s+Last\s+Payment:\s*(\d{2}\/\d{2}\/\d{4}|\-)\s+(\d{2}\/\d{2}\/\d{4}|\-)\s+(\d{2}\/\d{2}\/\d{4}|\-)/,

  // Comments (can be multi-line, so we handle separately)
  comments: /Comments:\s*([^\n]+?)(?:\s{2,}([^\n]+?))?(?:\s{2,}([^\n]+?))?(?:\s*$|\s+Date)/m,
};

// Payment history status codes
const PAYMENT_STATUS_CODES: Record<string, { isLate: boolean; daysLate: number; isChargeoff: boolean }> = {
  "OK": { isLate: false, daysLate: 0, isChargeoff: false },
  "30": { isLate: true, daysLate: 30, isChargeoff: false },
  "60": { isLate: true, daysLate: 60, isChargeoff: false },
  "90": { isLate: true, daysLate: 90, isChargeoff: false },
  "120": { isLate: true, daysLate: 120, isChargeoff: false },
  "CO": { isLate: false, daysLate: 0, isChargeoff: true },
  "": { isLate: false, daysLate: 0, isChargeoff: false }, // Missing data
};

// Month abbreviations for payment history parsing
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Parse two-year payment history from account block.
 * IdentityIQ format has the payment history grid like:
 *
 * Two-Year Payment History
 *           Dec Nov Oct Sep Aug Jul Jun May Apr Mar Feb Jan Dec Nov Oct Sep Aug Jul Jun May Apr Mar Feb Jan
 * Year   25  25  25  25  25  25  25  25  25  24  24  24  24  24  24  24  24  24  24  24  24  24  24  24  24
 * Status OK  OK  OK  OK  90  60  OK  OK  OK  OK  OK  OK  OK  OK  OK  OK  OK  OK  OK  OK  OK  OK  OK  OK
 */
function parsePaymentHistory(blockText: string, craIndex: number): PaymentHistory | undefined {
  const result: PaymentHistory = {
    entries: [],
    hasLatePayments: false,
    hasChargeoffs: false,
    hasMissingMonths: false,
    totalLateCount: 0,
    totalChargeoffCount: 0,
    totalMissingCount: 0,
    lateMonths: [],
    chargeoffMonths: [],
    missingMonths: [],
  };

  // Look for Two-Year Payment History section
  const historyMatch = blockText.match(/Two[\s-]*Year\s+Payment\s+History[\s\S]*?(?=(?:Account|$))/i);
  if (!historyMatch) return undefined;

  const historyBlock = historyMatch[0];

  // Extract month headers - they appear in a row like: Dec Nov Oct Sep Aug Jul...
  const monthHeaderMatch = historyBlock.match(/(?:Dec|Nov|Oct|Sep|Aug|Jul|Jun|May|Apr|Mar|Feb|Jan)(?:\s+(?:Dec|Nov|Oct|Sep|Aug|Jul|Jun|May|Apr|Mar|Feb|Jan))+/gi);
  if (!monthHeaderMatch) return undefined;

  const monthHeaders = monthHeaderMatch[0].split(/\s+/).filter(m => MONTHS.includes(m));

  // Extract year row - numbers like: 25 25 25 25 24 24 24...
  const yearRowMatch = historyBlock.match(/(?:Year\s+)?(\d{2}(?:\s+\d{2})+)/);
  let years: string[] = [];
  if (yearRowMatch) {
    years = yearRowMatch[1].split(/\s+/).filter(y => /^\d{2}$/.test(y));
  }

  // Extract status rows - Each CRA has its own row
  // Look for patterns like: TransUnion OK OK 30 60 OK OK...
  // Or the three-column format after the year row

  // Pattern for IdentityIQ three-column format
  const statusPatterns = [
    // CRA-labeled rows
    /TransUnion\s+((?:OK|30|60|90|120|CO|[\-\s])+)/gi,
    /Experian\s+((?:OK|30|60|90|120|CO|[\-\s])+)/gi,
    /Equifax\s+((?:OK|30|60|90|120|CO|[\-\s])+)/gi,
    // Generic status rows (when CRAs aren't labeled individually)
    /(?:^|\n)\s*((?:OK|30|60|90|120|CO)(?:\s+(?:OK|30|60|90|120|CO|\-))+)/gm,
  ];

  // Try to find status row for this CRA
  let statusValues: string[] = [];

  // First try CRA-specific pattern
  const craPattern = statusPatterns[craIndex];
  const craMatch = historyBlock.match(craPattern);
  if (craMatch && craMatch[1]) {
    statusValues = craMatch[1].trim().split(/\s+/).filter(s => s && s !== "-");
  }

  // If no CRA-specific match, try to find rows of statuses
  if (statusValues.length === 0) {
    const allStatusMatches = historyBlock.matchAll(/(?:^|\s)((?:OK|30|60|90|120|CO)(?:\s+(?:OK|30|60|90|120|CO|\-)){5,})/gm);
    const statusRows: string[][] = [];

    for (const match of allStatusMatches) {
      const row = match[1].trim().split(/\s+/).filter(s => s && s !== "-");
      if (row.length >= 6) {
        statusRows.push(row);
      }
    }

    // If we have multiple rows, pick the one for this CRA index
    if (statusRows.length > craIndex) {
      statusValues = statusRows[craIndex];
    } else if (statusRows.length === 1) {
      // Single row, all CRAs share the same history
      statusValues = statusRows[0];
    }
  }

  // Build entries from the parsed data
  const numMonths = Math.min(monthHeaders.length, statusValues.length, years.length || 24);

  for (let i = 0; i < numMonths; i++) {
    const month = monthHeaders[i] || "";
    const year = years[i] || "";
    const status = statusValues[i] || "";

    const statusInfo = PAYMENT_STATUS_CODES[status] || PAYMENT_STATUS_CODES[""];
    const isMissing = status === "" || status === "-";

    const entry: PaymentHistoryEntry = {
      month,
      year,
      status,
      isLate: statusInfo.isLate,
      daysLate: statusInfo.daysLate || undefined,
      isChargeoff: statusInfo.isChargeoff,
      isMissing,
    };

    result.entries.push(entry);

    // Update summary counts
    if (statusInfo.isLate) {
      result.hasLatePayments = true;
      result.totalLateCount++;
      result.lateMonths.push(`${month} ${year}`);
    }
    if (statusInfo.isChargeoff) {
      result.hasChargeoffs = true;
      result.totalChargeoffCount++;
      result.chargeoffMonths.push(`${month} ${year}`);
    }
    if (isMissing) {
      result.hasMissingMonths = true;
      result.totalMissingCount++;
      result.missingMonths.push(`${month} ${year}`);
    }
  }

  // Only return if we actually found data
  return result.entries.length > 0 ? result : undefined;
}

// Status mapping - Expanded to capture ALL negative/derogatory accounts
const STATUS_MAP: Record<string, AccountStatus> = {
  // Positive statuses
  "open": AccountStatus.OPEN,
  "current": AccountStatus.OPEN,
  "active": AccountStatus.OPEN,
  "paid": AccountStatus.PAID,
  "paid in full": AccountStatus.PAID,
  "closed": AccountStatus.CLOSED,
  "closed/paid": AccountStatus.PAID,

  // CHARGEOFF variations - ALL map to CHARGED_OFF
  "charged off": AccountStatus.CHARGED_OFF,
  "chargeoff": AccountStatus.CHARGED_OFF,
  "charge off": AccountStatus.CHARGED_OFF,
  "charge-off": AccountStatus.CHARGED_OFF,
  "chargedoff": AccountStatus.CHARGED_OFF,
  "charged-off": AccountStatus.CHARGED_OFF,
  "chargeoff/collection": AccountStatus.CHARGED_OFF,
  "charged off/collection": AccountStatus.CHARGED_OFF,
  "profit and loss writeoff": AccountStatus.CHARGED_OFF,
  "profit and loss": AccountStatus.CHARGED_OFF,
  "write off": AccountStatus.CHARGED_OFF,
  "writeoff": AccountStatus.CHARGED_OFF,
  "written off": AccountStatus.CHARGED_OFF,

  // Collection variations
  "collection": AccountStatus.COLLECTION,
  "collections": AccountStatus.COLLECTION,
  "in collection": AccountStatus.COLLECTION,
  "placed for collection": AccountStatus.COLLECTION,
  "transferred to collection": AccountStatus.COLLECTION,
  "sold to collection": AccountStatus.COLLECTION,

  // Derogatory statuses (treated as CHARGED_OFF for COLLECTION flow)
  "derogatory": AccountStatus.CHARGED_OFF,
  "delinquent": AccountStatus.CHARGED_OFF,
  "seriously delinquent": AccountStatus.CHARGED_OFF,
  "seriously past due": AccountStatus.CHARGED_OFF,
  "past due": AccountStatus.CHARGED_OFF,
  "overdue": AccountStatus.CHARGED_OFF,
  "late": AccountStatus.CHARGED_OFF,
  "default": AccountStatus.CHARGED_OFF,
  "defaulted": AccountStatus.CHARGED_OFF,
  "bad debt": AccountStatus.CHARGED_OFF,
  "unpaid": AccountStatus.CHARGED_OFF,
  "settled": AccountStatus.CHARGED_OFF,
  "settled for less": AccountStatus.CHARGED_OFF,
  "repo": AccountStatus.CHARGED_OFF,
  "repossession": AccountStatus.CHARGED_OFF,
  "foreclosure": AccountStatus.CHARGED_OFF,
  "bankruptcy": AccountStatus.CHARGED_OFF,
  "included in bankruptcy": AccountStatus.CHARGED_OFF,
};

// Credit score extraction result
export interface ExtractedCreditScores {
  transunion: number | null;
  equifax: number | null;
  experian: number | null;
}

/**
 * Extract credit scores from the report text.
 * IdentityIQ reports have various formats for displaying scores.
 * This function tries multiple patterns to extract scores reliably.
 */
export function extractCreditScores(text: string): ExtractedCreditScores {
  const scores: ExtractedCreditScores = {
    transunion: null,
    equifax: null,
    experian: null,
  };

  // Helper to validate and extract a score
  const extractScore = (match: RegExpMatchArray | null, group: number = 1): number | null => {
    if (match && match[group]) {
      const score = parseInt(match[group], 10);
      if (score >= 300 && score <= 850) {
        return score;
      }
    }
    return null;
  };

  // TransUnion patterns (from most specific to least)
  const tuPatterns = [
    /TransUnion[®™]?\s*[:\-]?\s*(\d{3})/i,
    /TransUnion\s+(?:VantageScore|Vantage\s*Score|FICO)[\s\d.®™]*?(\d{3})/i,
    /TransUnion\s+Score[:\s]+(\d{3})/i,
    /TransUnion\s+Credit\s+Score[:\s]+(\d{3})/i,
    /\bTU[:\s]+(\d{3})\b/i,
    /TransUnion[\s\S]{0,50}?(\d{3})(?=\s|$|\n)/i,
  ];

  // Equifax patterns
  const eqPatterns = [
    /Equifax[®™]?\s*[:\-]?\s*(\d{3})/i,
    /Equifax\s+(?:VantageScore|Vantage\s*Score|FICO)[\s\d.®™]*?(\d{3})/i,
    /Equifax\s+Score[:\s]+(\d{3})/i,
    /Equifax\s+Credit\s+Score[:\s]+(\d{3})/i,
    /\bEQ[:\s]+(\d{3})\b/i,
    /Equifax[\s\S]{0,50}?(\d{3})(?=\s|$|\n)/i,
  ];

  // Experian patterns
  const exPatterns = [
    /Experian[®™]?\s*[:\-]?\s*(\d{3})/i,
    /Experian\s+(?:VantageScore|Vantage\s*Score|FICO)[\s\d.®™]*?(\d{3})/i,
    /Experian\s+Score[:\s]+(\d{3})/i,
    /Experian\s+Credit\s+Score[:\s]+(\d{3})/i,
    /\bEX[:\s]+(\d{3})\b/i,
    /Experian[\s\S]{0,50}?(\d{3})(?=\s|$|\n)/i,
  ];

  // Try each TransUnion pattern
  for (const pattern of tuPatterns) {
    const score = extractScore(text.match(pattern));
    if (score) {
      scores.transunion = score;
      break;
    }
  }

  // Try each Equifax pattern
  for (const pattern of eqPatterns) {
    const score = extractScore(text.match(pattern));
    if (score) {
      scores.equifax = score;
      break;
    }
  }

  // Try each Experian pattern
  for (const pattern of exPatterns) {
    const score = extractScore(text.match(pattern));
    if (score) {
      scores.experian = score;
      break;
    }
  }

  // Try score summary table pattern if individual patterns didn't work
  if (!scores.transunion && !scores.equifax && !scores.experian) {
    // Pattern: Three 3-digit scores in sequence (common in summary tables)
    // IdentityIQ often shows: TransUnion Experian Equifax header with scores below
    const tablePatterns = [
      /Credit\s+Score[s]?\s*(?:Summary)?[\s\S]*?(\d{3})\s+(\d{3})\s+(\d{3})/i,
      /Score[s]?\s*Summary[\s\S]*?(\d{3})\s+(\d{3})\s+(\d{3})/i,
      /VantageScore[\s\S]*?(\d{3})\s+(\d{3})\s+(\d{3})/i,
    ];

    for (const pattern of tablePatterns) {
      const tableMatch = text.match(pattern);
      if (tableMatch) {
        const s1 = parseInt(tableMatch[1], 10);
        const s2 = parseInt(tableMatch[2], 10);
        const s3 = parseInt(tableMatch[3], 10);
        // Typically order is: TransUnion, Experian, Equifax in IdentityIQ
        if (s1 >= 300 && s1 <= 850) scores.transunion = s1;
        if (s2 >= 300 && s2 <= 850) scores.experian = s2;
        if (s3 >= 300 && s3 <= 850) scores.equifax = s3;
        break;
      }
    }
  }

  // Last resort: Look for "Your Score" or "Credit Score" followed by 3-digit number
  // and use context to determine bureau
  if (!scores.transunion && !scores.equifax && !scores.experian) {
    // Find all 3-digit numbers that could be scores
    const allScores = text.match(/\b([3-8]\d{2})\b/g);
    if (allScores) {
      const validScores = allScores
        .map(s => parseInt(s, 10))
        .filter(s => s >= 300 && s <= 850);

      // If we found exactly 3 valid scores, assign them
      if (validScores.length >= 3) {
        // Check if TransUnion, Experian, Equifax appear in order in the text
        const tuPos = text.search(/TransUnion/i);
        const exPos = text.search(/Experian/i);
        const eqPos = text.search(/Equifax/i);

        if (tuPos >= 0 && exPos >= 0 && eqPos >= 0) {
          // Assign first 3 unique valid scores
          const uniqueScores = [...new Set(validScores)].slice(0, 3);
          if (uniqueScores.length >= 3) {
            scores.transunion = uniqueScores[0];
            scores.experian = uniqueScores[1];
            scores.equifax = uniqueScores[2];
          }
        }
      }
    }
  }

  console.log(`[PARSER] Score extraction result: TU=${scores.transunion}, EQ=${scores.equifax}, EX=${scores.experian}`);

  return scores;
}

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

  // Extract ALL fields from the three-column format
  const accountNumbers = extractTripleValues(blockText, FIELD_PATTERNS.accountNumber);
  const accountTypes = extractTripleValues(blockText, FIELD_PATTERNS.accountType);
  const accountTypeDetails = extractTripleValues(blockText, FIELD_PATTERNS.accountTypeDetail);
  const bureauCodes = extractTripleValues(blockText, FIELD_PATTERNS.bureauCode);
  const accountStatuses = extractTripleValues(blockText, FIELD_PATTERNS.accountStatus);
  const balances = extractTripleValues(blockText, FIELD_PATTERNS.balance);
  const pastDues = extractTripleValues(blockText, FIELD_PATTERNS.pastDue);
  const creditLimits = extractTripleValues(blockText, FIELD_PATTERNS.creditLimit);
  const highCredits = extractTripleValues(blockText, FIELD_PATTERNS.highCredit);
  const monthlyPayments = extractTripleValues(blockText, FIELD_PATTERNS.monthlyPayment);
  const numberOfMonths = extractTripleValues(blockText, FIELD_PATTERNS.numberOfMonths);
  const datesOpened = extractTripleValues(blockText, FIELD_PATTERNS.dateOpened);
  const datesLastActive = extractTripleValues(blockText, FIELD_PATTERNS.dateLastActive);
  const datesOfLastPayment = extractTripleValues(blockText, FIELD_PATTERNS.dateOfLastPayment);
  const paymentStatuses = extractTripleValues(blockText, FIELD_PATTERNS.paymentStatus);
  const lastReportedDates = extractTripleValues(blockText, FIELD_PATTERNS.lastReported);
  const comments = extractTripleValues(blockText, FIELD_PATTERNS.comments);

  // Create account for each CRA that has data
  for (let i = 0; i < cras.length; i++) {
    const accountNum = accountNumbers[i];

    // Skip if no account number for this CRA (account doesn't exist at this bureau)
    if (!accountNum || accountNum === "-" || accountNum === "$0.00") {
      continue;
    }

    const balance = parseNumber(balances[i]);
    const pastDue = parseNumber(pastDues[i]);
    const creditLimit = parseNumber(creditLimits[i]);
    const highBalance = parseNumber(highCredits[i]);
    const monthlyPayment = parseNumber(monthlyPayments[i]);
    const numMonths = parseNumber(numberOfMonths[i]);
    const status = mapAccountStatus(accountStatuses[i]);

    // Parse payment history for this CRA
    const paymentHistory = parsePaymentHistory(blockText, i);

    // Calculate confidence - more fields = higher confidence
    const confidence = calculateConfidence({
      hasCreditorName: creditorName.length > 2,
      hasAccountId: accountNum.length > 3,
      hasBalance: balance !== undefined,
      hasStatus: !!accountStatuses[i],
      hasDates: !!datesOpened[i] || !!lastReportedDates[i] || !!datesLastActive[i],
      hasStructure: blockText.includes("Account #:") && blockText.includes("Balance:"),
    });

    accounts.push({
      creditorName: cleanCreditorName(creditorName),
      maskedAccountId: cleanAccountId(accountNum),
      cra: cras[i],
      // Basic account info
      accountType: accountTypes[i] || undefined,
      accountTypeDetail: accountTypeDetails[i] || undefined,
      bureauCode: bureauCodes[i] || undefined,
      accountStatus: status,
      // Financial fields
      balance,
      pastDue,
      creditLimit,
      highBalance,
      monthlyPayment,
      numberOfMonths: numMonths,
      // Date fields
      dateOpened: cleanDateField(datesOpened[i]),
      dateReported: cleanDateField(lastReportedDates[i]),
      lastActivityDate: cleanDateField(datesLastActive[i]),
      dateOfLastPayment: cleanDateField(datesOfLastPayment[i]),
      // Status fields
      paymentStatus: paymentStatuses[i] || undefined,
      comments: comments[i] || undefined,
      // Payment history
      paymentHistory,
      // Metadata
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
 * Clean date field - return undefined for invalid/missing values
 */
function cleanDateField(dateStr: string | undefined): string | undefined {
  if (!dateStr || dateStr === "-" || dateStr.trim() === "") {
    return undefined;
  }
  return dateStr.trim();
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
    // AMELIA DOCTRINE: CHARGEOFF = COLLECTION FLOW (not Accuracy)
    // Chargeoffs are essentially collection accounts and should be disputed under FDCPA/Collection flow
    if (account.accountStatus === AccountStatus.CHARGED_OFF) {
      issues.push({
        code: "DEROGATORY_CHARGEOFF",
        severity: "HIGH",
        description: "Account shows charge-off status - request debt validation and verify reporting accuracy",
        suggestedFlow: FlowType.COLLECTION,
        fcraSection: "15 U.S.C. § 1692g",
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

    // 2. Check for late payment indicators in payment status
    if (account.paymentStatus && /late|30|60|90|120|delinquent/i.test(account.paymentStatus)) {
      issues.push({
        code: "LATE_PAYMENT_STATUS",
        severity: "HIGH",
        description: `Late payment reported in status: ${account.paymentStatus}`,
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

    // ============================================================================
    // 4. PAYMENT HISTORY ANALYSIS - Late marks and missing "OK" detection
    // ============================================================================
    if (account.paymentHistory) {
      const ph = account.paymentHistory;

      // 4a. Late payment marks in payment history
      if (ph.hasLatePayments) {
        const lateSummary = ph.lateMonths.slice(0, 5).join(", ");
        const additionalCount = ph.lateMonths.length > 5 ? ` and ${ph.lateMonths.length - 5} more` : "";
        issues.push({
          code: "PAYMENT_HISTORY_LATE_MARKS",
          severity: "HIGH",
          description: `Payment history shows ${ph.totalLateCount} late payment(s): ${lateSummary}${additionalCount}`,
          suggestedFlow: FlowType.ACCURACY,
          fcraSection: "15 U.S.C. § 1681e(b)",
        });
      }

      // 4b. Chargeoff marks in payment history
      if (ph.hasChargeoffs) {
        const coSummary = ph.chargeoffMonths.slice(0, 5).join(", ");
        issues.push({
          code: "PAYMENT_HISTORY_CHARGEOFF_MARKS",
          severity: "HIGH",
          description: `Payment history shows ${ph.totalChargeoffCount} charge-off mark(s): ${coSummary}`,
          suggestedFlow: FlowType.COLLECTION,
          fcraSection: "15 U.S.C. § 1692g",
        });
      }

      // 4c. MISSING "OK" MARKS - gaps in payment history
      // This is a key dispute point: if there's no data for months, CRA cannot verify
      if (ph.hasMissingMonths && ph.totalMissingCount > 0) {
        const missingSummary = ph.missingMonths.slice(0, 5).join(", ");
        const additionalCount = ph.missingMonths.length > 5 ? ` and ${ph.missingMonths.length - 5} more` : "";
        issues.push({
          code: "PAYMENT_HISTORY_MISSING_DATA",
          severity: "MEDIUM",
          description: `Payment history has ${ph.totalMissingCount} missing month(s) without "OK" status: ${missingSummary}${additionalCount}. CRA cannot verify accuracy of incomplete data.`,
          suggestedFlow: FlowType.ACCURACY,
          fcraSection: "15 U.S.C. § 1681e(b)",
        });
      }
    }

    // ============================================================================
    // 5. CROSS-BUREAU INCONSISTENCIES
    // ============================================================================
    if (creditorAccounts.length > 1) {
      // 5a. Balance inconsistency
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

      // 5b. Status inconsistency
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

      // 5c. Account number inconsistency
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

      // 5d. Date opened inconsistency
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

      // ============================================================================
      // 5e. CROSS-BUREAU PAYMENT HISTORY COMPARISON
      // ============================================================================
      const accountsWithHistory = creditorAccounts.filter(a => a.paymentHistory && a.paymentHistory.entries.length > 0);
      if (accountsWithHistory.length > 1) {
        // Compare payment history across bureaus
        const paymentHistoryDiscrepancies = comparePaymentHistoriesAcrossBureaus(accountsWithHistory);
        for (const discrepancy of paymentHistoryDiscrepancies) {
          issues.push({
            code: "PAYMENT_HISTORY_CROSS_BUREAU_DISCREPANCY",
            severity: "HIGH",
            description: discrepancy,
            suggestedFlow: FlowType.ACCURACY,
            fcraSection: "15 U.S.C. § 1681e(b)",
          });
        }
      }
    }

    // ============================================================================
    // 6. MISSING BUREAU DETECTION
    // If account exists at some bureaus but not all three, it's a potential issue
    // ============================================================================
    if (creditorAccounts.length > 0 && creditorAccounts.length < 3) {
      const presentBureaus = creditorAccounts.map(a => a.cra);
      const allBureaus: CRA[] = [CRA.TRANSUNION, CRA.EXPERIAN, CRA.EQUIFAX];
      const missingBureaus = allBureaus.filter(b => !presentBureaus.includes(b));

      if (missingBureaus.length > 0) {
        issues.push({
          code: "MISSING_FROM_BUREAUS",
          severity: "MEDIUM",
          description: `Account not reported to: ${missingBureaus.join(", ")}. Bureau divergence may indicate reporting error.`,
          suggestedFlow: FlowType.ACCURACY,
          fcraSection: "15 U.S.C. § 1681e(b)",
        });
      }
    }

    // 7. Check for outdated accounts (>7 years for most items)
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

    // 8. Check for missing required information
    if (!account.dateOpened) {
      issues.push({
        code: "MISSING_DATE_OPENED",
        severity: "LOW",
        description: "Date opened is missing - required for accurate reporting",
        suggestedFlow: FlowType.ACCURACY,
        fcraSection: "15 U.S.C. § 1681e(b)",
      });
    }

    // 9. Check for student loan specific issues
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

    // 10. Check for medical debt issues (FCRA restrictions on medical debt)
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
 * Compare payment histories across bureaus to find discrepancies.
 * This catches cases where one bureau shows late but others show OK.
 */
function comparePaymentHistoriesAcrossBureaus(accounts: ParsedAccountItem[]): string[] {
  const discrepancies: string[] = [];

  // Build a map of month/year -> status for each CRA
  const historyByCRA = new Map<CRA, Map<string, string>>();

  for (const account of accounts) {
    if (!account.paymentHistory) continue;
    const statusMap = new Map<string, string>();
    for (const entry of account.paymentHistory.entries) {
      const key = `${entry.month} ${entry.year}`;
      statusMap.set(key, entry.status);
    }
    historyByCRA.set(account.cra, statusMap);
  }

  // Compare histories across all CRAs
  const allMonths = new Set<string>();
  for (const statusMap of historyByCRA.values()) {
    for (const month of statusMap.keys()) {
      allMonths.add(month);
    }
  }

  for (const monthKey of allMonths) {
    const statusesForMonth: { cra: CRA; status: string }[] = [];

    for (const [cra, statusMap] of historyByCRA.entries()) {
      const status = statusMap.get(monthKey);
      if (status && status !== "") {
        statusesForMonth.push({ cra, status });
      }
    }

    if (statusesForMonth.length < 2) continue;

    // Check for discrepancies
    const uniqueStatuses = new Set(statusesForMonth.map(s => s.status));
    if (uniqueStatuses.size > 1) {
      // There's a discrepancy for this month
      const details = statusesForMonth
        .map(s => `${s.cra}: ${s.status}`)
        .join(", ");

      // Determine severity - late vs OK is more serious
      const hasLate = statusesForMonth.some(s => ["30", "60", "90", "120", "CO"].includes(s.status));
      const hasOK = statusesForMonth.some(s => s.status === "OK");

      if (hasLate && hasOK) {
        discrepancies.push(
          `Payment history discrepancy for ${monthKey}: ${details}. One bureau shows late/derogatory while another shows on-time.`
        );
      }
    }
  }

  return discrepancies;
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
