"use client";

/**
 * SENTRY ANALYSIS PANEL
 *
 * Combined view of all Sentry intelligence analysis results.
 * Now includes actionable recommendations powered by the Amelia Sentry Engine.
 */

import { useState } from "react";
import { type SentryAnalysisPanelProps, type ActionableRecommendationUI } from "./types";
import { SuccessProbabilityGauge } from "./success-probability-gauge";
import { OCRRiskAnalyzer } from "./ocr-risk-analyzer";
import { LegalCitationChecker } from "./legal-citation-checker";
import { ActionableRecommendationsPanel } from "./actionable-recommendations";

type AnalysisTab = "overview" | "ocr" | "citations" | "success";

export function SentryAnalysisPanel({
  analysis,
  disputeId,
  onApplyFixes,
  onApplyRecommendation,
  onRevertRecommendation,
  onResetRecommendations,
}: SentryAnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState<AnalysisTab>("overview");

  const tabs: { key: AnalysisTab; label: string; icon: React.ReactNode }[] = [
    {
      key: "overview",
      label: "Overview",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      key: "ocr",
      label: "OCR",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      key: "citations",
      label: "Legal",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
        </svg>
      ),
    },
    {
      key: "success",
      label: "Success",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="bg-slate-900/50 rounded-xl border border-slate-800">
      {/* Tabs */}
      <div className="flex border-b border-slate-800 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
              activeTab === tab.key
                ? "text-blue-400 border-b-2 border-blue-400 -mb-px"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === "overview" && (
          <OverviewTab
            analysis={analysis}
            onApplyFixes={onApplyFixes}
            onApplyRecommendation={onApplyRecommendation}
            onRevertRecommendation={onRevertRecommendation}
            onResetRecommendations={onResetRecommendations}
          />
        )}

        {activeTab === "ocr" && (
          <OCRRiskAnalyzer
            score={analysis.ocrScore}
            risk={analysis.ocrRisk}
            findings={analysis.ocrFindings}
            onApplyFix={onApplyFixes ? () => onApplyFixes() : undefined}
          />
        )}

        {activeTab === "citations" && (
          <LegalCitationChecker
            validation={analysis.citationValidation}
          />
        )}

        {activeTab === "success" && (
          <SuccessProbabilityGauge
            probability={analysis.successPrediction.probability}
            confidence={analysis.successPrediction.confidence}
            breakdown={analysis.successPrediction.breakdown}
            recommendations={analysis.successPrediction.recommendations}
            actionableRecommendations={analysis.successPrediction.actionableRecommendations}
            onApplyRecommendation={onApplyRecommendation}
            onRevertRecommendation={onRevertRecommendation}
            onResetRecommendations={onResetRecommendations}
          />
        )}
      </div>
    </div>
  );
}

function OverviewTab({
  analysis,
  onApplyFixes,
  onApplyRecommendation,
  onRevertRecommendation,
  onResetRecommendations,
}: {
  analysis: SentryAnalysisPanelProps["analysis"];
  onApplyFixes?: () => void;
  onApplyRecommendation?: (recommendation: ActionableRecommendationUI) => Promise<void>;
  onRevertRecommendation?: (recommendationId: string) => Promise<void>;
  onResetRecommendations?: () => Promise<void>;
}) {
  const overallScore = Math.round(
    analysis.ocrScore * 0.3 +
    (analysis.citationValidation.isValid ? 100 : 50) * 0.2 +
    analysis.successPrediction.probability * 100 * 0.5
  );

  return (
    <div className="space-y-4">
      {/* Overall score */}
      <div className="text-center py-6 bg-slate-800/30 rounded-lg">
        <div className="text-5xl font-bold mb-2">
          <span className={
            overallScore >= 70 ? "text-emerald-400" :
            overallScore >= 50 ? "text-amber-400" :
            "text-red-400"
          }>
            {overallScore}
          </span>
          <span className="text-xl text-slate-500">/100</span>
        </div>
        <p className="text-sm text-slate-400">Overall Dispute Quality Score</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-3">
        {/* OCR Score */}
        <div className={`p-3 rounded-lg border ${
          analysis.ocrScore >= 70 ? "bg-emerald-500/10 border-emerald-500/30" :
          analysis.ocrScore >= 40 ? "bg-amber-500/10 border-amber-500/30" :
          "bg-red-500/10 border-red-500/30"
        }`}>
          <div className="text-2xl font-bold text-slate-200">{analysis.ocrScore}</div>
          <div className="text-xs text-slate-400">OCR Safety</div>
          <div className={`text-xs mt-1 ${
            analysis.ocrScore >= 70 ? "text-emerald-400" :
            analysis.ocrScore >= 40 ? "text-amber-400" :
            "text-red-400"
          }`}>
            {analysis.ocrRisk} risk
          </div>
        </div>

        {/* Citations */}
        <div className={`p-3 rounded-lg border ${
          analysis.citationValidation.isValid
            ? "bg-emerald-500/10 border-emerald-500/30"
            : "bg-red-500/10 border-red-500/30"
        }`}>
          <div className="text-2xl font-bold text-slate-200">
            {analysis.citationValidation.validCitations.length}
          </div>
          <div className="text-xs text-slate-400">Valid Citations</div>
          <div className={`text-xs mt-1 ${
            analysis.citationValidation.isValid ? "text-emerald-400" : "text-red-400"
          }`}>
            {analysis.citationValidation.invalidCitations.length} invalid
          </div>
        </div>

        {/* Success Probability */}
        <div className={`p-3 rounded-lg border ${
          analysis.successPrediction.probability >= 0.7 ? "bg-emerald-500/10 border-emerald-500/30" :
          analysis.successPrediction.probability >= 0.5 ? "bg-amber-500/10 border-amber-500/30" :
          "bg-red-500/10 border-red-500/30"
        }`}>
          <div className="text-2xl font-bold text-slate-200">
            {analysis.successPrediction.probabilityPercent}%
          </div>
          <div className="text-xs text-slate-400">Success Rate</div>
          <div className={`text-xs mt-1 ${
            analysis.successPrediction.probability >= 0.7 ? "text-emerald-400" :
            analysis.successPrediction.probability >= 0.5 ? "text-amber-400" :
            "text-red-400"
          }`}>
            {analysis.successPrediction.confidence} confidence
          </div>
        </div>
      </div>

      {/* Quick actions */}
      {(analysis.ocrScore < 70 || !analysis.citationValidation.isValid) && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-400">Improvements Available</p>
              <p className="text-xs text-slate-400 mt-1">
                {analysis.ocrFindings.length} OCR issues, {analysis.citationValidation.invalidCitations.length} citation issues
              </p>
            </div>
            {onApplyFixes && (
              <button
                onClick={onApplyFixes}
                className="px-4 py-2 bg-amber-500/20 text-amber-400 text-sm rounded-lg hover:bg-amber-500/30 transition-colors"
              >
                Apply Fixes
              </button>
            )}
          </div>
        </div>
      )}

      {/* Actionable Recommendations */}
      {analysis.successPrediction.actionableRecommendations &&
        analysis.successPrediction.actionableRecommendations.length > 0 &&
        onApplyRecommendation && (
          <ActionableRecommendationsPanel
            recommendations={analysis.successPrediction.actionableRecommendations}
            onApply={onApplyRecommendation}
            onRevert={onRevertRecommendation}
            onReset={onResetRecommendations}
            hasAppliedRecommendations={
              analysis.successPrediction.actionableRecommendations.some(
                (r) => r.status === "APPLIED"
              )
            }
          />
        )}

      {/* Text recommendations (fallback if no actionable recommendations or no callback) */}
      {(!analysis.successPrediction.actionableRecommendations ||
        !onApplyRecommendation) &&
        analysis.successPrediction.recommendations.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-slate-400 mb-2">Top Recommendations</h4>
            <ul className="space-y-1">
              {analysis.successPrediction.recommendations.slice(0, 3).map((rec, i) => (
                <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                  <span className="text-blue-400">→</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
    </div>
  );
}

export default SentryAnalysisPanel;
