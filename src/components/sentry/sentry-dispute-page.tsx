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
import { EOSCARCodeSelector } from "./eoscar-code-selector";
import { SuccessProbabilityGauge } from "./success-probability-gauge";
import { MailSendDialog } from "@/components/disputes/mail-send-dialog";
import type { SentryCRA, SentryFlowType } from "@/types/sentry";
import { createLogger } from "@/lib/logger";
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
  const [selectedEOSCARCode, setSelectedEOSCARCode] = useState<string>("105");

  // Dispute and analysis
  const [currentDispute, setCurrentDispute] = useState<SentryDisputeForUI | null>(null);
  const [analysis, setAnalysis] = useState<SentryAnalysisForUI | null>(null);
  const [generating, setGenerating] = useState(false);
  const [mailDialogOpen, setMailDialogOpen] = useState(false);

  // Success probability state (dynamic calculation by Amelia Sentry Engine)
  const [successProbability, setSuccessProbability] = useState<{
    probability: number;
    confidence: "HIGH" | "MEDIUM" | "LOW";
    recommendations: string[];
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
  });

  // Load client data
  useEffect(() => {
    async function loadClient() {
      try {
        const res = await fetch(`/api/clients/${clientId}`);
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
      const res = await fetch(`/api/clients/${clientId}/reports`);
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
      const res = await fetch(`/api/clients/${clientId}/accounts?reportId=${reportId}&includeDisputeStatus=true`);
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

        // Determine factors based on flow and e-OSCAR code
        const hasSpecificCode = selectedEOSCARCode !== "112";
        const hasMetro2Targeting = selectedFlow === "ACCURACY" || selectedFlow === "COLLECTION";
        // Check if any selected accounts have detected issues that may indicate discrepancies
        const hasBureauDiscrepancy = selectedAccounts.some(a =>
          a.detectedIssues && a.detectedIssues.some(issue =>
            issue.description.toLowerCase().includes("discrepancy") ||
            issue.description.toLowerCase().includes("inconsistent") ||
            issue.code === "BUREAU_DISCREPANCY"
          )
        );

        // Call success prediction API
        const res = await fetch("/api/sentry/success-prediction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountAge: avgAccountAge,
            furnisherName,
            hasMetro2Targeting,
            eoscarCode: selectedEOSCARCode,
            hasPoliceReport: false,
            hasBureauDiscrepancy,
            hasPaymentProof: false,
            citationAccuracyScore: 0.85, // Default good citation score
            ocrSafetyScore: 75, // Default safe OCR score
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.prediction) {
            setSuccessProbability({
              probability: data.prediction.probability,
              confidence: data.prediction.confidence,
              recommendations: data.prediction.recommendations || [],
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
  }, [selectedAccountIds, selectedEOSCARCode, selectedFlow, selectedCRA, step, accounts]);

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
          eoscarCodeOverride: selectedEOSCARCode,
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
  }, [clientId, selectedCRA, selectedFlow, selectedAccountIds, selectedEOSCARCode]);

  // Regenerate letter
  const handleRegenerate = useCallback(async () => {
    if (!currentDispute) return;

    try {
      setGenerating(true);
      setError(null);

      const res = await fetch(`/api/sentry/${currentDispute.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eoscarCodeOverride: selectedEOSCARCode,
        }),
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
  }, [currentDispute, selectedEOSCARCode]);

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

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {[
          { key: "reports" as Step, label: "1. Select Report" },
          { key: "select" as Step, label: "2. Select Accounts" },
          { key: "configure" as Step, label: "3. Configure" },
          { key: "generate" as Step, label: "4. Generate" },
          { key: "review" as Step, label: "5. Review & Send" },
        ].map((s) => {
          const steps: Step[] = ["reports", "select", "configure", "generate", "review"];
          const currentIndex = steps.indexOf(step);
          const thisIndex = steps.indexOf(s.key);
          const isCompleted = thisIndex < currentIndex;
          const isCurrent = step === s.key;

          return (
            <button
              key={s.key}
              onClick={() => {
                if (thisIndex <= currentIndex) {
                  setStep(s.key);
                }
              }}
              disabled={thisIndex > currentIndex}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                isCurrent
                  ? "bg-primary/20 text-primary"
                  : isCompleted
                  ? "text-emerald-400 hover:text-emerald-300"
                  : "text-muted-foreground cursor-not-allowed"
              }`}
            >
              {isCompleted && (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              {s.label}
            </button>
          );
        })}
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

              {/* Continue button */}
              <div className="flex justify-end">
                <button
                  onClick={handleContinueFromReports}
                  disabled={!selectedReportId}
                  className={`px-6 py-2 rounded-lg text-sm transition-colors ${
                    selectedReportId
                      ? "bg-blue-500 text-foreground hover:bg-primary"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  Continue with Selected Report
                </button>
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

              {/* Navigation buttons */}
              <div className="flex justify-between">
                <button
                  onClick={() => setStep("reports")}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-muted-foreground"
                >
                  ← Back to Reports
                </button>
                <button
                  onClick={() => setStep("configure")}
                  disabled={selectedAccountIds.length === 0}
                  className={`px-6 py-2 rounded-lg text-sm transition-colors ${
                    selectedAccountIds.length > 0
                      ? "bg-blue-500 text-foreground hover:bg-primary"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  Continue with {selectedAccountIds.length} account(s)
                </button>
              </div>
            </>
          )}

          {/* Step 3: Configuration */}
          {step === "configure" && (
            <>
              {/* Flow selection */}
              <div className="bg-card rounded-lg border border-border p-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Dispute Flow
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {(["ACCURACY", "COLLECTION", "CONSENT", "COMBO"] as SentryFlowType[]).map(
                    (flow) => {
                      const colors = SENTRY_FLOW_COLORS[flow];
                      return (
                        <button
                          key={flow}
                          onClick={() => setSelectedFlow(flow)}
                          className={`p-3 rounded-lg text-left transition-colors ${
                            selectedFlow === flow
                              ? `${colors.bg} ${colors.border} border`
                              : "bg-muted hover:bg-muted"
                          }`}
                        >
                          <span
                            className={`text-sm font-medium ${
                              selectedFlow === flow ? colors.text : "text-foreground"
                            }`}
                          >
                            {flow}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* e-OSCAR Code */}
              <EOSCARCodeSelector
                recommendations={[
                  {
                    code: "105",
                    name: "Disputes dates",
                    confidence: 0.85,
                    reasoning: "Best for date discrepancies",
                  },
                  {
                    code: "106",
                    name: "Disputes amounts",
                    confidence: 0.7,
                    reasoning: "Good for balance disputes",
                  },
                  {
                    code: "109",
                    name: "Disputes payment history",
                    confidence: 0.65,
                    reasoning: "For late payment challenges",
                  },
                ]}
                selectedCode={selectedEOSCARCode}
                onCodeSelect={setSelectedEOSCARCode}
              />

              {/* Navigation buttons */}
              <div className="flex justify-between">
                <button
                  onClick={() => setStep("select")}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-muted-foreground"
                >
                  ← Back
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="px-6 py-2 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  {generating ? "Generating..." : "Generate Letter"}
                </button>
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
              <div className="flex justify-between">
                <button
                  onClick={() => setStep("configure")}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-muted-foreground"
                >
                  ← Back to Configure
                </button>
                <div className="flex items-center gap-3">
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
              </div>
            </>
          )}
        </div>

        {/* Right panel - Analysis */}
        <div className="space-y-6">
          {/* Quick stats */}
          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Quick Stats</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reports Available</span>
                <span className="text-foreground">{reports.length}</span>
              </div>
              {selectedReportId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Disputable Accounts</span>
                  <span className="text-foreground">{accounts.filter(a => {
                    // Match the criteria from /api/accounts/negative
                    // Account is disputable if ANY of these are true:
                    if (a.isCollection) return true;
                    if (a.detectedIssues && a.detectedIssues.length > 0) return true;
                    // Check paymentStatus for negative indicators
                    const payStatus = (a.paymentStatus || "").toLowerCase();
                    if (payStatus.includes("late") ||
                        payStatus.includes("delinquent") ||
                        payStatus.includes("chargeoff") ||
                        payStatus.includes("charge off") ||
                        payStatus.includes("collection") ||
                        payStatus.includes("past due")) return true;
                    return false;
                  }).length}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Selected Accounts</span>
                <span className="text-foreground">{selectedAccountIds.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bureau</span>
                <span className={SENTRY_CRA_COLORS[selectedCRA].text}>{selectedCRA}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Flow</span>
                <span className={SENTRY_FLOW_COLORS[selectedFlow].text}>
                  {selectedFlow}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">e-OSCAR Code</span>
                <span className="text-foreground">{selectedEOSCARCode}</span>
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

          {/* Success gauge (if not in analysis) - Powered by Amelia Sentry Engine */}
          {!analysis && step !== "reports" && step !== "select" && (
            <SuccessProbabilityGauge
              probability={successProbability.probability}
              confidence={successProbability.confidence}
              recommendations={successProbability.recommendations.length > 0
                ? successProbability.recommendations
                : [
                    "Add Metro 2 field targeting for +15% potential",
                    "Use specific e-OSCAR codes instead of generic 112",
                  ]}
              breakdown={successProbability.breakdown}
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
    </div>
  );
}

export default SentryDisputePage;
