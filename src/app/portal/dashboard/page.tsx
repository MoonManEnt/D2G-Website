"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  Scale,
  TrendingUp,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  LogOut,
  User,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { usePortal } from "../portal-context";

interface DashboardData {
  creditScores: {
    latest: Record<string, number>;
    change30Days: Record<string, number>;
  };
  disputes: {
    total: number;
    resolved: number;
    inProgress: number;
    pending: number;
    items: Array<{
      id: string;
      cra: string;
      disputeStatus: string;
      createdAt: string;
      accounts: Array<{
        creditorName: string;
      }>;
    }>;
  };
  negativeItems: {
    total: number;
    resolved: number;
    remaining: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    date: string;
  }>;
}

const CRA_COLORS = {
  TRANSUNION: { bg: "bg-sky-500", text: "text-sky-400" },
  EXPERIAN: { bg: "bg-blue-500", text: "text-blue-400" },
  EQUIFAX: { bg: "bg-red-500", text: "text-red-400" },
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-500/20 text-slate-400",
  PENDING_REVIEW: "bg-amber-500/20 text-amber-400",
  APPROVED: "bg-blue-500/20 text-blue-400",
  SENT: "bg-purple-500/20 text-purple-400",
  RESPONSE_RECEIVED: "bg-cyan-500/20 text-cyan-400",
  RESOLVED_POSITIVE: "bg-green-500/20 text-green-400",
  RESOLVED_NEGATIVE: "bg-red-500/20 text-red-400",
  CLOSED: "bg-slate-500/20 text-slate-400",
};

function getScoreLabel(score: number): { label: string; color: string } {
  if (score >= 800) return { label: "Exceptional", color: "text-emerald-400" };
  if (score >= 740) return { label: "Very Good", color: "text-green-400" };
  if (score >= 670) return { label: "Good", color: "text-lime-400" };
  if (score >= 580) return { label: "Fair", color: "text-yellow-400" };
  return { label: "Poor", color: "text-red-400" };
}

export default function PortalDashboardPage() {
  const { user, organization, logout } = usePortal();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch("/api/portal/dashboard", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("portal_token")}`,
          },
        });

        if (res.ok) {
          const dashboardData = await res.json();
          setData(dashboardData);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const progressPercent = data?.negativeItems?.total
    ? Math.round((data.negativeItems.resolved / data.negativeItems.total) * 100)
    : 0;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-slate-800/50 border-b border-slate-700 sticky top-0 z-50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-white font-medium">
                  {user?.firstName} {user?.lastName}
                </h2>
                <p className="text-slate-400 text-sm">{organization?.name}</p>
              </div>
            </div>
            <Button variant="ghost" onClick={logout} className="text-slate-400 hover:text-white">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Welcome back, {user?.firstName}!</h1>
          <p className="text-slate-400 mt-1">Here&apos;s an overview of your credit repair progress</p>
        </div>

        {/* Progress Overview */}
        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Overall Progress
            </CardTitle>
            <CardDescription className="text-slate-400">
              Your credit repair journey progress
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <Progress value={progressPercent} className="flex-1" />
              <span className="text-2xl font-bold text-white">{progressPercent}%</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-400">
                  {data?.negativeItems?.resolved || 0}
                </p>
                <p className="text-sm text-slate-400">Items Resolved</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-400">
                  {data?.disputes?.inProgress || 0}
                </p>
                <p className="text-sm text-slate-400">In Progress</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-400">
                  {data?.negativeItems?.remaining || 0}
                </p>
                <p className="text-sm text-slate-400">Remaining</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Credit Scores */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {(["TRANSUNION", "EXPERIAN", "EQUIFAX"] as const).map((cra) => {
            const score = data?.creditScores?.latest?.[cra];
            const change = data?.creditScores?.change30Days?.[cra] || 0;
            const colors = CRA_COLORS[cra];
            const scoreInfo = score ? getScoreLabel(score) : null;

            return (
              <Card key={cra} className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={`${colors.bg} text-white`}>{cra}</Badge>
                    {scoreInfo && (
                      <span className={`text-xs ${scoreInfo.color}`}>{scoreInfo.label}</span>
                    )}
                  </div>
                  {score ? (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-white">{score}</span>
                        {change !== 0 && (
                          <span
                            className={`flex items-center text-sm ${
                              change > 0 ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            {change > 0 ? (
                              <ArrowUp className="w-4 h-4" />
                            ) : (
                              <ArrowDown className="w-4 h-4" />
                            )}
                            {Math.abs(change)}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 text-xs mt-1">30-day change</p>
                    </>
                  ) : (
                    <p className="text-slate-500 text-sm">No score recorded</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Active Disputes */}
        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Scale className="w-5 h-5" />
                  Active Disputes
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Track the status of your disputes
                </CardDescription>
              </div>
              <Badge className="bg-primary/20 text-primary">
                {data?.disputes?.total || 0} Total
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {!data?.disputes?.items?.length ? (
              <div className="text-center py-8">
                <Scale className="w-12 h-12 mx-auto text-slate-600" />
                <p className="text-slate-400 mt-2">No active disputes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.disputes.items.slice(0, 5).map((dispute) => {
                  const colors = CRA_COLORS[dispute.cra as keyof typeof CRA_COLORS];
                  const statusColor = STATUS_COLORS[dispute.disputeStatus] || STATUS_COLORS.DRAFT;

                  return (
                    <div
                      key={dispute.id}
                      className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Badge className={`${colors?.bg || "bg-slate-500"} text-white`}>
                          {dispute.cra}
                        </Badge>
                        <div>
                          <p className="text-white text-sm font-medium">
                            {dispute.accounts.map((a) => a.creditorName).join(", ")}
                          </p>
                          <p className="text-slate-500 text-xs">
                            Submitted {new Date(dispute.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Badge className={statusColor}>
                        {dispute.disputeStatus.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <CheckCircle className="w-8 h-8 mx-auto text-green-400" />
              <p className="text-2xl font-bold text-white mt-2">
                {data?.disputes?.resolved || 0}
              </p>
              <p className="text-sm text-slate-400">Resolved</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <Clock className="w-8 h-8 mx-auto text-amber-400" />
              <p className="text-2xl font-bold text-white mt-2">
                {data?.disputes?.inProgress || 0}
              </p>
              <p className="text-sm text-slate-400">In Progress</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <FileText className="w-8 h-8 mx-auto text-blue-400" />
              <p className="text-2xl font-bold text-white mt-2">
                {data?.disputes?.pending || 0}
              </p>
              <p className="text-sm text-slate-400">Pending</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <AlertTriangle className="w-8 h-8 mx-auto text-red-400" />
              <p className="text-2xl font-bold text-white mt-2">
                {data?.negativeItems?.remaining || 0}
              </p>
              <p className="text-sm text-slate-400">Items Remaining</p>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-slate-500 text-sm">
            Questions? Contact your credit repair specialist at {organization?.name}
          </p>
        </div>
      </main>
    </div>
  );
}
