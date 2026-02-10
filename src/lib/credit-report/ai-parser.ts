/**
 * AI-Powered Credit Report Parser
 *
 * Uses Claude/OpenAI via the LLM orchestrator to intelligently extract
 * structured data from any credit report format.
 */

import { completeLLM, type LLMResponse } from "../llm-orchestrator";
import {
  type ParsedCreditReport,
  type AIParseRequest,
  type AIParseResponse,
  type CreditAccount,
  type ConsumerInfo,
  type CreditInquiry,
  type PublicRecord,
  type BureauSummary,
  CREDIT_REPORT_PROMPT_SCHEMA,
} from "./extraction-schema";
import { detectReportFormat, generateFormatInstructions } from "./format-detector";
import { createLogger } from "../logger";
const log = createLogger("ai-parser");

// Retry configuration
const MAX_RETRIES = 2;
const CHUNK_SIZE = 80000; // Characters per chunk for very long reports (increased for IdentityIQ)
const ACCOUNT_BOUNDARY_PATTERNS = [
  /\n(?=[A-Z][A-Z0-9\s&',.-]{2,50}(?:BANK|FINANCIAL|CREDIT|CARD|AUTO|MORTGAGE|LOAN|SERVICES?|LLC|INC|CORP|NA|FSB|COLLECTION|COLL)\s*\n)/gi,
  /\n(?=Account\s*(?:#|Number|:))/gi,
  /\n(?=Creditor(?:\s+Name)?:)/gi,
  /\n-{20,}\n/g, // Separator lines
];

/**
 * Build the system prompt for credit report parsing.
 */
function buildSystemPrompt(formatInstructions: string): string {
  return `You are an expert credit report parser. Your task is to extract structured data from credit report text.

${CREDIT_REPORT_PROMPT_SCHEMA}

${formatInstructions}

CRITICAL RULES:
1. Output ONLY valid JSON - no explanations, no markdown, just the JSON object
2. Parse ALL accounts found in the report - do not skip any
3. For three-bureau reports (IdentityIQ format with columns), create SEPARATE account entries for each bureau that has data
4. If data is missing or unclear, use null instead of guessing
5. Extract payment history month by month when available - include ALL late payments (30, 60, 90, 120 days)
6. Identify collection accounts by looking for "collection", "CA", "COLL", "CREDIT COLL", or collection agency names
7. Flag charge-offs by looking for "charge-off", "CO", "CHARGED OFF", or $0 balance with derogatory status
8. Convert all currency values to numbers (no $ or commas)
9. Convert all dates to YYYY-MM-DD format
10. Include the confidence score (0-1) based on data quality and completeness

IMPORTANT FOR IDENTITYIQ 3-BUREAU REPORTS:
- Data is organized in THREE columns: TransUnion | Experian | Equifax
- Each creditor/account appears ONCE but has data in up to 3 columns
- Look for creditor names like: CREDIT COLL, DEPTEDNELNET, MERRICK BK, AVA FINANCE, AUSTINCAPBK, POSSIBLEFINA
- Create a SEPARATE account object for each bureau that has data for that creditor
- Payment history shows codes like "OK", "30", "60", "90", "120" - extract ALL of them
- Account status can be: CURRENT, PAID, CLOSED, CHARGE OFF, COLLECTION, etc.
- Look for "Date of First Delinquency" (DOFD) for collections

PER-BUREAU DATA EXTRACTION (CRITICAL):
For EACH account, extract these fields FOR EACH BUREAU that has data:
- Account #: The masked account number (e.g., "8A5799****")
- Account Type: Credit Card, Installment, Mortgage, Collection, etc.
- Account Status: Open, Closed, Paid, Charge Off, etc.
- Balance: Current balance amount ($0.00 is valid data, don't skip it)
- High Credit/High Balance: The highest balance or credit limit used
- Credit Limit: The credit limit if applicable
- Past Due: Amount past due
- Payment Status: Current, Late 30/60/90/120 Days, etc.
- Date Opened: When the account was opened
- Date Reported: When last reported to bureau

EXAMPLE - For an account "AUSTINCAPBK" showing:
  TransUnion column: Account Status: Closed, Balance: $0, High Credit: $5,000, Payment Status: Late 60 Days
  Experian column: Account Status: Paid, Balance: $0, High Credit: $5,000, Payment Status: Late 60 Days
  Equifax column: - (no data)

Create TWO account objects:
1. { creditorName: "AUSTINCAPBK", bureau: "TRANSUNION", accountStatus: "CLOSED", balance: 0, highBalance: 5000, paymentStatus: "Late 60 Days" }
2. { creditorName: "AUSTINCAPBK", bureau: "EXPERIAN", accountStatus: "PAID", balance: 0, highBalance: 5000, paymentStatus: "Late 60 Days" }
DO NOT create a third object for Equifax since it shows "-" (no data).
`;
}

/**
 * Build the user prompt with the credit report text.
 */
function buildUserPrompt(text: string, pageCount?: number): string {
  const truncationNote = text.length > CHUNK_SIZE
    ? `\n\nNOTE: This is a portion of the full report. Parse all data visible in this section.`
    : "";

  return `Parse the following credit report and extract all information into the specified JSON structure.

Report Statistics:
- Pages: ${pageCount || "Unknown"}
- Characters: ${text.length.toLocaleString()}

--- CREDIT REPORT TEXT ---
${text.slice(0, CHUNK_SIZE)}${truncationNote}
--- END CREDIT REPORT ---

Extract all consumer information, accounts, inquiries, public records, and bureau summaries.
Output ONLY the JSON object, no other text.`;
}

/**
 * Parse the LLM response and extract the JSON data.
 */
function parseAIResponse(content: string): AIParseResponse {
  // Try to extract JSON from the response
  let jsonStr = content;

  // Remove markdown code blocks if present
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  // Try to find JSON object boundaries
  const startIdx = jsonStr.indexOf("{");
  const endIdx = jsonStr.lastIndexOf("}");
  if (startIdx !== -1 && endIdx !== -1) {
    jsonStr = jsonStr.slice(startIdx, endIdx + 1);
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Validate required fields exist
    if (!parsed.consumer && !parsed.accounts) {
      throw new Error("Response missing required fields (consumer or accounts)");
    }

    return {
      consumer: parsed.consumer || { name: "", addresses: [] },
      accounts: parsed.accounts || [],
      inquiries: parsed.inquiries || [],
      publicRecords: parsed.publicRecords || [],
      bureauSummaries: parsed.bureauSummaries || [],
      confidence: parsed.confidence ?? 0.5,
    };
  } catch (error) {
    log.error({ err: error, content: content.slice(0, 500) }, "Failed to parse AI response");
    throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : "Invalid JSON"}`);
  }
}

/**
 * Validate and clean extracted accounts.
 */
function validateAccounts(accounts: CreditAccount[]): CreditAccount[] {
  return accounts.map((account, index) => {
    // Ensure required fields
    const cleaned: CreditAccount = {
      id: `account-${index}`,
      creditorName: account.creditorName || "Unknown Creditor",
      accountNumber: account.accountNumber || "****",
      accountType: account.accountType || "OTHER",
      accountStatus: account.accountStatus || account.status || "UNKNOWN",
      bureau: account.bureau || "TRANSUNION",
    };

    // Copy optional fields if valid
    if (typeof account.balance === "number") cleaned.balance = account.balance;
    if (typeof account.creditLimit === "number") cleaned.creditLimit = account.creditLimit;
    if (typeof account.highBalance === "number") cleaned.highBalance = account.highBalance;
    if (typeof account.pastDue === "number") cleaned.pastDue = account.pastDue;
    if (typeof account.monthlyPayment === "number") cleaned.monthlyPayment = account.monthlyPayment;
    if (account.dateOpened) cleaned.dateOpened = account.dateOpened;
    if (account.dateReported) cleaned.dateReported = account.dateReported;
    if (account.dateClosed) cleaned.dateClosed = account.dateClosed;
    if (account.paymentStatus) cleaned.paymentStatus = account.paymentStatus;
    if (account.paymentHistory) cleaned.paymentHistory = account.paymentHistory;
    if (account.responsibility) cleaned.responsibility = account.responsibility;
    if (account.comments) cleaned.comments = account.comments;

    return cleaned;
  });
}

/**
 * Main AI parsing function.
 * Sends the credit report text to the LLM and returns structured data.
 */
export async function parseWithAI(request: AIParseRequest): Promise<ParsedCreditReport> {
  const startTime = Date.now();
  const warnings: string[] = [];

  log.info({
    textLength: request.rawText.length,
    extractionMethod: request.extractionMethod,
    format: request.reportFormat,
  }, "Starting AI parsing");

  // Detect format if not provided
  const formatDetection = detectReportFormat(request.rawText);
  const reportFormat = request.reportFormat || formatDetection.format;
  const formatInstructions = generateFormatInstructions(formatDetection.format);

  // Build prompts
  const systemPrompt = buildSystemPrompt(formatInstructions);
  const userPrompt = buildUserPrompt(request.rawText, request.pageCount);

  let response: AIParseResponse | null = null;
  let llmResponse: LLMResponse | null = null;
  let lastError: Error | null = null;

  // Retry loop
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      log.info({ attempt }, "Attempting AI parse");

      llmResponse = await completeLLM({
        taskType: "REPORT_PARSING" as never, // Type will be added to orchestrator
        prompt: userPrompt,
        systemPrompt,
        organizationId: request.organizationId || "system",
      });

      response = parseAIResponse(llmResponse.content);
      break; // Success
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");
      log.warn({ err: lastError, attempt }, "AI parse attempt failed");

      if (attempt === MAX_RETRIES) {
        throw new Error(`AI parsing failed after ${MAX_RETRIES + 1} attempts: ${lastError.message}`);
      }
    }
  }

  if (!response) {
    throw lastError || new Error("AI parsing failed");
  }

  // Validate and clean accounts
  const validatedAccounts = validateAccounts(response.accounts);

  // Add OCR warnings if applicable
  if (request.extractionMethod === "OCR" && request.ocrConfidence) {
    if (request.ocrConfidence < 70) {
      warnings.push(`OCR confidence was low (${request.ocrConfidence.toFixed(1)}%). Some data may be inaccurate.`);
    }
  }

  // Calculate overall confidence
  const parseConfidence = Math.min(
    response.confidence * (formatDetection.confidence + 0.5), // Format confidence boost
    1
  );

  const processingTimeMs = Date.now() - startTime;

  log.info({
    accountCount: validatedAccounts.length,
    inquiryCount: response.inquiries.length,
    publicRecordCount: response.publicRecords.length,
    confidence: parseConfidence,
    processingTimeMs,
    tokensUsed: llmResponse?.totalTokens,
    costCents: llmResponse?.costCents,
  }, "AI parsing complete");

  return {
    consumer: response.consumer,
    bureaus: response.bureauSummaries,
    accounts: validatedAccounts,
    inquiries: response.inquiries,
    publicRecords: response.publicRecords,
    metadata: {
      reportDate: new Date().toISOString().split("T")[0],
      reportFormat,
      parseConfidence,
      sourceType: request.extractionMethod === "OCR" ? "IMAGE" : "PDF",
      extractionMethod: request.extractionMethod,
      processingTimeMs,
      warnings: warnings.length > 0 ? warnings : undefined,
    },
  };
}

/**
 * Find a good split point that doesn't break in the middle of an account.
 * Looks for account boundaries, section headers, or page breaks.
 */
function findAccountBoundary(text: string, startFrom: number): number {
  // Look backwards from the target position to find a clean break
  const searchWindow = text.slice(Math.max(0, startFrom - 5000), startFrom);

  // Try to find section breaks first (most reliable)
  const sectionBreaks = [
    /\n-{20,}\n/g, // Separator lines
    /\n(?=ACCOUNT\s+(?:HISTORY|INFORMATION|DETAILS))/gi,
    /\n(?=Account\s+#\s*:)/gi,
    /\n\n(?=[A-Z][A-Z0-9\s&',./-]{2,40}\s*\n)/g, // Double newline before account name
  ];

  for (const pattern of sectionBreaks) {
    const matches = [...searchWindow.matchAll(pattern)];
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      return Math.max(0, startFrom - 5000) + (lastMatch.index || 0);
    }
  }

  // Fall back to any double newline
  const doubleNewline = searchWindow.lastIndexOf("\n\n");
  if (doubleNewline !== -1) {
    return Math.max(0, startFrom - 5000) + doubleNewline;
  }

  // Last resort: single newline
  const singleNewline = searchWindow.lastIndexOf("\n");
  if (singleNewline !== -1) {
    return Math.max(0, startFrom - 5000) + singleNewline;
  }

  return startFrom;
}

/**
 * Parse a very large credit report in chunks.
 * Uses intelligent chunking to avoid splitting mid-account.
 */
export async function parseWithAIChunked(request: AIParseRequest): Promise<ParsedCreditReport> {
  const { rawText } = request;

  // If text is small enough, use single parse
  if (rawText.length <= CHUNK_SIZE) {
    return parseWithAI(request);
  }

  log.info({ totalLength: rawText.length, chunkSize: CHUNK_SIZE }, "Parsing large report in chunks");

  // Split into chunks at account boundaries
  const chunks: string[] = [];
  let position = 0;

  while (position < rawText.length) {
    // Calculate target end position
    const targetEnd = Math.min(position + CHUNK_SIZE, rawText.length);

    // If we're at the end, just take the rest
    if (targetEnd >= rawText.length) {
      chunks.push(rawText.slice(position));
      break;
    }

    // Find a good boundary to split at
    const boundaryPos = findAccountBoundary(rawText, targetEnd);

    // Ensure we make progress (at least take something)
    const endPos = boundaryPos > position ? boundaryPos : targetEnd;

    chunks.push(rawText.slice(position, endPos));
    position = endPos;
  }

  log.info({ chunks: chunks.length, avgChunkSize: Math.round(rawText.length / chunks.length) }, "Created chunks");

  // Parse each chunk
  const chunkResults: ParsedCreditReport[] = [];
  for (let i = 0; i < chunks.length; i++) {
    log.info({ chunk: i + 1, total: chunks.length }, "Parsing chunk");

    const chunkResult = await parseWithAI({
      ...request,
      rawText: chunks[i],
    });
    chunkResults.push(chunkResult);
  }

  // Merge results
  const mergedAccounts: CreditAccount[] = [];
  const mergedInquiries: CreditInquiry[] = [];
  const mergedPublicRecords: PublicRecord[] = [];
  let consumer = chunkResults[0]?.consumer || { name: "", addresses: [] };

  for (const result of chunkResults) {
    // Use consumer info from first chunk or the one with most data
    if (result.consumer.name && result.consumer.addresses.length > consumer.addresses.length) {
      consumer = result.consumer;
    }

    // Merge accounts (dedup by creditor name + account number + bureau)
    for (const account of result.accounts) {
      const key = `${account.creditorName}-${account.accountNumber}-${account.bureau}`;
      const existing = mergedAccounts.find(
        (a) => `${a.creditorName}-${a.accountNumber}-${a.bureau}` === key
      );
      if (!existing) {
        mergedAccounts.push(account);
      }
    }

    // Merge inquiries (dedup by name + date + bureau)
    for (const inquiry of result.inquiries) {
      const key = `${inquiry.inquirerName}-${inquiry.inquiryDate}-${inquiry.bureau}`;
      const existing = mergedInquiries.find(
        (i) => `${i.inquirerName}-${i.inquiryDate}-${i.bureau}` === key
      );
      if (!existing) {
        mergedInquiries.push(inquiry);
      }
    }

    // Merge public records
    for (const record of result.publicRecords) {
      const key = `${record.type}-${record.filedDate}-${record.bureau}`;
      const existing = mergedPublicRecords.find(
        (r) => `${r.type}-${r.filedDate}-${r.bureau}` === key
      );
      if (!existing) {
        mergedPublicRecords.push(record);
      }
    }
  }

  // Calculate merged confidence
  const avgConfidence =
    chunkResults.reduce((sum, r) => sum + r.metadata.parseConfidence, 0) / chunkResults.length;

  return {
    consumer,
    bureaus: chunkResults[0]?.bureaus || [],
    accounts: mergedAccounts,
    inquiries: mergedInquiries,
    publicRecords: mergedPublicRecords,
    metadata: {
      reportDate: new Date().toISOString().split("T")[0],
      reportFormat: chunkResults[0]?.metadata.reportFormat || "UNKNOWN",
      parseConfidence: avgConfidence,
      sourceType: request.extractionMethod === "OCR" ? "IMAGE" : "PDF",
      extractionMethod: request.extractionMethod,
      processingTimeMs: chunkResults.reduce((sum, r) => sum + (r.metadata.processingTimeMs || 0), 0),
      warnings: [
        `Report was parsed in ${chunks.length} chunks due to size`,
        ...chunkResults.flatMap((r) => r.metadata.warnings || []),
      ],
    },
  };
}
