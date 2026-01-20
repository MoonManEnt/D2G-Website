/**
 * Credit Monitoring API Integration
 *
 * Integrates with credit monitoring services like IdentityIQ and Array/SmartCredit
 * to fetch credit reports, scores, and alerts.
 */

// Credit Score Types
export interface CreditScore {
  score: number;
  bureau: "EQUIFAX" | "EXPERIAN" | "TRANSUNION";
  model: string; // e.g., "FICO 8", "VantageScore 3.0"
  date: Date;
  factors?: string[]; // Key factors affecting the score
}

export interface CreditScoreTrend {
  bureau: "EQUIFAX" | "EXPERIAN" | "TRANSUNION";
  scores: Array<{
    score: number;
    date: Date;
  }>;
  change30Days?: number;
  change90Days?: number;
}

// Credit Alert Types
export interface CreditAlert {
  id: string;
  type: "NEW_ACCOUNT" | "INQUIRY" | "ADDRESS_CHANGE" | "BALANCE_CHANGE" | "DELINQUENCY" | "PUBLIC_RECORD" | "FRAUD";
  bureau: "EQUIFAX" | "EXPERIAN" | "TRANSUNION";
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  date: Date;
  details?: Record<string, unknown>;
}

// Credit Report Data Types
export interface CreditReportSummary {
  bureaus: {
    equifax?: BureauSummary;
    experian?: BureauSummary;
    transunion?: BureauSummary;
  };
  totalAccounts: number;
  openAccounts: number;
  closedAccounts: number;
  negativeItems: number;
  inquiriesLast6Months: number;
  publicRecords: number;
  creditUtilization?: number;
}

export interface BureauSummary {
  score?: number;
  scoreDate?: Date;
  totalAccounts: number;
  negativeItems: number;
  inquiries: number;
  collections: number;
  publicRecords: number;
}

// Provider Configuration
const IDENTITYIQ_API_KEY = process.env.IDENTITYIQ_API_KEY;
const IDENTITYIQ_PARTNER_ID = process.env.IDENTITYIQ_PARTNER_ID;
const ARRAY_API_KEY = process.env.ARRAY_API_KEY;
const ARRAY_CLIENT_KEY = process.env.ARRAY_CLIENT_KEY;
const FEATURE_CREDIT_MONITORING_ENABLED = process.env.FEATURE_CREDIT_MONITORING_ENABLED === "true";

export type CreditProvider = "identityiq" | "array";

/**
 * Check if credit monitoring is available
 */
export function isCreditMonitoringAvailable(): boolean {
  if (!FEATURE_CREDIT_MONITORING_ENABLED) return false;
  return !!(IDENTITYIQ_API_KEY || ARRAY_API_KEY);
}

/**
 * Get the configured credit monitoring provider
 */
export function getConfiguredProvider(): CreditProvider | null {
  if (IDENTITYIQ_API_KEY && IDENTITYIQ_PARTNER_ID) return "identityiq";
  if (ARRAY_API_KEY && ARRAY_CLIENT_KEY) return "array";
  return null;
}

// =============================================================================
// IDENTITYIQ INTEGRATION
// =============================================================================

interface IdentityIQClient {
  apiKey: string;
  partnerId: string;
  baseUrl: string;
}

function getIdentityIQClient(): IdentityIQClient | null {
  if (!IDENTITYIQ_API_KEY || !IDENTITYIQ_PARTNER_ID) return null;

  return {
    apiKey: IDENTITYIQ_API_KEY,
    partnerId: IDENTITYIQ_PARTNER_ID,
    baseUrl: "https://api.identityiq.com/v1", // Example base URL
  };
}

async function identityIQRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<unknown> {
  const client = getIdentityIQClient();
  if (!client) throw new Error("IdentityIQ not configured");

  const response = await fetch(`${client.baseUrl}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": client.apiKey,
      "X-Partner-ID": client.partnerId,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`IdentityIQ API error: ${response.status}`);
  }

  return response.json();
}

// =============================================================================
// ARRAY/SMARTCREDIT INTEGRATION
// =============================================================================

interface ArrayClient {
  apiKey: string;
  clientKey: string;
  baseUrl: string;
}

function getArrayClient(): ArrayClient | null {
  if (!ARRAY_API_KEY || !ARRAY_CLIENT_KEY) return null;

  return {
    apiKey: ARRAY_API_KEY,
    clientKey: ARRAY_CLIENT_KEY,
    baseUrl: "https://api.array.io/v1", // Example base URL
  };
}

async function arrayRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<unknown> {
  const client = getArrayClient();
  if (!client) throw new Error("Array not configured");

  const response = await fetch(`${client.baseUrl}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${client.apiKey}`,
      "X-Client-Key": client.clientKey,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Array API error: ${response.status}`);
  }

  return response.json();
}

// =============================================================================
// UNIFIED API
// =============================================================================

export interface EnrollClientParams {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  ssn?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
  };
}

export interface EnrollmentResult {
  success: boolean;
  enrollmentId?: string;
  status?: "pending" | "active" | "failed";
  verificationRequired?: boolean;
  verificationQuestions?: Array<{
    id: string;
    text: string;
    answers: string[];
  }>;
  error?: string;
}

/**
 * Enroll a client in credit monitoring
 */
export async function enrollClient(
  params: EnrollClientParams,
  provider?: CreditProvider
): Promise<EnrollmentResult> {
  const activeProvider = provider || getConfiguredProvider();

  if (!activeProvider) {
    return { success: false, error: "No credit monitoring provider configured" };
  }

  try {
    if (activeProvider === "identityiq") {
      const result = await identityIQRequest("/enrollments", {
        method: "POST",
        body: JSON.stringify({
          firstName: params.firstName,
          lastName: params.lastName,
          email: params.email,
          phone: params.phone,
          ssn: params.ssn,
          dob: params.dateOfBirth,
          address: {
            street1: params.address.line1,
            street2: params.address.line2,
            city: params.address.city,
            state: params.address.state,
            postalCode: params.address.zip,
          },
        }),
      }) as Record<string, unknown>;

      return {
        success: true,
        enrollmentId: result.enrollmentId as string,
        status: result.status as "pending" | "active" | "failed",
        verificationRequired: result.verificationRequired as boolean,
        verificationQuestions: result.questions as EnrollmentResult["verificationQuestions"],
      };
    } else if (activeProvider === "array") {
      const result = await arrayRequest("/members", {
        method: "POST",
        body: JSON.stringify({
          first_name: params.firstName,
          last_name: params.lastName,
          email: params.email,
          phone: params.phone,
          ssn: params.ssn,
          date_of_birth: params.dateOfBirth,
          address_line_1: params.address.line1,
          address_line_2: params.address.line2,
          city: params.address.city,
          state: params.address.state,
          zip: params.address.zip,
        }),
      }) as Record<string, unknown>;

      return {
        success: true,
        enrollmentId: result.member_id as string,
        status: "pending",
        verificationRequired: result.requires_verification as boolean,
      };
    }

    return { success: false, error: "Unknown provider" };
  } catch (error) {
    console.error("Enrollment error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Enrollment failed",
    };
  }
}

/**
 * Answer verification questions
 */
export async function answerVerificationQuestions(
  enrollmentId: string,
  answers: Array<{ questionId: string; answerId: string }>,
  provider?: CreditProvider
): Promise<{ success: boolean; status?: string; error?: string }> {
  const activeProvider = provider || getConfiguredProvider();

  if (!activeProvider) {
    return { success: false, error: "No provider configured" };
  }

  try {
    if (activeProvider === "identityiq") {
      await identityIQRequest(`/enrollments/${enrollmentId}/verify`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      });
      return { success: true, status: "verified" };
    } else if (activeProvider === "array") {
      await arrayRequest(`/members/${enrollmentId}/verify`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      });
      return { success: true, status: "verified" };
    }

    return { success: false, error: "Unknown provider" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

/**
 * Get credit scores for an enrolled client
 */
export async function getCreditScores(
  enrollmentId: string,
  provider?: CreditProvider
): Promise<{ success: boolean; scores?: CreditScore[]; error?: string }> {
  const activeProvider = provider || getConfiguredProvider();

  if (!activeProvider) {
    return {
      success: false,
      error: "No credit monitoring provider configured. Set IDENTITYIQ_API_KEY/IDENTITYIQ_PARTNER_ID or ARRAY_API_KEY/ARRAY_CLIENT_KEY environment variables.",
    };
  }

  try {
    if (activeProvider === "identityiq") {
      const result = await identityIQRequest(`/enrollments/${enrollmentId}/scores`) as Record<string, unknown>;
      const scores = (result.scores as Array<Record<string, unknown>>).map((s) => ({
        score: s.score as number,
        bureau: s.bureau as CreditScore["bureau"],
        model: s.model as string,
        date: new Date(s.date as string),
        factors: s.factors as string[],
      }));
      return { success: true, scores };
    } else if (activeProvider === "array") {
      const result = await arrayRequest(`/members/${enrollmentId}/scores`) as Record<string, unknown>;
      const scores = (result.credit_scores as Array<Record<string, unknown>>).map((s) => ({
        score: s.score as number,
        bureau: (s.bureau as string).toUpperCase() as CreditScore["bureau"],
        model: s.score_model as string,
        date: new Date(s.date as string),
        factors: s.risk_factors as string[],
      }));
      return { success: true, scores };
    }

    return { success: false, error: "Unknown provider" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get scores",
    };
  }
}

/**
 * Get credit score history/trends
 */
export async function getCreditScoreTrends(
  enrollmentId: string,
  months: number = 12,
  provider?: CreditProvider
): Promise<{ success: boolean; trends?: CreditScoreTrend[]; error?: string }> {
  const activeProvider = provider || getConfiguredProvider();

  if (!activeProvider) {
    return {
      success: false,
      error: "No credit monitoring provider configured. Set IDENTITYIQ_API_KEY/IDENTITYIQ_PARTNER_ID or ARRAY_API_KEY/ARRAY_CLIENT_KEY environment variables.",
    };
  }

  try {
    if (activeProvider === "identityiq") {
      const result = await identityIQRequest(
        `/enrollments/${enrollmentId}/scores/history?months=${months}`
      ) as Record<string, unknown>;
      return { success: true, trends: result.trends as CreditScoreTrend[] };
    } else if (activeProvider === "array") {
      const result = await arrayRequest(
        `/members/${enrollmentId}/scores/history?months=${months}`
      ) as Record<string, unknown>;
      return { success: true, trends: result.score_trends as CreditScoreTrend[] };
    }

    return { success: false, error: "Unknown provider" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get trends",
    };
  }
}

/**
 * Get credit alerts
 */
export async function getCreditAlerts(
  enrollmentId: string,
  options: { since?: Date; limit?: number } = {},
  provider?: CreditProvider
): Promise<{ success: boolean; alerts?: CreditAlert[]; error?: string }> {
  const activeProvider = provider || getConfiguredProvider();

  if (!activeProvider) {
    return {
      success: false,
      error: "No credit monitoring provider configured. Set IDENTITYIQ_API_KEY/IDENTITYIQ_PARTNER_ID or ARRAY_API_KEY/ARRAY_CLIENT_KEY environment variables.",
    };
  }

  try {
    const params = new URLSearchParams();
    if (options.since) params.set("since", options.since.toISOString());
    if (options.limit) params.set("limit", String(options.limit));

    if (activeProvider === "identityiq") {
      const result = await identityIQRequest(
        `/enrollments/${enrollmentId}/alerts?${params}`
      ) as Record<string, unknown>;
      return { success: true, alerts: result.alerts as CreditAlert[] };
    } else if (activeProvider === "array") {
      const result = await arrayRequest(
        `/members/${enrollmentId}/alerts?${params}`
      ) as Record<string, unknown>;
      return { success: true, alerts: result.alerts as CreditAlert[] };
    }

    return { success: false, error: "Unknown provider" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get alerts",
    };
  }
}

/**
 * Get credit report summary
 */
export async function getCreditReportSummary(
  enrollmentId: string,
  provider?: CreditProvider
): Promise<{ success: boolean; summary?: CreditReportSummary; error?: string }> {
  const activeProvider = provider || getConfiguredProvider();

  if (!activeProvider) {
    return {
      success: false,
      error: "No credit monitoring provider configured. Set IDENTITYIQ_API_KEY/IDENTITYIQ_PARTNER_ID or ARRAY_API_KEY/ARRAY_CLIENT_KEY environment variables.",
    };
  }

  try {
    if (activeProvider === "identityiq") {
      const result = await identityIQRequest(
        `/enrollments/${enrollmentId}/report/summary`
      ) as Record<string, unknown>;
      return { success: true, summary: result.summary as CreditReportSummary };
    } else if (activeProvider === "array") {
      const result = await arrayRequest(
        `/members/${enrollmentId}/report/summary`
      ) as Record<string, unknown>;
      return { success: true, summary: result.report_summary as CreditReportSummary };
    }

    return { success: false, error: "Unknown provider" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get summary",
    };
  }
}

/**
 * Refresh credit data (trigger a new pull)
 */
export async function refreshCreditData(
  enrollmentId: string,
  provider?: CreditProvider
): Promise<{ success: boolean; refreshId?: string; error?: string }> {
  const activeProvider = provider || getConfiguredProvider();

  if (!activeProvider) {
    return {
      success: false,
      error: "No credit monitoring provider configured. Set IDENTITYIQ_API_KEY/IDENTITYIQ_PARTNER_ID or ARRAY_API_KEY/ARRAY_CLIENT_KEY environment variables.",
    };
  }

  try {
    if (activeProvider === "identityiq") {
      const result = await identityIQRequest(`/enrollments/${enrollmentId}/refresh`, {
        method: "POST",
      }) as Record<string, unknown>;
      return { success: true, refreshId: result.refreshId as string };
    } else if (activeProvider === "array") {
      const result = await arrayRequest(`/members/${enrollmentId}/refresh`, {
        method: "POST",
      }) as Record<string, unknown>;
      return { success: true, refreshId: result.refresh_id as string };
    }

    return { success: false, error: "Unknown provider" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to refresh",
    };
  }
}

// =============================================================================
// MOCK DATA GENERATORS (for development)
// =============================================================================

function generateMockScores(): CreditScore[] {
  const bureaus: CreditScore["bureau"][] = ["EQUIFAX", "EXPERIAN", "TRANSUNION"];
  const now = new Date();

  return bureaus.map((bureau) => ({
    score: Math.floor(Math.random() * 150) + 600, // 600-750 range
    bureau,
    model: "FICO 8",
    date: now,
    factors: [
      "Length of credit history",
      "Credit utilization ratio",
      "Payment history",
    ],
  }));
}

function generateMockTrends(months: number): CreditScoreTrend[] {
  const bureaus: CreditScoreTrend["bureau"][] = ["EQUIFAX", "EXPERIAN", "TRANSUNION"];

  return bureaus.map((bureau) => {
    const baseScore = Math.floor(Math.random() * 100) + 620;
    const scores: CreditScoreTrend["scores"] = [];

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      scores.push({
        score: baseScore + Math.floor(Math.random() * 30) - 10,
        date,
      });
    }

    const latest = scores[scores.length - 1].score;
    const thirtyDaysAgo = scores[Math.max(0, scores.length - 2)]?.score || latest;
    const ninetyDaysAgo = scores[Math.max(0, scores.length - 4)]?.score || latest;

    return {
      bureau,
      scores,
      change30Days: latest - thirtyDaysAgo,
      change90Days: latest - ninetyDaysAgo,
    };
  });
}

function generateMockAlerts(): CreditAlert[] {
  return [
    {
      id: "alert_1",
      type: "INQUIRY",
      bureau: "EXPERIAN",
      title: "New Credit Inquiry",
      description: "A new hard inquiry was added to your credit report",
      severity: "low",
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      details: {
        inquirer: "Sample Bank",
        purpose: "Credit Card Application",
      },
    },
    {
      id: "alert_2",
      type: "BALANCE_CHANGE",
      bureau: "EQUIFAX",
      title: "Significant Balance Change",
      description: "Your credit card balance changed by more than 20%",
      severity: "medium",
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  ];
}

function generateMockSummary(): CreditReportSummary {
  return {
    bureaus: {
      equifax: {
        score: 685,
        scoreDate: new Date(),
        totalAccounts: 12,
        negativeItems: 2,
        inquiries: 3,
        collections: 1,
        publicRecords: 0,
      },
      experian: {
        score: 678,
        scoreDate: new Date(),
        totalAccounts: 11,
        negativeItems: 2,
        inquiries: 2,
        collections: 1,
        publicRecords: 0,
      },
      transunion: {
        score: 690,
        scoreDate: new Date(),
        totalAccounts: 12,
        negativeItems: 1,
        inquiries: 4,
        collections: 0,
        publicRecords: 0,
      },
    },
    totalAccounts: 12,
    openAccounts: 8,
    closedAccounts: 4,
    negativeItems: 3,
    inquiriesLast6Months: 5,
    publicRecords: 0,
    creditUtilization: 32,
  };
}
