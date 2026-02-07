/**
 * Hybrid Credit Report Parser
 *
 * Combines position-based parsing (for IdentityIQ) with AI-powered parsing
 * (for other formats) to achieve maximum accuracy across all report types.
 *
 * Strategy:
 * 1. Detect report format
 * 2. For IdentityIQ: Use position-based parser (more accurate)
 * 3. For others: Use AI parser (format-agnostic)
 * 4. Validate results and apply confidence scoring
 */

import { createLogger } from "../logger";
import { detectReportFormat, type ReportFormat } from "./format-detector";
import { parseWithAIChunked } from "./ai-parser";
import type { AIParseRequest } from "./extraction-schema";
import {
  parseWithPositions,
  isIdentityIQFormat,
  detectDisputeNotations,
  detectAuthorizedUser,
  extractDOFD,
  isExpiredBySOL,
  generateEnhancedFingerprint,
  assignSequenceIndices,
  parsePersonalInfo,
  parseCreditScores,
  parseInquiries,
  detectColumnBoundaries,
  type PositionParsedAccount,
  type PositionParseResult,
  type ParsedInquiry,
  type Bureau,
} from "./position-parser";
import type { ParsedCreditReport, CreditAccount } from "./extraction-schema";
import { analyzeForIssues, type DetectedIssue } from "./issue-analyzer";
import { validateParsedReport, calculateConfidence, type ValidationResult } from "./validation";

const log = createLogger("hybrid-parser");

// Hybrid parse options
export interface HybridParseOptions {
  /** Force a specific parser */
  forceParser?: "POSITION" | "AI" | "AUTO";
  /** Organization ID for LLM cost tracking */
  organizationId?: string;
  /** Enable OCR for image-based documents */
  enableOCR?: boolean;
  /** Detect issues during parsing */
  detectIssues?: boolean;
  /** Page count for context */
  pageCount?: number;
  /** Extraction method */
  extractionMethod?: "TEXT" | "OCR";
  /** OCR confidence if applicable */
  ocrConfidence?: number;
}

// Complete hybrid parse result
export interface HybridParseResult {
  success: boolean;
  report: ParsedCreditReport | null;
  issues: DetectedIssue[];
  validation: ValidationResult | null;
  metadata: {
    parserUsed: "POSITION" | "AI" | "HYBRID";
    format: ReportFormat;
    positionParseConfidence: number;
    aiParseConfidence: number;
    finalConfidence: number;
    processingTimeMs: number;
    accountCount: number;
    validationPassed: boolean;
    warnings: string[];
    errors: string[];
  };
}

/**
 * Convert position-parsed account to standard CreditAccount format.
 */
function convertPositionAccount(
  posAccount: PositionParsedAccount,
  bureau: Bureau
): CreditAccount | null {
  // Skip if no data for this bureau
  const hasData =
    posAccount.accountNumber[bureau] ||
    posAccount.balance[bureau] !== null ||
    posAccount.accountStatus[bureau];

  if (!hasData) return null;

  // Detect dispute notations
  const disputeInfo = detectDisputeNotations(posAccount.rawBlock);

  // Detect AU status
  const auInfo = detectAuthorizedUser(
    posAccount.bureauCode[bureau],
    posAccount.responsibility[bureau]
  );

  // Extract DOFD
  const dofdInfo = extractDOFD(posAccount.rawBlock);

  // Generate enhanced fingerprint
  const fingerprint = generateEnhancedFingerprint(
    posAccount.creditorName,
    posAccount.accountNumber[bureau],
    posAccount.accountType[bureau],
    posAccount.dateOpened[bureau]
  );

  return {
    creditorName: posAccount.creditorName,
    accountNumber: posAccount.accountNumber[bureau] || "Unknown",
    accountType: posAccount.accountType[bureau] as CreditAccount["accountType"] || "OTHER",
    accountStatus: (posAccount.accountStatus[bureau]?.toUpperCase() || "UNKNOWN") as CreditAccount["accountStatus"],
    bureau: bureau,
    balance: posAccount.balance[bureau] ?? undefined,
    creditLimit: posAccount.creditLimit[bureau] ?? undefined,
    highBalance: posAccount.highBalance[bureau] ?? undefined,
    pastDue: posAccount.pastDue[bureau] ?? undefined,
    monthlyPayment: posAccount.monthlyPayment[bureau] ?? undefined,
    dateOpened: posAccount.dateOpened[bureau] || undefined,
    dateReported: posAccount.dateReported[bureau] || undefined,
    lastActivityDate: posAccount.lastActivityDate[bureau] || undefined,
    paymentStatus: posAccount.paymentStatus[bureau] as CreditAccount["paymentStatus"] || undefined,
    remarks: posAccount.comments[bureau] || undefined,

    // Parser 2.0 enhanced fields
    paymentHistory: posAccount.paymentHistory[bureau],
    responsibility: posAccount.responsibility[bureau] || undefined,
    isAuthorizedUser: auInfo.isAU,
    disputeNotation: disputeInfo.notations.join("; ") || undefined,
    hasBeenPreviouslyDisputed: disputeInfo.hasDispute,
    dateOfFirstDelinquency: dofdInfo.dofd || undefined,
    dateOfLastPayment: posAccount.dateOfLastPayment[bureau] || undefined,
    bureauCode: posAccount.bureauCode[bureau] || undefined,
    sequenceIndex: posAccount.sequenceIndex,

    // Computed fields
    fingerprint,
    isExpiredBySOL: dofdInfo.dofd ? isExpiredBySOL(dofdInfo.dofd) : false,
  };
}

/**
 * Convert position parse result to standard ParsedCreditReport format.
 */
function convertPositionResult(
  posResult: PositionParseResult,
  text: string
): ParsedCreditReport {
  const accounts: CreditAccount[] = [];
  const bureaus: Bureau[] = ["TRANSUNION", "EXPERIAN", "EQUIFAX"];

  // Assign sequence indices before conversion
  const indexedAccounts = assignSequenceIndices(posResult.accounts);

  // Convert each account for each bureau
  for (const posAccount of indexedAccounts) {
    for (const bureau of bureaus) {
      const converted = convertPositionAccount(posAccount, bureau);
      if (converted) {
        accounts.push(converted);
      }
    }
  }

  // Get personal info, scores, and inquiries from position parser
  const boundaries = detectColumnBoundaries(text);
  const personalInfo = posResult.personalInfo || parsePersonalInfo(text, boundaries);
  const creditScores = posResult.creditScores || parseCreditScores(text, boundaries);
  const parsedInquiries = posResult.inquiries || parseInquiries(text, boundaries);

  // Convert inquiries to standard format
  const inquiries = parsedInquiries.map(inq => ({
    inquirerName: inq.inquirerName,
    inquiryDate: inq.inquiryDate,
    inquiryType: inq.inquiryType as "HARD" | "SOFT",
    bureau: inq.bureau,
  }));

  // Build bureau summaries
  const tuAccounts = accounts.filter(a => a.bureau === "TRANSUNION");
  const exAccounts = accounts.filter(a => a.bureau === "EXPERIAN");
  const eqAccounts = accounts.filter(a => a.bureau === "EQUIFAX");

  const tuInquiries = inquiries.filter(i => i.bureau === "TRANSUNION").length;
  const exInquiries = inquiries.filter(i => i.bureau === "EXPERIAN").length;
  const eqInquiries = inquiries.filter(i => i.bureau === "EQUIFAX").length;

  const result: ParsedCreditReport = {
    consumer: {
      name: personalInfo?.TRANSUNION?.name ||
        personalInfo?.EXPERIAN?.name ||
        personalInfo?.EQUIFAX?.name ||
        "Unknown",
      addresses: [],
      ssnLast4: personalInfo?.TRANSUNION?.ssn?.slice(-4) || undefined,
      dateOfBirth: personalInfo?.TRANSUNION?.dateOfBirth || undefined,
    },
    bureaus: [
      {
        name: "TRANSUNION",
        creditScore: creditScores?.TRANSUNION?.score,
        scoreModel: creditScores?.TRANSUNION?.model,
        reportDate: new Date().toISOString().split("T")[0],
        accountCount: tuAccounts.length,
        hardInquiries: tuInquiries,
      },
      {
        name: "EXPERIAN",
        creditScore: creditScores?.EXPERIAN?.score,
        scoreModel: creditScores?.EXPERIAN?.model,
        reportDate: new Date().toISOString().split("T")[0],
        accountCount: exAccounts.length,
        hardInquiries: exInquiries,
      },
      {
        name: "EQUIFAX",
        creditScore: creditScores?.EQUIFAX?.score,
        scoreModel: creditScores?.EQUIFAX?.model,
        reportDate: new Date().toISOString().split("T")[0],
        accountCount: eqAccounts.length,
        hardInquiries: eqInquiries,
      },
    ],
    accounts,
    inquiries,
    publicRecords: [], // TODO: Parse public records
    metadata: {
      reportDate: new Date().toISOString().split("T")[0],
      reportFormat: "IDENTITY_IQ" as ReportFormat,
      parseConfidence: posResult.columnBoundaries.confidence * 100,
      parserVersion: "2.0.0",
    },

    // Parser 2.0 fields
    personalInfoByBureau: personalInfo ? {
      TRANSUNION: personalInfo.TRANSUNION || undefined,
      EXPERIAN: personalInfo.EXPERIAN || undefined,
      EQUIFAX: personalInfo.EQUIFAX || undefined,
    } : undefined,
  };

  // Add addresses from personal info
  if (personalInfo) {
    const allAddresses = new Set<string>();
    const currentAddresses = new Set<string>();

    for (const bureau of bureaus) {
      const info = personalInfo[bureau];
      if (info?.address) {
        allAddresses.add(info.address);
        currentAddresses.add(info.address);
      }
      if (info?.previousAddresses) {
        info.previousAddresses.forEach(addr => allAddresses.add(addr));
      }
    }

    result.consumer.addresses = [...allAddresses].map(addr => ({
      street: addr,
      city: "",
      state: "",
      zip: "",
      type: currentAddresses.has(addr) ? "CURRENT" as const : "PREVIOUS" as const,
      isCurrent: currentAddresses.has(addr),
    }));
  }

  return result;
}

/**
 * Merge position-parsed data into AI-parsed result for enhanced accuracy.
 */
function mergePositionIntoAI(
  aiResult: ParsedCreditReport,
  posResult: PositionParseResult,
  text: string
): ParsedCreditReport {
  // Use position parser's validation to verify AI extraction
  const posValidation = posResult.validationResult;

  // If position parser found validation issues, log them
  if (!posValidation.isValid) {
    log.warn(
      { discrepancies: posValidation.discrepancies },
      "Position parser found validation issues with AI result"
    );
  }

  // Enhance AI accounts with position-parsed data where available
  const boundaries = detectColumnBoundaries(text);
  const indexedPosAccounts = assignSequenceIndices(posResult.accounts);

  // Match AI accounts to position accounts and enhance
  for (const aiAccount of aiResult.accounts) {
    // Find matching position account
    const matchingPos = indexedPosAccounts.find(posAcc => {
      // Match by creditor name similarity
      const aiCreditor = aiAccount.creditorName.toLowerCase().replace(/\s+/g, "");
      const posCreditor = posAcc.creditorName.toLowerCase().replace(/\s+/g, "");

      return (
        aiCreditor.includes(posCreditor) ||
        posCreditor.includes(aiCreditor) ||
        levenshteinDistance(aiCreditor, posCreditor) < 5
      );
    });

    if (matchingPos) {
      // Add enhanced fields from position parser
      const bureau = aiAccount.bureau as Bureau;

      // Add dispute notation
      const disputeInfo = detectDisputeNotations(matchingPos.rawBlock);
      if (!aiAccount.disputeNotation && disputeInfo.hasDispute) {
        aiAccount.disputeNotation = disputeInfo.notations.join("; ");
        aiAccount.hasBeenPreviouslyDisputed = true;
      }

      // Add AU detection
      const auInfo = detectAuthorizedUser(
        matchingPos.bureauCode[bureau],
        matchingPos.responsibility[bureau]
      );
      if (auInfo.isAU) {
        aiAccount.isAuthorizedUser = true;
        aiAccount.responsibility = matchingPos.responsibility[bureau] || undefined;
      }

      // Add DOFD
      const dofdInfo = extractDOFD(matchingPos.rawBlock);
      if (dofdInfo.dofd && !aiAccount.dateOfFirstDelinquency) {
        aiAccount.dateOfFirstDelinquency = dofdInfo.dofd;
        aiAccount.isExpiredBySOL = isExpiredBySOL(dofdInfo.dofd);
      }

      // Add payment history
      if (matchingPos.paymentHistory[bureau]?.length > 0) {
        aiAccount.paymentHistory = matchingPos.paymentHistory[bureau];
      }

      // Add bureau code
      if (matchingPos.bureauCode[bureau]) {
        aiAccount.bureauCode = matchingPos.bureauCode[bureau] || undefined;
      }

      // Add sequence index
      aiAccount.sequenceIndex = matchingPos.sequenceIndex;

      // Generate enhanced fingerprint
      aiAccount.fingerprint = generateEnhancedFingerprint(
        aiAccount.creditorName,
        aiAccount.accountNumber,
        aiAccount.accountType,
        aiAccount.dateOpened || null
      );
    }
  }

  // Add personal info from position parser
  const personalInfo = parsePersonalInfo(text, boundaries);
  const creditScores = parseCreditScores(text, boundaries);

  // Enhance bureau data with scores
  for (const bureau of aiResult.bureaus) {
    const posScore = creditScores[bureau.name as Bureau];
    if (posScore && !bureau.creditScore) {
      bureau.creditScore = posScore.score;
      bureau.scoreModel = posScore.model;
    }
  }

  // Update metadata
  aiResult.metadata.parserVersion = "2.0.0-hybrid";

  return aiResult;
}

/**
 * Simple Levenshtein distance for string comparison.
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Main hybrid parser entry point.
 */
export async function parseWithHybrid(
  text: string,
  options: HybridParseOptions = {}
): Promise<HybridParseResult> {
  const startTime = Date.now();
  const warnings: string[] = [];
  const errors: string[] = [];

  const {
    forceParser = "AUTO",
    organizationId = "system",
    enableOCR = true,
    detectIssues = true,
    pageCount = 1,
    extractionMethod = "TEXT",
    ocrConfidence,
  } = options;

  log.info(
    {
      textLength: text.length,
      forceParser,
      enableOCR,
    },
    "Starting hybrid parsing"
  );

  // Detect format
  const formatDetection = detectReportFormat(text);
  const isIdentityIQ = isIdentityIQFormat(text);

  log.info(
    {
      format: formatDetection.format,
      confidence: formatDetection.confidence,
      isIdentityIQ,
    },
    "Format detected"
  );

  let report: ParsedCreditReport | null = null;
  let parserUsed: "POSITION" | "AI" | "HYBRID" = "AI";
  let positionConfidence = 0;
  let aiConfidence = 0;

  try {
    // Decide which parser(s) to use
    const usePosition =
      forceParser === "POSITION" ||
      (forceParser === "AUTO" && isIdentityIQ && formatDetection.confidence > 0.7);

    const useAI =
      forceParser === "AI" ||
      (forceParser === "AUTO" && (!isIdentityIQ || formatDetection.confidence <= 0.7));

    const useHybrid =
      forceParser === "AUTO" &&
      isIdentityIQ &&
      formatDetection.confidence > 0.5;

    if (usePosition && !useHybrid) {
      // Pure position-based parsing
      log.info("Using position-based parser");
      parserUsed = "POSITION";

      const posResult = await parseWithPositions(text);
      positionConfidence = posResult.columnBoundaries.confidence * 100;

      if (posResult.success) {
        report = convertPositionResult(posResult, text);

        // Apply validation adjustment
        if (posResult.validationResult.isValid) {
          positionConfidence += 10;
        } else {
          positionConfidence -= Math.abs(posResult.validationResult.confidenceAdjustment);
          warnings.push(...posResult.validationResult.discrepancies);
        }
      } else {
        warnings.push("Position parsing failed, no accounts extracted");
      }
    } else if (useAI && !useHybrid) {
      // Pure AI parsing
      log.info("Using AI parser");
      parserUsed = "AI";

      const aiRequest: AIParseRequest = {
        rawText: text,
        reportFormat: formatDetection.format,
        organizationId,
        pageCount,
        extractionMethod,
        ocrConfidence,
      };

      report = await parseWithAIChunked(aiRequest);
      aiConfidence = report.metadata.parseConfidence;
    } else {
      // Hybrid: Use both parsers and merge
      log.info("Using hybrid parsing strategy");
      parserUsed = "HYBRID";

      // Run both parsers
      const [posResult, aiResult] = await Promise.all([
        parseWithPositions(text),
        parseWithAIChunked({
          rawText: text,
          reportFormat: formatDetection.format,
          organizationId,
          pageCount,
          extractionMethod,
          ocrConfidence,
        }),
      ]);

      positionConfidence = posResult.columnBoundaries.confidence * 100;
      aiConfidence = aiResult.metadata.parseConfidence;

      // Merge position data into AI result
      report = mergePositionIntoAI(aiResult, posResult, text);

      // Add validation warnings
      if (!posResult.validationResult.isValid) {
        warnings.push(...posResult.validationResult.discrepancies);
      }
    }

    // Calculate final confidence
    let finalConfidence = 0;
    if (parserUsed === "POSITION") {
      finalConfidence = positionConfidence;
    } else if (parserUsed === "AI") {
      finalConfidence = aiConfidence;
    } else {
      // Hybrid: weighted average with bonus
      finalConfidence = (positionConfidence * 0.4 + aiConfidence * 0.6) + 5;
    }

    // Validate report
    let validation: ValidationResult | null = null;
    if (report) {
      validation = validateParsedReport(report);
      finalConfidence = calculateConfidence(report, extractionMethod, ocrConfidence);

      if (validation.warnings.length > 0) {
        warnings.push(...validation.warnings.map(w => w.message));
      }
      if (validation.errors.length > 0) {
        errors.push(...validation.errors.map(e => e.message));
      }
    }

    // Detect issues
    let issues: DetectedIssue[] = [];
    if (report && detectIssues) {
      issues = analyzeForIssues(report);
    }

    const processingTimeMs = Date.now() - startTime;

    log.info(
      {
        success: !!report,
        parserUsed,
        accountCount: report?.accounts.length || 0,
        issueCount: issues.length,
        finalConfidence,
        processingTimeMs,
      },
      "Hybrid parsing complete"
    );

    return {
      success: !!report && report.accounts.length > 0,
      report,
      issues,
      validation,
      metadata: {
        parserUsed,
        format: formatDetection.format,
        positionParseConfidence: positionConfidence,
        aiParseConfidence: aiConfidence,
        finalConfidence,
        processingTimeMs,
        accountCount: report?.accounts.length || 0,
        validationPassed: validation?.isValid ?? false,
        warnings,
        errors,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log.error({ err: error }, "Hybrid parsing failed");

    return {
      success: false,
      report: null,
      issues: [],
      validation: null,
      metadata: {
        parserUsed,
        format: formatDetection.format,
        positionParseConfidence: positionConfidence,
        aiParseConfidence: aiConfidence,
        finalConfidence: 0,
        processingTimeMs: Date.now() - startTime,
        accountCount: 0,
        validationPassed: false,
        warnings,
        errors: [errorMessage],
      },
    };
  }
}
