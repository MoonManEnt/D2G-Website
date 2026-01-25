'use client';

// ============================================================================
// DISPUTE2GO - AMELIA AI Hooks
// React hooks for AMELIA AI-powered features
// ============================================================================

import { useMemo } from 'react';
import { useApiQuery, useMutation } from './use-api';
import { ameliaApi } from '@/lib/api-client';
import type { FlowType, CRA } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface AmeliaInsight {
  id: string;
  type: 'RECOMMENDATION' | 'WARNING' | 'TIP' | 'LEGAL_CITATION';
  title: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  relatedAccounts?: string[];
  suggestedAction?: string;
  statuteReference?: string;
}

export interface AccountInsightRequest {
  accounts: AccountForInsight[];
  clientHistory?: ClientHistory;
  options?: InsightOptions;
}

export interface AccountForInsight {
  id: string;
  creditorName: string;
  maskedAccountId: string;
  cra: CRA;
  accountStatus: string;
  balance?: number;
  pastDue?: number;
  dateOpened?: string;
  dateReported?: string;
  isNegative: boolean;
}

export interface ClientHistory {
  previousDisputes?: number;
  previousSuccesses?: number;
  averageRound?: number;
  lastDisputeDate?: string;
}

export interface InsightOptions {
  includeFlowRecommendations?: boolean;
  includeToneRecommendations?: boolean;
  includeStatuteSuggestions?: boolean;
  maxInsights?: number;
}

export interface FlowRecommendation {
  accountId: string;
  creditorName: string;
  recommendedFlow: FlowType;
  confidence: number;
  reasoning: string;
  alternativeFlows?: {
    flow: FlowType;
    confidence: number;
    reasoning: string;
  }[];
}

export interface ToneRecommendation {
  round: number;
  recommendedTone: 'formal' | 'assertive' | 'aggressive';
  reasoning: string;
  samplePhrases?: string[];
}

export interface EoscarCheckResult {
  score: number;
  isResistant: boolean;
  vulnerabilities: EoscarVulnerability[];
  suggestions: string[];
}

export interface EoscarVulnerability {
  type: string;
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  lineNumber?: number;
  suggestion: string;
}

export interface CreditDNA {
  clientId: string;
  overallHealth: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  overallScore: number;
  analysis: CreditDNAAnalysis;
  recommendations: CreditDNARecommendation[];
  riskFactors: CreditDNARiskFactor[];
  opportunities: CreditDNAOpportunity[];
  generatedAt: string;
}

export interface CreditDNAAnalysis {
  accountMix: {
    total: number;
    positive: number;
    negative: number;
    neutral: number;
  };
  utilizationRate?: number;
  averageAccountAge?: number;
  paymentHistory?: {
    onTime: number;
    late30: number;
    late60: number;
    late90Plus: number;
  };
  derogatorySummary: {
    collections: number;
    chargeOffs: number;
    publicRecords: number;
  };
}

export interface CreditDNARecommendation {
  id: string;
  priority: number;
  category: string;
  title: string;
  description: string;
  expectedImpact: 'HIGH' | 'MEDIUM' | 'LOW';
  timeframe: string;
  steps?: string[];
}

export interface CreditDNARiskFactor {
  factor: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  affectedAccounts?: string[];
}

export interface CreditDNAOpportunity {
  type: string;
  title: string;
  description: string;
  potentialGain: string;
  relatedAccounts?: string[];
}

export interface RegenerateSectionRequest {
  disputeId: string;
  sectionType: string;
  currentContent: string;
  instructions?: string;
  tone?: 'formal' | 'assertive' | 'aggressive';
}

export interface GeneratedSection {
  sectionType: string;
  content: string;
  confidence: number;
  alternatives?: string[];
}

export interface DisputeGenerationRequest {
  accountId: string;
  cra: CRA;
  flow: FlowType;
  round: number;
  clientInfo?: {
    firstName: string;
    lastName: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    ssn4?: string;
  };
  customInstructions?: string;
  tone?: 'formal' | 'assertive' | 'aggressive';
}

export interface GeneratedDispute {
  letterContent: string;
  statutesCited: string[];
  sections: {
    type: string;
    content: string;
  }[];
  confidence: number;
  warnings?: string[];
}

export interface CFPBGenerationRequest {
  disputeId: string;
  violationType: string;
  evidence?: string[];
  customNarrative?: string;
}

export interface GeneratedCFPB {
  intro: string;
  when: string;
  how: string;
  why: string;
  what: string;
  fullContent: string;
  confidence: number;
}

// ============================================================================
// useCreditDNA Hook
// Fetch AI-generated Credit DNA analysis for a client
// ============================================================================

export function useCreditDNA(clientId: string | null | undefined) {
  return useApiQuery<CreditDNA>(
    () => ameliaApi.generateCreditDNA<CreditDNA>(clientId!),
    [clientId],
    { enabled: !!clientId }
  );
}

// ============================================================================
// Mutation Hooks
// ============================================================================

// Generate AI Insights for Accounts
export function useAmeliaInsights() {
  return useMutation<AmeliaInsight[], AccountInsightRequest>(
    (data) => ameliaApi.generateInsights<AmeliaInsight[]>(data)
  );
}

// Get Recommended Flow for Accounts
export function useRecommendedFlow() {
  return useMutation<FlowRecommendation[], AccountForInsight[]>(
    (accounts) => ameliaApi.getRecommendedFlow<FlowRecommendation[]>(accounts)
  );
}

// Get Tone Recommendation for Round
export function useToneRecommendation() {
  return useMutation<ToneRecommendation, { round: number; history: ClientHistory }>(
    ({ round, history }) => ameliaApi.getToneRecommendation<ToneRecommendation>(round, history)
  );
}

// Check eOSCAR Resistance Score
export function useEoscarCheck() {
  return useMutation<EoscarCheckResult, string>(
    (content) => ameliaApi.checkEoscar<EoscarCheckResult>(content)
  );
}

// Regenerate Letter Section
export function useRegenerateSection() {
  return useMutation<GeneratedSection, RegenerateSectionRequest>(
    (data) => ameliaApi.regenerateSection<GeneratedSection>(data)
  );
}

// Generate Full Dispute Letter
export function useGenerateDispute() {
  return useMutation<GeneratedDispute, { disputeId: string; data?: DisputeGenerationRequest }>(
    ({ disputeId, data }) => ameliaApi.generateDispute<GeneratedDispute>(disputeId, data)
  );
}

// Generate CFPB Complaint
export function useGenerateCFPB() {
  return useMutation<GeneratedCFPB, { disputeId: string; data?: CFPBGenerationRequest }>(
    ({ disputeId, data }) => ameliaApi.generateCFPB<GeneratedCFPB>(disputeId, data)
  );
}

// Generate Credit DNA (as mutation for manual refresh)
export function useRefreshCreditDNA() {
  return useMutation<CreditDNA, string>(
    (clientId) => ameliaApi.generateCreditDNA<CreditDNA>(clientId)
  );
}

// ============================================================================
// Computed Hooks
// ============================================================================

// Categorize insights by type
export function useInsightsByType(insights: AmeliaInsight[] | null | undefined) {
  return useMemo(() => {
    if (!insights) {
      return {
        recommendations: [],
        warnings: [],
        tips: [],
        legalCitations: [],
      };
    }

    return {
      recommendations: insights.filter(i => i.type === 'RECOMMENDATION'),
      warnings: insights.filter(i => i.type === 'WARNING'),
      tips: insights.filter(i => i.type === 'TIP'),
      legalCitations: insights.filter(i => i.type === 'LEGAL_CITATION'),
    };
  }, [insights]);
}

// Filter high priority insights
export function useHighPriorityInsights(insights: AmeliaInsight[] | null | undefined) {
  return useMemo(() => {
    if (!insights) return [];
    return insights.filter(i => i.priority === 'HIGH');
  }, [insights]);
}

// Sort insights by priority
export function useSortedInsights(insights: AmeliaInsight[] | null | undefined) {
  return useMemo(() => {
    if (!insights) return [];

    const priorityOrder: Record<string, number> = {
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
    };

    return [...insights].sort((a, b) => {
      const aPriority = priorityOrder[a.priority] || 99;
      const bPriority = priorityOrder[b.priority] || 99;
      return aPriority - bPriority;
    });
  }, [insights]);
}

// Calculate Credit DNA health score color
export function useCreditDNAHealthColor(health: CreditDNA['overallHealth'] | null | undefined): string {
  return useMemo(() => {
    if (!health) return '#64748b'; // gray

    const colors: Record<CreditDNA['overallHealth'], string> = {
      EXCELLENT: '#10b981', // green
      GOOD: '#22c55e', // light green
      FAIR: '#f59e0b', // amber
      POOR: '#ef4444', // red
    };

    return colors[health] || '#64748b';
  }, [health]);
}

// Get top recommendations from Credit DNA
export function useTopRecommendations(creditDNA: CreditDNA | null | undefined, count: number = 3) {
  return useMemo(() => {
    if (!creditDNA?.recommendations) return [];
    return creditDNA.recommendations
      .sort((a, b) => a.priority - b.priority)
      .slice(0, count);
  }, [creditDNA, count]);
}

// Categorize risk factors by severity
export function useRiskFactorsBySeverity(creditDNA: CreditDNA | null | undefined) {
  return useMemo(() => {
    if (!creditDNA?.riskFactors) {
      return {
        high: [],
        medium: [],
        low: [],
      };
    }

    return {
      high: creditDNA.riskFactors.filter(r => r.severity === 'HIGH'),
      medium: creditDNA.riskFactors.filter(r => r.severity === 'MEDIUM'),
      low: creditDNA.riskFactors.filter(r => r.severity === 'LOW'),
    };
  }, [creditDNA]);
}

// Calculate eOSCAR resistance level
export function useEoscarResistanceLevel(result: EoscarCheckResult | null | undefined): {
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  color: string;
  label: string;
} {
  return useMemo(() => {
    if (!result) {
      return { level: 'LOW', color: '#64748b', label: 'Unknown' };
    }

    if (result.score >= 80) {
      return { level: 'HIGH', color: '#10b981', label: 'Highly Resistant' };
    }

    if (result.score >= 50) {
      return { level: 'MEDIUM', color: '#f59e0b', label: 'Moderately Resistant' };
    }

    return { level: 'LOW', color: '#ef4444', label: 'Vulnerable' };
  }, [result]);
}

// Group flow recommendations by flow type
export function useFlowRecommendationsByType(recommendations: FlowRecommendation[] | null | undefined) {
  return useMemo(() => {
    if (!recommendations) return {};

    return recommendations.reduce(
      (acc, rec) => {
        if (!acc[rec.recommendedFlow]) {
          acc[rec.recommendedFlow] = [];
        }
        acc[rec.recommendedFlow].push(rec);
        return acc;
      },
      {} as Record<FlowType, FlowRecommendation[]>
    );
  }, [recommendations]);
}

// Calculate average confidence from flow recommendations
export function useAverageConfidence(recommendations: FlowRecommendation[] | null | undefined): number {
  return useMemo(() => {
    if (!recommendations || recommendations.length === 0) return 0;
    const total = recommendations.reduce((sum, r) => sum + r.confidence, 0);
    return Math.round((total / recommendations.length) * 100) / 100;
  }, [recommendations]);
}

export default useCreditDNA;
