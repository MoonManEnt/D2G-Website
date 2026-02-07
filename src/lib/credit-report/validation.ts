/**
 * Credit Report Validation Module
 *
 * Validates parsed credit report data for completeness and consistency.
 * Calculates confidence scores based on data quality.
 */

import type { ParsedCreditReport, CreditAccount, ConsumerInfo, Bureau } from "./extraction-schema";
import { createLogger } from "../logger";
const log = createLogger("validation");

// Validation warning
export interface ValidationWarning {
  field: string;
  message: string;
  severity: "low" | "medium" | "high";
}

// Validation error
export interface ValidationError {
  field: string;
  message: string;
}

// Validation result
export interface ValidationResult {
  isValid: boolean;
  confidence: number; // 0-1 scale
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: ValidationStats;
}

// Statistics about the validation
export interface ValidationStats {
  totalAccounts: number;
  accountsWithIssues: number;
  completeAccounts: number;
  bureauCoverage: Bureau[];
  dataCompleteness: number; // 0-1 scale
  consistencyScore: number; // 0-1 scale
}

/**
 * Validate consumer information.
 */
function validateConsumer(consumer: ConsumerInfo): {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  completeness: number;
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  let fieldsComplete = 0;
  const totalFields = 4; // name, ssn, dob, address

  // Required: Name
  if (!consumer.name || consumer.name.trim().length < 2) {
    errors.push({ field: "consumer.name", message: "Consumer name is missing or too short" });
  } else {
    fieldsComplete++;
  }

  // Optional but important: SSN
  if (consumer.ssn) {
    if (!/^\*{3}-\*{2}-\d{4}$|^XXX-XX-\d{4}$|^\d{4}$/.test(consumer.ssn)) {
      warnings.push({
        field: "consumer.ssn",
        message: "SSN format is unusual - expected XXX-XX-1234",
        severity: "low",
      });
    } else {
      fieldsComplete++;
    }
  } else {
    warnings.push({
      field: "consumer.ssn",
      message: "SSN not extracted - may affect identification",
      severity: "medium",
    });
  }

  // Optional: DOB
  if (consumer.dateOfBirth) {
    const dobDate = new Date(consumer.dateOfBirth);
    if (isNaN(dobDate.getTime())) {
      warnings.push({
        field: "consumer.dateOfBirth",
        message: "Date of birth format is invalid",
        severity: "low",
      });
    } else {
      fieldsComplete++;
    }
  }

  // Required: At least one address
  if (!consumer.addresses || consumer.addresses.length === 0) {
    warnings.push({
      field: "consumer.addresses",
      message: "No addresses extracted",
      severity: "medium",
    });
  } else {
    fieldsComplete++;
    // Validate first address
    const addr = consumer.addresses[0];
    if (!addr.street || !addr.city || !addr.state || !addr.zip) {
      warnings.push({
        field: "consumer.addresses",
        message: "Primary address is incomplete",
        severity: "medium",
      });
    }
  }

  return {
    errors,
    warnings,
    completeness: fieldsComplete / totalFields,
  };
}

/**
 * Validate a single account.
 */
function validateAccount(account: CreditAccount): {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  completeness: number;
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  let fieldsComplete = 0;
  const totalFields = 8; // Essential fields to check

  // Required: Creditor name
  if (!account.creditorName || account.creditorName.length < 2) {
    errors.push({ field: "creditorName", message: "Creditor name is missing" });
  } else {
    fieldsComplete++;
  }

  // Required: Account number
  if (!account.accountNumber) {
    warnings.push({
      field: "accountNumber",
      message: "Account number not extracted",
      severity: "medium",
    });
  } else {
    fieldsComplete++;
  }

  // Required: Bureau
  if (!account.bureau) {
    errors.push({ field: "bureau", message: "Bureau not identified" });
  } else {
    fieldsComplete++;
  }

  // Required: Account type
  if (!account.accountType || account.accountType === "OTHER") {
    warnings.push({
      field: "accountType",
      message: "Account type not properly identified",
      severity: "low",
    });
  } else {
    fieldsComplete++;
  }

  // Required: Status
  if (!account.status || account.status === "UNKNOWN") {
    warnings.push({
      field: "status",
      message: "Account status not identified",
      severity: "medium",
    });
  } else {
    fieldsComplete++;
  }

  // Financial validation
  if (typeof account.balance === "number") {
    fieldsComplete++;
    if (account.balance < 0) {
      warnings.push({
        field: "balance",
        message: "Negative balance detected",
        severity: "low",
      });
    }
  }

  // Date validation
  if (account.dateOpened) {
    fieldsComplete++;
    const openDate = new Date(account.dateOpened);
    if (isNaN(openDate.getTime())) {
      warnings.push({
        field: "dateOpened",
        message: "Invalid date format for dateOpened",
        severity: "low",
      });
    }
  }

  // Payment history validation
  if (account.paymentHistory && account.paymentHistory.length > 0) {
    fieldsComplete++;
    // Check for valid status codes - handle both string[] and PaymentHistoryEntry[]
    const validCodes = ["OK", "30", "60", "90", "120", "150", "180", "CO", "CLS", "-", "UNKNOWN", "C", "1", "2", "3", "4", "5", "6", "X"];
    const invalidEntries: string[] = [];
    account.paymentHistory.forEach((p) => {
      const code = typeof p === "string" ? p : p.status;
      if (!validCodes.includes(code)) {
        invalidEntries.push(code);
      }
    });
    if (invalidEntries.length > 0) {
      warnings.push({
        field: "paymentHistory",
        message: `Invalid payment status codes: ${invalidEntries.join(", ")}`,
        severity: "low",
      });
    }
  }

  // Logical consistency checks
  if (account.creditLimit && account.balance) {
    if (account.balance > account.creditLimit * 2) {
      warnings.push({
        field: "balance",
        message: "Balance is unusually high compared to credit limit",
        severity: "medium",
      });
    }
  }

  if (account.status === "CLOSED" && account.pastDue && account.pastDue > 0) {
    warnings.push({
      field: "pastDue",
      message: "Closed account shows past due amount",
      severity: "high",
    });
  }

  return {
    errors,
    warnings,
    completeness: fieldsComplete / totalFields,
  };
}

/**
 * Validate the complete parsed credit report.
 */
export function validateParsedReport(report: ParsedCreditReport): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  log.info({
    accountCount: report.accounts.length,
    inquiryCount: report.inquiries.length,
  }, "Starting report validation");

  // Validate consumer info
  const consumerValidation = validateConsumer(report.consumer);
  errors.push(...consumerValidation.errors);
  warnings.push(...consumerValidation.warnings);

  // Validate accounts
  let totalAccountCompleteness = 0;
  let accountsWithIssues = 0;
  let completeAccounts = 0;
  const bureausFound = new Set<Bureau>();

  for (const account of report.accounts) {
    const validation = validateAccount(account);
    if (validation.errors.length > 0) {
      errors.push(...validation.errors.map((e) => ({
        field: `account[${account.id}].${e.field}`,
        message: e.message,
      })));
    }
    if (validation.warnings.length > 0) {
      warnings.push(...validation.warnings.map((w) => ({
        ...w,
        field: `account[${account.id}].${w.field}`,
      })));
      accountsWithIssues++;
    }

    totalAccountCompleteness += validation.completeness;
    if (validation.completeness >= 0.8) {
      completeAccounts++;
    }

    bureausFound.add(account.bureau);
  }

  // Check for minimum data
  if (report.accounts.length === 0) {
    errors.push({
      field: "accounts",
      message: "No accounts were extracted from the report",
    });
  }

  // Calculate metrics
  const avgAccountCompleteness = report.accounts.length > 0
    ? totalAccountCompleteness / report.accounts.length
    : 0;

  // Calculate consistency score based on cross-bureau data
  let consistencyScore = 1;
  if (bureausFound.size > 1) {
    // Group accounts by creditor to check consistency
    const accountsByCreditor = new Map<string, CreditAccount[]>();
    for (const account of report.accounts) {
      const key = account.creditorName.toLowerCase().replace(/[^a-z0-9]/g, "");
      const existing = accountsByCreditor.get(key) || [];
      existing.push(account);
      accountsByCreditor.set(key, existing);
    }

    let consistencyIssues = 0;
    for (const accounts of accountsByCreditor.values()) {
      if (accounts.length > 1) {
        // Check for balance consistency
        const balances = accounts.map((a) => a.balance).filter((b): b is number => b !== undefined);
        if (balances.length > 1) {
          const avg = balances.reduce((a, b) => a + b, 0) / balances.length;
          const variance = balances.some((b) => Math.abs(b - avg) > avg * 0.1);
          if (variance) consistencyIssues++;
        }

        // Check for status consistency
        const statuses = new Set(accounts.map((a) => a.status));
        if (statuses.size > 1) consistencyIssues++;
      }
    }

    consistencyScore = 1 - (consistencyIssues / Math.max(accountsByCreditor.size, 1));
  }

  // Calculate overall data completeness
  const dataCompleteness = (consumerValidation.completeness * 0.3) + (avgAccountCompleteness * 0.7);

  // Calculate confidence
  // Base confidence from parse confidence in metadata
  let confidence = report.metadata.parseConfidence;

  // Adjust based on validation results
  const errorPenalty = Math.min(errors.length * 0.1, 0.3);
  const warningPenalty = Math.min(warnings.length * 0.02, 0.2);
  const completenessBonusPenalty = (1 - dataCompleteness) * 0.2;

  confidence = Math.max(
    0,
    confidence - errorPenalty - warningPenalty - completenessBonusPenalty
  );

  // OCR extractions get a slight penalty
  if (report.metadata.extractionMethod === "OCR") {
    confidence *= 0.9;
  }

  const isValid = errors.length === 0;

  log.info({
    isValid,
    confidence,
    errorCount: errors.length,
    warningCount: warnings.length,
    dataCompleteness,
    consistencyScore,
  }, "Validation complete");

  return {
    isValid,
    confidence: Math.round(confidence * 100) / 100,
    errors,
    warnings,
    stats: {
      totalAccounts: report.accounts.length,
      accountsWithIssues,
      completeAccounts,
      bureauCoverage: Array.from(bureausFound),
      dataCompleteness: Math.round(dataCompleteness * 100) / 100,
      consistencyScore: Math.round(consistencyScore * 100) / 100,
    },
  };
}

/**
 * Calculate an overall confidence score for extraction quality.
 */
export function calculateConfidence(
  report: ParsedCreditReport,
  extractionMethod: "TEXT" | "OCR",
  ocrConfidence?: number
): number {
  let confidence = 0.8; // Base confidence

  // OCR confidence adjustment
  if (extractionMethod === "OCR") {
    confidence *= 0.85; // 15% penalty for OCR
    if (ocrConfidence !== undefined) {
      // Scale OCR confidence (0-100) to 0-1 and blend
      const ocrFactor = (ocrConfidence / 100) * 0.5 + 0.5; // Maps 0-100 to 0.5-1
      confidence *= ocrFactor;
    }
  }

  // Account count confidence (more accounts = more reliable)
  const accountBonus = Math.min(report.accounts.length / 20, 0.1); // Up to 10% bonus
  confidence += accountBonus;

  // Format recognition confidence
  if (report.metadata.reportFormat !== "UNKNOWN") {
    confidence += 0.05; // 5% bonus for recognized format
  }

  // Consumer data completeness
  if (report.consumer.name && report.consumer.addresses.length > 0) {
    confidence += 0.05;
  }

  return Math.min(Math.round(confidence * 100) / 100, 1);
}
