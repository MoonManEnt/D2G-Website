"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  TrendingUp,
  Users,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  Brain,
  DollarSign,
  Activity,
} from "lucide-react";

interface AnalyticsData {
  summary: {
    clientCount: number;
    activeDisputeCount: number;
    resolvedDisputeCount: number;
    negativeItemCount: number;
    reportsUploaded: number;
    resolutionRate: number;
    avgResolutionDays: number;
  };
  charts: {
    disputesByStatus: Array<{ name: string; value: number }>;
    disputesByCRA: Array<{ name: string; value: number }>;
    disputesByFlow: Array<{ name: string; value: number }>;
    dailyActivity: Array<{ date: string; disputes: number; reports: number }>;
  };
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

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const response = await fetch("/api/analytics");
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
  }, []);

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

  const maxDaily = Math.max(
    ...data.charts.dailyActivity.map((d) => Math.max(d.disputes, d.reports)),
    1
  );

  return (
    <div className="space-y-6 lg:ml-64 pt-16 lg:pt-0 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          Analytics
        </h1>
        <p className="text-slate-400 mt-1">Track your dispute performance and AI usage</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Clients"
          value={data.summary.clientCount}
          icon={<Users className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Active Disputes"
          value={data.summary.activeDisputeCount}
          icon={<FileText className="w-5 h-5" />}
          color="amber"
        />
        <StatCard
          title="Resolved"
          value={data.summary.resolvedDisputeCount}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="emerald"
          suffix={
            <span className="text-emerald-400 text-sm ml-2">
              {data.summary.resolutionRate}% rate
            </span>
          }
        />
        <StatCard
          title="Negative Items"
          value={data.summary.negativeItemCount}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="red"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Activity Chart */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Daily Activity (Last 14 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-end gap-1">
              {data.charts.dailyActivity.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex gap-0.5 h-32 items-end">
                    <div
                      className="flex-1 bg-blue-500/80 rounded-t transition-all"
                      style={{ height: `${(day.disputes / maxDaily) * 100}%`, minHeight: day.disputes > 0 ? 4 : 0 }}
                      title={`${day.disputes} disputes`}
                    />
                    <div
                      className="flex-1 bg-emerald-500/80 rounded-t transition-all"
                      style={{ height: `${(day.reports / maxDaily) * 100}%`, minHeight: day.reports > 0 ? 4 : 0 }}
                      title={`${day.reports} reports`}
                    />
                  </div>
                  <span className="text-xs text-slate-500 transform -rotate-45 origin-center">
                    {day.date.split(" ")[1]}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded" />
                <span className="text-sm text-slate-400">Disputes</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 rounded" />
                <span className="text-sm text-slate-400">Reports</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Disputes by CRA */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Disputes by Credit Bureau</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.charts.disputesByCRA.length > 0 ? (
                data.charts.disputesByCRA.map((cra) => {
                  const total = data.charts.disputesByCRA.reduce((s, c) => s + c.value, 0);
                  const percentage = total > 0 ? Math.round((cra.value / total) * 100) : 0;
                  const colorMap: Record<string, string> = {
                    TRANSUNION: "bg-blue-500",
                    EXPERIAN: "bg-emerald-500",
                    EQUIFAX: "bg-purple-500",
                  };
                  return (
                    <div key={cra.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-300">{cra.name}</span>
                        <span className="text-slate-400">{cra.value} ({percentage}%)</span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${colorMap[cra.name] || "bg-slate-500"} transition-all`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-slate-500 text-center py-8">No disputes yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Disputes by Status */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">By Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.charts.disputesByStatus.length > 0 ? (
                data.charts.disputesByStatus.map((status) => {
                  const colorMap: Record<string, string> = {
                    DRAFT: "bg-slate-500",
                    APPROVED: "bg-blue-500",
                    SENT: "bg-amber-500",
                    RESPONDED: "bg-purple-500",
                    RESOLVED: "bg-emerald-500",
                  };
                  return (
                    <div key={status.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${colorMap[status.name] || "bg-slate-500"}`} />
                        <span className="text-slate-300 text-sm">{status.name}</span>
                      </div>
                      <span className="text-white font-medium">{status.value}</span>
                    </div>
                  );
                })
              ) : (
                <p className="text-slate-500 text-center py-4">No data</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Disputes by Flow */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">By Flow Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.charts.disputesByFlow.length > 0 ? (
                data.charts.disputesByFlow.map((flow) => {
                  const colorMap: Record<string, string> = {
                    ACCURACY: "bg-blue-500",
                    COLLECTION: "bg-amber-500",
                    CONSENT: "bg-purple-500",
                    COMBO: "bg-emerald-500",
                  };
                  return (
                    <div key={flow.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${colorMap[flow.name] || "bg-slate-500"}`} />
                        <span className="text-slate-300 text-sm">{flow.name}</span>
                      </div>
                      <span className="text-white font-medium">{flow.value}</span>
                    </div>
                  );
                })
              ) : (
                <p className="text-slate-500 text-center py-4">No data</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Resolution Rate</span>
              <span className="text-2xl font-bold text-emerald-400">{data.summary.resolutionRate}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Avg. Resolution</span>
              <span className="text-slate-200 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {data.summary.avgResolutionDays} days
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Reports (30d)</span>
              <span className="text-slate-200">{data.summary.reportsUploaded}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Usage Section */}
      {data.llmStats.totalRequests > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Brain className="w-5 h-5" />
              AI Usage (Last 30 Days)
            </CardTitle>
            <CardDescription className="text-slate-400">
              Track your AI-powered dispute strategy and letter generation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
        <Card className="bg-slate-800/50 border-slate-700">
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

function StatCard({
  title,
  value,
  icon,
  color,
  suffix,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: "blue" | "amber" | "emerald" | "red" | "purple";
  suffix?: React.ReactNode;
}) {
  const colorClasses = {
    blue: "bg-blue-500/20 text-blue-400",
    amber: "bg-amber-500/20 text-amber-400",
    emerald: "bg-emerald-500/20 text-emerald-400",
    red: "bg-red-500/20 text-red-400",
    purple: "bg-purple-500/20 text-purple-400",
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">{title}</p>
            <div className="flex items-center">
              <p className="text-3xl font-bold text-white mt-1">{value.toLocaleString()}</p>
              {suffix}
            </div>
          </div>
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 lg:ml-64 pt-16 lg:pt-0 p-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 mt-2" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                </div>
                <Skeleton className="h-12 w-12 rounded-lg" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
