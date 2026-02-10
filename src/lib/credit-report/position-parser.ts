/**
 * Position-Based Column Parser for IdentityIQ Credit Reports
 *
 * Uses column position detection to extract per-bureau values.
 * This approach is more reliable than regex for the structured
 * three-column format used by IdentityIQ.
 *
 * Key concept: Detect "TransUnion    Experian    Equifax" header,
 * calculate column boundaries, then extract field values by position.
 */

import { createLogger } from "../logger";
const log = createLogger("position-parser");

// Bureau types
export type Bureau = "TRANSUNION" | "EXPERIAN" | "EQUIFAX";

// Column boundary information
export interface ColumnBoundaries {
  transunion: { start: number; end: number };
  experian: { start: number; end: number };
  equifax: { start: number; end: number };
  detected: boolean;
  headerLine: number;
  confidence: number;
}

// Extracted field value per bureau
export interface BureauValue<T> {
  TRANSUNION: T | null;
  EXPERIAN: T | null;
  EQUIFAX: T | null;
}

// Payment history entry
export interface PaymentHistoryGrid {
  TRANSUNION: string[];
  EXPERIAN: string[];
  EQUIFAX: string[];
}

// Account data extracted via position parsing
export interface PositionParsedAccount {
  creditorName: string;
  accountNumber: BureauValue<string>;
  accountType: BureauValue<string>;
  bureauCode: BureauValue<string>;
  responsibility: BureauValue<string>;
  balance: BureauValue<number>;
  creditLimit: BureauValue<number>;
  highBalance: BureauValue<number>;
  pastDue: BureauValue<number>;
  monthlyPayment: BureauValue<number>;
  dateOpened: BureauValue<string>;
  dateReported: BureauValue<string>;
  lastActivityDate: BureauValue<string>;
  dateOfFirstDelinquency: BureauValue<string>;
  dateOfLastPayment: BureauValue<string>;
  paymentStatus: BureauValue<string>;
  accountStatus: BureauValue<string>;
  comments: BureauValue<string>;
  paymentHistory: PaymentHistoryGrid;
  rawBlock: string;
  lineStart: number;
  lineEnd: number;
  sequenceIndex: number;
}

// Account summary section
export interface AccountSummary {
  totalAccounts: BureauValue<number>;
  openAccounts: BureauValue<number>;
  closedAccounts: BureauValue<number>;
  delinquentAccounts: BureauValue<number>;
  derogAccounts: BureauValue<number>;
  collectionAccounts: BureauValue<number>;
  balances: BureauValue<number>;
  payments: BureauValue<number>;
  publicRecords: BureauValue<number>;
  inquiries: BureauValue<number>;
}

// Personal info per bureau
export interface PersonalInfoByBureau {
  TRANSUNION: PersonalInfo | null;
  EXPERIAN: PersonalInfo | null;
  EQUIFAX: PersonalInfo | null;
}

export interface PersonalInfo {
  name: string;
  address: string;
  previousAddresses: string[];
  employer: string;
  ssn: string;
  dateOfBirth: string;
}

// Credit score per bureau
export interface CreditScoreByBureau {
  TRANSUNION: CreditScore | null;
  EXPERIAN: CreditScore | null;
  EQUIFAX: CreditScore | null;
}

export interface CreditScore {
  score: number;
  model: string;
  date: string;
  factors: string[];
}

// Inquiry information
export interface ParsedInquiry {
  inquirerName: string;
  inquiryDate: string;
  inquiryType: "HARD" | "SOFT";
  bureau: Bureau;
}

// Full position parse result
export interface PositionParseResult {
  success: boolean;
  accounts: PositionParsedAccount[];
  accountSummary: AccountSummary | null;
  personalInfo: PersonalInfoByBureau | null;
  creditScores: CreditScoreByBureau | null;
  inquiries: ParsedInquiry[];
  columnBoundaries: ColumnBoundaries;
  validationResult: ValidationResult;
  metadata: {
    totalLines: number;
    accountBlocksFound: number;
    parseTimeMs: number;
  };
}

// Validation result comparing parsed accounts to summary
export interface ValidationResult {
  isValid: boolean;
  expectedCounts: BureauValue<number>;
  actualCounts: BureauValue<number>;
  discrepancies: string[];
  confidenceAdjustment: number;
}

/**
 * Detect column boundaries from the header line.
 */
export function detectColumnBoundaries(text: string): ColumnBoundaries {
  const lines = text.split("\n");
  const result: ColumnBoundaries = {
    transunion: { start: 0, end: 0 },
    experian: { start: 0, end: 0 },
    equifax: { start: 0, end: 0 },
    detected: false,
    headerLine: -1,
    confidence: 0,
  };

  // Common header patterns
  const headerPatterns = [
    /TransUnion\s+Experian\s+Equifax/i,
    /TU\s+EXP?\s+EQ/i,
    /Trans\s*Union\s+Experian\s+Equifax/i,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const pattern of headerPatterns) {
      if (pattern.test(line)) {
        // Found header line, extract positions
        const tuMatch = line.match(/Trans\s*Union/i);
        const exMatch = line.match(/Experian/i);
        const eqMatch = line.match(/Equifax/i);

        if (tuMatch && exMatch && eqMatch) {
          const tuIdx = line.indexOf(tuMatch[0]);
          const exIdx = line.indexOf(exMatch[0]);
          const eqIdx = line.indexOf(eqMatch[0]);

          // Calculate boundaries - each column extends to the next
          result.transunion = { start: tuIdx, end: exIdx - 1 };
          result.experian = { start: exIdx, end: eqIdx - 1 };
          result.equifax = { start: eqIdx, end: line.length };
          result.detected = true;
          result.headerLine = i;
          result.confidence = 0.95;

          log.info(
            {
              headerLine: i,
              tuBounds: result.transunion,
              exBounds: result.experian,
              eqBounds: result.equifax,
            },
            "Column boundaries detected"
          );

          return result;
        }
      }
    }
  }

  // Fallback: Estimate based on common IdentityIQ layout
  // These are typical character positions for IdentityIQ PDFs
  log.warn("Column header not found, using estimated boundaries");
  result.transunion = { start: 0, end: 35 };
  result.experian = { start: 36, end: 70 };
  result.equifax = { start: 71, end: 120 };
  result.detected = false;
  result.confidence = 0.6;

  return result;
}

/**
 * Extract value from a specific column position.
 */
export function extractColumnValue(
  line: string,
  boundaries: ColumnBoundaries,
  bureau: Bureau
): string {
  const bounds = boundaries[bureau.toLowerCase() as keyof typeof boundaries] as {
    start: number;
    end: number;
  };

  if (!bounds || typeof bounds.start !== "number") {
    return "";
  }

  const value = line.substring(bounds.start, bounds.end + 1).trim();

  // Clean up common artifacts
  return cleanExtractedValue(value);
}

/**
 * Clean extracted value - remove artifacts and normalize.
 */
function cleanExtractedValue(value: string): string {
  if (!value) return "";

  // Remove common artifacts
  let cleaned = value
    .replace(/^[-–—]+$/, "") // Just dashes means empty
    .replace(/^N\/A$/i, "")
    .replace(/^\s*-\s*$/, "")
    .replace(/^\s*\*+\s*$/, "")
    .trim();

  return cleaned;
}

/**
 * Parse a dollar amount from text.
 */
export function parseDollarAmount(text: string): number | null {
  if (!text) return null;

  // Handle negative amounts
  const isNegative = text.includes("(") || text.includes("-");

  // Extract digits and decimal
  const match = text.replace(/[()]/g, "").match(/[\d,]+\.?\d*/);
  if (!match) return null;

  const numStr = match[0].replace(/,/g, "");
  const num = parseFloat(numStr);

  if (isNaN(num)) return null;

  return isNegative ? -num : num;
}

/**
 * Parse a date from various formats.
 */
export function parseDate(text: string): string | null {
  if (!text) return null;

  // Common formats: MM/DD/YYYY, MM/YYYY, YYYY-MM-DD
  const datePatterns = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,  // MM/DD/YYYY
    /(\d{1,2})\/(\d{4})/,              // MM/YYYY
    /(\d{4})-(\d{2})-(\d{2})/,         // YYYY-MM-DD
    /([A-Za-z]+)\s+(\d{4})/,           // Month YYYY
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      // Return normalized ISO format when possible
      if (pattern === datePatterns[0]) {
        const [, month, day, year] = match;
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }
      if (pattern === datePatterns[1]) {
        const [, month, year] = match;
        return `${year}-${month.padStart(2, "0")}-01`;
      }
      if (pattern === datePatterns[2]) {
        return match[0];
      }
      if (pattern === datePatterns[3]) {
        const months: Record<string, string> = {
          jan: "01", january: "01",
          feb: "02", february: "02",
          mar: "03", march: "03",
          apr: "04", april: "04",
          may: "05",
          jun: "06", june: "06",
          jul: "07", july: "07",
          aug: "08", august: "08",
          sep: "09", september: "09",
          oct: "10", october: "10",
          nov: "11", november: "11",
          dec: "12", december: "12",
        };
        const monthKey = match[1].toLowerCase();
        const monthNum = months[monthKey] || "01";
        return `${match[2]}-${monthNum}-01`;
      }
    }
  }

  return null;
}

/**
 * Detect account block boundaries in text.
 *
 * Account blocks typically start with a creditor name and
 * end before the next creditor or section header.
 */
export function detectAccountBlocks(
  text: string,
  boundaries: ColumnBoundaries
): Array<{ start: number; end: number; creditorName: string }> {
  const lines = text.split("\n");
  const blocks: Array<{ start: number; end: number; creditorName: string }> = [];

  // Account section markers
  const accountSectionStart = /ACCOUNTS|Account Information|Trade Lines/i;
  const sectionEnd = /INQUIRIES|Public Records|Personal Information|Summary/i;

  let inAccountSection = false;
  let currentBlockStart = -1;
  let currentCreditor = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for account section start
    if (accountSectionStart.test(line)) {
      inAccountSection = true;
      continue;
    }

    // Check for section end
    if (inAccountSection && sectionEnd.test(line)) {
      // Close current block if open
      if (currentBlockStart >= 0) {
        blocks.push({
          start: currentBlockStart,
          end: i - 1,
          creditorName: currentCreditor,
        });
      }
      inAccountSection = false;
      currentBlockStart = -1;
      continue;
    }

    if (!inAccountSection) continue;

    // Detect new account block - typically starts with creditor name
    // Creditor names are usually all caps or title case at start of line
    const creditorPattern = /^([A-Z][A-Z0-9\s&',.-]+(?:BANK|FINANCIAL|CREDIT|CARD|AUTO|MORTGAGE|LOAN|SERVICES?|LLC|INC|CORP|NA|FSB)?)/i;
    const creditorMatch = line.match(creditorPattern);

    if (creditorMatch && line.length > 10) {
      // Potential new account block
      const potentialCreditor = creditorMatch[1].trim();

      // Validate it's a creditor name (not a field label)
      const fieldLabels = [
        "ACCOUNT", "BALANCE", "LIMIT", "STATUS", "DATE", "PAYMENT",
        "TYPE", "TERMS", "CREDIT", "HIGH", "PAST"
      ];

      const isFieldLabel = fieldLabels.some(
        label => potentialCreditor.toUpperCase().startsWith(label)
      );

      if (!isFieldLabel && potentialCreditor.length > 3) {
        // Close previous block
        if (currentBlockStart >= 0) {
          blocks.push({
            start: currentBlockStart,
            end: i - 1,
            creditorName: currentCreditor,
          });
        }

        // Start new block
        currentBlockStart = i;
        currentCreditor = potentialCreditor;
      }
    }
  }

  // Close final block
  if (currentBlockStart >= 0) {
    blocks.push({
      start: currentBlockStart,
      end: lines.length - 1,
      creditorName: currentCreditor,
    });
  }

  log.info({ blockCount: blocks.length }, "Account blocks detected");
  return blocks;
}

/**
 * Parse payment history grid from account block.
 *
 * Payment history shows 84 months of payment status codes:
 * C = Current, 1 = 30 days late, 2 = 60 days, 3 = 90 days, etc.
 */
export function parsePaymentHistory(
  blockLines: string[],
  boundaries: ColumnBoundaries
): PaymentHistoryGrid {
  const result: PaymentHistoryGrid = {
    TRANSUNION: [],
    EXPERIAN: [],
    EQUIFAX: [],
  };

  // Look for payment history section
  const historyStart = blockLines.findIndex(
    line => /Payment History|Payment Pattern|Pay Status/i.test(line)
  );

  if (historyStart < 0) return result;

  // Payment codes are typically on lines after the header
  // Format: CCCCCCC1111222... for each bureau
  const paymentCodePattern = /^[C0-9X\-\s]+$/;

  for (let i = historyStart + 1; i < Math.min(historyStart + 10, blockLines.length); i++) {
    const line = blockLines[i];

    // Extract values for each bureau column
    const tuValue = extractColumnValue(line, boundaries, "TRANSUNION");
    const exValue = extractColumnValue(line, boundaries, "EXPERIAN");
    const eqValue = extractColumnValue(line, boundaries, "EQUIFAX");

    // Parse codes
    if (paymentCodePattern.test(tuValue)) {
      result.TRANSUNION.push(...tuValue.split("").filter(c => c !== " "));
    }
    if (paymentCodePattern.test(exValue)) {
      result.EXPERIAN.push(...exValue.split("").filter(c => c !== " "));
    }
    if (paymentCodePattern.test(eqValue)) {
      result.EQUIFAX.push(...eqValue.split("").filter(c => c !== " "));
    }
  }

  return result;
}

/**
 * Parse a single account block.
 */
export function parseAccountBlock(
  text: string,
  blockInfo: { start: number; end: number; creditorName: string },
  boundaries: ColumnBoundaries,
  sequenceIndex: number
): PositionParsedAccount {
  const lines = text.split("\n").slice(blockInfo.start, blockInfo.end + 1);
  const blockText = lines.join("\n");

  // Initialize result with nulls
  const account: PositionParsedAccount = {
    creditorName: blockInfo.creditorName,
    accountNumber: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
    accountType: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
    bureauCode: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
    responsibility: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
    balance: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
    creditLimit: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
    highBalance: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
    pastDue: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
    monthlyPayment: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
    dateOpened: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
    dateReported: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
    lastActivityDate: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
    dateOfFirstDelinquency: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
    dateOfLastPayment: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
    paymentStatus: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
    accountStatus: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
    comments: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
    paymentHistory: { TRANSUNION: [], EXPERIAN: [], EQUIFAX: [] },
    rawBlock: blockText,
    lineStart: blockInfo.start,
    lineEnd: blockInfo.end,
    sequenceIndex,
  };

  // Field patterns and their property mappings
  const fieldMappings: Array<{
    pattern: RegExp;
    field: keyof PositionParsedAccount;
    parser: (val: string) => string | number | null;
  }> = [
    { pattern: /Account\s*(?:#|Number|Num)/i, field: "accountNumber", parser: (v) => v },
    { pattern: /Account\s*Type/i, field: "accountType", parser: (v) => v },
    { pattern: /Bureau\s*Code|Type\s*Code/i, field: "bureauCode", parser: (v) => v },
    { pattern: /Responsibility|Account\s*Owner/i, field: "responsibility", parser: (v) => v },
    { pattern: /Balance(?:\s*Owed)?/i, field: "balance", parser: parseDollarAmount },
    { pattern: /Credit\s*Limit|Limit/i, field: "creditLimit", parser: parseDollarAmount },
    { pattern: /High\s*(?:Balance|Credit)/i, field: "highBalance", parser: parseDollarAmount },
    { pattern: /Past\s*Due|Amount\s*Past\s*Due/i, field: "pastDue", parser: parseDollarAmount },
    { pattern: /Monthly\s*Payment|Payment\s*Amount/i, field: "monthlyPayment", parser: parseDollarAmount },
    { pattern: /Date\s*Opened|Open\s*Date/i, field: "dateOpened", parser: parseDate },
    { pattern: /Date\s*Reported|Reported/i, field: "dateReported", parser: parseDate },
    { pattern: /Last\s*Activity|Activity\s*Date/i, field: "lastActivityDate", parser: parseDate },
    { pattern: /Date\s*of\s*First\s*Delinquency|DOFD|First\s*Delinq/i, field: "dateOfFirstDelinquency", parser: parseDate },
    { pattern: /Date\s*of\s*Last\s*Payment|Last\s*Payment\s*Date/i, field: "dateOfLastPayment", parser: parseDate },
    { pattern: /Payment\s*Status|Pay\s*Status/i, field: "paymentStatus", parser: (v) => v },
    { pattern: /Account\s*Status|Status/i, field: "accountStatus", parser: (v) => v },
    { pattern: /Comments?|Remarks?/i, field: "comments", parser: (v) => v },
  ];

  // Parse each line for field values
  for (const line of lines) {
    for (const mapping of fieldMappings) {
      if (mapping.pattern.test(line)) {
        const tuRaw = extractColumnValue(line, boundaries, "TRANSUNION");
        const exRaw = extractColumnValue(line, boundaries, "EXPERIAN");
        const eqRaw = extractColumnValue(line, boundaries, "EQUIFAX");

        const parsed = account[mapping.field] as BureauValue<string | number | null>;
        if (parsed && typeof parsed === "object" && "TRANSUNION" in parsed) {
          parsed.TRANSUNION = mapping.parser(tuRaw) as never;
          parsed.EXPERIAN = mapping.parser(exRaw) as never;
          parsed.EQUIFAX = mapping.parser(eqRaw) as never;
        }
      }
    }
  }

  // Parse payment history
  account.paymentHistory = parsePaymentHistory(lines, boundaries);

  return account;
}

/**
 * Parse the account summary section.
 */
export function parseAccountSummary(
  text: string,
  boundaries: ColumnBoundaries
): AccountSummary | null {
  const lines = text.split("\n");

  // Find summary section
  const summaryStart = lines.findIndex(
    line => /Account\s*Summary|Summary\s*of\s*Accounts/i.test(line)
  );

  if (summaryStart < 0) {
    log.warn("Account summary section not found");
    return null;
  }

  const summary: AccountSummary = {
    totalAccounts: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
    openAccounts: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
    closedAccounts: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
    delinquentAccounts: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
    derogAccounts: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
    collectionAccounts: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
    balances: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
    payments: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
    publicRecords: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
    inquiries: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
  };

  const fieldMappings: Array<{
    pattern: RegExp;
    field: keyof AccountSummary;
  }> = [
    { pattern: /Total\s*Accounts?/i, field: "totalAccounts" },
    { pattern: /Open\s*Accounts?/i, field: "openAccounts" },
    { pattern: /Closed\s*Accounts?/i, field: "closedAccounts" },
    { pattern: /Delinquent/i, field: "delinquentAccounts" },
    { pattern: /Derog|Negative/i, field: "derogAccounts" },
    { pattern: /Collection/i, field: "collectionAccounts" },
    { pattern: /Total\s*Balance/i, field: "balances" },
    { pattern: /Total\s*Payment|Monthly/i, field: "payments" },
    { pattern: /Public\s*Record/i, field: "publicRecords" },
    { pattern: /Inquir/i, field: "inquiries" },
  ];

  // Parse summary lines (usually within 30 lines of header)
  for (let i = summaryStart; i < Math.min(summaryStart + 30, lines.length); i++) {
    const line = lines[i];

    for (const mapping of fieldMappings) {
      if (mapping.pattern.test(line)) {
        const tuRaw = extractColumnValue(line, boundaries, "TRANSUNION");
        const exRaw = extractColumnValue(line, boundaries, "EXPERIAN");
        const eqRaw = extractColumnValue(line, boundaries, "EQUIFAX");

        const field = summary[mapping.field];
        if (mapping.field === "balances" || mapping.field === "payments") {
          field.TRANSUNION = parseDollarAmount(tuRaw);
          field.EXPERIAN = parseDollarAmount(exRaw);
          field.EQUIFAX = parseDollarAmount(eqRaw);
        } else {
          field.TRANSUNION = parseInt(tuRaw) || null;
          field.EXPERIAN = parseInt(exRaw) || null;
          field.EQUIFAX = parseInt(eqRaw) || null;
        }
      }
    }
  }

  return summary;
}

/**
 * Validate parsed accounts against summary counts.
 */
export function validateAgainstSummary(
  accounts: PositionParsedAccount[],
  summary: AccountSummary | null
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    expectedCounts: { TRANSUNION: null, EXPERIAN: null, EQUIFAX: null },
    actualCounts: { TRANSUNION: 0, EXPERIAN: 0, EQUIFAX: 0 },
    discrepancies: [],
    confidenceAdjustment: 0,
  };

  if (!summary) {
    result.discrepancies.push("No summary section found for validation");
    result.confidenceAdjustment = -10;
    return result;
  }

  result.expectedCounts = { ...summary.totalAccounts };

  // Count accounts per bureau (an account counts for a bureau if it has data for that bureau)
  for (const account of accounts) {
    if (account.accountNumber.TRANSUNION || account.balance.TRANSUNION !== null) {
      result.actualCounts.TRANSUNION = (result.actualCounts.TRANSUNION || 0) + 1;
    }
    if (account.accountNumber.EXPERIAN || account.balance.EXPERIAN !== null) {
      result.actualCounts.EXPERIAN = (result.actualCounts.EXPERIAN || 0) + 1;
    }
    if (account.accountNumber.EQUIFAX || account.balance.EQUIFAX !== null) {
      result.actualCounts.EQUIFAX = (result.actualCounts.EQUIFAX || 0) + 1;
    }
  }

  // Compare counts
  const bureaus: Bureau[] = ["TRANSUNION", "EXPERIAN", "EQUIFAX"];
  for (const bureau of bureaus) {
    const expected = result.expectedCounts[bureau];
    const actual = result.actualCounts[bureau];

    if (expected !== null && actual !== expected) {
      result.isValid = false;
      result.discrepancies.push(
        `${bureau}: Expected ${expected} accounts, parsed ${actual}`
      );

      // Calculate confidence penalty based on discrepancy
      const diff = Math.abs(expected - (actual || 0));
      const penalty = Math.min(diff * 5, 25); // Max 25 point penalty per bureau
      result.confidenceAdjustment -= penalty;
    }
  }

  if (result.discrepancies.length === 0) {
    result.confidenceAdjustment = 10; // Bonus for matching
  }

  log.info(
    {
      isValid: result.isValid,
      discrepancies: result.discrepancies,
      adjustment: result.confidenceAdjustment,
    },
    "Validation complete"
  );

  return result;
}

/**
 * Parse hard inquiries from the credit report.
 *
 * IdentityIQ format shows inquiries in a table with columns for each bureau.
 * Example:
 *   CREDITOR NAME       01/29/2026     -              01/29/2026
 *                       (TransUnion)   (Experian)     (Equifax)
 */
export function parseInquiries(
  text: string,
  boundaries: ColumnBoundaries
): ParsedInquiry[] {
  const lines = text.split("\n");
  const inquiries: ParsedInquiry[] = [];

  // Find inquiry section
  const inquiryStart = lines.findIndex(
    line => /(?:Hard\s+)?Inquir(?:y|ies)|Credit\s+Inquir/i.test(line)
  );

  if (inquiryStart < 0) {
    log.warn("Inquiry section not found");
    return inquiries;
  }

  // Find end of inquiry section (before soft inquiries or next section)
  let inquiryEnd = lines.length;
  for (let i = inquiryStart + 1; i < lines.length; i++) {
    if (/Soft\s+Inquir|Promotional\s+Inquir|Public\s+Record|Employment\s+Inquir|Account\s+Summary/i.test(lines[i])) {
      inquiryEnd = i;
      break;
    }
  }

  log.info({ inquiryStart, inquiryEnd }, "Found inquiry section");

  // IdentityIQ inquiries can be in two formats:
  // Format 1 (table): CREDITOR | Type | Date | Bureau (bureau name at end)
  // Format 2 (3-col): CREDITOR with dates in TransUnion/Experian/Equifax columns

  for (let i = inquiryStart + 1; i < inquiryEnd; i++) {
    const line = lines[i];

    // Skip empty lines and headers
    if (!line.trim() || /^[-=\s]+$/.test(line)) continue;
    if (/TransUnion\s+Experian\s+Equifax/i.test(line)) continue;
    if (/Creditor\s+Name|Type\s+of\s+Business|Date\s+of|Credit\s+Bureau/i.test(line)) continue;

    // Try Format 1: Table with bureau name at end
    // Pattern: CREDITOR NAME ... DATE ... BUREAU_NAME
    const tableMatch = line.match(
      /^([A-Z][A-Z0-9\s\/&'.,\-]+?)\s+(?:[A-Za-z\s,]+\s+)?(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?:.*\s+)?(TransUnion|Experian|Equifax)\s*$/i
    );

    if (tableMatch) {
      const creditorName = tableMatch[1].trim().toUpperCase();
      const dateStr = tableMatch[2];
      const bureauName = tableMatch[3].toUpperCase();

      // Skip if it's a section header
      if (/^(INQUIR|CREDIT|TOTAL|SOFT|HARD)/i.test(creditorName)) continue;

      const parsedDate = parseDate(dateStr);
      if (parsedDate && creditorName.length >= 3) {
        const bureau: Bureau = bureauName === "TRANSUNION" ? "TRANSUNION" :
                               bureauName === "EXPERIAN" ? "EXPERIAN" : "EQUIFAX";
        inquiries.push({
          inquirerName: creditorName,
          inquiryDate: parsedDate,
          inquiryType: "HARD",
          bureau,
        });
        continue;
      }
    }

    // Try alternate table format: look for bureau at end with date before it
    const altMatch = line.match(
      /^(.+?)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(TransUnion|Experian|Equifax)\s*$/i
    );

    if (altMatch) {
      let creditorName = altMatch[1].trim().toUpperCase();
      // Remove business type if present (usually after hyphen or multiple spaces)
      creditorName = creditorName.replace(/\s{2,}.*$/, "").replace(/\s+-\s+.*$/, "");
      const dateStr = altMatch[2];
      const bureauName = altMatch[3].toUpperCase();

      if (/^(INQUIR|CREDIT|TOTAL|SOFT|HARD|CREDITOR)/i.test(creditorName)) continue;

      const parsedDate = parseDate(dateStr);
      if (parsedDate && creditorName.length >= 3) {
        const bureau: Bureau = bureauName === "TRANSUNION" ? "TRANSUNION" :
                               bureauName === "EXPERIAN" ? "EXPERIAN" : "EQUIFAX";
        inquiries.push({
          inquirerName: creditorName,
          inquiryDate: parsedDate,
          inquiryType: "HARD",
          bureau,
        });
        continue;
      }
    }

    // Try Format 2: 3-column layout with dates in bureau columns
    const creditorMatch = line.match(/^([A-Z][A-Z0-9\s\/&'.,\-]+?)(?=\s+\d{1,2}\/|\s{3,}|\s*$)/i);
    if (!creditorMatch) continue;

    const creditorName = creditorMatch[1].trim().toUpperCase();
    if (creditorName.length < 3) continue;
    if (/^(INQUIR|CREDIT|TRANSUNION|EXPERIAN|EQUIFAX|TOTAL|SOFT|HARD)/i.test(creditorName)) continue;

    // Extract values for each bureau column
    const bureaus: Bureau[] = ["TRANSUNION", "EXPERIAN", "EQUIFAX"];
    for (const bureau of bureaus) {
      const value = extractColumnValue(line, boundaries, bureau);
      const dateMatch = value.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);

      if (dateMatch) {
        const parsedDate = parseDate(dateMatch[1]);
        if (parsedDate) {
          inquiries.push({
            inquirerName: creditorName,
            inquiryDate: parsedDate,
            inquiryType: "HARD",
            bureau,
          });
        }
      }
    }
  }

  log.info({ inquiryCount: inquiries.length }, "Parsed inquiries");
  return inquiries;
}

/**
 * Main entry point for position-based parsing.
 */
export async function parseWithPositions(text: string): Promise<PositionParseResult> {
  const startTime = Date.now();

  log.info({ textLength: text.length }, "Starting position-based parsing");

  // Step 1: Detect column boundaries
  const boundaries = detectColumnBoundaries(text);

  // Step 2: Parse account summary (for validation)
  const accountSummary = parseAccountSummary(text, boundaries);

  // Step 3: Parse personal info per bureau
  const personalInfo = parsePersonalInfo(text, boundaries);

  // Step 4: Parse credit scores
  const creditScores = parseCreditScores(text, boundaries);

  // Step 5: Parse hard inquiries
  const inquiries = parseInquiries(text, boundaries);

  // Step 6: Detect and parse account blocks
  const blocks = detectAccountBlocks(text, boundaries);

  // Track sequence indices for duplicate fingerprints
  const fingerprintCounts: Record<string, number> = {};

  const accounts: PositionParsedAccount[] = [];
  for (const block of blocks) {
    // Generate simple fingerprint for sequence tracking
    const fingerprint = block.creditorName.toLowerCase().replace(/\s+/g, "_");
    const seqIndex = fingerprintCounts[fingerprint] || 0;
    fingerprintCounts[fingerprint] = seqIndex + 1;

    const account = parseAccountBlock(text, block, boundaries, seqIndex);
    accounts.push(account);
  }

  // Step 7: Validate against summary
  const validationResult = validateAgainstSummary(accounts, accountSummary);

  const parseTimeMs = Date.now() - startTime;

  log.info(
    {
      accountCount: accounts.length,
      inquiryCount: inquiries.length,
      validationIsValid: validationResult.isValid,
      parseTimeMs,
    },
    "Position parsing complete"
  );

  return {
    success: accounts.length > 0 || boundaries.detected,
    accounts,
    accountSummary,
    personalInfo,
    creditScores,
    inquiries,
    columnBoundaries: boundaries,
    validationResult,
    metadata: {
      totalLines: text.split("\n").length,
      accountBlocksFound: blocks.length,
      parseTimeMs,
    },
  };
}

/**
 * Check if text appears to be IdentityIQ format (suitable for position parsing).
 */
export function isIdentityIQFormat(text: string): boolean {
  const indicators = [
    /IdentityIQ/i,
    /Trans\s*Union\s+Experian\s+Equifax/i,
    /3-Bureau\s*Credit\s*Report/i,
    /Credit\s*Monitoring\s*Service/i,
  ];

  const matchCount = indicators.filter(pattern => pattern.test(text)).length;

  return matchCount >= 2;
}

/**
 * Parse personal information section per bureau.
 */
export function parsePersonalInfo(
  text: string,
  boundaries: ColumnBoundaries
): PersonalInfoByBureau {
  const lines = text.split("\n");
  const result: PersonalInfoByBureau = {
    TRANSUNION: null,
    EXPERIAN: null,
    EQUIFAX: null,
  };

  // Find personal info section
  const piStart = lines.findIndex(
    line => /Personal\s*Information|Consumer\s*Information|Your\s*Information/i.test(line)
  );

  if (piStart < 0) {
    log.warn("Personal information section not found");
    return result;
  }

  // Initialize per-bureau data
  const bureaus: Bureau[] = ["TRANSUNION", "EXPERIAN", "EQUIFAX"];
  for (const bureau of bureaus) {
    result[bureau] = {
      name: "",
      address: "",
      previousAddresses: [],
      employer: "",
      ssn: "",
      dateOfBirth: "",
    };
  }

  // Field patterns
  const fieldMappings: Array<{
    pattern: RegExp;
    field: keyof PersonalInfo;
    multiLine?: boolean;
  }> = [
    { pattern: /Name|Consumer\s*Name/i, field: "name" },
    { pattern: /Current\s*Address|Address/i, field: "address" },
    { pattern: /Previous\s*Address|Former\s*Address/i, field: "previousAddresses", multiLine: true },
    { pattern: /Employer|Employment/i, field: "employer" },
    { pattern: /SSN|Social\s*Security/i, field: "ssn" },
    { pattern: /Date\s*of\s*Birth|DOB|Birth\s*Date/i, field: "dateOfBirth" },
  ];

  // Parse lines (usually within 50 lines of section start)
  for (let i = piStart; i < Math.min(piStart + 50, lines.length); i++) {
    const line = lines[i];

    // Check for section end
    if (/Account\s*Summary|Accounts|Credit\s*Score/i.test(line) && i > piStart + 5) {
      break;
    }

    for (const mapping of fieldMappings) {
      if (mapping.pattern.test(line)) {
        for (const bureau of bureaus) {
          const value = extractColumnValue(line, boundaries, bureau);
          const info = result[bureau];

          if (info && value) {
            if (mapping.field === "previousAddresses") {
              info.previousAddresses.push(value);
            } else {
              info[mapping.field] = value;
            }
          }
        }
      }
    }
  }

  return result;
}

/**
 * Parse credit scores section.
 */
export function parseCreditScores(
  text: string,
  boundaries: ColumnBoundaries
): CreditScoreByBureau {
  const lines = text.split("\n");
  const result: CreditScoreByBureau = {
    TRANSUNION: null,
    EXPERIAN: null,
    EQUIFAX: null,
  };

  // Find score section
  const scoreStart = lines.findIndex(
    line => /Credit\s*Score|VantageScore|FICO\s*Score|Your\s*Score/i.test(line)
  );

  if (scoreStart < 0) {
    log.warn("Credit score section not found");
    return result;
  }

  const bureaus: Bureau[] = ["TRANSUNION", "EXPERIAN", "EQUIFAX"];

  // Look for score values (usually 3-digit numbers between 300-850)
  const scorePattern = /\b([3-8]\d{2})\b/;

  for (let i = scoreStart; i < Math.min(scoreStart + 20, lines.length); i++) {
    const line = lines[i];

    for (const bureau of bureaus) {
      if (result[bureau]) continue; // Already found

      const value = extractColumnValue(line, boundaries, bureau);
      const scoreMatch = value.match(scorePattern);

      if (scoreMatch) {
        const score = parseInt(scoreMatch[1]);
        if (score >= 300 && score <= 850) {
          result[bureau] = {
            score,
            model: "VantageScore 3.0", // Default for IdentityIQ
            date: new Date().toISOString().split("T")[0],
            factors: [],
          };
        }
      }
    }
  }

  // Parse score factors if present
  const factorPattern = /Factor|Reason|Impact/i;
  for (let i = scoreStart; i < Math.min(scoreStart + 40, lines.length); i++) {
    const line = lines[i];

    if (factorPattern.test(line)) {
      for (const bureau of bureaus) {
        const value = extractColumnValue(line, boundaries, bureau);
        if (value && result[bureau]) {
          result[bureau].factors.push(value);
        }
      }
    }
  }

  return result;
}

/**
 * Detect dispute notations in account text.
 *
 * Look for phrases like:
 * - "Consumer disputes"
 * - "Disputed by consumer"
 * - "Account disputed"
 * - "FCRA dispute"
 */
export function detectDisputeNotations(
  text: string
): { hasDispute: boolean; notations: string[] } {
  const notations: string[] = [];

  const disputePatterns = [
    /Consumer\s+disputes?/gi,
    /Disputed\s+by\s+consumer/gi,
    /Account\s+(?:is\s+)?disputed/gi,
    /FCRA\s+dispute/gi,
    /Investigation\s+in\s+progress/gi,
    /Currently\s+in\s+dispute/gi,
    /Dispute\s+resolved/gi,
    /Consumer\s+statement/gi,
  ];

  for (const pattern of disputePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      notations.push(...matches);
    }
  }

  return {
    hasDispute: notations.length > 0,
    notations: [...new Set(notations)], // Deduplicate
  };
}

/**
 * Detect Authorized User (AU) status from bureau codes and responsibility field.
 *
 * Bureau codes indicating AU:
 * - "A" prefix or suffix in some formats
 * - Responsibility field: "Authorized User", "Auth User", "AU"
 */
export function detectAuthorizedUser(
  bureauCode: string | null,
  responsibility: string | null
): { isAU: boolean; reason: string } {
  // Check responsibility field first
  if (responsibility) {
    const auPatterns = [
      /Authorized\s*User/i,
      /Auth\.?\s*User/i,
      /\bAU\b/,
      /Joint\s*Account\s*Holder/i,
    ];

    for (const pattern of auPatterns) {
      if (pattern.test(responsibility)) {
        return { isAU: true, reason: `Responsibility: ${responsibility}` };
      }
    }
  }

  // Check bureau code
  if (bureauCode) {
    // Common AU indicators in bureau codes
    // A = Authorized User, J = Joint, I = Individual
    if (/^[AJ]/i.test(bureauCode) || /A$/i.test(bureauCode)) {
      // "A" prefix or suffix often indicates AU
      // But "A1" typically means "Open/Current" - need context
      const codeUpper = bureauCode.toUpperCase();
      if (codeUpper.startsWith("A") && !/^A[0-9]$/.test(codeUpper)) {
        return { isAU: true, reason: `Bureau code: ${bureauCode}` };
      }
    }
  }

  return { isAU: false, reason: "" };
}

/**
 * Extract Date of First Delinquency (DOFD) for 7-year SOL calculation.
 *
 * DOFD is critical because:
 * - Negative items must be removed 7 years from DOFD
 * - Re-aging (changing DOFD) is a FCRA violation
 */
export function extractDOFD(
  accountBlock: string
): { dofd: string | null; isEstimated: boolean; source: string } {
  // Direct DOFD field
  const dofdPatterns = [
    /Date\s*of\s*First\s*Delinquency[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /DOFD[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /First\s*Delinquent[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /1st\s*Delinquency[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i,
  ];

  for (const pattern of dofdPatterns) {
    const match = accountBlock.match(pattern);
    if (match) {
      return {
        dofd: parseDate(match[1]),
        isEstimated: false,
        source: "DOFD field",
      };
    }
  }

  // Try to extract from other date fields as estimation
  // Date Closed for charge-offs
  const dateClosedMatch = accountBlock.match(
    /Date\s*Closed[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i
  );
  if (dateClosedMatch) {
    // Check if it's a charge-off or collection
    if (/Charge\s*Off|Collection|Write\s*Off/i.test(accountBlock)) {
      return {
        dofd: parseDate(dateClosedMatch[1]),
        isEstimated: true,
        source: "Date Closed (estimated for charge-off)",
      };
    }
  }

  // Look for first late payment in history
  const paymentHistoryMatch = accountBlock.match(/Payment\s*History[:\s]*([CXL0-9\s-]+)/i);
  if (paymentHistoryMatch) {
    const history = paymentHistoryMatch[1];
    // Find first delinquency marker (1, 2, 3, etc.)
    const firstLateIdx = history.search(/[1-9]/);
    if (firstLateIdx >= 0) {
      // Estimate based on position (each position = 1 month back)
      // This is very rough and should be flagged as estimated
      return {
        dofd: null,
        isEstimated: true,
        source: "Payment history suggests delinquency (date unclear)",
      };
    }
  }

  return { dofd: null, isEstimated: false, source: "" };
}

/**
 * Calculate 7-year removal date from DOFD.
 */
export function calculate7YearDate(dofd: string): string | null {
  if (!dofd) return null;

  try {
    const date = new Date(dofd);
    date.setFullYear(date.getFullYear() + 7);
    return date.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

/**
 * Determine if an account should have been removed (past 7-year SOL).
 */
export function isExpiredBySOL(dofd: string | null): boolean {
  if (!dofd) return false;

  try {
    const dofdDate = new Date(dofd);
    const sevenYearsAgo = new Date();
    sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);

    return dofdDate < sevenYearsAgo;
  } catch {
    return false;
  }
}

/**
 * Enhanced fingerprint generation for duplicate handling.
 *
 * Uses multiple fields to create a unique identifier:
 * - Creditor name (normalized)
 * - Account number (last 4-6 digits)
 * - Account type
 * - Date opened
 */
export function generateEnhancedFingerprint(
  creditorName: string,
  accountNumber: string | null,
  accountType: string | null,
  dateOpened: string | null
): string {
  // Normalize creditor name
  const normalizedCreditor = creditorName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .substring(0, 20);

  // Extract last digits of account number
  const accountSuffix = accountNumber
    ? accountNumber.replace(/[^0-9X]/gi, "").slice(-6)
    : "NOACCT";

  // Normalize account type
  const typeCode = accountType
    ? accountType.substring(0, 4).toUpperCase()
    : "UNK";

  // Extract year from date opened
  const openYear = dateOpened
    ? dateOpened.substring(0, 4)
    : "0000";

  return `${normalizedCreditor}_${accountSuffix}_${typeCode}_${openYear}`;
}

/**
 * Compare two fingerprints to determine if accounts are duplicates.
 */
export function fingerprintsMatch(fp1: string, fp2: string): boolean {
  if (fp1 === fp2) return true;

  // Partial match logic for near-duplicates
  const parts1 = fp1.split("_");
  const parts2 = fp2.split("_");

  // Must match on creditor name
  if (parts1[0] !== parts2[0]) return false;

  // Account number match is strong indicator
  if (parts1[1] === parts2[1] && parts1[1] !== "NOACCT") {
    return true;
  }

  // Type + year match with same creditor
  if (parts1[2] === parts2[2] && parts1[3] === parts2[3]) {
    return true;
  }

  return false;
}

/**
 * Assign sequence indices to accounts with matching fingerprints.
 *
 * Example: 8 Nelnet accounts with similar details
 * Each gets sequenceIndex 0-7 to maintain uniqueness
 */
export function assignSequenceIndices(
  accounts: PositionParsedAccount[]
): PositionParsedAccount[] {
  const fingerprintMap: Record<string, number> = {};

  return accounts.map(account => {
    // Generate fingerprint from TransUnion data (primary), fallback to others
    const creditor = account.creditorName;
    const accNum = account.accountNumber.TRANSUNION ||
      account.accountNumber.EXPERIAN ||
      account.accountNumber.EQUIFAX;
    const accType = account.accountType.TRANSUNION ||
      account.accountType.EXPERIAN ||
      account.accountType.EQUIFAX;
    const dateOpen = account.dateOpened.TRANSUNION ||
      account.dateOpened.EXPERIAN ||
      account.dateOpened.EQUIFAX;

    const fingerprint = generateEnhancedFingerprint(
      creditor,
      accNum,
      accType,
      dateOpen
    );

    // Get and increment sequence index
    const seqIndex = fingerprintMap[fingerprint] || 0;
    fingerprintMap[fingerprint] = seqIndex + 1;

    return {
      ...account,
      sequenceIndex: seqIndex,
    };
  });
}
