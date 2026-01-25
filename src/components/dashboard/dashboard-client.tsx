"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ActionQueueItem {
  id: string;
  type: "response" | "send" | "parse" | "followup" | "escalate";
  priority: "urgent" | "high" | "medium" | "low";
  title: string;
  client: { id: string; name: string; initials: string };
  detail: string;
  bureau: string | null;
  age: string;
  action: string;
  linkTo: string;
}

interface RecentResponse {
  id: string;
  bureau: string;
  client: string;
  clientId: string;
  time: string;
  result: "success" | "stall" | "mixed";
  deleted: number;
  verified: number;
}

interface ApproachingDeadline {
  id: string;
  client: string;
  clientId: string;
  bureau: string;
  daysLeft: number;
  round: number;
  sentDate: string;
}

interface DashboardStats {
  totalClients: number;
  activeDisputes: number;
  successRate: number;
  deletionsThisMonth: number;
}

interface DashboardClientProps {
  userName: string;
  stats: DashboardStats;
  actionQueue: ActionQueueItem[];
  responses: RecentResponse[];
  deadlines: ApproachingDeadline[];
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function ActionQueueItemCard({ item }: { item: ActionQueueItem }) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "response": return "📨";
      case "send": return "📤";
      case "parse": return "📄";
      case "followup": return "📞";
      case "escalate": return "⬆️";
      default: return "📋";
    }
  };

  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "border-red-500/30 bg-gradient-to-r from-red-500/[0.08] to-red-500/[0.02]";
      case "high":
        return "border-amber-500/20 bg-amber-500/[0.03]";
      default:
        return "border-white/[0.06] bg-white/[0.02]";
    }
  };

  const getPriorityBarColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-500";
      case "high": return "bg-amber-500";
      default: return "bg-slate-500";
    }
  };

  const getAvatarGradient = (priority: string) => {
    switch (priority) {
      case "urgent": return "from-red-500 to-red-600";
      case "high": return "from-amber-500 to-amber-600";
      default: return "from-indigo-500 to-indigo-600";
    }
  };

  const getBureauColor = (bureau: string | null) => {
    if (!bureau) return "bg-slate-500/15 text-slate-400";
    switch (bureau) {
      case "TU": return "bg-sky-500/15 text-sky-400";
      case "EX": return "bg-indigo-500/15 text-indigo-400";
      case "EQ": return "bg-pink-500/15 text-pink-400";
      case "ALL": return "bg-slate-500/15 text-slate-400";
      default: return "bg-slate-500/15 text-slate-400";
    }
  };

  return (
    <div
      className={`relative flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-200 overflow-hidden ${getPriorityStyles(item.priority)} ${isHovered ? "translate-y-[-2px] shadow-lg shadow-black/30" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => router.push(item.linkTo)}
    >
      {/* Priority Bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${getPriorityBarColor(item.priority)}`} />

      {/* Client Avatar */}
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0 bg-gradient-to-br ${getAvatarGradient(item.priority)}`}>
        {item.client.initials}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 mb-1">
          <span className="text-sm font-semibold text-white">{item.title}</span>
          {item.priority === "urgent" && (
            <span className="px-2 py-0.5 bg-red-500/20 rounded text-[10px] font-bold text-red-500 uppercase tracking-wide">
              Urgent
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[13px] text-slate-500">
          <span className="font-medium text-slate-400">{item.client.name}</span>
          <span className="text-slate-600">•</span>
          <span>{item.detail}</span>
        </div>
      </div>

      {/* Bureau Tag */}
      {item.bureau && (
        <div className={`px-3 py-1.5 rounded-md text-[11px] font-bold flex-shrink-0 ${getBureauColor(item.bureau)}`}>
          {item.bureau}
        </div>
      )}

      {/* Time */}
      <span className="text-xs text-slate-500 min-w-[80px] text-right flex-shrink-0">
        {item.age}
      </span>

      {/* Action Button */}
      <button
        className={`px-4 py-2.5 rounded-lg text-xs font-semibold flex-shrink-0 transition-all duration-200 ${
          isHovered
            ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white"
            : "bg-indigo-500/10 text-indigo-400"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          router.push(item.linkTo);
        }}
      >
        {item.action}
      </button>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DashboardClient({
  userName,
  stats,
  actionQueue,
  responses,
  deadlines,
}: DashboardClientProps) {
  const router = useRouter();
  const [time, setTime] = useState(new Date());
  const [greeting, setGreeting] = useState("");
  const [filter, setFilter] = useState<"all" | "urgent" | "responses" | "letters">("all");

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Set greeting based on time of day
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  // Format local time
  const localTime = time.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const urgentCount = actionQueue.filter((a) => a.priority === "urgent").length;

  // Filter action queue
  const filteredQueue = actionQueue.filter((item) => {
    if (filter === "all") return true;
    if (filter === "urgent") return item.priority === "urgent";
    if (filter === "responses") return item.type === "response";
    if (filter === "letters") return item.type === "send";
    return true;
  });

  return (
    <div className="min-h-screen text-slate-50 relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#07051a] via-[#0f0d2e] to-[#07051a]" />
      <div className="fixed top-[-30%] left-[-10%] w-[60%] h-[70%] bg-[radial-gradient(ellipse,rgba(99,102,241,0.1)_0%,transparent_70%)] blur-[80px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[60%] bg-[radial-gradient(ellipse,rgba(16,185,129,0.06)_0%,transparent_70%)] blur-[80px] pointer-events-none" />

      {/* Main Content */}
      <main className="relative z-10 p-6 md:p-8 pb-24">
        {/* Welcome Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-[28px] font-bold text-white">
              {greeting}, {userName}
            </h1>
            <p className="text-[15px] text-slate-500 mt-1">
              {urgentCount > 0 ? (
                <>
                  You have{" "}
                  <span className="text-red-500 font-semibold">
                    {urgentCount} urgent {urgentCount === 1 ? "item" : "items"}
                  </span>{" "}
                  requiring attention
                </>
              ) : (
                <>You're all caught up! 🎉</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg">
              <span className="text-sm font-semibold text-white font-mono tracking-wide">
                {localTime}
              </span>
            </div>
            <Link
              href="/clients"
              className="flex items-center gap-2.5 px-5 py-2.5 bg-white/[0.05] border border-white/10 rounded-xl text-sm font-medium text-white hover:bg-white/[0.08] transition-colors"
            >
              <span className="text-lg">📄</span>
              <span>Upload Report</span>
            </Link>
          </div>
        </div>

        {/* Action Queue Section */}
        <section className="mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white">Action Queue</h2>
              <span className="px-3 py-1 bg-indigo-500/15 rounded-full text-xs font-semibold text-indigo-400">
                {actionQueue.length} items
              </span>
            </div>
            <div className="flex gap-1.5">
              {(["all", "urgent", "responses", "letters"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                    filter === f
                      ? "bg-white/10 border-white/15 text-white"
                      : "bg-transparent border-white/[0.08] text-slate-500 hover:text-white"
                  } border`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {filteredQueue.length === 0 ? (
              <div className="p-12 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
                <div className="text-4xl mb-3">🎉</div>
                <p className="text-slate-400">No pending actions</p>
                <p className="text-sm text-slate-600 mt-1">You're all caught up!</p>
              </div>
            ) : (
              filteredQueue.map((item) => (
                <ActionQueueItemCard key={item.id} item={item} />
              ))
            )}
          </div>
        </section>

        {/* Bottom Row: Responses + Deadlines */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Recent Responses */}
          <section className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="flex items-center gap-2.5 text-[15px] font-semibold text-white">
                <span className="text-base">📬</span>
                Recent Responses
              </h3>
              <Link
                href="/responses"
                className="px-3 py-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                View All →
              </Link>
            </div>
            <div className="flex flex-col gap-2.5">
              {responses.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  <p className="text-sm">No responses yet</p>
                </div>
              ) : (
                responses.map((response) => (
                  <Link key={response.id} href={`/clients/${response.clientId}`}>
                    <div className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-bold text-white ${
                          response.bureau === "TU"
                            ? "bg-sky-500"
                            : response.bureau === "EX"
                            ? "bg-indigo-500"
                            : "bg-pink-500"
                        }`}
                      >
                        {response.bureau}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="block text-[13px] font-semibold text-white">
                          {response.client}
                        </span>
                        <span className="text-[11px] text-slate-500">{response.time}</span>
                      </div>
                      <div
                        className={`px-3 py-1 rounded-md text-[11px] font-semibold ${
                          response.result === "success"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : response.result === "stall"
                            ? "bg-amber-500/15 text-amber-400"
                            : "bg-indigo-500/15 text-indigo-400"
                        }`}
                      >
                        {response.result === "success"
                          ? `${response.deleted} deleted`
                          : response.result === "stall"
                          ? "Stall letter"
                          : `${response.deleted}↓ ${response.verified}↔`}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>

          {/* Approaching Deadlines */}
          <section className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="flex items-center gap-2.5 text-[15px] font-semibold text-white">
                <span className="text-base">⏰</span>
                Approaching Deadlines
              </h3>
              <Link
                href="/responses"
                className="px-3 py-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                View All →
              </Link>
            </div>
            <div className="flex flex-col gap-2.5">
              {deadlines.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  <p className="text-sm">No pending deadlines</p>
                </div>
              ) : (
                deadlines.map((deadline) => (
                  <Link key={deadline.id} href={`/clients/${deadline.clientId}`}>
                    <div className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer">
                      <div
                        className={`w-10 h-10 rounded-lg border flex items-center justify-center text-[13px] font-bold ${
                          deadline.daysLeft <= 5
                            ? "bg-red-500/15 text-red-400 border-red-500/30"
                            : deadline.daysLeft <= 10
                            ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                            : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        }`}
                      >
                        {deadline.daysLeft}d
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="block text-[13px] font-semibold text-white">
                          {deadline.client}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          R{deadline.round} • {deadline.bureau} • Sent {deadline.sentDate}
                        </span>
                      </div>
                      {deadline.daysLeft <= 5 && (
                        <span className="px-2.5 py-1 bg-red-500/15 rounded-md text-[10px] font-bold text-red-500 uppercase">
                          Urgent
                        </span>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Quick Stats Bar (Fixed Footer) */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 flex justify-center items-center gap-10 py-4 px-8 bg-white/[0.02] backdrop-blur-xl border-t border-white/[0.05]">
        <div className="text-center">
          <span className="block text-2xl font-bold text-white">{stats.totalClients}</span>
          <span className="text-[11px] text-slate-500">Total Clients</span>
        </div>
        <div className="w-px h-9 bg-white/[0.08]" />
        <div className="text-center">
          <span className="block text-2xl font-bold text-white">{stats.activeDisputes}</span>
          <span className="text-[11px] text-slate-500">Active Disputes</span>
        </div>
        <div className="w-px h-9 bg-white/[0.08]" />
        <div className="text-center">
          <span className="block text-2xl font-bold text-emerald-400">{stats.successRate}%</span>
          <span className="text-[11px] text-slate-500">Success Rate</span>
        </div>
        <div className="w-px h-9 bg-white/[0.08]" />
        <div className="text-center">
          <span className="block text-2xl font-bold text-amber-400">{stats.deletionsThisMonth}</span>
          <span className="text-[11px] text-slate-500">Deletions This Month</span>
        </div>
      </footer>
    </div>
  );
}
