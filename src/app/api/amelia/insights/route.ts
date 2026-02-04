import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { completeLLM } from "@/lib/llm-orchestrator";
import { isAIAvailable } from "@/lib/ai/providers";
import {
  assembleClientContext,
  formatContextForPrompt,
} from "@/lib/ai/context-assembler";
import { validateUniqueness } from "@/lib/ai/content-validator";

export const dynamic = "force-dynamic";

// Known eOSCAR template phrases that CRAs flag
const EOSCAR_FLAGGED_PHRASES = [
  "i am writing to dispute",
  "please investigate the following",
  "i am requesting that you",
  "pursuant to the fair credit reporting act",
  "i hereby dispute",
  "to whom it may concern",
  "under 15 usc",
  "i demand that you",
  "this letter is to inform you",
  "please be advised",
];

// Human-sounding contractions and phrases
const HUMANIZING_MARKERS = [
  /\bi'm\b/gi,
  /\bcan't\b/gi,
  /\bdon't\b/gi,
  /\bwon't\b/gi,
  /\bisn't\b/gi,
  /\bdidn't\b/gi,
  /\bwouldn't\b/gi,
  /\bcouldn't\b/gi,
  /\bshouldn't\b/gi,
  /\bhaven't\b/gi,
  /\bhasn't\b/gi,
  /\baren't\b/gi,
  /\bwasn't\b/gi,
  /\blet me\b/gi,
  /\blook,\b/gi,
  /\bhonestly\b/gi,
  /\bhere's the thing\b/gi,
  /\bbottom line\b/gi,
];

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { clientId, cra, flow, accountIds } = body;

    if (!clientId || !accountIds || accountIds.length === 0) {
      return NextResponse.json(
        { error: "clientId and accountIds are required" },
        { status: 400 }
      );
    }

    // Fetch accounts with detected issues
    const accounts = await prisma.accountItem.findMany({
      where: {
        id: { in: accountIds },
        report: {
          client: {
            id: clientId,
            organizationId: session.user.organizationId,
          },
        },
      },
      include: {
        report: {
          include: {
            client: true,
          },
        },
      },
    });

    if (accounts.length === 0) {
      return NextResponse.json(
        { error: "No accounts found" },
        { status: 404 }
      );
    }

    // Parse issues from all accounts
    const accountDetails = accounts.map((acc) => {
      let issues: Array<{ description: string; severity: string }> = [];
      try {
        issues = JSON.parse(acc.detectedIssues || "[]");
      } catch {
        issues = [];
      }
      return {
        creditorName: acc.creditorName,
        accountNumber: acc.maskedAccountId,
        accountType: acc.accountType || "Unknown",
        accountStatus: acc.accountStatus,
        balance: acc.balance,
        pastDue: acc.pastDue,
        paymentStatus: acc.paymentStatus,
        dateOpened: acc.dateOpened,
        dateReported: acc.dateReported,
        issues,
      };
    });

    // Compute eOSCAR metrics from real letter data
    const eoscarDetection = await computeEoscarMetrics(clientId);

    // Attempt AI-powered analysis
    if (isAIAvailable()) {
      try {
        const aiInsights = await generateAIInsights(
          clientId,
          session.user.organizationId,
          cra,
          flow,
          accountDetails,
          accounts[0].report.client
        );

        return NextResponse.json({
          ...aiInsights,
          eoscarDetection,
          analyzedAccounts: accounts.length,
          analyzedAt: new Date().toISOString(),
          generationMethod: "ai",
        });
      } catch (aiError) {
        console.error("[Amelia Insights] AI analysis failed, using fallback:", aiError);
      }
    }

    // Fallback: formula-based insights
    const fallbackInsights = computeFallbackInsights(accountDetails, flow);

    return NextResponse.json({
      ...fallbackInsights,
      eoscarDetection,
      analyzedAccounts: accounts.length,
      analyzedAt: new Date().toISOString(),
      generationMethod: "fallback",
    });
  } catch (error) {
    console.error("Error generating AMELIA insights:", error);
    return NextResponse.json(
      { error: "Failed to generate insights" },
      { status: 500 }
    );
  }
}

// =============================================================================
// AI-POWERED INSIGHTS
// =============================================================================

interface AccountDetail {
  creditorName: string;
  accountNumber: string;
  accountType: string;
  accountStatus: string;
  balance: number | null;
  pastDue: number | null;
  paymentStatus: string | null;
  dateOpened: Date | null;
  dateReported: Date | null;
  issues: Array<{ description: string; severity: string }>;
}

async function generateAIInsights(
  clientId: string,
  orgId: string,
  cra: string,
  flow: string,
  accountDetails: AccountDetail[],
  client: { firstName: string; lastName: string; currentRound: number }
) {
  // 1. Assemble client context (dispute history, scores, patterns)
  let clientContext = "";
  try {
    const context = await assembleClientContext(clientId, orgId, "DASHBOARD");
    clientContext = formatContextForPrompt(context);
  } catch {
    clientContext = "Client context unavailable.";
  }

  // 2. Fetch historical success rates for these creditors
  let patternContext = "No historical data available yet.";
  try {
    const creditorNames = [...new Set(accountDetails.map((a) => a.creditorName))];
    const patterns = await prisma.ameliaOutcomePattern.findMany({
      where: {
        organizationId: orgId,
        cra,
        isReliable: true,
        OR: [
          { creditorName: { in: creditorNames } },
          { creditorName: null },
        ],
      },
      orderBy: { successRate: "desc" },
      take: 10,
    });

    if (patterns.length > 0) {
      patternContext = patterns
        .map(
          (p) =>
            `${p.creditorName || "General"} (${p.flow}): ${p.successRate.toFixed(0)}% deletion rate (n=${p.sampleSize})${p.avgDaysToResolve ? `, avg ${p.avgDaysToResolve.toFixed(0)} days` : ""}`
        )
        .join("\n");
    }
  } catch {
    // Pattern data unavailable
  }

  // 3. Fetch previous disputes for this client on this CRA
  let previousDisputeContext = "No previous disputes on this CRA.";
  try {
    const prevDisputes = await prisma.dispute.findMany({
      where: {
        clientId,
        cra,
        status: { not: "CANCELLED" },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        round: true,
        flow: true,
        status: true,
        sentDate: true,
        respondedAt: true,
        createdAt: true,
      },
    });

    if (prevDisputes.length > 0) {
      previousDisputeContext = prevDisputes
        .map((d) => {
          const daysSinceSent = d.sentDate
            ? Math.floor((Date.now() - d.sentDate.getTime()) / (1000 * 60 * 60 * 24))
            : null;
          return `R${d.round} (${d.flow}) — ${d.status}${daysSinceSent != null ? `, ${daysSinceSent} days ago` : ""}${d.respondedAt ? ", got response" : d.sentDate ? ", no response yet" : ""}`;
        })
        .join("\n");
    }
  } catch {
    // Previous dispute data unavailable
  }

  // 4. Build the account descriptions
  const accountDescriptions = accountDetails
    .map((a, i) => {
      const issueList = a.issues
        .map((iss) => `  - [${iss.severity}] ${iss.description}`)
        .join("\n");
      return `${i + 1}. ${a.creditorName} (${a.accountNumber})
   Type: ${a.accountType} | Status: ${a.accountStatus}
   Balance: $${a.balance || 0}${a.pastDue ? ` | Past Due: $${a.pastDue}` : ""} | Payment: ${a.paymentStatus || "N/A"}
   Opened: ${a.dateOpened ? new Date(a.dateOpened).toLocaleDateString() : "N/A"} | Last Reported: ${a.dateReported ? new Date(a.dateReported).toLocaleDateString() : "N/A"}
   Issues (${a.issues.length}):
${issueList || "   - No specific issues detected"}`;
    })
    .join("\n\n");

  // 5. Call the LLM
  const systemPrompt = `You are Amelia, an expert AI credit dispute analyst with deep knowledge of FCRA, FDCPA, and credit bureau practices. Analyze dispute data and return a strategic assessment as JSON. Be specific to the actual accounts, creditor names, and issues found — never give generic advice. Your analysis directly helps credit repair specialists decide how to approach each dispute.`;

  const prompt = `Analyze this dispute strategy for ${client.firstName} ${client.lastName} targeting ${cra}:

DISPUTE FLOW: ${flow}
CURRENT ROUND: ${client.currentRound || 1}

ACCOUNTS TO DISPUTE (${accountDetails.length}):
${accountDescriptions}

CLIENT HISTORY & CONTEXT:
${clientContext}

HISTORICAL SUCCESS RATES FOR THIS CRA:
${patternContext}

PREVIOUS DISPUTES ON ${cra}:
${previousDisputeContext}

Return ONLY a valid JSON object (no markdown, no code fences):
{
  "confidence": <number 0-100, how strong the evidence is for these specific accounts>,
  "estimatedSuccessRate": <number 0-100, factor in historical pattern data>,
  "tone": "<CONCERNED|WORRIED|FED_UP|WARNING|PISSED based on round: R1=CONCERNED, R2=WORRIED, R3=FED_UP, R4=WARNING, R5+=PISSED>",
  "recommendations": [<4-6 specific actionable strings referencing actual creditor names and issues>],
  "riskFactors": [{"factor": "<specific observation about these accounts>", "impact": "<positive|negative|neutral>"}],
  "suggestedStatutes": ["<relevant USC sections for this flow and these specific violations>"]
}

Rules:
- Confidence: Weight HIGH severity issues heavily. Bureau divergence is strong evidence. Collections without dunning letters are strong.
- Success Rate: If historical pattern data shows rates for these creditors, weight that heavily. Otherwise estimate from issue severity.
- Recommendations: MUST reference actual creditor names (${accountDetails.map((a) => a.creditorName).join(", ")}). Reference specific issues found. Be tactical.
- Risk Factors: Based on real data — recent reporting dates, account age, payment status, missing information.
- Statutes: Choose the most relevant 2-4 statutes for this specific ${flow} dispute. Include section numbers.`;

  const response = await completeLLM({
    taskType: "DISPUTE_STRATEGY",
    prompt,
    systemPrompt,
    organizationId: orgId,
    context: {
      cra,
      flow,
      round: client.currentRound || 1,
    },
  });

  // 6. Parse the AI response
  const parsed = parseAIResponse(response.content);
  return parsed;
}

function parseAIResponse(content: string): {
  confidence: number;
  estimatedSuccessRate: number;
  tone: string;
  recommendations: string[];
  riskFactors: Array<{ factor: string; impact: string }>;
  suggestedStatutes: string[];
} {
  // Strip markdown code fences if present
  let cleaned = content.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }

  const parsed = JSON.parse(cleaned);

  // Validate and clamp values
  return {
    confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 75)),
    estimatedSuccessRate: Math.max(
      0,
      Math.min(100, Number(parsed.estimatedSuccessRate) || 65)
    ),
    tone: ["CONCERNED", "WORRIED", "FED_UP", "WARNING", "PISSED"].includes(
      parsed.tone
    )
      ? parsed.tone
      : "CONCERNED",
    recommendations: Array.isArray(parsed.recommendations)
      ? parsed.recommendations.slice(0, 6).map(String)
      : [],
    riskFactors: Array.isArray(parsed.riskFactors)
      ? parsed.riskFactors.slice(0, 6).map(
          (rf: { factor?: string; impact?: string }) => ({
            factor: String(rf.factor || ""),
            impact: ["positive", "negative", "neutral"].includes(
              rf.impact || ""
            )
              ? rf.impact!
              : "neutral",
          })
        )
      : [],
    suggestedStatutes: Array.isArray(parsed.suggestedStatutes)
      ? parsed.suggestedStatutes.slice(0, 5).map(String)
      : [],
  };
}

// =============================================================================
// eOSCAR METRICS — Real analysis of previous letters
// =============================================================================

async function computeEoscarMetrics(clientId: string) {
  try {
    // Fetch the most recent letter for this client
    const recentDispute = await prisma.dispute.findFirst({
      where: {
        clientId,
        letterContent: { not: null },
      },
      orderBy: { createdAt: "desc" },
      select: { letterContent: true },
    });

    if (!recentDispute?.letterContent) {
      return {
        risk: 15,
        level: "low" as const,
        uniquenessScore: 90,
        humanizingPhrases: 0,
        flaggedPhrases: 0,
      };
    }

    const letterText = recentDispute.letterContent;
    const lowerText = letterText.toLowerCase();

    // Count humanizing phrases (contractions, colloquialisms)
    let humanizingPhrases = 0;
    for (const marker of HUMANIZING_MARKERS) {
      const matches = lowerText.match(marker);
      if (matches) humanizingPhrases += matches.length;
    }

    // Count flagged template phrases
    let flaggedPhrases = 0;
    for (const phrase of EOSCAR_FLAGGED_PHRASES) {
      if (lowerText.includes(phrase)) flaggedPhrases++;
    }

    // Compute uniqueness against all other letters for this client
    let uniquenessScore = 90;
    const allLetters = await prisma.dispute.findMany({
      where: {
        clientId,
        letterContent: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { letterContent: true, id: true },
    });

    const otherLetters = allLetters
      .filter((d) => d.letterContent !== letterText)
      .map((d) => d.letterContent!)
      .filter(Boolean);

    if (otherLetters.length > 0) {
      const validation = validateUniqueness(letterText, otherLetters);
      uniquenessScore = validation.uniquenessScore;
    }

    // Calculate risk level
    const riskScore = Math.max(
      0,
      Math.min(100, 100 - uniquenessScore + flaggedPhrases * 10 - humanizingPhrases * 2)
    );
    const level =
      riskScore <= 25 ? ("low" as const) : riskScore <= 55 ? ("medium" as const) : ("high" as const);

    return {
      risk: riskScore,
      level,
      uniquenessScore,
      humanizingPhrases,
      flaggedPhrases,
    };
  } catch {
    return {
      risk: 15,
      level: "low" as const,
      uniquenessScore: 90,
      humanizingPhrases: 0,
      flaggedPhrases: 0,
    };
  }
}

// =============================================================================
// FALLBACK — Formula-based insights when AI is unavailable
// =============================================================================

function computeFallbackInsights(
  accountDetails: AccountDetail[],
  flow: string
) {
  const allIssues = accountDetails.flatMap((a) => a.issues);
  const highSeverityCount = allIssues.filter((i) => i.severity === "HIGH").length;
  const mediumSeverityCount = allIssues.filter((i) => i.severity === "MEDIUM").length;

  const balances = accountDetails.map((a) => a.balance).filter(Boolean);
  const hasDivergence = balances.length > 1 && new Set(balances).size > 1;

  const collectionCount = accountDetails.filter((a) =>
    a.accountStatus?.toLowerCase().includes("collection")
  ).length;

  const confidenceBoost =
    highSeverityCount * 3 +
    mediumSeverityCount * 1 +
    (hasDivergence ? 8 : 0) +
    (collectionCount > 0 ? 5 : 0);
  const confidence = Math.min(98, 75 + confidenceBoost);

  const successBoost =
    highSeverityCount * 4 +
    mediumSeverityCount * 2 +
    (hasDivergence ? 10 : 0);
  const estimatedSuccessRate = Math.min(95, 65 + successBoost);

  const tones = ["CONCERNED", "WORRIED", "FED_UP", "WARNING", "PISSED"] as const;
  const tone = tones[Math.min(Math.floor(highSeverityCount / 2), 4)];

  const recommendations: string[] = [];
  if (hasDivergence)
    recommendations.push(
      `Cite balance discrepancy across bureaus for ${accountDetails[0]?.creditorName || "accounts"}`
    );
  if (highSeverityCount > 0)
    recommendations.push(
      `Reference ${highSeverityCount} high-severity issue${highSeverityCount > 1 ? "s" : ""} in your dispute`
    );
  if (collectionCount > 0)
    recommendations.push(
      "Demand debt validation under 15 USC 1692g if no dunning letter received"
    );
  recommendations.push("Include specific dates of previous communications");
  recommendations.push(
    "Reference original dispute date for stronger timeline argument"
  );

  const riskFactors: Array<{ factor: string; impact: "positive" | "negative" | "neutral" }> = [];
  if (highSeverityCount > 0)
    riskFactors.push({
      factor: `${highSeverityCount} HIGH severity issue${highSeverityCount > 1 ? "s" : ""} detected`,
      impact: "positive",
    });
  if (hasDivergence)
    riskFactors.push({
      factor: "Bureau divergence found on balances/status",
      impact: "positive",
    });
  if (collectionCount > 0)
    riskFactors.push({
      factor: `${collectionCount} collection account${collectionCount > 1 ? "s" : ""} may have validation issues`,
      impact: "positive",
    });

  const recentAccounts = accountDetails.filter((a) => {
    if (!a.dateReported) return false;
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    return new Date(a.dateReported) > threeMonthsAgo;
  });
  if (recentAccounts.length > 0)
    riskFactors.push({
      factor: "Recent account activity may complicate dispute",
      impact: "negative",
    });

  const suggestedStatutes: string[] = [];
  if (flow === "COLLECTION" || collectionCount > 0) {
    suggestedStatutes.push("15 U.S.C. § 1692g", "15 U.S.C. § 1692e");
  }
  if (flow === "ACCURACY" || hasDivergence) {
    suggestedStatutes.push("15 U.S.C. § 1681e(b)", "15 U.S.C. § 1681i(a)(5)");
  }
  if (flow === "CONSENT") {
    suggestedStatutes.push("15 U.S.C. § 1681b(a)(2)");
  }
  if (!suggestedStatutes.includes("15 U.S.C. § 1681i(a)(5)")) {
    suggestedStatutes.push("15 U.S.C. § 1681i(a)(5)");
  }

  return {
    confidence,
    estimatedSuccessRate,
    tone,
    recommendations,
    riskFactors,
    suggestedStatutes,
  };
}
