"use client";

/**
 * SENTRY TRACKING CLIENT COMPONENT
 *
 * Interactive tracking dashboard with:
 * - Quick stats bar
 * - Account tracking matrix
 * - Pending actions
 * - Recent activity
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { generateAnalyticsReportPDF, type AnalyticsReportData } from "@/lib/pdf-generate";

// Types
interface BureauStatus {
  round: number;
  status: "NOT_STARTED" | "DRAFT" | "SENT" | "RESPONDED" | "RESOLVED";
  outcome?: "DELETED" | "VERIFIED" | "UPDATED" | "NO_RESPONSE" | "STALL_LETTER" | null;
  disputeId?: string;
  disputeItemId?: string;
  sentDate?: string;
  responseDate?: string;
  daysRemaining?: number;
  isOverdue?: boolean;
}

interface AccountTracking {
  accountId: string;
  creditorName: string;
  maskedAccountId: string;
  transunion: BureauStatus;
  experian: BureauStatus;
  equifax: BureauStatus;
  bestOutcome: "DELETED" | "VERIFIED" | "UPDATED" | "PENDING" | "NOT_STARTED";
}

interface QuickStats {
  activeDisputes: number;
  awaitingResponse: number;
  overdue: number;
  successRate: number;
  totalDeleted: number;
  totalDisputed: number;
  byBureau: {
    transunion: { active: number; deleted: number; total: number };
    experian: { active: number; deleted: number; total: number };
    equifax: { active: number; deleted: number; total: number };
  };
}

interface RecentActivity {
  id: string;
  date: string;
  type: "CREATED" | "SENT" | "RESPONSE" | "RESOLVED";
  creditorName: string;
  cra: string;
  round: number;
  outcome?: string;
  disputeId: string;
}

interface PendingAction {
  id: string;
  type: "SEND_DRAFT" | "RECORD_RESPONSE" | "OVERDUE" | "START_NEXT_ROUND";
  priority: "HIGH" | "MEDIUM" | "LOW";
  creditorName: string;
  cra: string;
  round: number;
  disputeId?: string;
  accountId?: string;
  message: string;
  daysOverdue?: number;
}

interface TrackingData {
  client: { id: string; name: string };
  trackingMatrix: AccountTracking[];
  quickStats: QuickStats;
  recentActivity: RecentActivity[];
  pendingActions: PendingAction[];
}

interface Props {
  clientId: string;
}

export function SentryTrackingClient({ clientId }: Props) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"matrix" | "timeline" | "analytics">("matrix");

  useEffect(() => {
    fetchTrackingData();
  }, [clientId]);

  const fetchTrackingData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/sentry/tracking?clientId=${clientId}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to fetch tracking data");
      }

      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tracking data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
        <p className="text-red-400">{error || "Failed to load tracking data"}</p>
        <button
          onClick={fetchTrackingData}
          className="mt-4 px-4 py-2 bg-red-500 text-foreground rounded-lg hover:bg-red-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats Bar */}
      <QuickStatsBar stats={data.quickStats} />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("matrix")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "matrix"
              ? "text-primary border-b-2 border-blue-400"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Account Matrix
        </button>
        <button
          onClick={() => setActiveTab("timeline")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "timeline"
              ? "text-primary border-b-2 border-blue-400"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Timeline
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "analytics"
              ? "text-primary border-b-2 border-blue-400"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Analytics
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "matrix" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Matrix - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            <AccountTrackingMatrix
              accounts={data.trackingMatrix}
              clientId={clientId}
            />
          </div>

          {/* Sidebar - 1 column */}
          <div className="space-y-6">
            <PendingActionsPanel
              actions={data.pendingActions}
              clientId={clientId}
              onRefresh={fetchTrackingData}
            />
            <RecentActivityPanel activities={data.recentActivity} />
          </div>
        </div>
      )}

      {activeTab === "timeline" && (
        <TimelineView activities={data.recentActivity} />
      )}

      {activeTab === "analytics" && (
        <AnalyticsView
          stats={data.quickStats}
          accounts={data.trackingMatrix}
          clientName={data.client.name}
        />
      )}
    </div>
  );
}

// ============================================================================
// QUICK STATS BAR
// ============================================================================

function QuickStatsBar({ stats }: { stats: QuickStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-card rounded-lg border border-border p-4">
        <div className="text-2xl font-bold text-foreground">{stats.activeDisputes}</div>
        <div className="text-xs text-muted-foreground">Active Disputes</div>
      </div>
      <div className="bg-card rounded-lg border border-border p-4">
        <div className="text-2xl font-bold text-amber-400">{stats.awaitingResponse}</div>
        <div className="text-xs text-muted-foreground">Awaiting Response</div>
      </div>
      <div className="bg-card rounded-lg border border-border p-4">
        <div className={`text-2xl font-bold ${stats.overdue > 0 ? "text-red-400" : "text-muted-foreground"}`}>
          {stats.overdue}
        </div>
        <div className="text-xs text-muted-foreground">Overdue</div>
      </div>
      <div className="bg-card rounded-lg border border-border p-4">
        <div className="text-2xl font-bold text-emerald-400">{stats.successRate}%</div>
        <div className="text-xs text-muted-foreground">
          Success Rate ({stats.totalDeleted}/{stats.totalDisputed})
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ACCOUNT TRACKING MATRIX
// ============================================================================

function AccountTrackingMatrix({
  accounts,
  clientId,
}: {
  accounts: AccountTracking[];
  clientId: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Account Tracking Matrix</h2>
        <p className="text-sm text-muted-foreground">Track progress across all bureaus and rounds</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-background">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Account
              </th>
              <th className="px-4 py-3 text-center">
                <div className="flex items-center justify-center">
                  <Image
                    src="/logos/transunion.svg"
                    alt="TransUnion"
                    width={80}
                    height={24}
                    className="h-5 w-auto opacity-80"
                  />
                </div>
              </th>
              <th className="px-4 py-3 text-center">
                <div className="flex items-center justify-center">
                  <Image
                    src="/logos/experian.svg"
                    alt="Experian"
                    width={80}
                    height={24}
                    className="h-5 w-auto opacity-80"
                  />
                </div>
              </th>
              <th className="px-4 py-3 text-center">
                <div className="flex items-center justify-center">
                  <Image
                    src="/logos/equifax.svg"
                    alt="Equifax"
                    width={80}
                    height={24}
                    className="h-5 w-auto opacity-80"
                  />
                </div>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                PDF
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {accounts.map((account) => (
              <tr key={account.accountId} className="hover:bg-muted">
                <td className="px-4 py-4">
                  <div className="font-medium text-foreground">{account.creditorName}</div>
                  <div className="text-xs text-muted-foreground">...{account.maskedAccountId}</div>
                </td>
                <td className="px-4 py-3">
                  <BureauStatusCell
                    status={account.transunion}
                    cra="TRANSUNION"
                    clientId={clientId}
                    accountId={account.accountId}
                  />
                </td>
                <td className="px-4 py-3">
                  <BureauStatusCell
                    status={account.experian}
                    cra="EXPERIAN"
                    clientId={clientId}
                    accountId={account.accountId}
                  />
                </td>
                <td className="px-4 py-3">
                  <BureauStatusCell
                    status={account.equifax}
                    cra="EQUIFAX"
                    clientId={clientId}
                    accountId={account.accountId}
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <OutcomeBadge outcome={account.bestOutcome} />
                </td>
                <td className="px-4 py-3 text-center">
                  <DownloadLetterButton
                    account={account}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-border bg-muted/30">
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-500"></span> Not Started
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span> Draft
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span> Sent/Waiting
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span> Responded
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Deleted
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400"></span> Verified
          </span>
        </div>
      </div>
    </div>
  );
}

function BureauStatusCell({
  status,
  cra,
  clientId,
  accountId,
}: {
  status: BureauStatus;
  cra: string;
  clientId: string;
  accountId: string;
}) {
  if (status.status === "NOT_STARTED") {
    return (
      <div className="text-center">
        <Link
          href={`/sentry/${clientId}?cra=${cra}&account=${accountId}`}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted text-muted-foreground rounded hover:bg-muted hover:text-foreground transition-colors"
        >
          <span>Start</span>
        </Link>
      </div>
    );
  }

  const getStatusColor = () => {
    if (status.outcome === "DELETED") return "bg-emerald-400";
    if (status.outcome === "VERIFIED") return "bg-red-400";
    if (status.outcome === "UPDATED") return "bg-yellow-400";
    if (status.status === "SENT") return status.isOverdue ? "bg-red-400" : "bg-amber-400";
    if (status.status === "DRAFT") return "bg-slate-400";
    if (status.status === "RESPONDED") return "bg-blue-400";
    return "bg-slate-500";
  };

  const getStatusText = () => {
    if (status.outcome) {
      return status.outcome.charAt(0) + status.outcome.slice(1).toLowerCase();
    }
    if (status.status === "SENT") {
      return status.isOverdue
        ? `Overdue`
        : `${status.daysRemaining}d`;
    }
    return status.status.charAt(0) + status.status.slice(1).toLowerCase();
  };

  return (
    <div className="text-center">
      <div className="inline-flex flex-col items-center gap-1">
        <div className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${getStatusColor()}`}></span>
          <span className="text-xs font-medium text-muted-foreground">R{status.round}</span>
        </div>
        <span className={`text-xs ${status.isOverdue ? "text-red-400" : "text-muted-foreground"}`}>
          {getStatusText()}
        </span>
        {status.disputeId && (
          <Link
            href={`/sentry/${clientId}?dispute=${status.disputeId}`}
            className="text-xs text-primary hover:underline"
          >
            View
          </Link>
        )}
      </div>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: AccountTracking["bestOutcome"] }) {
  const config = {
    DELETED: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "Deleted" },
    VERIFIED: { bg: "bg-red-500/20", text: "text-red-400", label: "Verified" },
    UPDATED: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "Updated" },
    PENDING: { bg: "bg-amber-500/20", text: "text-amber-400", label: "Pending" },
    NOT_STARTED: { bg: "bg-muted", text: "text-muted-foreground", label: "-" },
  };

  const { bg, text, label } = config[outcome];

  return (
    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${bg} ${text}`}>
      {label}
    </span>
  );
}

// ============================================================================
// DOWNLOAD LETTER BUTTON
// ============================================================================

function DownloadLetterButton({ account }: { account: AccountTracking }) {
  const [isDownloading, setIsDownloading] = useState(false);

  // Find the first available dispute ID from any bureau
  const disputeId = account.transunion.disputeId ||
    account.experian.disputeId ||
    account.equifax.disputeId;

  // Only show button if there's a dispute
  if (!disputeId) {
    return <span className="text-muted-foreground text-xs">-</span>;
  }

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      // Fetch the dispute to get the letter content
      const response = await fetch(`/api/sentry/${disputeId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch dispute");
      }
      const data = await response.json();
      const letterContent = data.dispute?.letterContent;

      if (!letterContent) {
        alert("No letter content available for this dispute.");
        return;
      }

      // Generate PDF
      const { generateSimpleLetterPDF } = await import("@/lib/pdf-generate");
      const pdfBytes = await generateSimpleLetterPDF(letterContent, {
        title: "Dispute Letter",
        date: new Date(),
        footer: `Dispute ID: ${disputeId}`,
      });

      // Download
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${account.creditorName.replace(/\s+/g, "_")}_Dispute_Letter.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download letter:", error);
      alert("Failed to download letter. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isDownloading}
      className="inline-flex items-center justify-center p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors disabled:opacity-50"
      title="Download Letter PDF"
    >
      {isDownloading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )}
    </button>
  );
}

// ============================================================================
// PENDING ACTIONS PANEL
// ============================================================================

function PendingActionsPanel({
  actions,
  clientId,
  onRefresh,
}: {
  actions: PendingAction[];
  clientId: string;
  onRefresh: () => void;
}) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "HIGH":
        return "border-l-red-500";
      case "MEDIUM":
        return "border-l-amber-500";
      default:
        return "border-l-border";
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case "SEND_DRAFT":
        return "📤";
      case "RECORD_RESPONSE":
        return "📋";
      case "OVERDUE":
        return "⚠️";
      case "START_NEXT_ROUND":
        return "🔄";
      default:
        return "•";
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Pending Actions</h3>
          <p className="text-xs text-muted-foreground">{actions.length} items need attention</p>
        </div>
        <button
          onClick={onRefresh}
          className="p-1 hover:bg-muted rounded transition-colors"
          title="Refresh"
        >
          <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="divide-y divide-border max-h-80 overflow-y-auto">
        {actions.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            No pending actions
          </div>
        ) : (
          actions.slice(0, 10).map((action) => (
            <div
              key={action.id}
              className={`p-3 border-l-2 ${getPriorityColor(action.priority)} hover:bg-muted`}
            >
              <div className="flex items-start gap-2">
                <span className="text-sm">{getActionIcon(action.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {action.creditorName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {action.cra} • R{action.round} • {action.message}
                  </p>
                </div>
                {action.disputeId && (
                  <Link
                    href={`/sentry/${clientId}?dispute=${action.disputeId}`}
                    className="shrink-0 px-2 py-1 text-xs bg-primary/20 text-primary rounded hover:bg-blue-500/30"
                  >
                    Action
                  </Link>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// RECENT ACTIVITY PANEL
// ============================================================================

function RecentActivityPanel({ activities }: { activities: RecentActivity[] }) {
  const getActivityIcon = (type: string, outcome?: string) => {
    if (outcome === "DELETED") return "✅";
    if (outcome === "VERIFIED") return "❌";
    switch (type) {
      case "CREATED":
        return "●";
      case "SENT":
        return "✉️";
      case "RESPONSE":
        return "📬";
      case "RESOLVED":
        return "✓";
      default:
        return "•";
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="bg-card rounded-xl border border-border">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
      </div>

      <div className="divide-y divide-border max-h-64 overflow-y-auto">
        {activities.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            No recent activity
          </div>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="p-3 hover:bg-muted">
              <div className="flex items-start gap-2">
                <span className="text-sm mt-0.5">{getActivityIcon(activity.type, activity.outcome)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{activity.creditorName}</span>
                    <span className="text-muted-foreground"> ({activity.cra})</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    R{activity.round} • {activity.type.toLowerCase()}
                    {activity.outcome && ` • ${activity.outcome.toLowerCase()}`}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDate(activity.date)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// TIMELINE VIEW
// ============================================================================

function TimelineView({ activities }: { activities: RecentActivity[] }) {
  const groupedByDate = activities.reduce((acc, activity) => {
    const date = new Date(activity.date).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(activity);
    return acc;
  }, {} as Record<string, RecentActivity[]>);

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <h2 className="text-lg font-semibold text-foreground mb-6">Timeline</h2>

      {Object.entries(groupedByDate).map(([date, items]) => (
        <div key={date} className="mb-8">
          <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
            {date}
          </h3>
          <div className="space-y-4 border-l-2 border-border pl-4">
            {items.map((item) => (
              <div key={item.id} className="relative">
                <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-muted border-2 border-input"></div>
                <div className="bg-background rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{item.creditorName}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.date).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {item.cra} • Round {item.round} • {item.type.toLowerCase()}
                    {item.outcome && (
                      <span className={`ml-2 ${
                        item.outcome === "DELETED" ? "text-emerald-400" :
                        item.outcome === "VERIFIED" ? "text-red-400" :
                        "text-yellow-400"
                      }`}>
                        {item.outcome}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {activities.length === 0 && (
        <div className="text-center text-muted-foreground py-10">
          No activity yet. Start a dispute to see timeline updates.
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ANALYTICS VIEW
// ============================================================================

function AnalyticsView({
  stats,
  accounts,
  clientName,
}: {
  stats: QuickStats;
  accounts: AccountTracking[];
  clientName: string;
}) {
  const [downloading, setDownloading] = useState(false);

  const bureauData = [
    { name: "TransUnion", ...stats.byBureau.transunion, color: "bg-blue-500" },
    { name: "Experian", ...stats.byBureau.experian, color: "bg-purple-500" },
    { name: "Equifax", ...stats.byBureau.equifax, color: "bg-emerald-500" },
  ];

  // Calculate outcomes from accounts
  const outcomes = {
    deleted: accounts.filter((a) => a.bestOutcome === "DELETED").length,
    verified: accounts.filter((a) => a.bestOutcome === "VERIFIED").length,
    updated: accounts.filter((a) => a.bestOutcome === "UPDATED").length,
    pending: accounts.filter((a) => a.bestOutcome === "PENDING").length,
    notStarted: accounts.filter((a) => a.bestOutcome === "NOT_STARTED").length,
  };

  const handleDownloadPDF = useCallback(async () => {
    setDownloading(true);
    try {
      const reportData: AnalyticsReportData = {
        clientName,
        generatedDate: new Date(),
        bureauStats: stats.byBureau,
        totalDeleted: stats.totalDeleted,
        totalDisputed: stats.totalDisputed,
        awaitingResponse: stats.awaitingResponse,
        accountsTracked: accounts.length,
        successRate: stats.successRate,
        outcomes,
      };

      const pdfBytes = await generateAnalyticsReportPDF(reportData);

      // Create download link - convert Uint8Array to regular array for Blob compatibility
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${clientName.replace(/\s+/g, "_")}_Sentry_Analytics_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  }, [clientName, stats, accounts, outcomes]);

  return (
    <div className="space-y-6">
      {/* Header with Download Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Analytics Overview</h2>
        <button
          onClick={handleDownloadPDF}
          disabled={downloading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {downloading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Generating...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Download PDF</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bureau Performance */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Bureau Performance</h3>
        <div className="space-y-4">
          {bureauData.map((bureau) => {
            const rate = bureau.total > 0 ? Math.round((bureau.deleted / bureau.total) * 100) : 0;
            return (
              <div key={bureau.name}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{bureau.name}</span>
                  <span className="text-muted-foreground">
                    {rate}% deletion rate ({bureau.deleted}/{bureau.total})
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${bureau.color} transition-all duration-500`}
                    style={{ width: `${rate}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Overall Stats */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Overall Statistics</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-background rounded-lg">
            <div className="text-3xl font-bold text-emerald-400">{stats.totalDeleted}</div>
            <div className="text-sm text-muted-foreground">Items Deleted</div>
          </div>
          <div className="text-center p-4 bg-background rounded-lg">
            <div className="text-3xl font-bold text-foreground">{stats.totalDisputed}</div>
            <div className="text-sm text-muted-foreground">Total Disputed</div>
          </div>
          <div className="text-center p-4 bg-background rounded-lg">
            <div className="text-3xl font-bold text-amber-400">{stats.awaitingResponse}</div>
            <div className="text-sm text-muted-foreground">Awaiting Response</div>
          </div>
          <div className="text-center p-4 bg-background rounded-lg">
            <div className="text-3xl font-bold text-primary">{accounts.length}</div>
            <div className="text-sm text-muted-foreground">Accounts Tracked</div>
          </div>
        </div>
      </div>

      {/* Outcome Breakdown */}
      <div className="bg-card rounded-xl border border-border p-6 md:col-span-2">
        <h3 className="text-lg font-semibold text-foreground mb-4">Account Outcomes</h3>
        <div className="grid grid-cols-5 gap-4">
          {[
            { label: "Deleted", outcome: "DELETED", color: "bg-emerald-500" },
            { label: "Verified", outcome: "VERIFIED", color: "bg-red-500" },
            { label: "Updated", outcome: "UPDATED", color: "bg-yellow-500" },
            { label: "Pending", outcome: "PENDING", color: "bg-amber-500" },
            { label: "Not Started", outcome: "NOT_STARTED", color: "bg-slate-500" },
          ].map(({ label, outcome, color }) => {
            const count = accounts.filter((a) => a.bestOutcome === outcome).length;
            return (
              <div key={outcome} className="text-center">
                <div className={`w-full h-2 ${color} rounded-full mb-2`}></div>
                <div className="text-2xl font-bold text-foreground">{count}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
}
