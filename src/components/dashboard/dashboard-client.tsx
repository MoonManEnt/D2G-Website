"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  FileText,
  Scale,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  LucideIcon,
  Bell,
} from "lucide-react";
import { ReminderList } from "@/components/reminders";
import { FCRAAlerts } from "./fcra-alerts";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
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

const cardHoverVariants = {
  hover: {
    scale: 1.02,
    y: -4,
    transition: { duration: 0.2 },
  },
  tap: {
    scale: 0.98,
    transition: { duration: 0.1 },
  },
};

const quickActionVariants = {
  hover: {
    scale: 1.05,
    backgroundColor: "rgba(51, 65, 85, 1)",
    transition: { duration: 0.2 },
  },
  tap: {
    scale: 0.95,
  },
};

// Animated counter component
function AnimatedNumber({ value }: { value: number }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, type: "spring" }}
    >
      {value.toLocaleString()}
    </motion.span>
  );
}

// Icon map
const iconMap: Record<string, LucideIcon> = {
  Users,
  FileText,
  Scale,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
};

interface StatCard {
  title: string;
  value: number;
  icon: string;
  color: string;
  bgColor: string;
  href: string;
}

interface ActivityEvent {
  id: string;
  eventType: string;
  createdAt: Date;
  actor?: { name: string } | null;
}

interface DashboardClientProps {
  userName: string;
  statCards: StatCard[];
  needsReviewCount: number;
  recentActivity: ActivityEvent[];
  subscriptionTier: string;
}

export function DashboardClient({
  userName,
  statCards,
  needsReviewCount,
  recentActivity,
  subscriptionTier,
}: DashboardClientProps) {
  const formatEventType = (type: string) => {
    return type
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <motion.div
      className="space-y-6 lg:ml-64 pt-16 lg:pt-0"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-1">
          Welcome back, <span className="text-white">{userName}</span>
        </p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={containerVariants}
      >
        {statCards.map((stat, index) => {
          const Icon = iconMap[stat.icon] || AlertTriangle;
          return (
            <motion.a
              key={stat.title}
              href={stat.href}
              variants={itemVariants}
              whileHover="hover"
              whileTap="tap"
              custom={index}
            >
              <motion.div variants={cardHoverVariants}>
                <Card className="bg-slate-800/50 border-slate-700 hover:border-slate-500 transition-colors cursor-pointer overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-400">{stat.title}</p>
                        <p className="text-3xl font-bold text-white mt-1">
                          <AnimatedNumber value={stat.value} />
                        </p>
                      </div>
                      <motion.div
                        className={`p-3 rounded-full ${stat.bgColor}`}
                        whileHover={{ rotate: 10, scale: 1.1 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <Icon className={`w-6 h-6 ${stat.color}`} />
                      </motion.div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.a>
          );
        })}
      </motion.div>

      {/* FCRA Compliance Alerts */}
      <motion.div variants={itemVariants}>
        <FCRAAlerts />
      </motion.div>

      {/* Needs Review Alert */}
      {needsReviewCount > 0 && (
        <motion.div
          variants={itemVariants}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="bg-amber-500/10 border-amber-500/20 overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent"
              animate={{
                x: ["-100%", "100%"],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear",
              }}
            />
            <CardContent className="p-4 relative">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </motion.div>
                <div>
                  <p className="font-medium text-amber-200">
                    {needsReviewCount} account{needsReviewCount !== 1 ? "s" : ""} need review
                  </p>
                  <p className="text-sm text-amber-300/70">
                    Low confidence parses require specialist confirmation before disputes can be generated.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <motion.div variants={itemVariants}>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Activity
              </CardTitle>
              <CardDescription className="text-slate-400">
                Latest actions in your organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <motion.div
                className="space-y-4"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {recentActivity.length === 0 ? (
                  <p className="text-slate-500 text-sm">No recent activity</p>
                ) : (
                  recentActivity.map((event, index) => (
                    <motion.div
                      key={event.id}
                      className="flex items-start gap-3"
                      variants={itemVariants}
                      custom={index}
                    >
                      <motion.div
                        className="w-2 h-2 rounded-full bg-primary mt-2"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: index * 0.1 + 0.5 }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">
                          {formatEventType(event.eventType)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {event.actor?.name || "System"} • {formatTimeAgo(event.createdAt)}
                        </p>
                      </div>
                    </motion.div>
                  ))
                )}
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={itemVariants}>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Quick Actions
              </CardTitle>
              <CardDescription className="text-slate-400">
                Common tasks and workflows
              </CardDescription>
            </CardHeader>
            <CardContent>
              <motion.div
                className="grid grid-cols-2 gap-3"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {[
                  { href: "/reports", icon: FileText, color: "text-brand-success", label: "Upload Report" },
                  { href: "/negative-items", icon: AlertTriangle, color: "text-brand-error", label: "Negative Items" },
                  { href: "/evidence", icon: FileText, color: "text-brand-warning", label: "Evidence Gallery" },
                  { href: "/disputes", icon: Scale, color: "text-brand-accent", label: "Create Dispute" },
                ].map((action, index) => (
                  <motion.a
                    key={action.href}
                    href={action.href}
                    className="p-4 rounded-lg bg-slate-700/50 text-center"
                    variants={itemVariants}
                    whileHover="hover"
                    whileTap="tap"
                    custom={index}
                  >
                    <motion.div variants={quickActionVariants}>
                      <motion.div
                        whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                        transition={{ duration: 0.3 }}
                      >
                        <action.icon className={`w-8 h-8 mx-auto ${action.color}`} />
                      </motion.div>
                      <p className="text-sm font-medium text-white mt-2">{action.label}</p>
                    </motion.div>
                  </motion.a>
                ))}
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Reminders Section */}
      <motion.div variants={itemVariants}>
        <ReminderList showStats={false} compact={true} />
      </motion.div>

      {/* Subscription Status */}
      {subscriptionTier === "FREE" && (
        <motion.div
          variants={itemVariants}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card className="bg-gradient-to-r from-primary/20 to-purple-500/20 border-primary/30 overflow-hidden relative">
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
              animate={{
                x: ["-100%", "100%"],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear",
                repeatDelay: 3,
              }}
            />
            <CardContent className="p-6 relative">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Upgrade to Pro</h3>
                  <p className="text-slate-300 mt-1">
                    Unlock report uploads, dispute generation, and evidence tools.
                  </p>
                </div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Badge variant="outline" className="text-primary border-primary cursor-pointer">
                    Free Plan
                  </Badge>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
