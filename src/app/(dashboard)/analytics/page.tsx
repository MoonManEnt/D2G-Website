"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  TrendingUp,
  Users,
  FileText,
  CheckCircle2,
  Clock,
  Zap,
  Brain,
  Target,
  AlertTriangle,
  Scale,
  Send,
  ChevronUp,
  ChevronDown,
  Download,
} from "lucide-react";

// Extended analytics interface preserving existing data + new metrics
interface AnalyticsData {
  summary: {
    clientCount: number;
    activeDisputeCount: number;
    resolvedDisputeCount: number;
    negativeItemCount: number;
    reportsUploaded: number;
    resolutionRate: number;
    avgResolutionDays: number;
    // New metrics
    totalItemsDeleted?: number;
    overallSuccessRate?: number;
    avgScoreImprovement?: number;
    avgCompletionMonths?: number;
  };
  charts: {
    disputesByStatus: Array<{ name: string; value: number }>;
    disputesByCRA: Array<{ name: string; value: number }>;
    disputesByFlow: Array<{ name: string; value: number }>;
    dailyActivity: Array<{ date: string; disputes: number; reports: number }>;
  };
  // New chart data
  monthlyTrends?: Array<{
    month: string;
    clients: number;
    disputes: number;
    deleted: number;
    successRate: number;
  }>;
  successByCRA?: Record<string, {
    sent: number;
    deleted: number;
    verified: number;
    noResponse: number;
    rate: number;
  }>;
  successByFlow?: Record<string, {
    total: number;
    success: number;
    rate: number;
  }>;
  roundPerformance?: Array<{
    round: string;
    sent: number;
    deleted: number;
    rate: number;
  }>;
  clientFunnel?: Record<string, number>;
  topPerformingItems?: Array<{
    type: string;
    deleted: number;
    total: number;
    rate: number;
  }>;
  fcraViolations?: {
    total: number;
    failureToRespond: number;
    inadequateInvestigation: number;
    frivolousRejection: number;
    cfpbComplaints: number;
  };
  recentActivity?: Array<{
    date: string;
    type: string;
    client: string;
    details: string;
  }>;
  recentDisputes: Array<{
    id: string;
    cra: string;
    status: string;
    flow: string;
    round: number;
    clientName: string;
    createdAt: string;
  }>;
  topClients: Array<{
    id: string;
    name: string;
    disputeCount: number;
    accountCount: number;
  }>;
  llmStats: {
    totalRequests: number;
    totalCostCents: number;
    avgLatencyMs: number;
    byProvider: Record<string, { requests: number; cost: number }>;
    byTaskType: Record<string, { requests: number; cost: number }>;
  };
}

type TimeRange = "1m" | "3m" | "6m" | "1y" | "all";

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("6m");

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const response = await fetch(`/api/analytics?range=${timeRange}`);
        if (response.ok) {
          const analytics = await response.json();
          setData(analytics);
        }
      } catch (error) {
        console.error("Error fetching analytics:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnalytics();
  }, [timeRange]);

  if (isLoading) {
    return <AnalyticsSkeleton />;
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Failed to load analytics data.</p>
        </div>
      </div>
    );
  }

  // Calculate monthly trends max for chart scaling
  const maxDisputes = data.monthlyTrends
    ? Math.max(...data.monthlyTrends.map(m => m.disputes), 1)
    : Math.max(...data.charts.dailyActivity.map(d => d.disputes), 1);

  return (
    <div className="space-y-6 relative">
      {/* Ambient glow effects */}
      <div className="fixed top-[10%] left-[20%] w-[600px] h-[600px] bg-[radial-gradient(ellipse,rgba(124,58,237,0.08)_0%,transparent_70%)] pointer-events-none" />
      <div className="fixed bottom-[20%] right-[10%] w-[400px] h-[400px] bg-[radial-gradient(ellipse,rgba(16,185,129,0.06)_0%,transparent_70%)] pointer-events-none" />

      {/* Header */}
      <div className="flex justify-between items-start relative z-10">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-foreground" />
            Analytics
          </h1>
          <p className="text-muted-foreground mt-1">Business performance and insights</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex bg-card rounded-lg p-1">
            {(["1m", "3m", "6m", "1y", "all"] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${
                  timeRange === range
                    ? "bg-purple-500/20 text-purple-400"
                    : "text-muted-foreground hover:text-muted-foreground"
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
          <button className="px-4 py-2 bg-muted border border-input rounded-lg text-sm text-foreground flex items-center gap-2 hover:bg-muted transition-colors">
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* KPI Cards - 6 columns */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 relative z-10">
        {(() => {
          // Calculate real month-over-month trends from monthly data
          const trends = data.monthlyTrends || [];
          const currentMonth = trends.length > 0 ? trends[trends.length - 1] : null;
          const prevMonth = trends.length > 1 ? trends[trends.length - 2] : null;

          const disputeChange = currentMonth && prevMonth
            ? currentMonth.disputes - prevMonth.disputes : null;
          const deletedChange = currentMonth && prevMonth
            ? currentMonth.deleted - prevMonth.deleted : null;

          const currentRate = data.summary.overallSuccessRate || data.summary.resolutionRate;
          const prevRate = prevMonth ? prevMonth.successRate : null;
          const rateChange = prevRate !== null && prevRate > 0
            ? currentRate - prevRate : null;

          const totalDisputes = data.summary.activeDisputeCount + data.summary.resolvedDisputeCount;
          const totalDeleted = data.summary.totalItemsDeleted || data.summary.resolvedDisputeCount;
          const scoreImprovement = data.summary.avgScoreImprovement || 0;
          const completionMonths = data.summary.avgCompletionMonths || (data.summary.avgResolutionDays > 0 ? Number((data.summary.avgResolutionDays / 30).toFixed(1)) : 0);
          const hasData = data.summary.clientCount > 0;

          return (
            <>
              <KPICard
                icon={<Users className="w-6 h-6" />}
                value={data.summary.clientCount}
                label="Total Clients"
                trend={currentMonth && currentMonth.clients > 0 ? `+${currentMonth.clients} this month` : undefined}
                trendUp={true}
              />
              <KPICard
                icon={<Send className="w-6 h-6" />}
                value={totalDisputes}
                label="Total Disputes"
                trend={disputeChange !== null && disputeChange !== 0
                  ? `${disputeChange > 0 ? "+" : ""}${disputeChange} from last month`
                  : undefined}
                trendUp={disputeChange !== null ? disputeChange >= 0 : undefined}
              />
              <KPICard
                icon={<CheckCircle2 className="w-6 h-6" />}
                value={totalDeleted}
                label="Items Deleted"
                trend={deletedChange !== null && deletedChange !== 0
                  ? `${deletedChange > 0 ? "+" : ""}${deletedChange} from last month`
                  : undefined}
                trendUp={deletedChange !== null ? deletedChange >= 0 : undefined}
                accent="emerald"
              />
              <KPICard
                icon={<TrendingUp className="w-6 h-6" />}
                value={hasData ? `${currentRate}%` : "0%"}
                label="Success Rate"
                trend={rateChange !== null && rateChange !== 0
                  ? `${rateChange > 0 ? "+" : ""}${rateChange}% from last month`
                  : undefined}
                trendUp={rateChange !== null ? rateChange >= 0 : undefined}
                accent="amber"
              />
              <KPICard
                icon={<Target className="w-6 h-6" />}
                value={scoreImprovement > 0 ? `+${scoreImprovement}` : hasData ? "0" : "--"}
                label="Avg Score Improvement"
                accent="emerald"
              />
              <KPICard
                icon={<Clock className="w-6 h-6" />}
                value={completionMonths > 0 ? `${completionMonths}mo` : hasData ? "0mo" : "--"}
                label="Avg Completion Time"
              />
            </>
          );
        })()}
      </div>

      {/* Charts Row 1 - Monthly Trends + Success by CRA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 relative z-10">
        {/* Monthly Trends */}
        <Card className="bg-card border-border backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Monthly Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-44 flex items-end justify-between gap-2">
              {(data.monthlyTrends || []).map((month, i) => (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex gap-1 h-36 items-end">
                    <div
                      className="flex-1 bg-blue-500 rounded-t transition-all"
                      style={{ height: `${(month.disputes / maxDisputes) * 100}%`, minHeight: month.disputes > 0 ? 4 : 0 }}
                      title={`${month.disputes} disputes`}
                    />
                    <div
                      className="flex-1 bg-emerald-500 rounded-t transition-all"
                      style={{ height: `${(month.deleted / maxDisputes) * 100}%`, minHeight: month.deleted > 0 ? 4 : 0 }}
                      title={`${month.deleted} deleted`}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground mt-2">{month.month}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-5 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm" />
                <span className="text-[11px] text-muted-foreground">Disputes Sent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" />
                <span className="text-[11px] text-muted-foreground">Items Deleted</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Success by CRA */}
        <Card className="bg-card border-border backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Success by Bureau</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(data.successByCRA
                ? Object.entries(data.successByCRA)
                : []
              ).map(([cra, stats]) => {
                const craData = stats;
                const colorMap: Record<string, string> = {
                  TRANSUNION: "#0ea5e9",
                  EXPERIAN: "#3b82f6",
                  EQUIFAX: "#ef4444",
                };
                return (
                  <div key={cra}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-[13px] font-semibold text-foreground">{cra}</span>
                      <span className="text-[13px] font-bold text-emerald-400">{craData.rate}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded overflow-hidden mb-1.5">
                      <div
                        className="h-full rounded transition-all"
                        style={{ width: `${craData.rate}%`, backgroundColor: colorMap[cra] || "#64748b" }}
                      />
                    </div>
                    <div className="flex gap-3 text-[11px] text-muted-foreground">
                      <span>Sent: {craData.sent}</span>
                      <span className="text-emerald-400">Deleted: {craData.deleted}</span>
                      <span className="text-amber-400">Verified: {craData.verified}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 - Client Funnel, Success by Flow, Round Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 relative z-10">
        {/* Client Pipeline Funnel */}
        <Card className="bg-card border-border backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Client Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(() => {
                const funnel = data.clientFunnel || {};
                const entries = Object.entries(funnel);
                const maxCount = Math.max(...entries.map(([, c]) => c as number), 1);
                const totalClients = entries.reduce((sum, [, c]) => sum + (c as number), 0);

                if (totalClients === 0) {
                  return (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      No clients in pipeline
                    </div>
                  );
                }

                return entries.map(([stage, count], i) => {
                  const numCount = count as number;
                  const width = numCount > 0 ? Math.max((numCount / maxCount) * 100, 8) : 0;
                  const hue = 260 - i * 25;
                  return (
                    <div key={stage} className="flex items-center gap-3">
                      <span className="w-20 text-[11px] text-muted-foreground text-right capitalize">
                        {stage.replace(/([A-Z])/g, ' $1')}
                      </span>
                      <div className="flex-1">
                        {numCount > 0 ? (
                          <div
                            className="h-7 rounded flex items-center px-3"
                            style={{ width: `${width}%`, background: `hsl(${hue}, 70%, 50%)` }}
                          >
                            <span className="text-xs font-semibold text-foreground">{numCount}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground pl-1">0</span>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </CardContent>
        </Card>

        {/* Success by Flow Type */}
        <Card className="bg-card border-border backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Success by Flow Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(data.successByFlow
                ? Object.entries(data.successByFlow)
                : []
              ).map(([flow, stats]) => {
                const flowData = stats;
                const colorMap: Record<string, { bg: string; text: string }> = {
                  ACCURACY: { bg: "rgba(59, 130, 246, 0.15)", text: "#3b82f6" },
                  COLLECTION: { bg: "rgba(239, 68, 68, 0.15)", text: "#ef4444" },
                  CONSENT: { bg: "rgba(168, 85, 247, 0.15)", text: "#a855f7" },
                  COMBO: { bg: "rgba(245, 158, 11, 0.15)", text: "#f59e0b" },
                };
                const colors = colorMap[flow] || { bg: "rgba(100, 116, 139, 0.15)", text: "#64748b" };
                return (
                  <div key={flow} className="flex items-center gap-3 p-3 bg-background rounded-lg">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
                      style={{ backgroundColor: colors.bg, color: colors.text }}
                    >
                      {flow[0]}
                    </div>
                    <div className="flex-1">
                      <span className="block text-[13px] font-semibold text-foreground">{flow}</span>
                      <span className="text-[11px] text-muted-foreground">{flowData.success}/{flowData.total}</span>
                    </div>
                    <span className="text-lg font-bold text-emerald-400">{flowData.rate}%</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Round Performance */}
        <Card className="bg-card border-border backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Round Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(data.roundPerformance || []).map((round) => (
                <div key={round.round}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-[13px] font-semibold text-foreground">{round.round}</span>
                    <span className="text-[13px] font-bold text-emerald-400">{round.rate}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded overflow-hidden mb-1.5">
                    <div
                      className="h-full rounded bg-gradient-to-r from-purple-600 to-purple-400 transition-all"
                      style={{ width: `${round.rate}%` }}
                    />
                  </div>
                  <div className="flex gap-3 text-[11px] text-muted-foreground">
                    <span>Sent: {round.sent}</span>
                    <span className="text-emerald-400">Deleted: {round.deleted}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3 - Item Type Success, FCRA Violations, Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 relative z-10">
        {/* Top Performing Items */}
        <Card className="bg-card border-border backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Success by Item Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {(data.topPerformingItems || []).map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 bg-background rounded-lg">
                  <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center text-[11px] font-semibold text-muted-foreground">
                    #{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-[13px] font-medium text-foreground truncate">{item.type}</span>
                    <span className="text-[11px] text-muted-foreground">{item.deleted}/{item.total} deleted</span>
                  </div>
                  <div className="flex items-center gap-2 w-28">
                    <div className="flex-1 h-1.5 bg-muted rounded overflow-hidden">
                      <div
                        className="h-full rounded transition-all"
                        style={{
                          width: `${item.rate}%`,
                          backgroundColor: item.rate >= 70 ? "#10b981" : item.rate >= 50 ? "#f59e0b" : "#ef4444"
                        }}
                      />
                    </div>
                    <span className="text-xs font-bold text-foreground w-9 text-right">{item.rate}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* FCRA Compliance */}
        <Card className="bg-card border-border backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Scale className="w-4 h-4" />
              FCRA Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { value: data.fcraViolations?.total || 0, label: "Total Violations" },
                { value: data.fcraViolations?.failureToRespond || 0, label: "Failure to Respond" },
                { value: data.fcraViolations?.inadequateInvestigation || 0, label: "Inadequate Investigation" },
                { value: data.fcraViolations?.cfpbComplaints || 0, label: "CFPB Complaints" },
              ].map((stat, i) => (
                <div key={i} className="p-4 bg-purple-500/10 rounded-lg text-center">
                  <span className="block text-2xl font-bold text-purple-400">{stat.value}</span>
                  <span className="text-[11px] text-muted-foreground">{stat.label}</span>
                </div>
              ))}
            </div>
            <div className="text-[11px] text-muted-foreground p-3 bg-background rounded-lg text-center">
              Violations can strengthen future disputes and support potential litigation.
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-card border-border backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {(() => {
                const activities = data.recentActivity && data.recentActivity.length > 0
                  ? data.recentActivity
                  : [];

                if (activities.length === 0) {
                  return (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      No recent activity
                    </div>
                  );
                }

                return activities.map((activity, i) => {
                  const iconConfig: Record<string, { icon: string; bg: string; color: string }> = {
                    deletion: { icon: "✓", bg: "rgba(16, 185, 129, 0.15)", color: "#10b981" },
                    violation: { icon: "⚖", bg: "rgba(139, 92, 246, 0.15)", color: "#8b5cf6" },
                    sent: { icon: "📤", bg: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" },
                    response: { icon: "📬", bg: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" },
                  };
                  const config = iconConfig[activity.type] || iconConfig.response;
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                        style={{ backgroundColor: config.bg, color: config.color }}
                      >
                        {config.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="block text-xs text-foreground">
                          <strong>{activity.client}</strong> - {activity.details}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{activity.date}</span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Usage Section */}
      {data.llmStats.totalRequests > 0 && (
        <Card className="bg-card border-border backdrop-blur-xl relative z-10">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Brain className="w-5 h-5" />
              AI Usage (Last 30 Days)
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Track your AI-powered dispute strategy and letter generation
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{data.llmStats.totalRequests}</div>
                <div className="text-sm text-muted-foreground mt-1">Total Requests</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-400">
                  ${(data.llmStats.totalCostCents / 100).toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Total Cost</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-400">
                  {(data.llmStats.avgLatencyMs / 1000).toFixed(1)}s
                </div>
                <div className="text-sm text-muted-foreground mt-1">Avg. Response</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-400">
                  ${((data.llmStats.totalCostCents / data.llmStats.totalRequests) / 100).toFixed(3)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Cost/Request</div>
              </div>
            </div>

            {/* Provider breakdown */}
            {Object.keys(data.llmStats.byProvider).length > 0 && (
              <div className="mt-6 pt-6 border-t border-border">
                <h4 className="text-sm font-medium text-muted-foreground mb-4">By Provider</h4>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(data.llmStats.byProvider).map(([provider, stats]) => (
                    <div key={provider} className="bg-muted rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className={`w-4 h-4 ${provider === "CLAUDE" ? "text-amber-400" : "text-emerald-400"}`} />
                        <span className="font-medium text-foreground">{provider}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {stats.requests} requests · ${(stats.cost / 100).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Top Clients */}
      {data.topClients.length > 0 && (
        <Card className="bg-card border-border backdrop-blur-xl relative z-10">
          <CardHeader>
            <CardTitle className="text-foreground">Top Clients by Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topClients.map((client, i) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-sm text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="text-foreground">{client.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">{client.accountCount} accounts</span>
                    <Badge variant="outline" className="border-blue-500/50 text-primary">
                      {client.disputeCount} disputes
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// KPI Card Component
// ============================================================================

function KPICard({
  icon,
  value,
  label,
  trend,
  trendUp,
  accent,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  trend?: string;
  trendUp?: boolean;
  accent?: "emerald" | "amber" | "purple" | "blue";
}) {
  const accentColors: Record<string, string> = {
    emerald: "#10b981",
    amber: "#f59e0b",
    purple: "#a78bfa",
    blue: "#3b82f6",
  };
  const valueColor = accent ? accentColors[accent] : "#f8fafc";

  return (
    <Card className="bg-card border-border backdrop-blur-xl">
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div className="flex flex-col">
            <span className="text-2xl font-bold" style={{ color: valueColor }}>
              {value}
            </span>
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
              {label}
            </span>
            {trend && (
              <span className={`text-[11px] mt-1 flex items-center gap-0.5 ${trendUp ? "text-emerald-400" : "text-red-400"}`}>
                {trendUp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {trend}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


// ============================================================================
// Loading Skeleton
// ============================================================================

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 lg:ml-64 pt-16 lg:pt-0 p-6">
      <div className="flex justify-between items-start">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="bg-card border-border">
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-44 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="bg-card border-border">
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
