"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ActiveClient {
  id: string;
  name: string;
  initials: string;
  round: number;
  bureaus: string[];
  score: number | null;
  gain: number | null;
  status: "hot" | "active" | "new" | "winning";
}

interface RecentWin {
  creditor: string;
  type: string;
  bureau: string;
  client: string;
}

interface DashboardClientProps {
  userName: string;
  subscriptionTier: string;
  stats: {
    totalClients: number;
    activeDisputes: number;
    deletions: number;
    successRate: number;
    avgScoreGain: number;
    clientsTrend?: string;
    disputesTrend?: string;
    deletionsTrend?: string;
  };
  flows: Record<string, { active: number; rate: number }>;
  activeClients: ActiveClient[];
  recentWins: RecentWin[];
  itemsRequiringAttention: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DashboardClient({
  userName,
  subscriptionTier,
  stats,
  flows,
  activeClients,
  recentWins,
  itemsRequiringAttention,
}: DashboardClientProps) {
  const router = useRouter();
  const [time, setTime] = useState(new Date());
  const [animatedStats, setAnimatedStats] = useState({
    clients: 0,
    disputes: 0,
    deletions: 0,
  });

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Animate stats on mount
  useEffect(() => {
    const duration = 1500;
    const steps = 30;
    const interval = duration / steps;
    let step = 0;

    const animate = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3); // ease out cubic

      setAnimatedStats({
        clients: Math.round(stats.totalClients * eased),
        disputes: Math.round(stats.activeDisputes * eased),
        deletions: Math.round(stats.deletions * eased),
      });

      if (step >= steps) clearInterval(animate);
    }, interval);

    return () => clearInterval(animate);
  }, [stats.totalClients, stats.activeDisputes, stats.deletions]);

  const tierBadge = subscriptionTier === "FREE" ? "FREE" : "PRO";

  return (
    <div className="min-h-screen text-slate-50 relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed top-[-30%] left-[-10%] w-[600px] h-[600px] bg-[radial-gradient(ellipse,rgba(99,102,241,0.15)_0%,transparent_70%)] pointer-events-none" />
      <div className="fixed top-[30%] right-[-15%] w-[700px] h-[700px] bg-[radial-gradient(ellipse,rgba(236,72,153,0.1)_0%,transparent_70%)] pointer-events-none" />
      <div className="fixed bottom-[-20%] left-[30%] w-[500px] h-[500px] bg-[radial-gradient(ellipse,rgba(16,185,129,0.08)_0%,transparent_70%)] pointer-events-none" />

      {/* Welcome Section */}
      <section className="px-6 pt-6 pb-4 relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <span className="inline-block px-3 py-1.5 bg-white/5 rounded-full text-xs text-slate-400 mb-3">
              {time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Welcome back, <span className="bg-gradient-to-r from-indigo-400 to-pink-500 bg-clip-text text-transparent">{userName}</span>
            </h1>
            <p className="text-slate-500 mt-2">
              {itemsRequiringAttention > 0 ? (
                <>You have <span className="text-amber-400 font-semibold">{itemsRequiringAttention} items</span> requiring attention today</>
              ) : (
                "You're all caught up!"
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-md text-[10px] font-bold tracking-wider ${
              tierBadge === "PRO"
                ? "bg-gradient-to-r from-amber-500 to-red-500"
                : "bg-slate-700 text-slate-300"
            }`}>
              {tierBadge}
            </span>
            <button
              onClick={() => router.push("/clients")}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/40 hover:shadow-indigo-500/60 transition-shadow"
            >
              <span className="text-lg">+</span>
              New Client
            </button>
          </div>
        </div>
      </section>

      {/* Bento Grid */}
      <div className="grid grid-cols-12 auto-rows-[100px] gap-4 px-6 pb-6 relative z-10">
        {/* Large Stats Card */}
        <div className="col-span-12 md:col-span-5 row-span-2 bg-white/[0.03] backdrop-blur-xl rounded-3xl border border-white/[0.06] p-7 flex flex-col justify-between">
          <div className="flex justify-around items-center">
            <div className="text-center">
              <span className="block text-5xl font-bold bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
                {animatedStats.clients}
              </span>
              <span className="text-sm text-slate-500 mt-1">Clients</span>
              {stats.clientsTrend && (
                <span className="inline-block mt-2 px-3 py-1 bg-emerald-500/15 rounded-full text-xs font-semibold text-emerald-400">
                  {stats.clientsTrend}
                </span>
              )}
            </div>
            <div className="w-px h-16 bg-white/10" />
            <div className="text-center">
              <span className="block text-5xl font-bold bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
                {animatedStats.disputes}
              </span>
              <span className="text-sm text-slate-500 mt-1">Active</span>
              {stats.disputesTrend && (
                <span className="inline-block mt-2 px-3 py-1 bg-emerald-500/15 rounded-full text-xs font-semibold text-emerald-400">
                  {stats.disputesTrend}
                </span>
              )}
            </div>
            <div className="w-px h-16 bg-white/10" />
            <div className="text-center">
              <span className="block text-5xl font-bold bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
                {animatedStats.deletions}
              </span>
              <span className="text-sm text-slate-500 mt-1">Deleted</span>
              {stats.deletionsTrend && (
                <span className="inline-block mt-2 px-3 py-1 bg-emerald-500/15 rounded-full text-xs font-semibold text-emerald-400">
                  {stats.deletionsTrend}
                </span>
              )}
            </div>
          </div>
          {/* Visualization Bars */}
          <div className="flex items-end justify-center gap-2 h-20 pt-5">
            {[65, 45, 78, 52, 89, 67, 92].map((h, i) => (
              <div
                key={i}
                className="w-6 bg-gradient-to-t from-indigo-500 to-purple-500 rounded-t-md animate-pulse"
                style={{
                  height: `${h}%`,
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: "2s",
                }}
              />
            ))}
          </div>
        </div>

        {/* Success Rate Card */}
        <div className="col-span-6 md:col-span-3 row-span-2 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 backdrop-blur-xl rounded-3xl border border-white/[0.06] p-6 flex flex-col items-center justify-center">
          <div className="relative w-32 h-32">
            <svg width="128" height="128" viewBox="0 0 128 128">
              <circle cx="64" cy="64" r="54" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
              <circle
                cx="64" cy="64" r="54"
                fill="none"
                stroke="url(#successGrad)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${stats.successRate * 3.39} 339`}
                transform="rotate(-90 64 64)"
                className="transition-all duration-1000"
              />
              <defs>
                <linearGradient id="successGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-emerald-400">{stats.successRate}%</span>
              <span className="text-xs text-slate-500">Success</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 px-4 py-2 bg-white/5 rounded-xl">
            <span className="text-lg">📈</span>
            <span className="text-xl font-bold text-white">+{stats.avgScoreGain || 0}</span>
            <span className="text-xs text-slate-500">Avg Score Gain</span>
          </div>
        </div>

        {/* Upload Card */}
        <Link href="/clients" className="col-span-6 md:col-span-4 row-span-2">
          <div className="h-full bg-gradient-to-br from-indigo-500/10 to-purple-500/5 backdrop-blur-xl rounded-3xl border-2 border-dashed border-indigo-500/30 flex flex-col items-center justify-center hover:border-indigo-500/50 transition-colors cursor-pointer">
            <div className="text-5xl mb-3 animate-bounce" style={{ animationDuration: "3s" }}>📄</div>
            <h3 className="text-lg font-semibold text-white">Upload Report</h3>
            <p className="text-sm text-slate-500 mb-4">Drop IdentityIQ PDF</p>
            <span className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-sm font-semibold">
              Choose File
            </span>
          </div>
        </Link>

        {/* Clients Card */}
        <div className="col-span-12 md:col-span-5 row-span-3 bg-white/[0.03] backdrop-blur-xl rounded-3xl border border-white/[0.06] p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-white">Active Clients</h3>
            <Link href="/clients" className="px-3 py-1.5 bg-white/5 rounded-lg text-xs text-slate-400 hover:text-white transition-colors">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {activeClients.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <div className="text-4xl mb-2">👥</div>
                <p>No clients yet</p>
                <button
                  onClick={() => router.push("/clients")}
                  className="mt-3 px-4 py-2 bg-indigo-500/20 rounded-lg text-sm text-indigo-400"
                >
                  Add Your First Client
                </button>
              </div>
            ) : (
              activeClients.map((client) => (
                <Link key={client.id} href={`/clients/${client.id}`}>
                  <div className="flex items-center gap-4 p-4 bg-white/[0.03] rounded-2xl hover:bg-white/[0.06] transition-colors cursor-pointer">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                      style={{
                        background:
                          client.status === "hot" ? "linear-gradient(135deg, #f59e0b, #ef4444)" :
                          client.status === "winning" ? "linear-gradient(135deg, #10b981, #059669)" :
                          client.status === "new" ? "linear-gradient(135deg, #3b82f6, #6366f1)" :
                          "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                      }}
                    >
                      {client.initials}
                    </div>
                    <div className="flex-1">
                      <span className="block text-sm font-semibold text-white">{client.name}</span>
                      <span className="text-xs text-slate-500">
                        R{client.round} • {client.bureaus.length > 0 ? client.bureaus.join(", ") : "—"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-lg font-bold text-white">{client.score || "—"}</span>
                      {client.gain && client.gain > 0 && (
                        <span className="text-xs font-semibold text-emerald-400">+{client.gain}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Wins Card */}
        <div className="col-span-6 md:col-span-3 row-span-2 bg-gradient-to-br from-amber-500/10 to-amber-600/5 backdrop-blur-xl rounded-3xl border border-white/[0.06] p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🏆</span>
            <h3 className="text-base font-semibold text-white">Recent Wins</h3>
          </div>
          <div className="space-y-2">
            {recentWins.length === 0 ? (
              <div className="text-center py-4 text-slate-500">
                <p className="text-sm">No deletions yet</p>
              </div>
            ) : (
              recentWins.map((win, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                  <div className="w-7 h-7 bg-emerald-500/20 rounded-lg flex items-center justify-center text-sm text-emerald-400">
                    ✓
                  </div>
                  <div className="flex-1">
                    <span className="block text-sm font-semibold text-white">{win.creditor}</span>
                    <span className="text-xs text-slate-500">{win.type}</span>
                  </div>
                  <span className="px-2 py-1 bg-white/10 rounded-md text-[10px] font-bold text-white">
                    {win.bureau}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Flows Card */}
        <div className="col-span-6 md:col-span-4 row-span-2 bg-white/[0.03] backdrop-blur-xl rounded-3xl border border-white/[0.06] p-6">
          <h3 className="text-base font-semibold text-white mb-5">Dispute Flows</h3>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(flows).map(([name, data]) => (
              <div key={name}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-sm font-medium text-white capitalize">{name}</span>
                  <span className="text-sm font-bold text-white">{data.rate}%</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-1">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${data.rate}%`,
                      background:
                        name === "accuracy" ? "linear-gradient(90deg, #3b82f6, #60a5fa)" :
                        name === "collections" ? "linear-gradient(90deg, #f59e0b, #fbbf24)" :
                        name === "consent" ? "linear-gradient(90deg, #10b981, #34d399)" :
                        "linear-gradient(90deg, #8b5cf6, #a78bfa)",
                    }}
                  />
                </div>
                <span className="text-[10px] text-slate-500">{data.active} active</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Dispute Card */}
        <Link href="/disputes" className="col-span-12 md:col-span-4 row-span-1">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl p-5 flex items-center gap-4 hover:shadow-lg hover:shadow-indigo-500/30 transition-shadow cursor-pointer">
            <span className="text-3xl">⚡</span>
            <div className="flex-1">
              <h3 className="text-base font-bold text-white">Quick Dispute</h3>
              <p className="text-sm text-white/70">Generate dispute letters instantly</p>
            </div>
            <span className="px-5 py-2.5 bg-white/20 border border-white/30 rounded-xl text-sm font-semibold text-white">
              Start Now
            </span>
          </div>
        </Link>
      </div>

      {/* Subscription Prompt for Free Users */}
      {subscriptionTier === "FREE" && (
        <div className="mx-6 mb-6 p-6 rounded-3xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/20 relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Upgrade to Pro</h3>
              <p className="text-slate-300 mt-1">
                Unlock report uploads, AI dispute generation, and CFPB complaint tools.
              </p>
            </div>
            <button
              onClick={() => router.push("/billing")}
              className="px-6 py-3 bg-white text-slate-900 rounded-xl font-semibold hover:bg-slate-100 transition-colors"
            >
              View Plans
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
