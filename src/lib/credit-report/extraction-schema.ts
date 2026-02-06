/**
 * Credit Report Extraction Schema
 *
 * Defines the structured output types for AI-powered credit report parsing.
 * These types are format-agnostic and can represent data from any credit report source.
 */

// Bureau identifiers
export type Bureau = "EXPERIAN" | "EQUIFAX" | "TRANSUNION";

// Account type classifications
export type AccountType =
  | "CREDIT_CARD"
  | "MORTGAGE"
  | "AUTO_LOAN"
  | "STUDENT_LOAN"
  | "PERSONAL_LOAN"
  | "HELOC"
  | "INSTALLMENT"
  | "COLLECTION"
  | "CHARGE_CARD"
  | "RETAIL_CARD"
  | "MEDICAL"
  | "UTILITY"
  | "OTHER";

// Account status types
export type AccountStatus =
  | "OPEN"
  | "CLOSED"
  | "PAID"
  | "COLLECTION"
  | "CHARGE_OFF"
  | "FORECLOSURE"
  | "REPOSSESSION"
  | "TRANSFERRED"
  | "DEFERRED"
  | "UNKNOWN";

// Payment status for history
export type PaymentStatusCode =
  | "OK"
  | "30"
  | "60"
  | "90"
  | "120"
  | "150"
  | "180"
  | "CO"
  | "CLS"
  | "-"
  | "UNKNOWN";

// Address structure
export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  type?: "CURRENT" | "PREVIOUS" | "UNKNOWN";
  dateReported?: string;
}

// Consumer personal information
export interface ConsumerInfo {
  name: string;
  aliases?: string[];
  dateOfBirth?: string;
  ssn?: string; // Last 4 only (XXX-XX-1234)
  addresses: Address[];
  phone?: string;
  employerInfo?: {
    name?: string;
    address?: string;
    dateReported?: string;
  };
}

// Payment history entry
export interface PaymentHistoryEntry {
  month: string; // "Jan", "Feb", etc.
  year: string; // "24", "25", etc.
  status: PaymentStatusCode;
}

// Credit account information
export interface CreditAccount {
  id?: string; // Internal ID for tracking
  creditorName: string;
  accountNumber: string; // Last 4-6 digits masked
  accountType: AccountType;
  status: AccountStatus;
  bureau: Bureau;

  // Financial data
  balance?: number;
  creditLimit?: number;
  highBalance?: number;
  pastDue?: number;
  monthlyPayment?: number;
  originalAmount?: number;

  // Dates
  dateOpened?: string; // ISO format
  dateReported?: string;
  dateClosed?: string;
  dateLastActive?: string;
  dateLastPayment?: string;
  dateOfFirstDelinquency?: string;

  // Payment info
  paymentStatus?: string;
  paymentHistory?: PaymentHistoryEntry[];
  termsMonths?: number;
  termsDuration?: string;

  // Responsibility
  responsibility?: "INDIVIDUAL" | "JOINT" | "AUTHORIZED_USER" | "CO_SIGNER" | "UNKNOWN";

  // Comments and remarks
  comments?: string;
  disputeComment?: string;

  // Source tracking
  rawExtractedText?: string;
  sourcePageNum?: number;
  extractionConfidence?: number;
}

// Inquiry information
export interface CreditInquiry {
  inquirerName: string;
  inquiryDate: string;
  inquiryType: "HARD" | "SOFT";
  bureau: Bureau;
  purpose?: string;
}

// Public records
export interface PublicRecord {
  type: "BANKRUPTCY" | "TAX_LIEN" | "JUDGMENT" | "CIVIL_SUIT" | "FORECLOSURE" | "OTHER";
  filedDate?: string;
  resolvedDate?: string;
  amount?: number;
  court?: string;
  status?: string;
  bureau: Bureau;
  description?: string;
}

// Bureau-specific summary
export interface BureauSummary {
  bureau: Bureau;
  reportDate?: string;
  creditScore?: number;
  scoreType?: string; // "FICO", "VANTAGE3", etc.
  totalAccounts?: number;
  openAccounts?: number;
  closedAccounts?: number;
  derogatory?: number;
  totalBalance?: number;
  totalCreditLimit?: number;
  utilizationPercent?: number;
  hardInquiries?: number;
  softInquiries?: number;
}

// Complete parsed credit report
export interface ParsedCreditReport {
  consumer: ConsumerInfo;
  bureaus: BureauSummary[];
  accounts: CreditAccount[];
  inquiries: CreditInquiry[];
  publicRecords: PublicRecord[];

  metadata: {
    reportDate: string;
    reportFormat: string;
    parseConfidence: number;
    sourceType: "PDF" | "IMAGE" | "TEXT";
    extractionMethod: "TEXT" | "OCR";
    processingTimeMs: number;
    warnings?: string[];
  };
}

// AI Parsing Request
export interface AIParseRequest {
  rawText: string;
  reportFormat?: string;
  organizationId?: string;
  pageCount?: number;
  extractionMethod: "TEXT" | "OCR";
  ocrConfidence?: number;
}

// AI Parsing Response (internal)
export interface AIParseResponse {
  consumer: ConsumerInfo;
  accounts: CreditAccount[];
  inquiries: CreditInquiry[];
  publicRecords: PublicRecord[];
  bureauSummaries: BureauSummary[];
  confidence: number;
}

// The prompt schema description for the LLM
export const CREDIT_REPORT_PROMPT_SCHEMA = `
You are parsing a credit report. Extract ALL information into this exact JSON structure:

{
  "consumer": {
    "name": "Full legal name as shown on report",
    "aliases": ["Any AKA or alternate names"],
    "dateOfBirth": "YYYY-MM-DD format if available",
    "ssn": "XXX-XX-1234 format (last 4 only)",
    "addresses": [
      {
        "street": "Street address",
        "city": "City",
        "state": "Two-letter state code",
        "zip": "ZIP code",
        "type": "CURRENT or PREVIOUS"
      }
    ]
  },
  "accounts": [
    {
      "creditorName": "Creditor/lender name",
      "accountNumber": "Last 4-6 digits (masked)",
      "accountType": "CREDIT_CARD|MORTGAGE|AUTO_LOAN|STUDENT_LOAN|PERSONAL_LOAN|COLLECTION|INSTALLMENT|OTHER",
      "status": "OPEN|CLOSED|PAID|COLLECTION|CHARGE_OFF|UNKNOWN",
      "bureau": "EXPERIAN|EQUIFAX|TRANSUNION",
      "balance": 0,
      "creditLimit": 0,
      "highBalance": 0,
      "pastDue": 0,
      "monthlyPayment": 0,
      "dateOpened": "YYYY-MM-DD or null",
      "dateReported": "YYYY-MM-DD or null",
      "dateClosed": "YYYY-MM-DD or null",
      "dateLastActive": "YYYY-MM-DD or null",
      "paymentStatus": "Current|Late 30|Late 60|Late 90|Charge-off|etc",
      "paymentHistory": [{"month": "Jan", "year": "24", "status": "OK|30|60|90|CO"}],
      "responsibility": "INDIVIDUAL|JOINT|AUTHORIZED_USER|UNKNOWN",
      "comments": "Any remarks or notes"
    }
  ],
  "inquiries": [
    {
      "inquirerName": "Company name",
      "inquiryDate": "YYYY-MM-DD",
      "inquiryType": "HARD|SOFT",
      "bureau": "EXPERIAN|EQUIFAX|TRANSUNION"
    }
  ],
  "publicRecords": [
    {
      "type": "BANKRUPTCY|TAX_LIEN|JUDGMENT|FORECLOSURE|OTHER",
      "filedDate": "YYYY-MM-DD",
      "amount": 0,
      "status": "Filed|Discharged|Released|etc",
      "bureau": "EXPERIAN|EQUIFAX|TRANSUNION"
    }
  ],
  "bureauSummaries": [
    {
      "bureau": "EXPERIAN|EQUIFAX|TRANSUNION",
      "reportDate": "YYYY-MM-DD",
      "creditScore": 0,
      "scoreType": "FICO|VANTAGE3|etc",
      "totalAccounts": 0,
      "openAccounts": 0,
      "derogatory": 0,
      "totalBalance": 0,
      "utilizationPercent": 0,
      "hardInquiries": 0
    }
  ],
  "confidence": 0.95
}

IMPORTANT RULES:
1. Create ONE account entry per creditor per bureau. If a creditor appears on multiple bureaus, create separate entries.
2. Parse ALL financial values as numbers (no $ signs, no commas)
3. Convert all dates to YYYY-MM-DD format
4. For accounts in collection, set accountType to "COLLECTION"
5. Include payment history if present (24 months max)
6. Set confidence between 0 and 1 based on data quality
7. Include ANY remarks, comments, or dispute notes
8. Identify inquiry type as HARD unless explicitly marked as "soft" or "promotional"
`;
