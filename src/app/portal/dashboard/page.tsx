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
  Target,
  Sparkles,
  ExternalLink,
  ChevronRight,
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
  readiness: {
    productType: string;
    approvalLikelihood: number;
    approvalTier: string;
    explanation: string;
    scoreModel: string;
    relevantScore: number | null;
    estimatedDTI: number | null;
    topActions: Array<{
      stepNumber: number;
      title: string;
      priority: string;
      category: string;
    }>;
    analyzedAt: string;
  } | null;
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    date: string;
  }>;
}

interface PortalRecommendation {
  vendorId: string;
  vendorName: string;
  vendorCategory: string;
  affiliateUrl: string | null;
  ruleId: string;
  recommendationTitle: string;
  recommendationBody: string;
  recommendationCTA: string | null;
  customAffiliateUrl: string | null;
}

const CRA_COLORS = {
  TRANSUNION: { bg: "bg-sky-500", text: "text-sky-400" },
  EXPERIAN: { bg: "bg-blue-500", text: "text-blue-400" },
  EQUIFAX: { bg: "bg-red-500", text: "text-red-400" },
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PENDING_REVIEW: "bg-amber-500/20 text-amber-400",
  APPROVED: "bg-primary/20 text-primary",
  SENT: "bg-purple-500/20 text-purple-400",
  RESPONSE_RECEIVED: "bg-cyan-500/20 text-cyan-400",
  RESOLVED_POSITIVE: "bg-green-500/20 text-green-400",
  RESOLVED_NEGATIVE: "bg-red-500/20 text-red-400",
  CLOSED: "bg-muted text-muted-foreground",
};

const TIER_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  LIKELY: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "Likely Approved" },
  POSSIBLE: { bg: "bg-amber-500/20", text: "text-amber-400", label: "Possible Approval" },
  UNLIKELY: { bg: "bg-orange-500/20", text: "text-orange-400", label: "Unlikely" },
  NOT_READY: { bg: "bg-red-500/20", text: "text-red-400", label: "Not Ready" },
};

const CATEGORY_COLORS: Record<string, string> = {
  CREDIT_REPAIR: "bg-purple-500/20 text-purple-400",
  DEBT_MANAGEMENT: "bg-primary/20 text-primary",
  FINANCIAL_COACHING: "bg-amber-500/20 text-amber-400",
  CREDIT_MONITORING: "bg-cyan-500/20 text-cyan-400",
  CREDIT_BUILDER: "bg-emerald-500/20 text-emerald-400",
  OTHER: "bg-muted text-muted-foreground",
};

function formatProductType(type: string): string {
  const labels: Record<string, string> = {
    MORTGAGE: "Mortgage",
    AUTO: "Auto Loan",
    CREDIT_CARD: "Credit Card",
    PERSONAL_LOAN: "Personal Loan",
    BUSINESS_LOC: "Business LOC",
    GENERAL: "General",
  };
  return labels[type] || type;
}

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
  const [recommendations, setRecommendations] = useState<PortalRecommendation[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("portal_token");
    const headers = { Authorization: `Bearer ${token}` };

    const fetchDashboard = async () => {
      try {
        const res = await fetch("/api/portal/dashboard", { headers });
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

    const fetchRecommendations = async () => {
      try {
        const res = await fetch("/api/portal/recommendations", { headers });
        if (res.ok) {
          const recData = await res.json();
          setRecommendations(recData.recommendations || []);
        }
      } catch (error) {
        console.error("Failed to fetch recommendations:", error);
      }
    };

    fetchDashboard();
    fetchRecommendations();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const progressPercent = data?.negativeItems?.total
    ? Math.round((data.negativeItems.resolved / data.negativeItems.total) * 100)
    : 0;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-foreground font-medium">
                  {user?.firstName} {user?.lastName}
                </h2>
                <p className="text-muted-foreground text-sm">{organization?.name}</p>
              </div>
            </div>
            <Button variant="ghost" onClick={logout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Welcome back, {user?.firstName}!</h1>
          <p className="text-muted-foreground mt-1">Here&apos;s an overview of your credit repair progress</p>
        </div>

        {/* Progress Overview */}
        <Card className="bg-card border-border mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Overall Progress
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Your credit repair journey progress
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <Progress value={progressPercent} className="flex-1" />
              <span className="text-2xl font-bold text-foreground">{progressPercent}%</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-400">
                  {data?.negativeItems?.resolved || 0}
                </p>
                <p className="text-sm text-muted-foreground">Items Resolved</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-400">
                  {data?.disputes?.inProgress || 0}
                </p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-muted-foreground">
                  {data?.negativeItems?.remaining || 0}
                </p>
                <p className="text-sm text-muted-foreground">Remaining</p>
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
              <Card key={cra} className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={`${colors.bg} text-foreground`}>{cra}</Badge>
                    {scoreInfo && (
                      <span className={`text-xs ${scoreInfo.color}`}>{scoreInfo.label}</span>
                    )}
                  </div>
                  {score ? (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-foreground">{score}</span>
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
                      <p className="text-muted-foreground text-xs mt-1">30-day change</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-sm">No score recorded</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Active Disputes */}
        <Card className="bg-card border-border mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Scale className="w-5 h-5" />
                  Active Disputes
                </CardTitle>
                <CardDescription className="text-muted-foreground">
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
                <Scale className="w-12 h-12 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground mt-2">No active disputes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.disputes.items.slice(0, 5).map((dispute) => {
                  const colors = CRA_COLORS[dispute.cra as keyof typeof CRA_COLORS];
                  const statusColor = STATUS_COLORS[dispute.disputeStatus] || STATUS_COLORS.DRAFT;

                  return (
                    <div
                      key={dispute.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Badge className={`${colors?.bg || "bg-slate-500"} text-foreground`}>
                          {dispute.cra}
                        </Badge>
                        <div>
                          <p className="text-foreground text-sm font-medium">
                            {dispute.accounts.map((a) => a.creditorName).join(", ")}
                          </p>
                          <p className="text-muted-foreground text-xs">
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
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <CheckCircle className="w-8 h-8 mx-auto text-green-400" />
              <p className="text-2xl font-bold text-foreground mt-2">
                {data?.disputes?.resolved || 0}
              </p>
              <p className="text-sm text-muted-foreground">Resolved</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <Clock className="w-8 h-8 mx-auto text-amber-400" />
              <p className="text-2xl font-bold text-foreground mt-2">
                {data?.disputes?.inProgress || 0}
              </p>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <FileText className="w-8 h-8 mx-auto text-primary" />
              <p className="text-2xl font-bold text-foreground mt-2">
                {data?.disputes?.pending || 0}
              </p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <AlertTriangle className="w-8 h-8 mx-auto text-red-400" />
              <p className="text-2xl font-bold text-foreground mt-2">
                {data?.negativeItems?.remaining || 0}
              </p>
              <p className="text-sm text-muted-foreground">Items Remaining</p>
            </CardContent>
          </Card>
        </div>

        {/* Credit Readiness Summary */}
        {data?.readiness && (
          <Card className="bg-card border-border mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    Credit Readiness
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {formatProductType(data.readiness.productType)} approval analysis
                  </CardDescription>
                </div>
                <Badge className={TIER_COLORS[data.readiness.approvalTier]?.bg + " " + TIER_COLORS[data.readiness.approvalTier]?.text}>
                  {TIER_COLORS[data.readiness.approvalTier]?.label || data.readiness.approvalTier}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {/* Approval Gauge */}
              <div className="flex items-center gap-6 mb-4">
                <div className="relative w-20 h-20">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                    <circle
                      cx="40" cy="40" r="34"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="6"
                      className="text-muted"
                    />
                    <circle
                      cx="40" cy="40" r="34"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="6"
                      strokeDasharray={`${(data.readiness.approvalLikelihood / 100) * 213.6} 213.6`}
                      strokeLinecap="round"
                      className={
                        data.readiness.approvalLikelihood >= 70 ? "text-emerald-400" :
                        data.readiness.approvalLikelihood >= 40 ? "text-amber-400" :
                        "text-red-400"
                      }
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-foreground">{data.readiness.approvalLikelihood}%</span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {data.readiness.explanation}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>Model: {data.readiness.scoreModel}</span>
                    {data.readiness.relevantScore && (
                      <span>Score: {data.readiness.relevantScore}</span>
                    )}
                    {data.readiness.estimatedDTI !== null && (
                      <span>DTI: {Math.round(data.readiness.estimatedDTI)}%</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Top Action Steps */}
              {data.readiness.topActions.length > 0 && (
                <div className="border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">Next Steps</p>
                  <div className="space-y-2">
                    {data.readiness.topActions.map((action) => (
                      <div
                        key={action.stepNumber}
                        className="flex items-center gap-3 p-2 bg-muted rounded-lg"
                      >
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs text-primary font-medium">{action.stepNumber}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{action.title}</span>
                        <Badge className="ml-auto text-[10px] bg-muted text-muted-foreground">
                          {action.priority}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Vendor Recommendations */}
        {recommendations.length > 0 && (
          <Card className="bg-card border-border mt-6">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                Recommended Services
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Personalized recommendations based on your credit profile
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recommendations.map((rec) => {
                  const url = rec.customAffiliateUrl || rec.affiliateUrl;
                  const catColor = CATEGORY_COLORS[rec.vendorCategory] || CATEGORY_COLORS.OTHER;

                  return (
                    <div
                      key={`${rec.vendorId}-${rec.ruleId}`}
                      className="p-4 bg-muted rounded-lg border border-input hover:border-input transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-foreground">{rec.vendorName}</span>
                        <Badge className={`text-[10px] ${catColor}`}>
                          {rec.vendorCategory.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="text-sm font-semibold text-foreground mb-1">
                        {rec.recommendationTitle}
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {rec.recommendationBody}
                      </p>
                      {rec.recommendationCTA && url && (
                        <Button
                          size="sm"
                          className="mt-3 gap-2"
                          onClick={async () => {
                            try {
                              await fetch("/api/portal/recommendations", {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${localStorage.getItem("portal_token")}`,
                                },
                                body: JSON.stringify({
                                  vendorId: rec.vendorId,
                                  triggerType: "PORTAL_VIEW",
                                }),
                              });
                            } catch {
                              // Tracking failure shouldn't block the user
                            }
                            window.open(url, "_blank", "noopener,noreferrer");
                          }}
                        >
                          {rec.recommendationCTA}
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground text-sm">
            Questions? Contact your credit repair specialist at {organization?.name}
          </p>
        </div>
      </main>
    </div>
  );
}
