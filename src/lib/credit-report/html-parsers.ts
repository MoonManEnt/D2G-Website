/**
 * HTML Parsers for Credit Report Services
 *
 * Handles HTML copy & paste from:
 * - IdentityIQ (IDIQ)
 * - MyScoreIQ
 * - MyFreeScoreNow
 *
 * Each parser extracts accounts, scores, and personal info
 * from the specific HTML structure of each service.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("html-parsers");

// =============================================================================
// TYPES
// =============================================================================

export type CreditReportSource =
  | "IDENTITYIQ"
  | "MYSCOREIQ"
  | "MYFREESCORENOW"
  | "UNKNOWN";

export interface ParsedAccount {
  creditorName: string;
  accountNumber: string;
  accountType: string;
  accountStatus: string;
  bureau: "TRANSUNION" | "EXPERIAN" | "EQUIFAX";
  balance?: number;
  creditLimit?: number;
  highBalance?: number;
  pastDue?: number;
  monthlyPayment?: number;
  dateOpened?: string;
  dateReported?: string;
  lastActivityDate?: string;
  paymentStatus?: string;
  paymentHistory?: PaymentHistoryEntry[];
  responsibility?: string;
  comments?: string;
  extractionConfidence: number;
}

export interface PaymentHistoryEntry {
  date: string;
  status: string;
}

export interface ParsedCreditScore {
  bureau: "TRANSUNION" | "EXPERIAN" | "EQUIFAX";
  score: number;
  scoreType?: string;
  scoreDate?: string;
}

export interface ParsedPersonalInfo {
  name?: string;
  aliases?: string[];
  dateOfBirth?: string;
  ssn?: string;
  addresses?: string[];
  employers?: string[];
}

export interface ParsedInquiry {
  creditorName: string;
  inquiryDate: string;
  bureau: "TRANSUNION" | "EXPERIAN" | "EQUIFAX";
  inquiryType?: string;
}

export interface HTMLParseResult {
  success: boolean;
  source: CreditReportSource;
  accounts: ParsedAccount[];
  scores: ParsedCreditScore[];
  personalInfo: ParsedPersonalInfo;
  inquiries: ParsedInquiry[];
  rawText: string;
  errors: string[];
  warnings: string[];
}

// =============================================================================
// SOURCE DETECTION
// =============================================================================

/**
 * Detect which credit monitoring service the HTML came from
 */
export function detectCreditReportSource(html: string): CreditReportSource {
  const lowerHtml = html.toLowerCase();

  // IdentityIQ detection
  if (
    lowerHtml.includes("identityiq") ||
    lowerHtml.includes("idiq") ||
    lowerHtml.includes("creditreportinfo.com") ||
    lowerHtml.includes("idseal")
  ) {
    return "IDENTITYIQ";
  }

  // MyScoreIQ detection
  if (
    lowerHtml.includes("myscoreiq") ||
    lowerHtml.includes("scoreiq") ||
    lowerHtml.includes("myscore iq")
  ) {
    return "MYSCOREIQ";
  }

  // MyFreeScoreNow detection
  if (
    lowerHtml.includes("myfreescorenow") ||
    lowerHtml.includes("freescorenow") ||
    lowerHtml.includes("free score now")
  ) {
    return "MYFREESCORENOW";
  }

  // Check for common credit report patterns to see if it's valid at all
  const hasAccountPatterns =
    lowerHtml.includes("account #") ||
    lowerHtml.includes("creditor") ||
    lowerHtml.includes("transunion") ||
    lowerHtml.includes("experian") ||
    lowerHtml.includes("equifax");

  if (hasAccountPatterns) {
    return "UNKNOWN"; // Valid credit report but unknown source
  }

  return "UNKNOWN";
}

// =============================================================================
// COMMON UTILITIES
// =============================================================================

/**
 * Clean HTML and extract structured text
 */
function cleanHTML(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
}

/**
 * Extract text content from HTML with table structure preserved
 */
function extractTableStructure(html: string): string {
  let text = cleanHTML(html);

  // Preserve table structure with delimiters
  text = text
    .replace(/<\/th>/gi, " | ")
    .replace(/<\/td>/gi, " | ")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<tr[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

/**
 * Parse a currency string to number
 */
function parseCurrency(str: string | undefined | null): number | undefined {
  if (!str) return undefined;
  const cleaned = str.replace(/[$,\s]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

/**
 * Parse a date string to YYYY-MM-DD format
 */
function parseDate(str: string | undefined | null): string | undefined {
  if (!str) return undefined;

  // Try various date formats
  const patterns = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // MM/DD/YYYY
    /(\d{1,2})-(\d{1,2})-(\d{4})/, // MM-DD-YYYY
    /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
    /(\w+)\s+(\d{1,2}),?\s+(\d{4})/, // Month DD, YYYY
  ];

  for (const pattern of patterns) {
    const match = str.match(pattern);
    if (match) {
      try {
        const date = new Date(str);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split("T")[0];
        }
      } catch {
        // Continue to next pattern
      }
    }
  }

  return undefined;
}

/**
 * Normalize bureau name
 */
function normalizeBureau(
  bureau: string
): "TRANSUNION" | "EXPERIAN" | "EQUIFAX" | null {
  const lower = bureau.toLowerCase().trim();
  if (lower.includes("transunion") || lower === "tu") return "TRANSUNION";
  if (lower.includes("experian") || lower === "ex") return "EXPERIAN";
  if (lower.includes("equifax") || lower === "eq") return "EQUIFAX";
  return null;
}

/**
 * Normalize account status
 */
function normalizeStatus(status: string): string {
  const lower = status.toLowerCase().trim();

  if (lower.includes("open")) return "OPEN";
  if (lower.includes("closed")) return "CLOSED";
  if (lower.includes("paid")) return "PAID";
  if (
    lower.includes("charge") ||
    lower.includes("chargeoff") ||
    lower.includes("charged off")
  )
    return "CHARGED_OFF";
  if (lower.includes("collection")) return "COLLECTION";
  if (lower.includes("derogatory")) return "DEROGATORY";
  if (lower.includes("current")) return "OPEN";
  if (lower.includes("closed") && lower.includes("never late"))
    return "CLOSED";

  return status.toUpperCase();
}

// =============================================================================
// IDENTITYIQ PARSER
// =============================================================================

/**
 * Parse IdentityIQ HTML format
 *
 * IdentityIQ uses a 3-column table format:
 * | Field Name | TransUnion | Experian | Equifax |
 */
function parseIdentityIQHTML(html: string): HTMLParseResult {
  const result: HTMLParseResult = {
    success: false,
    source: "IDENTITYIQ",
    accounts: [],
    scores: [],
    personalInfo: {},
    inquiries: [],
    rawText: "",
    errors: [],
    warnings: [],
  };

  try {
    const text = extractTableStructure(html);
    result.rawText = text;

    // Extract credit scores
    const scorePatterns = [
      /(?:credit\s*score|vantage\s*score|fico)[:\s]*(?:transunion|tu)[:\s]*(\d{3})/gi,
      /transunion[:\s|]*(\d{3})[|\s]*experian[:\s|]*(\d{3})[|\s]*equifax[:\s|]*(\d{3})/gi,
      /(?:score)[:\s]*(\d{3})[|\s]*(\d{3})[|\s]*(\d{3})/gi,
    ];

    for (const pattern of scorePatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[2] && match[3]) {
          const tu = parseInt(match[1]);
          const ex = parseInt(match[2]);
          const eq = parseInt(match[3]);

          if (tu >= 300 && tu <= 850) {
            result.scores.push({
              bureau: "TRANSUNION",
              score: tu,
              scoreType: "VANTAGESCORE",
            });
          }
          if (ex >= 300 && ex <= 850) {
            result.scores.push({
              bureau: "EXPERIAN",
              score: ex,
              scoreType: "VANTAGESCORE",
            });
          }
          if (eq >= 300 && eq <= 850) {
            result.scores.push({
              bureau: "EQUIFAX",
              score: eq,
              scoreType: "VANTAGESCORE",
            });
          }
        }
      }
    }

    // Extract accounts using section detection
    // IdentityIQ format: creditor name followed by 3-column data
    const accountBlockPattern =
      /([A-Z][A-Z0-9\s&'.,-]+?)(?:\s*TransUnion\s*Experian\s*Equifax|\s*\|\s*TU\s*\|\s*EX\s*\|\s*EQ)/gi;
    const lines = text.split("\n");

    let currentCreditor = "";
    let currentData: Record<string, Record<string, string>> = {};
    const bureaus: ("TRANSUNION" | "EXPERIAN" | "EQUIFAX")[] = [
      "TRANSUNION",
      "EXPERIAN",
      "EQUIFAX",
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Detect creditor name line (usually all caps, ends with bureau names)
      if (
        line.match(
          /^[A-Z][A-Z0-9\s&'.,-]+\s*(TransUnion|Experian|Equifax|\|)/i
        )
      ) {
        // Save previous account if exists
        if (currentCreditor && Object.keys(currentData).length > 0) {
          saveIdentityIQAccount(
            result,
            currentCreditor,
            currentData,
            bureaus
          );
        }

        // Extract creditor name
        currentCreditor = line
          .replace(/\s*(TransUnion|Experian|Equifax|\|).*/i, "")
          .trim();
        currentData = {};
        continue;
      }

      // Parse field: value | value | value lines
      const fieldMatch = line.match(
        /^([^|:]+)[:|]\s*([^|]*)\|?\s*([^|]*)\|?\s*([^|]*)?$/
      );
      if (fieldMatch && currentCreditor) {
        const fieldName = fieldMatch[1].trim().toLowerCase();
        const values = [
          fieldMatch[2]?.trim() || "-",
          fieldMatch[3]?.trim() || "-",
          fieldMatch[4]?.trim() || "-",
        ];

        currentData[fieldName] = {
          TRANSUNION: values[0],
          EXPERIAN: values[1],
          EQUIFAX: values[2],
        };
      }
    }

    // Save last account
    if (currentCreditor && Object.keys(currentData).length > 0) {
      saveIdentityIQAccount(result, currentCreditor, currentData, bureaus);
    }

    // Extract personal info
    const nameMatch = text.match(
      /(?:consumer|name)[:\s]*([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i
    );
    if (nameMatch) {
      result.personalInfo.name = nameMatch[1].trim();
    }

    // Extract inquiries
    const inquiryPattern =
      /(?:inquiry|inquiries)[:\s]*([A-Z][A-Za-z0-9\s&'.,-]+)[|\s]*(\d{1,2}\/\d{1,2}\/\d{4})/gi;
    const inquiryMatches = text.matchAll(inquiryPattern);
    for (const match of inquiryMatches) {
      const bureau = normalizeBureau(match[1]);
      if (bureau) {
        result.inquiries.push({
          creditorName: match[1].trim(),
          inquiryDate: parseDate(match[2]) || match[2],
          bureau,
        });
      }
    }

    result.success = result.accounts.length > 0 || result.scores.length > 0;

    if (!result.success) {
      result.warnings.push(
        "No accounts or scores found - content may need AI parsing"
      );
    }
  } catch (error) {
    log.error({ err: error }, "IdentityIQ HTML parsing error");
    result.errors.push(
      error instanceof Error ? error.message : "Parsing failed"
    );
  }

  return result;
}

/**
 * Helper to save IdentityIQ account data to result
 */
function saveIdentityIQAccount(
  result: HTMLParseResult,
  creditorName: string,
  data: Record<string, Record<string, string>>,
  bureaus: ("TRANSUNION" | "EXPERIAN" | "EQUIFAX")[]
): void {
  for (const bureau of bureaus) {
    const getValue = (field: string): string | undefined => {
      const fieldData = data[field];
      if (!fieldData) return undefined;
      const value = fieldData[bureau];
      return value && value !== "-" && value !== "N/A" ? value : undefined;
    };

    const accountNumber =
      getValue("account #") ||
      getValue("account number") ||
      getValue("acct #");
    const status =
      getValue("account status") || getValue("status") || getValue("pay status");

    // Only create account if we have meaningful data
    if (accountNumber || status) {
      result.accounts.push({
        creditorName,
        accountNumber: accountNumber || "N/A",
        accountType: getValue("account type") || getValue("type") || "OTHER",
        accountStatus: normalizeStatus(status || "UNKNOWN"),
        bureau,
        balance: parseCurrency(getValue("balance")),
        creditLimit: parseCurrency(
          getValue("credit limit") || getValue("limit")
        ),
        highBalance: parseCurrency(
          getValue("high balance") || getValue("high credit")
        ),
        pastDue: parseCurrency(getValue("past due") || getValue("amount past due")),
        monthlyPayment: parseCurrency(
          getValue("monthly payment") || getValue("payment")
        ),
        dateOpened: parseDate(getValue("date opened") || getValue("opened")),
        dateReported: parseDate(
          getValue("date reported") || getValue("reported")
        ),
        lastActivityDate: parseDate(
          getValue("last activity") || getValue("last active")
        ),
        paymentStatus: getValue("payment status") || getValue("pay status"),
        responsibility: getValue("responsibility"),
        comments: getValue("comments") || getValue("remarks"),
        extractionConfidence: 0.85,
      });
    }
  }
}

// =============================================================================
// MYSCOREIQ PARSER
// =============================================================================

/**
 * Parse MyScoreIQ HTML format
 */
function parseMyScoreIQHTML(html: string): HTMLParseResult {
  const result: HTMLParseResult = {
    success: false,
    source: "MYSCOREIQ",
    accounts: [],
    scores: [],
    personalInfo: {},
    inquiries: [],
    rawText: "",
    errors: [],
    warnings: [],
  };

  try {
    const text = extractTableStructure(html);
    result.rawText = text;

    // MyScoreIQ often uses similar 3-bureau format
    // Extract scores first
    const scorePattern =
      /(?:transunion|tu)[:\s|]*(\d{3})[|\s]*(?:experian|ex)[:\s|]*(\d{3})[|\s]*(?:equifax|eq)[:\s|]*(\d{3})/gi;
    const scoreMatch = scorePattern.exec(text);

    if (scoreMatch) {
      const tu = parseInt(scoreMatch[1]);
      const ex = parseInt(scoreMatch[2]);
      const eq = parseInt(scoreMatch[3]);

      if (tu >= 300 && tu <= 850)
        result.scores.push({
          bureau: "TRANSUNION",
          score: tu,
          scoreType: "VANTAGESCORE",
        });
      if (ex >= 300 && ex <= 850)
        result.scores.push({
          bureau: "EXPERIAN",
          score: ex,
          scoreType: "VANTAGESCORE",
        });
      if (eq >= 300 && eq <= 850)
        result.scores.push({
          bureau: "EQUIFAX",
          score: eq,
          scoreType: "VANTAGESCORE",
        });
    }

    // Parse accounts - MyScoreIQ uses a similar table structure
    // Look for account sections
    const accountSections = text.split(
      /(?=(?:REVOLVING|INSTALLMENT|MORTGAGE|COLLECTION|OTHER)\s+ACCOUNTS?)/i
    );

    for (const section of accountSections) {
      const lines = section.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Look for creditor name patterns
        if (
          line.match(/^[A-Z][A-Z0-9\s&'.,-]+$/) &&
          line.length > 3 &&
          line.length < 50
        ) {
          // This might be a creditor name, look for data in following lines
          const dataLines = lines.slice(i + 1, i + 15);
          const accountData = parseAccountDataLines(dataLines);

          if (accountData.hasData) {
            for (const bureau of ["TRANSUNION", "EXPERIAN", "EQUIFAX"] as const) {
              if (accountData.bureauData[bureau]) {
                result.accounts.push({
                  creditorName: line,
                  accountNumber:
                    accountData.bureauData[bureau].accountNumber || "N/A",
                  accountType:
                    accountData.bureauData[bureau].accountType || "OTHER",
                  accountStatus: normalizeStatus(
                    accountData.bureauData[bureau].status || "UNKNOWN"
                  ),
                  bureau,
                  balance: accountData.bureauData[bureau].balance,
                  creditLimit: accountData.bureauData[bureau].creditLimit,
                  pastDue: accountData.bureauData[bureau].pastDue,
                  dateOpened: accountData.bureauData[bureau].dateOpened,
                  extractionConfidence: 0.8,
                });
              }
            }
          }
        }
      }
    }

    result.success = result.accounts.length > 0 || result.scores.length > 0;

    if (!result.success) {
      result.warnings.push(
        "Limited data extracted - may need AI parsing for full extraction"
      );
    }
  } catch (error) {
    log.error({ err: error }, "MyScoreIQ HTML parsing error");
    result.errors.push(
      error instanceof Error ? error.message : "Parsing failed"
    );
  }

  return result;
}

// =============================================================================
// MYFREESCORENOW PARSER
// =============================================================================

/**
 * Parse MyFreeScoreNow HTML format
 */
function parseMyFreeScoreNowHTML(html: string): HTMLParseResult {
  const result: HTMLParseResult = {
    success: false,
    source: "MYFREESCORENOW",
    accounts: [],
    scores: [],
    personalInfo: {},
    inquiries: [],
    rawText: "",
    errors: [],
    warnings: [],
  };

  try {
    const text = extractTableStructure(html);
    result.rawText = text;

    // MyFreeScoreNow often has a different layout
    // Extract scores
    const singleScorePattern =
      /(?:transunion|experian|equifax)\s*[:\s]*(\d{3})/gi;
    let match;

    while ((match = singleScorePattern.exec(text)) !== null) {
      const bureau = normalizeBureau(match[0]);
      const score = parseInt(match[1]);

      if (bureau && score >= 300 && score <= 850) {
        // Avoid duplicates
        if (!result.scores.find((s) => s.bureau === bureau)) {
          result.scores.push({ bureau, score, scoreType: "VANTAGESCORE" });
        }
      }
    }

    // Parse accounts - look for account blocks
    const lines = text.split("\n");
    let currentAccount: Partial<ParsedAccount> | null = null;
    let currentBureau: "TRANSUNION" | "EXPERIAN" | "EQUIFAX" | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect bureau context
      const bureauMatch = trimmed.match(/^(transunion|experian|equifax)/i);
      if (bureauMatch) {
        currentBureau = normalizeBureau(bureauMatch[1]);
      }

      // Detect creditor name (usually uppercase, reasonable length)
      if (
        trimmed.match(/^[A-Z][A-Z0-9\s&'.,-]+$/) &&
        trimmed.length > 3 &&
        trimmed.length < 50 &&
        !trimmed.match(/^(ACCOUNT|STATUS|BALANCE|PAYMENT|DATE|CREDIT)/i)
      ) {
        // Save previous account
        if (
          currentAccount?.creditorName &&
          currentAccount.bureau &&
          currentAccount.accountNumber
        ) {
          result.accounts.push(currentAccount as ParsedAccount);
        }

        currentAccount = {
          creditorName: trimmed,
          bureau: currentBureau || "TRANSUNION",
          extractionConfidence: 0.75,
        };
        continue;
      }

      // Parse account fields
      if (currentAccount) {
        const fieldPatterns: [RegExp, keyof ParsedAccount][] = [
          [/account\s*#?[:\s]*([A-Z0-9*X]+)/i, "accountNumber"],
          [/status[:\s]*([A-Za-z\s]+)/i, "accountStatus"],
          [/balance[:\s]*\$?([\d,]+)/i, "balance"],
          [/limit[:\s]*\$?([\d,]+)/i, "creditLimit"],
          [/past\s*due[:\s]*\$?([\d,]+)/i, "pastDue"],
          [/opened[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i, "dateOpened"],
          [/type[:\s]*([A-Za-z\s]+)/i, "accountType"],
        ];

        for (const [pattern, field] of fieldPatterns) {
          const fieldMatch = trimmed.match(pattern);
          if (fieldMatch) {
            if (field === "balance" || field === "creditLimit" || field === "pastDue") {
              (currentAccount as Record<string, unknown>)[field] = parseCurrency(fieldMatch[1]);
            } else if (field === "dateOpened") {
              currentAccount[field] = parseDate(fieldMatch[1]);
            } else if (field === "accountStatus") {
              currentAccount[field] = normalizeStatus(fieldMatch[1]);
            } else {
              (currentAccount as Record<string, unknown>)[field] = fieldMatch[1].trim();
            }
          }
        }
      }
    }

    // Save last account
    if (
      currentAccount?.creditorName &&
      currentAccount.accountNumber
    ) {
      if (!currentAccount.bureau) currentAccount.bureau = "TRANSUNION";
      if (!currentAccount.accountStatus) currentAccount.accountStatus = "UNKNOWN";
      if (!currentAccount.accountType) currentAccount.accountType = "OTHER";
      result.accounts.push(currentAccount as ParsedAccount);
    }

    result.success = result.accounts.length > 0 || result.scores.length > 0;

    if (!result.success) {
      result.warnings.push(
        "Limited data extracted - may need AI parsing for full extraction"
      );
    }
  } catch (error) {
    log.error({ err: error }, "MyFreeScoreNow HTML parsing error");
    result.errors.push(
      error instanceof Error ? error.message : "Parsing failed"
    );
  }

  return result;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

interface AccountDataLines {
  hasData: boolean;
  bureauData: {
    TRANSUNION?: {
      accountNumber?: string;
      accountType?: string;
      status?: string;
      balance?: number;
      creditLimit?: number;
      pastDue?: number;
      dateOpened?: string;
    };
    EXPERIAN?: {
      accountNumber?: string;
      accountType?: string;
      status?: string;
      balance?: number;
      creditLimit?: number;
      pastDue?: number;
      dateOpened?: string;
    };
    EQUIFAX?: {
      accountNumber?: string;
      accountType?: string;
      status?: string;
      balance?: number;
      creditLimit?: number;
      pastDue?: number;
      dateOpened?: string;
    };
  };
}

/**
 * Parse account data from lines following a creditor name
 */
function parseAccountDataLines(lines: string[]): AccountDataLines {
  const result: AccountDataLines = {
    hasData: false,
    bureauData: {},
  };

  const bureaus: ("TRANSUNION" | "EXPERIAN" | "EQUIFAX")[] = [
    "TRANSUNION",
    "EXPERIAN",
    "EQUIFAX",
  ];

  for (const line of lines) {
    const trimmed = line.trim();

    // Look for 3-column data patterns
    const threeColMatch = trimmed.match(
      /^([^|]+)[:|]\s*([^|]+)\|([^|]+)\|([^|]+)$/
    );
    if (threeColMatch) {
      const fieldName = threeColMatch[1].toLowerCase().trim();
      const values = [
        threeColMatch[2].trim(),
        threeColMatch[3].trim(),
        threeColMatch[4].trim(),
      ];

      for (let i = 0; i < bureaus.length; i++) {
        const bureau = bureaus[i];
        if (!result.bureauData[bureau]) {
          result.bureauData[bureau] = {};
        }

        const value = values[i];
        if (value && value !== "-" && value !== "N/A") {
          result.hasData = true;

          if (fieldName.includes("account") && fieldName.includes("#")) {
            result.bureauData[bureau]!.accountNumber = value;
          } else if (fieldName.includes("status")) {
            result.bureauData[bureau]!.status = value;
          } else if (
            fieldName.includes("balance") &&
            !fieldName.includes("high")
          ) {
            result.bureauData[bureau]!.balance = parseCurrency(value);
          } else if (fieldName.includes("limit")) {
            result.bureauData[bureau]!.creditLimit = parseCurrency(value);
          } else if (fieldName.includes("past due")) {
            result.bureauData[bureau]!.pastDue = parseCurrency(value);
          } else if (fieldName.includes("opened")) {
            result.bureauData[bureau]!.dateOpened = parseDate(value);
          } else if (fieldName.includes("type")) {
            result.bureauData[bureau]!.accountType = value;
          }
        }
      }
    }
  }

  return result;
}

// =============================================================================
// MAIN PARSER
// =============================================================================

/**
 * Parse HTML from any supported credit report source
 */
export function parseHTMLCreditReport(html: string): HTMLParseResult {
  const source = detectCreditReportSource(html);

  log.info({ source, contentLength: html.length }, "Parsing HTML credit report");

  switch (source) {
    case "IDENTITYIQ":
      return parseIdentityIQHTML(html);
    case "MYSCOREIQ":
      return parseMyScoreIQHTML(html);
    case "MYFREESCORENOW":
      return parseMyFreeScoreNowHTML(html);
    default:
      // For unknown sources, try all parsers and use best result
      const idiqResult = parseIdentityIQHTML(html);
      if (idiqResult.success && idiqResult.accounts.length > 0) {
        idiqResult.source = "UNKNOWN";
        return idiqResult;
      }

      const msiqResult = parseMyScoreIQHTML(html);
      if (msiqResult.success && msiqResult.accounts.length > 0) {
        msiqResult.source = "UNKNOWN";
        return msiqResult;
      }

      const mfsnResult = parseMyFreeScoreNowHTML(html);
      if (mfsnResult.success && mfsnResult.accounts.length > 0) {
        mfsnResult.source = "UNKNOWN";
        return mfsnResult;
      }

      // Return empty result with raw text for AI parsing fallback
      return {
        success: false,
        source: "UNKNOWN",
        accounts: [],
        scores: [],
        personalInfo: {},
        inquiries: [],
        rawText: extractTableStructure(html),
        errors: [],
        warnings: [
          "Could not extract structured data - AI parsing recommended",
        ],
      };
  }
}

/**
 * Check if HTML content appears to be from a supported credit report source
 */
export function isValidCreditReportHTML(html: string): boolean {
  const source = detectCreditReportSource(html);
  if (source !== "UNKNOWN") return true;

  // Check for credit report indicators
  const lowerHtml = html.toLowerCase();
  return (
    (lowerHtml.includes("account") || lowerHtml.includes("creditor")) &&
    (lowerHtml.includes("transunion") ||
      lowerHtml.includes("experian") ||
      lowerHtml.includes("equifax"))
  );
}
