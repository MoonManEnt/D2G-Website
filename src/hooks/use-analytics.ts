'use client';

// ============================================================================
// DISPUTE2GO - Analytics Hooks
// React hooks for analytics and dashboard data
// ============================================================================

import { useMemo } from 'react';
import { useApiQuery } from './use-api';
import { analyticsApi } from '@/lib/api-client';
import type { CRA, FlowType } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface DashboardStats {
  clients: {
    total: number;
    active: number;
    newThisMonth: number;
    byStage: Record<string, number>;
  };
  disputes: {
    total: number;
    pending: number;
    sent: number;
    resolved: number;
    successRate: number;
    averageResolutionDays: number;
  };
  responses: {
    pending: number;
    overdue: number;
    receivedThisWeek: number;
  };
  revenue?: {
    thisMonth: number;
    lastMonth: number;
    growth: number;
  };
}

export interface SuccessRateByCRA {
  cra: CRA;
  total: number;
  successful: number;
  rate: number;
  deletionRate: number;
  verifiedRate: number;
  updatedRate: number;
}

export interface SuccessRateByFlow {
  flow: FlowType;
  total: number;
  successful: number;
  rate: number;
  averageRounds: number;
  averageDays: number;
}

export interface MonthlyTrend {
  month: string;
  year: number;
  disputes: {
    created: number;
    sent: number;
    resolved: number;
    successful: number;
  };
  clients: {
    new: number;
    active: number;
  };
  successRate: number;
}

export interface ClientFunnelStats {
  stage: string;
  count: number;
  percentage: number;
  averageDaysInStage: number;
  conversionRate?: number;
}

export interface ViolationStats {
  total: number;
  byType: {
    type: string;
    count: number;
    percentage: number;
    averageDamages?: number;
  }[];
  byCRA: {
    cra: CRA;
    count: number;
    percentage: number;
  }[];
  potentialDamages: number;
}

export interface AnalyticsData {
  dashboard: DashboardStats;
  successByCRA: SuccessRateByCRA[];
  successByFlow: SuccessRateByFlow[];
  monthlyTrends: MonthlyTrend[];
  clientFunnel: ClientFunnelStats[];
  violations: ViolationStats;
}

// ============================================================================
// useDashboardStats Hook
// Fetch main dashboard statistics
// ============================================================================

export function useDashboardStats() {
  return useApiQuery<DashboardStats>(
    () => analyticsApi.getDashboardStats<DashboardStats>(),
    []
  );
}

// ============================================================================
// useSuccessRateByCRA Hook
// Fetch success rates broken down by CRA
// ============================================================================

export function useSuccessRateByCRA() {
  return useApiQuery<SuccessRateByCRA[]>(
    () => analyticsApi.getSuccessRateByCRA<SuccessRateByCRA[]>(),
    []
  );
}

// ============================================================================
// useSuccessRateByFlow Hook
// Fetch success rates broken down by dispute flow
// ============================================================================

export function useSuccessRateByFlow() {
  return useApiQuery<SuccessRateByFlow[]>(
    () => analyticsApi.getSuccessRateByFlow<SuccessRateByFlow[]>(),
    []
  );
}

// ============================================================================
// useMonthlyTrends Hook
// Fetch monthly trend data for charts
// ============================================================================

export function useMonthlyTrends(months: number = 6) {
  return useApiQuery<MonthlyTrend[]>(
    () => analyticsApi.getMonthlyTrends<MonthlyTrend[]>(months),
    [months]
  );
}

// ============================================================================
// useClientFunnel Hook
// Fetch client funnel/pipeline stats
// ============================================================================

export function useClientFunnel() {
  return useApiQuery<ClientFunnelStats[]>(
    () => analyticsApi.getClientFunnel<ClientFunnelStats[]>(),
    []
  );
}

// ============================================================================
// useViolationStats Hook
// Fetch FCRA violation statistics
// ============================================================================

export function useViolationStats() {
  return useApiQuery<ViolationStats>(
    () => analyticsApi.getViolationStats<ViolationStats>(),
    []
  );
}

// ============================================================================
// useAllAnalytics Hook
// Fetch all analytics data in one request
// ============================================================================

export function useAllAnalytics() {
  return useApiQuery<AnalyticsData>(
    () => analyticsApi.getAll<AnalyticsData>(),
    []
  );
}

// ============================================================================
// Computed Hooks
// ============================================================================

// Calculate overall success rate from CRA data
export function useOverallSuccessRate(successByCRA: SuccessRateByCRA[] | null | undefined): number {
  return useMemo(() => {
    if (!successByCRA || successByCRA.length === 0) return 0;

    const totalSuccessful = successByCRA.reduce((sum, cra) => sum + cra.successful, 0);
    const total = successByCRA.reduce((sum, cra) => sum + cra.total, 0);

    return total > 0 ? Math.round((totalSuccessful / total) * 100) : 0;
  }, [successByCRA]);
}

// Get best performing CRA
export function useBestPerformingCRA(successByCRA: SuccessRateByCRA[] | null | undefined): SuccessRateByCRA | null {
  return useMemo(() => {
    if (!successByCRA || successByCRA.length === 0) return null;
    return successByCRA.reduce((best, current) =>
      current.rate > best.rate ? current : best
    );
  }, [successByCRA]);
}

// Get best performing flow
export function useBestPerformingFlow(successByFlow: SuccessRateByFlow[] | null | undefined): SuccessRateByFlow | null {
  return useMemo(() => {
    if (!successByFlow || successByFlow.length === 0) return null;
    return successByFlow.reduce((best, current) =>
      current.rate > best.rate ? current : best
    );
  }, [successByFlow]);
}

// Calculate trend direction for monthly data
export function useTrendDirection(trends: MonthlyTrend[] | null | undefined): {
  direction: 'up' | 'down' | 'stable';
  percentage: number;
} {
  return useMemo(() => {
    if (!trends || trends.length < 2) {
      return { direction: 'stable', percentage: 0 };
    }

    const current = trends[trends.length - 1];
    const previous = trends[trends.length - 2];

    if (previous.successRate === 0) {
      return { direction: 'stable', percentage: 0 };
    }

    const change = ((current.successRate - previous.successRate) / previous.successRate) * 100;

    if (change > 1) {
      return { direction: 'up', percentage: Math.round(change) };
    } else if (change < -1) {
      return { direction: 'down', percentage: Math.abs(Math.round(change)) };
    }

    return { direction: 'stable', percentage: 0 };
  }, [trends]);
}

// Format monthly trends for chart libraries
export function useFormattedTrendsForChart(trends: MonthlyTrend[] | null | undefined) {
  return useMemo(() => {
    if (!trends) return [];

    return trends.map(trend => ({
      label: `${trend.month} ${trend.year}`,
      disputes: trend.disputes.created,
      sent: trend.disputes.sent,
      resolved: trend.disputes.resolved,
      successRate: trend.successRate,
      newClients: trend.clients.new,
    }));
  }, [trends]);
}

// Calculate funnel conversion rates
export function useFunnelConversionRates(funnel: ClientFunnelStats[] | null | undefined) {
  return useMemo(() => {
    if (!funnel || funnel.length < 2) return [];

    return funnel.map((stage, index) => {
      if (index === 0) {
        return { ...stage, conversionFromPrevious: 100 };
      }

      const previousStage = funnel[index - 1];
      const conversionFromPrevious = previousStage.count > 0
        ? Math.round((stage.count / previousStage.count) * 100)
        : 0;

      return { ...stage, conversionFromPrevious };
    });
  }, [funnel]);
}

// Calculate top violation types
export function useTopViolations(violations: ViolationStats | null | undefined, count: number = 5) {
  return useMemo(() => {
    if (!violations?.byType) return [];
    return violations.byType
      .sort((a, b) => b.count - a.count)
      .slice(0, count);
  }, [violations, count]);
}

// Calculate CRA comparison data for charts
export function useCRAComparisonData(successByCRA: SuccessRateByCRA[] | null | undefined) {
  return useMemo(() => {
    if (!successByCRA) return [];

    return successByCRA.map(cra => ({
      name: cra.cra,
      successRate: cra.rate,
      deletionRate: cra.deletionRate,
      verifiedRate: cra.verifiedRate,
      updatedRate: cra.updatedRate,
      total: cra.total,
    }));
  }, [successByCRA]);
}

// Calculate average resolution time across all flows
export function useAverageResolutionTime(successByFlow: SuccessRateByFlow[] | null | undefined): number {
  return useMemo(() => {
    if (!successByFlow || successByFlow.length === 0) return 0;

    const totalDays = successByFlow.reduce((sum, flow) => sum + flow.averageDays * flow.total, 0);
    const total = successByFlow.reduce((sum, flow) => sum + flow.total, 0);

    return total > 0 ? Math.round(totalDays / total) : 0;
  }, [successByFlow]);
}

// Calculate average rounds across all flows
export function useAverageRounds(successByFlow: SuccessRateByFlow[] | null | undefined): number {
  return useMemo(() => {
    if (!successByFlow || successByFlow.length === 0) return 0;

    const totalRounds = successByFlow.reduce((sum, flow) => sum + flow.averageRounds * flow.total, 0);
    const total = successByFlow.reduce((sum, flow) => sum + flow.total, 0);

    return total > 0 ? Math.round(totalRounds / total * 10) / 10 : 0;
  }, [successByFlow]);
}

// Calculate key performance indicators
export function useKPIs(dashboard: DashboardStats | null | undefined) {
  return useMemo(() => {
    if (!dashboard) {
      return {
        clientRetention: 0,
        disputeEfficiency: 0,
        responseRate: 0,
        overduePercentage: 0,
      };
    }

    const clientRetention = dashboard.clients.total > 0
      ? Math.round((dashboard.clients.active / dashboard.clients.total) * 100)
      : 0;

    const disputeEfficiency = dashboard.disputes.total > 0
      ? Math.round(((dashboard.disputes.resolved + dashboard.disputes.sent) / dashboard.disputes.total) * 100)
      : 0;

    const totalPendingOrOverdue = dashboard.responses.pending + dashboard.responses.overdue;
    const overduePercentage = totalPendingOrOverdue > 0
      ? Math.round((dashboard.responses.overdue / totalPendingOrOverdue) * 100)
      : 0;

    const responseRate = dashboard.disputes.sent > 0
      ? Math.round(((dashboard.disputes.sent - dashboard.responses.pending) / dashboard.disputes.sent) * 100)
      : 0;

    return {
      clientRetention,
      disputeEfficiency,
      responseRate,
      overduePercentage,
    };
  }, [dashboard]);
}

// Calculate month-over-month growth
export function useMonthOverMonthGrowth(trends: MonthlyTrend[] | null | undefined) {
  return useMemo(() => {
    if (!trends || trends.length < 2) {
      return {
        disputes: 0,
        clients: 0,
        successRate: 0,
      };
    }

    const current = trends[trends.length - 1];
    const previous = trends[trends.length - 2];

    const disputeGrowth = previous.disputes.created > 0
      ? Math.round(((current.disputes.created - previous.disputes.created) / previous.disputes.created) * 100)
      : 0;

    const clientGrowth = previous.clients.new > 0
      ? Math.round(((current.clients.new - previous.clients.new) / previous.clients.new) * 100)
      : 0;

    const successRateChange = current.successRate - previous.successRate;

    return {
      disputes: disputeGrowth,
      clients: clientGrowth,
      successRate: Math.round(successRateChange),
    };
  }, [trends]);
}

export default useDashboardStats;
