"use client";

/**
 * SENTRY DISPUTE PAGE
 *
 * Main orchestrator component for the Sentry Dispute builder.
 * This is the primary UI for creating and managing Sentry disputes.
 */

import { useState, useEffect, useCallback } from "react";
import {
  type SentryDisputePageProps,
  type SentryAccountForUI,
  type SentryDisputeForUI,
  type SentryAnalysisForUI,
  SENTRY_CRA_COLORS,
  SENTRY_FLOW_COLORS,
  SENTRY_STATUS_COLORS,
} from "./types";
import { SentryAccountSelector } from "./sentry-account-selector";
import { SentryLetterBuilder } from "./sentry-letter-builder";
import { SentryAnalysisPanel } from "./sentry-analysis-panel";
import { EOSCARCodeSelector } from "./eoscar-code-selector";
import { Metro2FieldSelector } from "./metro2-field-selector";
import { SuccessProbabilityGauge } from "./success-probability-gauge";
import type { SentryCRA, SentryFlowType } from "@/types/sentry";

type Step = "select" | "configure" | "generate" | "review";

interface ClientData {
  id: string;
  firstName: string;
  lastName: string;
}

export function SentryDisputePage({ clientId }: SentryDisputePageProps) {
  // State
  const [step, setStep] = useState<Step>("select");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Client and accounts
  const [client, setClient] = useState<ClientData | null>(null);
  const [accounts, setAccounts] = useState<SentryAccountForUI[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);

  // Configuration
  const [selectedCRA, setSelectedCRA] = useState<SentryCRA>("TRANSUNION");
  const [selectedFlow, setSelectedFlow] = useState<SentryFlowType>("ACCURACY");
  const [selectedEOSCARCode, setSelectedEOSCARCode] = useState<string>("105");
  const [selectedMetro2Fields, setSelectedMetro2Fields] = useState<string[]>([]);

  // Dispute and analysis
  const [currentDispute, setCurrentDispute] = useState<SentryDisputeForUI | null>(null);
  const [analysis, setAnalysis] = useState<SentryAnalysisForUI | null>(null);
  const [generating, setGenerating] = useState(false);

  // Load client and accounts
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch client
        const clientRes = await fetch(`/api/clients/${clientId}`);
        if (!clientRes.ok) throw new Error("Failed to load client");
        const clientData = await clientRes.json();
        setClient(clientData.client);

        // Fetch accounts
        const accountsRes = await fetch(`/api/clients/${clientId}/accounts`);
        if (!accountsRes.ok) throw new Error("Failed to load accounts");
        const accountsData = await accountsRes.json();

        // Transform to UI format
        const uiAccounts: SentryAccountForUI[] = accountsData.accounts.map((acc: Record<string, unknown>) => ({
          id: acc.id,
          creditorName: acc.creditorName,
          maskedAccountId: acc.maskedAccountId,
          accountType: acc.accountType,
          balance: acc.balance,
          dateOpened: acc.dateOpened,
          cra: acc.cra,
          paymentStatus: acc.paymentStatus,
          isCollection: String(acc.accountType || "").toLowerCase().includes("collection"),
          detectedIssues: acc.detectedIssues
            ? JSON.parse(String(acc.detectedIssues))
            : [],
        }));

        setAccounts(uiAccounts);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [clientId]);

  // Filter accounts by selected CRA
  const filteredAccounts = accounts.filter((a) => a.cra === selectedCRA);

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
            probabilityPercent: Math.round((createData.sentry.successPrediction?.probability || 0.5) * 100),
            confidence: createData.sentry.successPrediction?.confidence || "MEDIUM",
            label: "",
            breakdown: [],
            recommendations: createData.sentry.successPrediction?.recommendations || [],
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

      // Update dispute with new content
      setCurrentDispute((prev) =>
        prev ? { ...prev, letterContent: data.letterContent } : null
      );

      // Update analysis
      if (data.sentry) {
        // Update analysis state
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate");
    } finally {
      setGenerating(false);
    }
  }, [currentDispute, selectedEOSCARCode]);

  // Save letter edits
  const handleSaveLetter = useCallback(async (content: string) => {
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
  }, [currentDispute]);

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

  // Loading state
  if (loading) {
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
          <h1 className="text-2xl font-bold text-slate-200">Sentry Dispute</h1>
          {client && (
            <p className="text-sm text-slate-400 mt-1">
              {client.firstName} {client.lastName}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 text-xs bg-blue-500/20 text-blue-400 rounded-lg">
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
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-4">
        {[
          { key: "select" as Step, label: "1. Select Accounts" },
          { key: "configure" as Step, label: "2. Configure" },
          { key: "generate" as Step, label: "3. Generate" },
          { key: "review" as Step, label: "4. Review & Send" },
        ].map((s, i) => (
          <button
            key={s.key}
            onClick={() => {
              // Only allow going back
              const steps: Step[] = ["select", "configure", "generate", "review"];
              if (steps.indexOf(s.key) <= steps.indexOf(step)) {
                setStep(s.key);
              }
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              step === s.key
                ? "bg-blue-500/20 text-blue-400"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left panel - Selection and configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: CRA Selection */}
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
                          : "text-slate-400 hover:text-slate-300"
                      }`}
                    >
                      {cra} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Account selector */}
              <SentryAccountSelector
                accounts={filteredAccounts}
                selectedIds={selectedAccountIds}
                onSelectionChange={setSelectedAccountIds}
                cra={selectedCRA}
              />

              {/* Continue button */}
              <div className="flex justify-end">
                <button
                  onClick={() => setStep("configure")}
                  disabled={selectedAccountIds.length === 0}
                  className={`px-6 py-2 rounded-lg text-sm transition-colors ${
                    selectedAccountIds.length > 0
                      ? "bg-blue-500 text-white hover:bg-blue-600"
                      : "bg-slate-700 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  Continue with {selectedAccountIds.length} account(s)
                </button>
              </div>
            </>
          )}

          {/* Step 2: Configuration */}
          {step === "configure" && (
            <>
              {/* Flow selection */}
              <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
                <h3 className="text-sm font-medium text-slate-300 mb-3">Dispute Flow</h3>
                <div className="grid grid-cols-2 gap-2">
                  {(["ACCURACY", "COLLECTION", "CONSENT", "COMBO"] as SentryFlowType[]).map((flow) => {
                    const colors = SENTRY_FLOW_COLORS[flow];
                    return (
                      <button
                        key={flow}
                        onClick={() => setSelectedFlow(flow)}
                        className={`p-3 rounded-lg text-left transition-colors ${
                          selectedFlow === flow
                            ? `${colors.bg} ${colors.border} border`
                            : "bg-slate-700/30 hover:bg-slate-700/50"
                        }`}
                      >
                        <span className={`text-sm font-medium ${selectedFlow === flow ? colors.text : "text-slate-200"}`}>
                          {flow}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* e-OSCAR Code */}
              <EOSCARCodeSelector
                recommendations={[
                  { code: "105", name: "Not mine", confidence: 0.85, reasoning: "Best for collections" },
                  { code: "106", name: "Belongs to another", confidence: 0.7, reasoning: "Good for mixed files" },
                ]}
                selectedCode={selectedEOSCARCode}
                onCodeSelect={setSelectedEOSCARCode}
              />

              {/* Continue button */}
              <div className="flex justify-between">
                <button
                  onClick={() => setStep("select")}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-300"
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

          {/* Step 3 & 4: Review */}
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
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-300"
                >
                  ← Back to Configure
                </button>
                <button
                  onClick={handleLaunch}
                  disabled={currentDispute.status !== "DRAFT"}
                  className={`px-6 py-2 rounded-lg text-sm transition-colors ${
                    currentDispute.status === "DRAFT"
                      ? "bg-emerald-500 text-white hover:bg-emerald-600"
                      : "bg-slate-700 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  {currentDispute.status === "DRAFT" ? "Launch Dispute" : `Status: ${currentDispute.status}`}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right panel - Analysis */}
        <div className="space-y-6">
          {/* Quick stats */}
          <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Quick Stats</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Selected Accounts</span>
                <span className="text-slate-200">{selectedAccountIds.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Bureau</span>
                <span className={SENTRY_CRA_COLORS[selectedCRA].text}>{selectedCRA}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Flow</span>
                <span className={SENTRY_FLOW_COLORS[selectedFlow].text}>{selectedFlow}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">e-OSCAR Code</span>
                <span className="text-slate-200">{selectedEOSCARCode}</span>
              </div>
            </div>
          </div>

          {/* Analysis panel */}
          {analysis && (
            <SentryAnalysisPanel
              analysis={analysis}
              onApplyFixes={() => {
                // Implement auto-fix
              }}
            />
          )}

          {/* Success gauge (if not in analysis) */}
          {!analysis && step !== "select" && (
            <SuccessProbabilityGauge
              probability={0.55}
              confidence="MEDIUM"
              recommendations={[
                "Add Metro 2 field targeting for +15% potential",
                "Use specific e-OSCAR codes instead of generic 112",
              ]}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default SentryDisputePage;
