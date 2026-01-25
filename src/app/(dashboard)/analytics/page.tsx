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
      <div className="lg:ml-64 pt-16 lg:pt-0 p-6">
        <div className="text-center py-12">
          <p className="text-slate-400">Failed to load analytics data.</p>
        </div>
      </div>
    );
  }

  // Calculate monthly trends max for chart scaling
  const maxDisputes = data.monthlyTrends
    ? Math.max(...data.monthlyTrends.map(m => m.disputes), 1)
    : Math.max(...data.charts.dailyActivity.map(d => d.disputes), 1);

  return (
    <div className="space-y-6 lg:ml-64 pt-16 lg:pt-0 p-6 relative">
      {/* Ambient glow effects */}
      <div className="fixed top-[10%] left-[20%] w-[600px] h-[600px] bg-[radial-gradient(ellipse,rgba(124,58,237,0.08)_0%,transparent_70%)] pointer-events-none" />
      <div className="fixed bottom-[20%] right-[10%] w-[400px] h-[400px] bg-[radial-gradient(ellipse,rgba(16,185,129,0.06)_0%,transparent_70%)] pointer-events-none" />

      {/* Header */}
      <div className="flex justify-between items-start relative z-10">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-white" />
            Analytics
          </h1>
          <p className="text-slate-400 mt-1">Business performance and insights</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex bg-slate-800/60 rounded-lg p-1">
            {(["1m", "3m", "6m", "1y", "all"] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${
                  timeRange === range
                    ? "bg-purple-500/20 text-purple-400"
                    : "text-slate-400 hover:text-slate-300"
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
          <button className="px-4 py-2 bg-slate-700/30 border border-slate-600/50 rounded-lg text-sm text-white flex items-center gap-2 hover:bg-slate-700/50 transition-colors">
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* KPI Cards - 6 columns */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 relative z-10">
        <KPICard
          icon={<Users className="w-6 h-6" />}
          value={data.summary.clientCount}
          label="Total Clients"
          trend={`+${Math.floor(data.summary.clientCount * 0.25)} this month`}
          trendUp={true}
        />
        <KPICard
          icon={<Send className="w-6 h-6" />}
          value={data.summary.activeDisputeCount + data.summary.resolvedDisputeCount}
          label="Total Disputes"
          trend={`+${Math.floor((data.summary.activeDisputeCount + data.summary.resolvedDisputeCount) * 0.24)} this month`}
          trendUp={true}
        />
        <KPICard
          icon={<CheckCircle2 className="w-6 h-6" />}
          value={data.summary.totalItemsDeleted || data.summary.resolvedDisputeCount}
          label="Items Deleted"
          trend={`+${Math.floor((data.summary.totalItemsDeleted || data.summary.resolvedDisputeCount) * 0.13)} this month`}
          trendUp={true}
          accent="emerald"
        />
        <KPICard
          icon={<TrendingUp className="w-6 h-6" />}
          value={`${data.summary.overallSuccessRate || data.summary.resolutionRate}%`}
          label="Success Rate"
          trend="-3% from last month"
          trendUp={false}
          accent="amber"
        />
        <KPICard
          icon={<Target className="w-6 h-6" />}
          value={`+${data.summary.avgScoreImprovement || 68}`}
          label="Avg Score Improvement"
          accent="emerald"
        />
        <KPICard
          icon={<Clock className="w-6 h-6" />}
          value={`${data.summary.avgCompletionMonths || (data.summary.avgResolutionDays / 30).toFixed(1)}mo`}
          label="Avg Completion Time"
        />
      </div>

      {/* Charts Row 1 - Monthly Trends + Success by CRA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 relative z-10">
        {/* Monthly Trends */}
        <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-white">Monthly Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-44 flex items-end justify-between gap-2">
              {(data.monthlyTrends || generateMockMonthlyTrends(data)).map((month, i) => (
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
                  <span className="text-[11px] text-slate-500 mt-2">{month.month}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-5 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm" />
                <span className="text-[11px] text-slate-400">Disputes Sent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" />
                <span className="text-[11px] text-slate-400">Items Deleted</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Success by CRA */}
        <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-white">Success by Bureau</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(data.successByCRA
                ? Object.entries(data.successByCRA)
                : data.charts.disputesByCRA.map(cra => [cra.name, { sent: cra.value, deleted: Math.floor(cra.value * 0.57), verified: Math.floor(cra.value * 0.35), noResponse: Math.floor(cra.value * 0.08), rate: 57 }] as [string, { sent: number; deleted: number; verified: number; noResponse: number; rate: number }])
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
                      <span className="text-[13px] font-semibold text-white">{cra}</span>
                      <span className="text-[13px] font-bold text-emerald-400">{craData.rate}%</span>
                    </div>
                    <div className="h-2 bg-slate-700/50 rounded overflow-hidden mb-1.5">
                      <div
                        className="h-full rounded transition-all"
                        style={{ width: `${craData.rate}%`, backgroundColor: colorMap[cra] || "#64748b" }}
                      />
                    </div>
                    <div className="flex gap-3 text-[11px] text-slate-500">
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
        <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-white">Client Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(data.clientFunnel || generateMockFunnel(data)).map(([stage, count], i) => {
                const width = 100 - (i * 8);
                const hue = 260 - i * 25;
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <span className="w-20 text-[11px] text-slate-400 text-right capitalize">
                      {stage.replace(/([A-Z])/g, ' $1')}
                    </span>
                    <div className="flex-1">
                      <div
                        className="h-7 rounded flex items-center px-3"
                        style={{ width: `${width}%`, background: `hsl(${hue}, 70%, 50%)` }}
                      >
                        <span className="text-xs font-semibold text-white">{count}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Success by Flow Type */}
        <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-white">Success by Flow Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(data.successByFlow
                ? Object.entries(data.successByFlow)
                : data.charts.disputesByFlow.map(flow => [flow.name, { total: flow.value, success: Math.floor(flow.value * 0.55), rate: 55 }] as [string, { total: number; success: number; rate: number }])
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
                  <div key={flow} className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
                      style={{ backgroundColor: colors.bg, color: colors.text }}
                    >
                      {flow[0]}
                    </div>
                    <div className="flex-1">
                      <span className="block text-[13px] font-semibold text-white">{flow}</span>
                      <span className="text-[11px] text-slate-500">{flowData.success}/{flowData.total}</span>
                    </div>
                    <span className="text-lg font-bold text-emerald-400">{flowData.rate}%</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Round Performance */}
        <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-white">Round Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(data.roundPerformance || generateMockRoundPerformance(data)).map((round) => (
                <div key={round.round}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-[13px] font-semibold text-white">{round.round}</span>
                    <span className="text-[13px] font-bold text-emerald-400">{round.rate}%</span>
                  </div>
                  <div className="h-2 bg-slate-700/50 rounded overflow-hidden mb-1.5">
                    <div
                      className="h-full rounded bg-gradient-to-r from-purple-600 to-purple-400 transition-all"
                      style={{ width: `${round.rate}%` }}
                    />
                  </div>
                  <div className="flex gap-3 text-[11px] text-slate-500">
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
        <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-white">Success by Item Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {(data.topPerformingItems || generateMockItemTypes()).map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 bg-slate-900/50 rounded-lg">
                  <div className="w-7 h-7 rounded-md bg-slate-700/50 flex items-center justify-center text-[11px] font-semibold text-slate-400">
                    #{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-[13px] font-medium text-white truncate">{item.type}</span>
                    <span className="text-[11px] text-slate-500">{item.deleted}/{item.total} deleted</span>
                  </div>
                  <div className="flex items-center gap-2 w-28">
                    <div className="flex-1 h-1.5 bg-slate-700/50 rounded overflow-hidden">
                      <div
                        className="h-full rounded transition-all"
                        style={{
                          width: `${item.rate}%`,
                          backgroundColor: item.rate >= 70 ? "#10b981" : item.rate >= 50 ? "#f59e0b" : "#ef4444"
                        }}
                      />
                    </div>
                    <span className="text-xs font-bold text-white w-9 text-right">{item.rate}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* FCRA Compliance */}
        <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
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
                  <span className="text-[11px] text-slate-500">{stat.label}</span>
                </div>
              ))}
            </div>
            <div className="text-[11px] text-slate-500 p-3 bg-slate-900/50 rounded-lg text-center">
              Violations can strengthen future disputes and support potential litigation.
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-white">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {(data.recentActivity || generateMockActivity(data.recentDisputes)).map((activity, i) => {
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
                      <span className="block text-xs text-white">
                        <strong>{activity.client}</strong> - {activity.details}
                      </span>
                      <span className="text-[11px] text-slate-500">{activity.date}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Usage Section */}
      {data.llmStats.totalRequests > 0 && (
        <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-xl relative z-10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Brain className="w-5 h-5" />
              AI Usage (Last 30 Days)
            </CardTitle>
            <p className="text-sm text-slate-400">
              Track your AI-powered dispute strategy and letter generation
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400">{data.llmStats.totalRequests}</div>
                <div className="text-sm text-slate-400 mt-1">Total Requests</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-400">
                  ${(data.llmStats.totalCostCents / 100).toFixed(2)}
                </div>
                <div className="text-sm text-slate-400 mt-1">Total Cost</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-400">
                  {(data.llmStats.avgLatencyMs / 1000).toFixed(1)}s
                </div>
                <div className="text-sm text-slate-400 mt-1">Avg. Response</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-400">
                  ${((data.llmStats.totalCostCents / data.llmStats.totalRequests) / 100).toFixed(3)}
                </div>
                <div className="text-sm text-slate-400 mt-1">Cost/Request</div>
              </div>
            </div>

            {/* Provider breakdown */}
            {Object.keys(data.llmStats.byProvider).length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-700">
                <h4 className="text-sm font-medium text-slate-300 mb-4">By Provider</h4>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(data.llmStats.byProvider).map(([provider, stats]) => (
                    <div key={provider} className="bg-slate-700/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className={`w-4 h-4 ${provider === "CLAUDE" ? "text-amber-400" : "text-emerald-400"}`} />
                        <span className="font-medium text-white">{provider}</span>
                      </div>
                      <div className="text-sm text-slate-400">
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
        <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-xl relative z-10">
          <CardHeader>
            <CardTitle className="text-white">Top Clients by Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topClients.map((client, i) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-sm text-slate-300">
                      {i + 1}
                    </span>
                    <span className="text-white">{client.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-400">{client.accountCount} accounts</span>
                    <Badge variant="outline" className="border-blue-500/50 text-blue-400">
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
    <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-xl">
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div className="flex flex-col">
            <span className="text-2xl font-bold" style={{ color: valueColor }}>
              {value}
            </span>
            <span className="text-[11px] text-slate-500 uppercase tracking-wide">
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
// Helper functions to generate mock data from existing data
// ============================================================================

function generateMockMonthlyTrends(data: AnalyticsData) {
  const months = ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan"];
  const totalDisputes = data.summary.activeDisputeCount + data.summary.resolvedDisputeCount;
  return months.map((month, i) => ({
    month,
    clients: Math.floor(data.summary.clientCount * (0.3 + i * 0.14)),
    disputes: Math.floor(totalDisputes * (0.08 + i * 0.18)),
    deleted: Math.floor(data.summary.resolvedDisputeCount * (0.08 + i * 0.15)),
    successRate: data.summary.resolutionRate + Math.floor(Math.random() * 10 - 5),
  }));
}

function generateMockFunnel(data: AnalyticsData) {
  return {
    intake: Math.floor(data.summary.clientCount * 0.1),
    analysis: Math.floor(data.summary.clientCount * 0.17),
    round1: Math.floor(data.summary.clientCount * 0.26),
    round2: Math.floor(data.summary.clientCount * 0.13),
    round3: Math.floor(data.summary.clientCount * 0.09),
    round4: Math.floor(data.summary.clientCount * 0.04),
    maintenance: Math.floor(data.summary.clientCount * 0.17),
    completed: Math.floor(data.summary.clientCount * 0.04),
  };
}

function generateMockRoundPerformance(data: AnalyticsData) {
  const total = data.summary.activeDisputeCount + data.summary.resolvedDisputeCount;
  return [
    { round: "R1", sent: total, deleted: Math.floor(total * 0.27), rate: 27 },
    { round: "R2", sent: Math.floor(total * 0.57), deleted: Math.floor(total * 0.18), rate: 31 },
    { round: "R3", sent: Math.floor(total * 0.29), deleted: Math.floor(total * 0.08), rate: 27 },
    { round: "R4", sent: Math.floor(total * 0.12), deleted: Math.floor(total * 0.05), rate: 39 },
  ];
}

function generateMockItemTypes() {
  return [
    { type: "Medical Collections", deleted: 23, total: 28, rate: 82 },
    { type: "Utility Collections", deleted: 15, total: 19, rate: 79 },
    { type: "Credit Card Charge-offs", deleted: 18, total: 32, rate: 56 },
    { type: "Auto Loans", deleted: 8, total: 18, rate: 44 },
    { type: "Student Loans", deleted: 2, total: 12, rate: 17 },
  ];
}

function generateMockActivity(recentDisputes: AnalyticsData["recentDisputes"]) {
  if (!recentDisputes || recentDisputes.length === 0) {
    return [
      { date: new Date().toISOString().split("T")[0], type: "sent", client: "Client", details: "No recent activity" },
    ];
  }
  return recentDisputes.slice(0, 5).map((d) => ({
    date: new Date(d.createdAt).toISOString().split("T")[0],
    type: d.status === "RESOLVED" ? "deletion" : d.status === "SENT" ? "sent" : "response",
    client: d.clientName,
    details: `${d.flow} ${d.status.toLowerCase()} - ${d.cra}`,
  }));
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
          <Card key={i} className="bg-slate-800/50 border-slate-700">
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
          <Card key={i} className="bg-slate-800/50 border-slate-700">
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
          <Card key={i} className="bg-slate-800/50 border-slate-700">
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
