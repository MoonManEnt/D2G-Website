/**
 * Dispute2Go PDF Parsing Engine
 * 
 * Parses IdentityIQ credit reports using text extraction.
 * No OCR in MVP - text-layer only parsing.
 * 
 * IdentityIQ Format (analyzed from sample):
 * - Multi-column layout: TransUnion | Experian | Equifax
 * - Account blocks starting with creditor name headers (ALL CAPS)
 * - Structured fields: Account #, Account Type, Balance, Past Due, etc.
 * - Two-Year payment history tables
 * 
 * Implements:
 * - Recommendation #1: Clear error for non-text PDFs
 * - Recommendation #2: Fingerprint matching support
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
} from "@/types";
import { generateFingerprint } from "./utils";

// ============================================================================
// PARSING CONFIGURATION - Based on actual IdentityIQ format
// ============================================================================

const PARSING_CONFIG = {
  // Minimum characters per page to consider it has text layer
  minCharsPerPage: 100,
  
  // Section markers in IdentityIQ reports
  sectionMarkers: {
    personalInfo: /Personal Information/i,
    creditScore: /Credit Score/i,
    summary: /Summary/i,
    accountHistory: /Account History/i,
    inquiries: /Inquiries/i,
    creditorContacts: /Creditor Contacts/i,
  },
  
  // Known creditor name patterns (all caps, may include special chars)
  creditorNamePattern: /^([A-Z][A-Z0-9\s\/\-&'.]+)$/m,
  
  // Field extraction patterns - based on actual PDF
  fieldPatterns: {
    accountNumber: /Account #:\s*([^\n]+)/i,
    accountType: /Account Type:\s*([^\n]+)/i,
    accountTypeDetail: /Account Type -\s*\n?\s*([^\n]+)/i,
    bureauCode: /Bureau Code:\s*([^\n]+)/i,
    accountStatus: /Account Status:\s*([^\n]+)/i,
    monthlyPayment: /Monthly\s*\n?\s*Payment:\s*\$?([\d,]+\.?\d*)/i,
    dateOpened: /Date Opened:\s*([^\n]+)/i,
    balance: /Balance:\s*\$?([\d,]+\.?\d*)/i,
    terms: /No\. of Months\s*\n?\s*\(terms\):\s*(\d+)/i,
    highCredit: /High Credit:\s*\$?([\d,]+\.?\d*)/i,
    creditLimit: /Credit Limit:\s*\$?([\d,]+\.?\d*)/i,
    pastDue: /Past Due:\s*\$?([\d,]+\.?\d*)/i,
    paymentStatus: /Payment Status:\s*([^\n]+)/i,
    lastReported: /Last Reported:\s*([^\n]+)/i,
    comments: /Comments:\s*([^\n]+)/i,
    dateLastActive: /Date Last Active:\s*([^\n]+)/i,
    dateLastPayment: /Date of Last\s*\n?\s*Payment:\s*([^\n]+)/i,
  },
  
  // Status mapping from IdentityIQ terminology
  statusMapping: {
    "open": AccountStatus.OPEN,
    "current": AccountStatus.OPEN,
    "paid": AccountStatus.PAID,
    "closed": AccountStatus.CLOSED,
    "charged off": AccountStatus.CHARGED_OFF,
    "chargeoff": AccountStatus.CHARGED_OFF,
    "charge-off": AccountStatus.CHARGED_OFF,
    "collection": AccountStatus.COLLECTION,
    "collections": AccountStatus.COLLECTION,
    "derogatory": AccountStatus.CHARGED_OFF,
  } as Record<string, AccountStatus>,
  
  // Payment status indicators for disputes
  delinquentStatuses: [
    "late 30",
    "late 60", 
    "late 90",
    "late 120",
    "charge off",
    "collection",
    "derogatory",
  ],
};

// ============================================================================
// MAIN PARSING FUNCTION
// ============================================================================

export async function parseIdentityIQReport(fullText: string): Promise<ParseResult> {
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const accounts: ParsedAccountItem[] = [];
  
  // Check for text content
  if (!fullText || fullText.trim().length < PARSING_CONFIG.minCharsPerPage) {
    return {
      success: false,
      pageCount: 0,
      accounts: [],
      errors: [{
        code: PARSE_ERROR_CODES.NO_TEXT_LAYER,
        message: "This PDF appears to be image-based or scanned. Please upload a native IdentityIQ export with selectable text.",
        details: {
          hint: "IdentityIQ reports downloaded directly from the website should have extractable text. If you printed and scanned the report, please download the original PDF instead.",
        },
      }],
      warnings: [],
    };
  }
  
  // Find Account History section
  const accountHistoryMatch = fullText.match(/Account History\s*Back to Top/i);
  if (!accountHistoryMatch) {
    warnings.push({
      code: "NO_ACCOUNT_SECTION",
      message: "Could not locate Account History section - attempting full document parse",
    });
  }
  
  // Extract account blocks
  const accountBlocks = extractAccountBlocks(fullText);
  
  for (let i = 0; i < accountBlocks.length; i++) {
    const block = accountBlocks[i];
    const parsedAccounts = parseAccountBlock(block, i);
    
    for (const account of parsedAccounts) {
      // Generate fingerprint for matching
      const fingerprint = generateFingerprint(account.creditorName, account.maskedAccountId);
      
      // Check for duplicates
      const isDuplicate = accounts.some(
        a => a.fingerprint === fingerprint && a.cra === account.cra
      );
      
      if (!isDuplicate) {
        accounts.push({
          ...account,
          fingerprint,
        });
      } else {
        warnings.push({
          code: "DUPLICATE_ACCOUNT",
          message: `Duplicate account: ${account.creditorName} (${account.cra})`,
          accountIndex: i,
        });
      }
    }
  }
  
  // Generate warnings for low confidence accounts
  accounts.forEach((account, index) => {
    if (account.confidenceScore < 45) {
      warnings.push({
        code: "LOW_CONFIDENCE",
        message: `Low confidence parse for ${account.creditorName} - manual review recommended`,
        accountIndex: index,
      });
    }
  });
  
  return {
    success: true,
    pageCount: Math.ceil(fullText.length / 3000),
    accounts,
    errors,
    warnings,
  };
}

// ============================================================================
// ACCOUNT BLOCK EXTRACTION
// ============================================================================

function extractAccountBlocks(text: string): string[] {
  const blocks: string[] = [];
  
  // Pattern: Creditor name (ALL CAPS) followed by TransUnion/Experian/Equifax header
  const creditorPattern = /\n([A-Z][A-Z0-9\s\/\-&'.]{2,40})\n\s*TransUnion\s+Experian\s+Equifax/g;
  
  let match;
  const matchPositions: { start: number; creditor: string }[] = [];
  
  while ((match = creditorPattern.exec(text)) !== null) {
    matchPositions.push({
      start: match.index,
      creditor: match[1].trim(),
    });
  }
  
  // Extract blocks between creditor headers
  for (let i = 0; i < matchPositions.length; i++) {
    const start = matchPositions[i].start;
    const end = i < matchPositions.length - 1 
      ? matchPositions[i + 1].start 
      : Math.min(start + 3000, text.length);
    
    const blockText = text.substring(start, end);
    
    if (blockText.includes("Account #:") || blockText.includes("Account Type:")) {
      blocks.push(blockText);
    }
  }
  
  return blocks;
}

// ============================================================================
// ACCOUNT BLOCK PARSING
// ============================================================================

interface ParsedAccountData {
  creditorName: string;
  maskedAccountId: string;
  cra: CRA;
  accountType?: string;
  accountStatus: AccountStatus;
  balance?: number;
  pastDue?: number;
  creditLimit?: number;
  highBalance?: number;
  monthlyPayment?: number;
  dateOpened?: string;
  dateReported?: string;
  lastActivityDate?: string;
  disputeComment?: string;
  paymentStatus?: string;
  confidenceScore: number;
  rawExtractedData?: Record<string, unknown>;
  fingerprint?: string;
}

function parseAccountBlock(block: string, blockIndex: number): ParsedAccountData[] {
  const accounts: ParsedAccountData[] = [];
  const patterns = PARSING_CONFIG.fieldPatterns;
  
  // Extract creditor name from first line
  const lines = block.split("\n");
  const creditorName = cleanCreditorName(lines[0]);
  
  if (!creditorName || creditorName.length < 2) {
    return accounts;
  }
  
  // Extract account numbers
  const accountNumberMatch = block.match(patterns.accountNumber);
  const accountNumbers = accountNumberMatch 
    ? parseMultiColumnValue(accountNumberMatch[1])
    : [generateMaskedId()];
  
  // Determine which bureaus have data
  const bureausWithData = detectBureausWithData(block);
  
  // Parse common fields
  const balanceMatch = block.match(patterns.balance);
  const balances = balanceMatch ? parseMultiColumnValue(balanceMatch[1]) : [];
  
  const pastDueMatch = block.match(patterns.pastDue);
  const pastDues = pastDueMatch ? parseMultiColumnValue(pastDueMatch[1]) : [];
  
  const creditLimitMatch = block.match(patterns.creditLimit);
  const creditLimits = creditLimitMatch ? parseMultiColumnValue(creditLimitMatch[1]) : [];
  
  const highCreditMatch = block.match(patterns.highCredit);
  const highCredits = highCreditMatch ? parseMultiColumnValue(highCreditMatch[1]) : [];
  
  const monthlyPaymentMatch = block.match(patterns.monthlyPayment);
  const monthlyPayments = monthlyPaymentMatch ? parseMultiColumnValue(monthlyPaymentMatch[1]) : [];
  
  const dateOpenedMatch = block.match(patterns.dateOpened);
  const datesOpened = dateOpenedMatch ? parseMultiColumnValue(dateOpenedMatch[1]) : [];
  
  const lastReportedMatch = block.match(patterns.lastReported);
  const lastReportedDates = lastReportedMatch ? parseMultiColumnValue(lastReportedMatch[1]) : [];
  
  const accountStatusMatch = block.match(patterns.accountStatus);
  const accountStatuses = accountStatusMatch ? parseMultiColumnValue(accountStatusMatch[1]) : [];
  
  const paymentStatusMatch = block.match(patterns.paymentStatus);
  const paymentStatuses = paymentStatusMatch ? parseMultiColumnValue(paymentStatusMatch[1]) : [];
  
  const accountTypeMatch = block.match(patterns.accountType);
  const accountTypes = accountTypeMatch ? parseMultiColumnValue(accountTypeMatch[1]) : [];
  
  const commentsMatch = block.match(patterns.comments);
  const comments = commentsMatch ? parseMultiColumnValue(commentsMatch[1]) : [];
  
  // Create account entries for each CRA that has data
  const cras: CRA[] = [CRA.TRANSUNION, CRA.EXPERIAN, CRA.EQUIFAX];
  
  for (let i = 0; i < cras.length; i++) {
    const cra = cras[i];
    
    if (!bureausWithData.includes(cra)) {
      continue;
    }
    
    const accountId = accountNumbers[i] || accountNumbers[0] || generateMaskedId();
    const balance = parseNumber(balances[i] || balances[0]);
    const pastDue = parseNumber(pastDues[i] || pastDues[0]);
    const creditLimit = parseNumber(creditLimits[i] || creditLimits[0]);
    const highBalance = parseNumber(highCredits[i] || highCredits[0]);
    const monthlyPayment = parseNumber(monthlyPayments[i] || monthlyPayments[0]);
    const status = mapAccountStatus(accountStatuses[i] || accountStatuses[0]);
    const paymentStatus = paymentStatuses[i] || paymentStatuses[0] || "";
    const accountType = accountTypes[i] || accountTypes[0];
    const comment = comments[i] || comments[0];
    
    const confidence = calculateConfidence({
      hasCreditorName: !!creditorName,
      hasAccountId: accountId !== generateMaskedId(),
      hasBalance: balance !== undefined && balance !== null,
      hasStatus: !!accountStatuses[i] || !!accountStatuses[0],
      hasDates: !!(datesOpened[i] || datesOpened[0] || lastReportedDates[i] || lastReportedDates[0]),
      hasStructure: block.includes("Account #:") && block.includes("Balance:"),
    });
    
    accounts.push({
      creditorName,
      maskedAccountId: cleanAccountId(accountId),
      cra,
      accountType,
      accountStatus: status,
      balance,
      pastDue,
      creditLimit,
      highBalance,
      monthlyPayment,
      dateOpened: datesOpened[i] || datesOpened[0],
      dateReported: lastReportedDates[i] || lastReportedDates[0],
      disputeComment: comment && comment !== "-" ? comment : undefined,
      paymentStatus: paymentStatus && paymentStatus !== "-" ? paymentStatus : undefined,
      confidenceScore: confidence.total,
      rawExtractedData: {
        blockIndex,
        originalBlock: block.substring(0, 500),
      },
    });
  }
  
  return accounts;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function detectBureausWithData(block: string): CRA[] {
  const bureaus: CRA[] = [];
  
  if (/TransUnion\s+(OK|30|60|90|120|\d)/i.test(block)) {
    bureaus.push(CRA.TRANSUNION);
  }
  if (/Experian\s+(OK|30|60|90|120|\d)/i.test(block)) {
    bureaus.push(CRA.EXPERIAN);
  }
  if (/Equifax\s+(OK|30|60|90|120|\d)/i.test(block)) {
    bureaus.push(CRA.EQUIFAX);
  }
  
  if (bureaus.length === 0) {
    const accountLine = block.match(/Account #:\s*([^\n]+)/i);
    if (accountLine) {
      const values = accountLine[1].split(/\s{2,}/);
      if (values[0] && values[0] !== "-") bureaus.push(CRA.TRANSUNION);
      if (values[1] && values[1] !== "-") bureaus.push(CRA.EXPERIAN);
      if (values[2] && values[2] !== "-") bureaus.push(CRA.EQUIFAX);
    }
  }
  
  if (bureaus.length === 0) {
    bureaus.push(CRA.TRANSUNION);
  }
  
  return bureaus;
}

function parseMultiColumnValue(value: string): string[] {
  if (!value) return [];
  const parts = value.trim().split(/\s{2,}|\t+/);
  return parts.map(p => p.trim()).filter(p => p && p !== "-");
}

function cleanCreditorName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^A-Za-z0-9\s\-&'./]/g, "")
    .toUpperCase();
}

function cleanAccountId(id: string): string {
  return id.trim().replace(/[^A-Za-z0-9*X]/gi, "");
}

function generateMaskedId(): string {
  return "XXXX" + Math.floor(Math.random() * 10000).toString().padStart(4, "0");
}

function mapAccountStatus(statusText: string | undefined): AccountStatus {
  if (!statusText) return AccountStatus.UNKNOWN;
  
  const normalized = statusText.toLowerCase().trim();
  
  for (const [key, value] of Object.entries(PARSING_CONFIG.statusMapping)) {
    if (normalized.includes(key)) {
      return value;
    }
  }
  
  for (const delinquent of PARSING_CONFIG.delinquentStatuses) {
    if (normalized.includes(delinquent)) {
      return AccountStatus.CHARGED_OFF;
    }
  }
  
  return AccountStatus.UNKNOWN;
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value || value === "-") return undefined;
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
}): { total: number; level: ConfidenceLevel } {
  let total = 0;
  
  if (factors.hasCreditorName) total += 25;
  if (factors.hasAccountId) total += 20;
  if (factors.hasBalance) total += 15;
  if (factors.hasStatus) total += 15;
  if (factors.hasDates) total += 15;
  if (factors.hasStructure) total += 10;
  
  return {
    total,
    level: computeConfidenceLevel(total),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { PARSING_CONFIG };
