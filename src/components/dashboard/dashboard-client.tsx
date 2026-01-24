"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  FileText,
  Scale,
  Clock,
  Zap,
  Search,
  Plus,
  ChevronRight,
  Upload,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94] as const,
    },
  },
};

// Stat card component
function StatCard({
  icon: Icon,
  value,
  label,
  change,
  iconBg,
  iconColor,
  href,
}: {
  icon: typeof Users;
  value: string | number;
  label: string;
  change?: { value: number; isPositive: boolean };
  iconBg: string;
  iconColor: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <motion.div
        className="relative overflow-hidden rounded-2xl bg-slate-800/40 border border-slate-700/50 p-5 hover:bg-slate-800/60 hover:border-slate-600/50 transition-all cursor-pointer group"
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex items-start justify-between">
          <div className={`p-3 rounded-xl ${iconBg}`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
          {change && (
            <div className={`flex items-center gap-1 text-sm ${change.isPositive ? "text-emerald-400" : "text-red-400"}`}>
              {change.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {change.isPositive ? "+" : ""}{change.value}%
            </div>
          )}
        </div>
        <div className="mt-4">
          <p className="text-3xl font-bold text-white">{value}</p>
          <p className="text-sm text-slate-400 mt-1">{label}</p>
        </div>
        {/* Hover glow effect */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </motion.div>
    </Link>
  );
}

// Client row component
function ClientRow({
  id,
  initials,
  name,
  disputeCount,
  currentRound,
  bureau,
  status,
}: {
  id: string;
  initials: string;
  name: string;
  disputeCount: number;
  currentRound: number | string;
  bureau: "TU" | "EQ" | "EX";
  status: "active" | "pending" | "completed";
}) {
  const bureauColors = {
    TU: "bg-blue-500/20 text-blue-400",
    EQ: "bg-amber-500/20 text-amber-400",
    EX: "bg-purple-500/20 text-purple-400",
  };

  const statusColors = {
    active: "bg-emerald-500/20 text-emerald-400",
    pending: "bg-amber-500/20 text-amber-400",
    completed: "bg-slate-500/20 text-slate-400",
  };

  const initialsColors = [
    "bg-blue-500/20 text-blue-400",
    "bg-emerald-500/20 text-emerald-400",
    "bg-amber-500/20 text-amber-400",
    "bg-purple-500/20 text-purple-400",
    "bg-pink-500/20 text-pink-400",
  ];
  const colorIndex = name.charCodeAt(0) % initialsColors.length;

  return (
    <Link href={`/clients/${id}`}>
      <motion.div
        className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-700/30 transition-colors cursor-pointer group"
        whileHover={{ x: 4 }}
      >
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${initialsColors[colorIndex]}`}>
            {initials}
          </div>
          <div>
            <p className="font-medium text-white">{name}</p>
            <p className="text-sm text-slate-400">
              {disputeCount} dispute{disputeCount !== 1 ? "s" : ""} • Round {currentRound}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`${bureauColors[bureau]} text-xs font-medium`}>
            {bureau}
          </Badge>
          <Badge className={`${statusColors[status]} text-xs font-medium`}>
            {status}
          </Badge>
          <ChevronRight className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </motion.div>
    </Link>
  );
}

interface RecentClient {
  id: string;
  firstName: string;
  lastName: string;
  disputeCount: number;
  currentRound: number;
  activeBureau: "TU" | "EQ" | "EX" | null;
  status: "active" | "pending" | "completed";
}

interface DashboardClientProps {
  userName: string;
  stats: {
    totalClients: number;
    activeDisputes: number;
    pendingReview: number;
    successRate: number;
    clientsChange?: number;
    disputesChange?: number;
    reviewChange?: number;
    successChange?: number;
  };
  recentClients: RecentClient[];
  needsReviewCount: number;
  subscriptionTier: string;
}

export function DashboardClient({
  userName,
  stats,
  recentClients,
  needsReviewCount,
  subscriptionTier,
}: DashboardClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/clients?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  const disputeFlows = [
    { name: "Accuracy", rounds: "12 rounds" },
    { name: "Collections", rounds: "10 rounds" },
    { name: "Consent", rounds: "4 rounds" },
    { name: "Combo", rounds: "Mixed rounds" },
  ];

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">Welcome back! Here's your dispute overview.</p>
        </div>
        <div className="flex items-center gap-3">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[200px] bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
            />
          </form>
          <Button onClick={() => router.push("/clients")} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Client
          </Button>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          value={stats.totalClients}
          label="Total Clients"
          change={stats.clientsChange ? { value: stats.clientsChange, isPositive: stats.clientsChange > 0 } : undefined}
          iconBg="bg-blue-500/20"
          iconColor="text-blue-400"
          href="/clients"
        />
        <StatCard
          icon={FileText}
          value={stats.activeDisputes}
          label="Active Disputes"
          change={stats.disputesChange ? { value: stats.disputesChange, isPositive: stats.disputesChange > 0 } : undefined}
          iconBg="bg-amber-500/20"
          iconColor="text-amber-400"
          href="/disputes"
        />
        <StatCard
          icon={Clock}
          value={stats.pendingReview}
          label="Pending Review"
          change={stats.reviewChange ? { value: Math.abs(stats.reviewChange), isPositive: stats.reviewChange < 0 } : undefined}
          iconBg="bg-slate-500/20"
          iconColor="text-slate-400"
          href="/disputes?status=pending"
        />
        <StatCard
          icon={Zap}
          value={`${stats.successRate}%`}
          label="Success Rate"
          change={stats.successChange ? { value: stats.successChange, isPositive: stats.successChange > 0 } : undefined}
          iconBg="bg-emerald-500/20"
          iconColor="text-emerald-400"
          href="/analytics"
        />
      </motion.div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Clients - 2 columns */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <div className="rounded-2xl bg-slate-800/40 border border-slate-700/50 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
              <h2 className="font-semibold text-white">Recent Clients</h2>
              <Link href="/clients" className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
                View all <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="divide-y divide-slate-700/30">
              {recentClients.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                  <p className="text-slate-400">No clients yet</p>
                  <Button
                    onClick={() => router.push("/clients")}
                    variant="outline"
                    className="mt-4 border-slate-600"
                  >
                    Add Your First Client
                  </Button>
                </div>
              ) : (
                recentClients.map((client) => (
                  <ClientRow
                    key={client.id}
                    id={client.id}
                    initials={`${client.firstName.charAt(0)}${client.lastName.charAt(0)}`}
                    name={`${client.firstName} ${client.lastName}`}
                    disputeCount={client.disputeCount}
                    currentRound={client.currentRound || 1}
                    bureau={client.activeBureau || "TU"}
                    status={client.status}
                  />
                ))
              )}
            </div>
          </div>
        </motion.div>

        {/* Right Sidebar - 1 column */}
        <motion.div variants={itemVariants} className="space-y-4">
          {/* Upload Report Card */}
          <div className="rounded-2xl bg-slate-800/40 border border-slate-700/50 p-5">
            <div className="flex flex-col items-center text-center">
              <div className="p-4 rounded-full bg-slate-700/50 mb-4">
                <Upload className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="font-semibold text-white">Upload Report</h3>
              <p className="text-sm text-slate-400 mt-1 mb-4">Parse a new IdentityIQ credit report</p>
              <Button
                onClick={() => router.push("/reports")}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Upload PDF
              </Button>
            </div>
          </div>

          {/* Dispute Flow Reference */}
          <div className="rounded-2xl bg-slate-800/40 border border-slate-700/50 p-5">
            <h3 className="font-semibold text-white text-sm uppercase tracking-wide text-slate-400 mb-4">
              Dispute Flow
            </h3>
            <div className="space-y-3">
              {disputeFlows.map((flow) => (
                <div key={flow.name} className="flex items-center justify-between">
                  <span className="text-white">{flow.name}</span>
                  <span className="text-sm text-slate-500">{flow.rounds}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Needs Review Alert */}
          {needsReviewCount > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl bg-red-500/10 border border-red-500/20 p-5"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-400">Needs Review</h3>
                  <p className="text-sm text-red-300/70 mt-1">
                    {needsReviewCount} account{needsReviewCount !== 1 ? "s" : ""} flagged with low confidence scores
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Subscription Prompt for Free Users */}
      {subscriptionTier === "FREE" && (
        <motion.div
          variants={itemVariants}
          className="rounded-2xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/20 p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Upgrade to Pro</h3>
              <p className="text-slate-300 mt-1">
                Unlock report uploads, AI dispute generation, and CFPB complaint tools.
              </p>
            </div>
            <Button
              onClick={() => router.push("/billing")}
              className="bg-white text-slate-900 hover:bg-slate-100"
            >
              View Plans
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
