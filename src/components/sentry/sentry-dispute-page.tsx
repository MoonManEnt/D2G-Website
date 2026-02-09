"use client";

/**
 * SENTRY DISPUTE PAGE
 *
 * Main orchestrator component for the Sentry Dispute builder.
 * This is the primary UI for creating and managing Sentry disputes.
 *
 * Flow: Report Selection → Account Selection → Configure → Generate → Review
 */

import { useState, useEffect, useCallback } from "react";
import { Mail } from "lucide-react";
import {
  type SentryDisputePageProps,
  type SentryAccountForUI,
  type SentryDisputeForUI,
  type SentryAnalysisForUI,
  type ActionableRecommendationUI,
  SENTRY_CRA_COLORS,
  SENTRY_FLOW_COLORS,
} from "./types";
import { SentryReportSelector } from "./sentry-report-selector";
import { SentryAccountSelector } from "./sentry-account-selector";
import { SentryLetterBuilder } from "./sentry-letter-builder";
import { SentryAnalysisPanel } from "./sentry-analysis-panel";
import { SuccessProbabilityGauge } from "./success-probability-gauge";
import { MailSendDialog } from "@/components/disputes/mail-send-dialog";
import type { SentryCRA, SentryFlowType } from "@/types/sentry";
import { createLogger } from "@/lib/logger";

// Human-readable flow descriptions
const FLOW_HUMAN_LABELS: Record<SentryFlowType, { label: string; description: string }> = {
  ACCURACY: {
    label: "Something is wrong",
    description: "The information on this account isn't accurate",
  },
  COLLECTION: {
    label: "Collection dispute",
    description: "This is a collection I need to challenge",
  },
  CONSENT: {
    label: "I didn't authorize this",
    description: "This account was opened without my permission",
  },
  COMBO: {
    label: "Multiple issues",
    description: "Several things are wrong with this account",
  },
};
const log = createLogger("sentry-dispute-page");

type Step = "reports" | "select" | "configure" | "generate" | "review";

interface ClientData {
  id: string;
  firstName: string;
  lastName: string;
}

interface CreditReport {
  id: string;
  reportDate: string;
  uploadedAt: string;
  parseStatus: string;
  pageCount: number;
  sourceType: string;
  scores?: {
    transunion?: number;
    equifax?: number;
    experian?: number;
  };
  accountCount?: number;
  bureauBreakdown?: {
    transunion: number;
    equifax: number;
    experian: number;
  };
}

export function SentryDisputePage({ clientId }: SentryDisputePageProps) {
  // State
  const [step, setStep] = useState<Step>("reports");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Client data
  const [client, setClient] = useState<ClientData | null>(null);

  // Reports
  const [reports, setReports] = useState<CreditReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  // Accounts
  const [accounts, setAccounts] = useState<SentryAccountForUI[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);

  // Configuration
  const [selectedCRA, setSelectedCRA] = useState<SentryCRA>("TRANSUNION");
  const [selectedFlow, setSelectedFlow] = useState<SentryFlowType>("ACCURACY");

  // Dispute and analysis
  const [currentDispute, setCurrentDispute] = useState<SentryDisputeForUI | null>(null);
  const [analysis, setAnalysis] = useState<SentryAnalysisForUI | null>(null);
  const [generating, setGenerating] = useState(false);
  const [mailDialogOpen, setMailDialogOpen] = useState(false);

  // Reset dialog
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Success probability state (dynamic calculation by Amelia Sentry Engine)
  const [successProbability, setSuccessProbability] = useState<{
    probability: number;
    confidence: "HIGH" | "MEDIUM" | "LOW";
    recommendations: string[];
    actionableRecommendations?: ActionableRecommendationUI[];
    breakdown?: Array<{
      name: string;
      score: number;
      weight: number;
      contribution: number;
      explanation: string;
    }>;
  }>({
    probability: 0.55,
    confidence: "MEDIUM",
    recommendations: [],
    actionableRecommendations: [],
  });

  // Load client data
  useEffect(() => {
    async function loadClient() {
      try {
        const res = await fetch(`/api/clients/${clientId}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load client");
        const data = await res.json();
        setClient(data.client);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load client");
      }
    }
    loadClient();
  }, [clientId]);

  // Load reports
  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/clients/${clientId}/reports`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load reports");
      const data = await res.json();

      const formattedReports: CreditReport[] = (data.reports || []).map(
        (r: Record<string, unknown>) => ({
          id: r.id,
          reportDate: r.reportDate,
          uploadedAt: r.uploadedAt,
          parseStatus: r.parseStatus || "COMPLETED",
          pageCount: r.pageCount || 0,
          sourceType: r.sourceType || "IDENTITYIQ",
          scores: r.scores,
          accountCount: r.accountCount,
          bureauBreakdown: r.bureauBreakdown,
        })
      );

      setReports(formattedReports);

      // Auto-select the most recent report if available
      if (formattedReports.length > 0 && !selectedReportId) {
        setSelectedReportId(formattedReports[0].id);
      }
    } catch (err) {
      log.error({ err: err }, "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [clientId, selectedReportId]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Load accounts when report is selected
  const loadAccountsForReport = useCallback(async (reportId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch accounts for the specific report with dispute status
      const res = await fetch(`/api/clients/${clientId}/accounts?reportId=${reportId}&includeDisputeStatus=true`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load accounts");
      const data = await res.json();

      // Transform to UI format
      const uiAccounts: SentryAccountForUI[] = (data.accounts || []).map(
        (acc: Record<string, unknown>) => ({
          id: acc.id,
          creditorName: acc.creditorName,
          maskedAccountId: acc.maskedAccountId,
          accountType: acc.accountType,
          balance: acc.balance,
          dateOpened: acc.dateOpened,
          cra: acc.cra,
          paymentStatus: acc.paymentStatus,
          isCollection: String(acc.accountType || "")
            .toLowerCase()
            .includes("collection"),
          detectedIssues: acc.detectedIssues
            ? typeof acc.detectedIssues === "string"
              ? JSON.parse(acc.detectedIssues)
              : acc.detectedIssues
            : [],
          // Dispute availability fields
          disputeStatus: acc.disputeStatus as SentryAccountForUI["disputeStatus"],
          disputeStatusReason: acc.disputeStatusReason as string | undefined,
          disputeId: acc.disputeId as string | undefined,
          currentRound: acc.currentRound as number | undefined,
          daysRemaining: acc.daysRemaining as number | undefined,
        })
      );

      setAccounts(uiAccounts);
      setSelectedAccountIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  // Handle report selection
  const handleReportSelect = useCallback(
    (reportId: string) => {
      setSelectedReportId(reportId);
      loadAccountsForReport(reportId);
    },
    [loadAccountsForReport]
  );

  // Handle new report uploaded
  const handleReportUploaded = useCallback((report: CreditReport) => {
    setReports((prev) => [report, ...prev]);
  }, []);

  // Continue from reports to account selection
  const handleContinueFromReports = useCallback(() => {
    if (selectedReportId) {
      loadAccountsForReport(selectedReportId);
      setStep("select");
    }
  }, [selectedReportId, loadAccountsForReport]);

  // Filter accounts by selected CRA
  const filteredAccounts = accounts.filter((a) => a.cra === selectedCRA);

  // Calculate success probability dynamically based on selections (Amelia Sentry Engine)
  useEffect(() => {
    // Only calculate when we have selections and are past the reports step
    if (selectedAccountIds.length === 0 || step === "reports" || step === "select") {
      return;
    }

    const calculateProbability = async () => {
      try {
        // Get selected account details for analysis
        const selectedAccounts = accounts.filter(a => selectedAccountIds.includes(a.id));

        // Calculate average account age and get first furnisher
        const avgAccountAge = selectedAccounts.length > 0
          ? Math.round(selectedAccounts.reduce((sum, a) => {
              if (!a.dateOpened) return sum + 24; // Default 2 years
              const opened = new Date(a.dateOpened);
              const months = Math.floor((Date.now() - opened.getTime()) / (1000 * 60 * 60 * 24 * 30));
              return sum + months;
            }, 0) / selectedAccounts.length)
          : 24;

        const furnisherName = selectedAccounts[0]?.creditorName || "Unknown";

        // Determine factors based on flow
        const hasMetro2Targeting = selectedFlow === "ACCURACY" || selectedFlow === "COLLECTION";
        // Check if any selected accounts have detected issues that may indicate discrepancies
        const hasBureauDiscrepancy = selectedAccounts.some(a =>
          a.detectedIssues && a.detectedIssues.some(issue =>
            issue.description.toLowerCase().includes("discrepancy") ||
            issue.description.toLowerCase().includes("inconsistent") ||
            issue.code === "BUREAU_DISCREPANCY"
          )
        );

        // Call success prediction API (e-OSCAR code will be auto-selected by generator)
        const res = await fetch("/api/sentry/success-prediction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountAge: avgAccountAge,
            furnisherName,
            hasMetro2Targeting,
            eoscarCode: "105", // Auto-selected by generator
            hasPoliceReport: false,
            hasBureauDiscrepancy,
            hasPaymentProof: false,
            citationAccuracyScore: 0.85,
            ocrSafetyScore: 75,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.prediction) {
            setSuccessProbability({
              probability: data.prediction.probability,
              confidence: data.prediction.confidence,
              recommendations: data.prediction.recommendations || [],
              actionableRecommendations: data.prediction.actionableRecommendations?.map(
                (rec: ActionableRecommendationUI) => ({
                  ...rec,
                  status: rec.status || "PENDING",
                })
              ) || [],
              breakdown: data.prediction.breakdown,
            });
          }
        }
      } catch (err) {
        log.error({ err: err }, "Failed to calculate success probability");
        // Keep default values on error
      }
    };

    calculateProbability();
  }, [selectedAccountIds, selectedFlow, selectedCRA, step, accounts]);

  // Create dispute and generate letter
  const handleGenerate = useCallback(async () => {
    if (selectedAccountIds.length === 0) {
      setError("Please select at least one account");
      return;
    }

    try {
      setGenerating(true);
      setError(null);

      // Create the Sentry dispute
      const createRes = await fetch("/api/sentry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          cra: selectedCRA,
          flow: selectedFlow,
          accountIds: selectedAccountIds,
          generateLetter: true,
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.error || "Failed to create dispute");
      }

      const createData = await createRes.json();
      setCurrentDispute(createData.dispute);

      // Transform analysis data
      if (createData.sentry) {
        const analysisData: SentryAnalysisForUI = {
          ocrScore: createData.sentry.ocrScore,
          ocrRisk: createData.sentry.ocrRisk,
          ocrFindings: createData.sentry.ocrAnalysis?.findings || [],
          citationValidation: {
            isValid: createData.sentry.citationValidation?.isValid ?? true,
            validCitations: [],
            invalidCitations: [],
            warnings: [],
          },
          eoscarRecommendations: [],
          metro2Targeting: {
            fieldsTargeted: createData.sentry.metro2Fields || 0,
            disputes: [],
            discrepancies: [],
          },
          successPrediction: {
            probability: createData.sentry.successPrediction?.probability || 0.5,
            probabilityPercent: Math.round(
              (createData.sentry.successPrediction?.probability || 0.5) * 100
            ),
            confidence: createData.sentry.successPrediction?.confidence || "MEDIUM",
            label: "",
            breakdown: createData.sentry.successPrediction?.breakdown || [],
            recommendations: createData.sentry.successPrediction?.recommendations || [],
            actionableRecommendations: createData.sentry.successPrediction?.actionableRecommendations?.map(
              (rec: ActionableRecommendationUI) => ({
                ...rec,
                status: rec.status || "PENDING",
              })
            ) || [],
          },
        };
        setAnalysis(analysisData);
      }

      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setGenerating(false);
    }
  }, [clientId, selectedCRA, selectedFlow, selectedAccountIds]);

  // Regenerate letter
  const handleRegenerate = useCallback(async () => {
    if (!currentDispute) return;

    try {
      setGenerating(true);
      setError(null);

      const res = await fetch(`/api/sentry/${currentDispute.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to regenerate");
      }

      const data = await res.json();

      // Update letter content
      setCurrentDispute((prev) =>
        prev ? { ...prev, letterContent: data.letterContent } : null
      );

      // Update analysis with new data from regeneration
      if (data.sentry) {
        const analysisData: SentryAnalysisForUI = {
          ocrScore: data.sentry.ocrAnalysis?.score || 0,
          ocrRisk: data.sentry.ocrAnalysis?.risk || "MEDIUM",
          ocrFindings: data.sentry.ocrAnalysis?.findings || [],
          citationValidation: {
            isValid: data.sentry.citationValidation?.isValid ?? true,
            validCitations: data.sentry.citationValidation?.validCitations || [],
            invalidCitations: data.sentry.citationValidation?.invalidCitations || [],
            warnings: data.sentry.citationValidation?.warnings || [],
          },
          eoscarRecommendations: data.sentry.eoscarRecommendations || [],
          metro2Targeting: {
            fieldsTargeted: data.sentry.metro2Targeting?.fieldsTargeted || 0,
            disputes: data.sentry.metro2Targeting?.disputes || [],
            discrepancies: data.sentry.metro2Targeting?.discrepancies || [],
          },
          successPrediction: {
            probability: data.sentry.successPrediction?.probability || 0.5,
            probabilityPercent: Math.round(
              (data.sentry.successPrediction?.probability || 0.5) * 100
            ),
            confidence: data.sentry.successPrediction?.confidence || "MEDIUM",
            label: "",
            breakdown: data.sentry.successPrediction?.breakdown || [],
            recommendations: data.sentry.successPrediction?.recommendations || [],
            actionableRecommendations: data.sentry.successPrediction?.actionableRecommendations?.map(
              (rec: ActionableRecommendationUI) => ({
                ...rec,
                status: rec.status || "PENDING",
              })
            ) || [],
          },
        };
        setAnalysis(analysisData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate");
    } finally {
      setGenerating(false);
    }
  }, [currentDispute]);

  // Reset client disputes
  const handleResetClient = useCallback(async () => {
    try {
      setResetting(true);
      setError(null);

      const res = await fetch("/api/sentry/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          confirmReset: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to reset");
      }

      const data = await res.json();

      // Reset local state
      setCurrentDispute(null);
      setAnalysis(null);
      setStep("reports");
      setSelectedAccountIds([]);

      // Show success message
      alert(`Successfully reset ${data.disputesArchived} dispute(s). Starting fresh.`);

      // Reload reports to refresh the page
      loadReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset");
    } finally {
      setResetting(false);
      setResetDialogOpen(false);
    }
  }, [clientId, loadReports]);

  // Save letter edits
  const handleSaveLetter = useCallback(
    async (content: string) => {
      if (!currentDispute) return;

      try {
        const res = await fetch(`/api/sentry/${currentDispute.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ letterContent: content }),
        });

        if (!res.ok) {
          throw new Error("Failed to save");
        }

        setCurrentDispute((prev) =>
          prev ? { ...prev, letterContent: content } : null
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    },
    [currentDispute]
  );

  // Launch dispute
  const handleLaunch = useCallback(async () => {
    if (!currentDispute) return;

    try {
      const res = await fetch(`/api/sentry/${currentDispute.id}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to launch");
      }

      const data = await res.json();
      setCurrentDispute((prev) =>
        prev ? { ...prev, status: "SENT", sentDate: data.dispute.sentDate } : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to launch");
    }
  }, [currentDispute]);

  // Apply actionable recommendation
  const handleApplyRecommendation = useCallback(
    async (recommendation: ActionableRecommendationUI) => {
      if (!currentDispute) return;

      try {
        const res = await fetch(`/api/sentry/${currentDispute.id}/recommendations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "apply",
            recommendation,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to apply recommendation");
        }

        const data = await res.json();

        // Update letter content
        if (data.updatedContent) {
          setCurrentDispute((prev) =>
            prev ? { ...prev, letterContent: data.updatedContent } : null
          );
        }

        // Update success probability in analysis
        if (data.newSuccessProbability !== undefined) {
          setAnalysis((prev) =>
            prev
              ? {
                  ...prev,
                  successPrediction: {
                    ...prev.successPrediction,
                    probability: data.newSuccessProbability,
                    probabilityPercent: Math.round(data.newSuccessProbability * 100),
                    actionableRecommendations:
                      prev.successPrediction.actionableRecommendations?.map((r) =>
                        r.id === recommendation.id ? { ...r, status: "APPLIED" as const } : r
                      ),
                  },
                }
              : null
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to apply recommendation");
      }
    },
    [currentDispute]
  );

  // Revert a recommendation
  const handleRevertRecommendation = useCallback(
    async (recommendationId: string) => {
      if (!currentDispute) return;

      try {
        const res = await fetch(`/api/sentry/${currentDispute.id}/recommendations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "revert",
            recommendationId,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to revert recommendation");
        }

        const data = await res.json();

        // Update letter content
        if (data.updatedContent) {
          setCurrentDispute((prev) =>
            prev ? { ...prev, letterContent: data.updatedContent } : null
          );
        }

        // Update recommendation status
        setAnalysis((prev) =>
          prev
            ? {
                ...prev,
                successPrediction: {
                  ...prev.successPrediction,
                  actionableRecommendations:
                    prev.successPrediction.actionableRecommendations?.map((r) =>
                      r.id === recommendationId ? { ...r, status: "PENDING" as const } : r
                    ),
                },
              }
            : null
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to revert recommendation");
      }
    },
    [currentDispute]
  );

  // Reset all recommendations
  const handleResetRecommendations = useCallback(async () => {
    if (!currentDispute) return;

    try {
      const res = await fetch(`/api/sentry/${currentDispute.id}/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to reset recommendations");
      }

      const data = await res.json();

      // Update letter content
      if (data.updatedContent) {
        setCurrentDispute((prev) =>
          prev ? { ...prev, letterContent: data.updatedContent } : null
        );
      }

      // Reset all recommendation statuses
      setAnalysis((prev) =>
        prev
          ? {
              ...prev,
              successPrediction: {
                ...prev.successPrediction,
                actionableRecommendations:
                  prev.successPrediction.actionableRecommendations?.map((r) => ({
                    ...r,
                    status: "PENDING" as const,
                  })),
              },
            }
          : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset recommendations");
    }
  }, [currentDispute]);

  // Loading state (only for initial load)
  if (loading && step === "reports" && reports.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Error state
  if (error && !client) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-lg">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sentry Dispute</h1>
          {client && (
            <p className="text-sm text-muted-foreground mt-1">
              {client.firstName} {client.lastName}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setResetDialogOpen(true)}
            className="px-4 py-2 text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors flex items-center gap-2"
            title="Reset all disputes for this client"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset Client
          </button>
          <a
            href={`/sentry/${clientId}/tracking`}
            className="px-4 py-2 text-sm font-medium bg-muted text-foreground rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            View Tracking
          </a>
          <span className="px-3 py-1 text-xs bg-emerald-500/20 text-emerald-400 rounded-lg">
            Sentry Engine v1.0
          </span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Step Navigation Bar */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          {/* Back Button */}
          <button
            onClick={() => {
              const steps: Step[] = ["reports", "select", "configure", "generate", "review"];
              const currentIndex = steps.indexOf(step);
              if (currentIndex > 0) {
                setStep(steps[currentIndex - 1]);
              }
            }}
            disabled={step === "reports"}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              step === "reports"
                ? "text-muted-foreground/50 cursor-not-allowed"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          {/* Step Indicators */}
          <div className="flex items-center gap-1">
            {[
              { key: "reports" as Step, label: "Report", icon: "📄" },
              { key: "select" as Step, label: "Accounts", icon: "📋" },
              { key: "configure" as Step, label: "Configure", icon: "⚙️" },
              { key: "generate" as Step, label: "Generate", icon: "✨" },
              { key: "review" as Step, label: "Review", icon: "✉️" },
            ].map((s, index) => {
              const steps: Step[] = ["reports", "select", "configure", "generate", "review"];
              const currentIndex = steps.indexOf(step);
              const thisIndex = steps.indexOf(s.key);
              const isCompleted = thisIndex < currentIndex;
              const isCurrent = step === s.key;
              const isAccessible = thisIndex <= currentIndex || (currentDispute && thisIndex <= 4);

              return (
                <div key={s.key} className="flex items-center">
                  {/* Step circle */}
                  <button
                    onClick={() => {
                      if (isAccessible) {
                        setStep(s.key);
                      }
                    }}
                    disabled={!isAccessible}
                    className={`relative flex items-center justify-center w-10 h-10 rounded-full text-sm font-medium transition-all ${
                      isCurrent
                        ? "bg-blue-500 text-white ring-4 ring-blue-500/20"
                        : isCompleted
                        ? "bg-emerald-500 text-white cursor-pointer hover:bg-emerald-600"
                        : isAccessible
                        ? "bg-muted text-muted-foreground cursor-pointer hover:bg-muted"
                        : "bg-muted/50 text-muted-foreground/50 cursor-not-allowed"
                    }`}
                    title={s.label}
                  >
                    {isCompleted ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </button>
                  {/* Connector line */}
                  {index < 4 && (
                    <div
                      className={`w-8 h-0.5 mx-1 transition-colors ${
                        isCompleted ? "bg-emerald-500" : "bg-border"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Forward / Action Button */}
          <button
            onClick={() => {
              const steps: Step[] = ["reports", "select", "configure", "generate", "review"];
              const currentIndex = steps.indexOf(step);
              if (step === "reports" && selectedReportId) {
                handleContinueFromReports();
              } else if (step === "select" && selectedAccountIds.length > 0) {
                setStep("configure");
              } else if (step === "configure") {
                handleGenerate();
              } else if (currentIndex < 4 && currentDispute) {
                setStep(steps[currentIndex + 1]);
              }
            }}
            disabled={
              (step === "reports" && !selectedReportId) ||
              (step === "select" && selectedAccountIds.length === 0) ||
              (step === "configure" && generating) ||
              step === "review"
            }
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              (step === "reports" && !selectedReportId) ||
              (step === "select" && selectedAccountIds.length === 0) ||
              step === "review"
                ? "bg-muted text-muted-foreground/50 cursor-not-allowed"
                : step === "configure"
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : "bg-blue-500 text-white hover:bg-blue-600"
            }`}
          >
            {step === "configure" ? (
              generating ? "Generating..." : "Generate Letter"
            ) : step === "review" ? (
              "Complete"
            ) : (
              "Next"
            )}
            {step !== "review" && !generating && (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>

        {/* Current step label */}
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-center">
          <span className="text-sm text-muted-foreground">
            Step {["reports", "select", "configure", "generate", "review"].indexOf(step) + 1} of 5:{" "}
            <span className="text-foreground font-medium">
              {step === "reports" && "Select Credit Report"}
              {step === "select" && "Choose Accounts to Dispute"}
              {step === "configure" && "Configure Dispute Settings"}
              {step === "generate" && "Review Generated Letter"}
              {step === "review" && "Review & Launch Dispute"}
            </span>
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left panel - Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Report Selection */}
          {step === "reports" && (
            <>
              <div className="bg-card rounded-xl border border-border p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  Select or Upload Credit Report
                </h2>
                <SentryReportSelector
                  clientId={clientId}
                  clientName={client ? `${client.firstName} ${client.lastName}` : undefined}
                  reports={reports}
                  selectedReportId={selectedReportId}
                  onReportSelect={handleReportSelect}
                  onReportUploaded={handleReportUploaded}
                  onRefreshReports={loadReports}
                />
              </div>

            </>
          )}

          {/* Step 2: Account Selection */}
          {step === "select" && (
            <>
              {/* CRA tabs */}
              <div className="flex gap-2">
                {(["TRANSUNION", "EXPERIAN", "EQUIFAX"] as SentryCRA[]).map((cra) => {
                  const colors = SENTRY_CRA_COLORS[cra];
                  const count = accounts.filter((a) => a.cra === cra).length;
                  return (
                    <button
                      key={cra}
                      onClick={() => {
                        setSelectedCRA(cra);
                        setSelectedAccountIds([]);
                      }}
                      className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                        selectedCRA === cra
                          ? `${colors.bg} ${colors.text} ${colors.border} border`
                          : "text-muted-foreground hover:text-muted-foreground"
                      }`}
                    >
                      {cra} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Account selector */}
              {loading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : filteredAccounts.length > 0 ? (
                <SentryAccountSelector
                  accounts={filteredAccounts}
                  selectedIds={selectedAccountIds}
                  onSelectionChange={setSelectedAccountIds}
                  cra={selectedCRA}
                />
              ) : (
                <div className="bg-card rounded-lg border border-border p-12 text-center">
                  <p className="text-muted-foreground">No accounts found for {selectedCRA}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Try selecting a different bureau or uploading a new report
                  </p>
                </div>
              )}

            </>
          )}

          {/* Step 3: Configuration */}
          {step === "configure" && (
            <>
              {/* Flow selection - Human-readable labels */}
              <div className="bg-card rounded-lg border border-border p-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  What's the issue?
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(["ACCURACY", "COLLECTION", "CONSENT", "COMBO"] as SentryFlowType[]).map(
                    (flow) => {
                      const colors = SENTRY_FLOW_COLORS[flow];
                      const humanLabel = FLOW_HUMAN_LABELS[flow];
                      return (
                        <button
                          key={flow}
                          onClick={() => setSelectedFlow(flow)}
                          className={`p-4 rounded-lg text-left transition-all border ${
                            selectedFlow === flow
                              ? `${colors.bg} ${colors.border} ring-2 ring-offset-2 ring-offset-background`
                              : "bg-muted border-border hover:bg-muted/80"
                          }`}
                          style={selectedFlow === flow ? { ['--tw-ring-color' as string]: colors.text.replace('text-', 'rgb(var(--') } : {}}
                        >
                          <span
                            className={`text-sm font-medium block ${
                              selectedFlow === flow ? colors.text : "text-foreground"
                            }`}
                          >
                            {humanLabel.label}
                          </span>
                          <span className="text-xs text-muted-foreground mt-1 block">
                            {humanLabel.description}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Info card about letter style */}
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-emerald-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-emerald-400">Human-First Letters</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your letter will include a unique personal story about how this affects your life.
                      Written in plain English that sounds like a real person - not a template.
                    </p>
                  </div>
                </div>
              </div>

            </>
          )}

          {/* Step 4 & 5: Review */}
          {(step === "generate" || step === "review") && currentDispute && (
            <>
              <SentryLetterBuilder
                disputeId={currentDispute.id}
                initialContent={currentDispute.letterContent || ""}
                onSave={handleSaveLetter}
                onGenerate={handleRegenerate}
              />

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleLaunch}
                  disabled={currentDispute.status !== "DRAFT"}
                  className={`px-6 py-2 rounded-lg text-sm transition-colors ${
                    currentDispute.status === "DRAFT"
                      ? "bg-emerald-500 text-white hover:bg-emerald-600"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  {currentDispute.status === "DRAFT"
                    ? "Launch Dispute"
                    : `Status: ${currentDispute.status}`}
                </button>
                {currentDispute.status === "SENT" && (
                  <button
                    onClick={() => setMailDialogOpen(true)}
                    className="px-6 py-2 rounded-lg text-sm transition-colors bg-blue-500 text-foreground hover:bg-primary flex items-center gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    Send via Mail
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right panel - Analysis */}
        <div className="space-y-6">
          {/* Quick stats */}
          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reports</span>
                <span className="text-foreground">{reports.length}</span>
              </div>
              {selectedReportId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Disputable</span>
                  <span className="text-foreground">{accounts.filter(a => {
                    if (a.isCollection) return true;
                    if (a.detectedIssues && a.detectedIssues.length > 0) return true;
                    const payStatus = (a.paymentStatus || "").toLowerCase();
                    if (payStatus.includes("late") ||
                        payStatus.includes("delinquent") ||
                        payStatus.includes("chargeoff") ||
                        payStatus.includes("charge off") ||
                        payStatus.includes("collection") ||
                        payStatus.includes("past due")) return true;
                    return false;
                  }).length} accounts</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Selected</span>
                <span className="text-foreground">{selectedAccountIds.length} accounts</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bureau</span>
                <span className={SENTRY_CRA_COLORS[selectedCRA].text}>{selectedCRA}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Issue Type</span>
                <span className={SENTRY_FLOW_COLORS[selectedFlow].text}>
                  {FLOW_HUMAN_LABELS[selectedFlow].label}
                </span>
              </div>
            </div>
          </div>

          {/* Analysis panel - only show on review step */}
          {analysis && step === "review" && (
            <SentryAnalysisPanel
              analysis={analysis}
              disputeId={currentDispute?.id}
              onApplyFixes={() => {
                // Implement auto-fix
              }}
              onApplyRecommendation={handleApplyRecommendation}
              onRevertRecommendation={handleRevertRecommendation}
              onResetRecommendations={handleResetRecommendations}
            />
          )}

          {/* Success gauge (if not in analysis) */}
          {!analysis && step !== "reports" && step !== "select" && (
            <SuccessProbabilityGauge
              probability={successProbability.probability}
              confidence={successProbability.confidence}
              recommendations={successProbability.recommendations.length > 0
                ? successProbability.recommendations
                : [
                    "Your story makes the letter more compelling",
                    "Include any supporting documents you have",
                  ]}
              breakdown={successProbability.breakdown}
              actionableRecommendations={successProbability.actionableRecommendations}
              onApplyRecommendation={currentDispute ? handleApplyRecommendation : undefined}
              onRevertRecommendation={currentDispute ? handleRevertRecommendation : undefined}
              onResetRecommendations={currentDispute ? handleResetRecommendations : undefined}
            />
          )}
        </div>
      </div>

      {/* Mail Send Dialog */}
      {currentDispute && (
        <MailSendDialog
          open={mailDialogOpen}
          onOpenChange={setMailDialogOpen}
          disputeId={currentDispute.id}
          disputeType="SENTRY"
          clientName={client ? `${client.firstName} ${client.lastName}` : "Client"}
          cra={selectedCRA}
          onSuccess={() => {
            // Optionally refresh dispute data
          }}
        />
      )}

      {/* Reset Confirmation Dialog */}
      {resetDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !resetting && setResetDialogOpen(false)}
          />
          <div className="relative bg-card border border-border rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground">Reset Client Disputes</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              This will archive all existing disputes for{" "}
              <span className="font-medium text-foreground">
                {client ? `${client.firstName} ${client.lastName}` : "this client"}
              </span>{" "}
              and reset them to Round 1. This action cannot be undone.
            </p>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-6">
              <p className="text-xs text-amber-400">
                <strong>What happens:</strong>
              </p>
              <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                <li>• All current disputes will be archived</li>
                <li>• Client returns to Round 1 starting point</li>
                <li>• Credit reports and accounts are preserved</li>
                <li>• Tracking history is maintained for records</li>
              </ul>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setResetDialogOpen(false)}
                disabled={resetting}
                className="px-4 py-2 text-sm font-medium bg-muted text-foreground rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResetClient}
                disabled={resetting}
                className="px-4 py-2 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {resetting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Resetting...
                  </>
                ) : (
                  "Reset Client"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SentryDisputePage;
