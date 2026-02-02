"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Target, Zap, Shield, BarChart3, PieChart } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DNAData {
  clientId: string;
  clientName: string;
  generatedAt: string;
  classification: string;
  classificationDescription: string;
  scores: {
    current: { TU: number | null; EX: number | null; EQ: number | null };
    average: number;
    trend: string;
    potential: number;
    potentialTimeline: string;
  };
  metrics: {
    overallHealth: number;
    paymentHistory: number;
    creditUtilization: number;
    creditAge: number;
    creditMix: number;
    newCredit: number;
  };
  improvement: {
    score: number;
    factors: Array<{ factor: string; impact: string; probability: number }>;
    totalPotential: string;
  };
  urgency: {
    score: number;
    level: string;
    reasons: string[];
  };
  accountBreakdown: {
    total: number;
    positive: number;
    negative: number;
    collections: number;
    chargeoffs: number;
    latePayments: number;
  };
  strategy: {
    recommendedFlow: string;
    priorityAccounts: string[];
    approach: string;
    estimatedRounds: string;
    cfpbRecommended: boolean;
  };
  riskFactors: Array<{ type: string; factor: string }>;
}

const CLASSIFICATION_CONFIG: Record<string, { color: string; icon: string; bg: string }> = {
  PRIME: { color: "text-emerald-400", icon: "diamond", bg: "from-emerald-500/20 to-emerald-600/10" },
  NEAR_PRIME: { color: "text-green-400", icon: "sparkles", bg: "from-green-500/20 to-green-600/10" },
  REBUILDER: { color: "text-amber-400", icon: "hammer", bg: "from-amber-500/20 to-amber-600/10" },
  SUBPRIME: { color: "text-red-400", icon: "flame", bg: "from-red-500/20 to-red-600/10" },
  THIN_FILE: { color: "text-purple-400", icon: "file", bg: "from-purple-500/20 to-purple-600/10" },
};

export default function CreditDNAPage() {
  const params = useParams();
  const router = useRouter();
  const [dna, setDna] = useState<DNAData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clientId = params.id as string;

  useEffect(() => {
    fetchDNA();
  }, [clientId]);

  const fetchDNA = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clients/" + clientId + "/dna");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setDna(data);
    } catch (err) {
      setError("Failed to load Credit DNA");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (error || !dna) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || "No data available"}</p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  const config = CLASSIFICATION_CONFIG[dna.classification] || CLASSIFICATION_CONFIG.REBUILDER;
  const scorePercent = ((dna.scores.average - 300) / 550) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background text-foreground p-6">
      {/* Ambient glow */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
      
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()}
            className="p-2 rounded-lg bg-card hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              Credit DNA
            </h1>
            <p className="text-muted-foreground text-sm">{dna.clientName}</p>
          </div>
        </div>
        <Button onClick={fetchDNA} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Regenerate
        </Button>
      </header>

      {/* Classification Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={"relative z-10 rounded-2xl p-6 mb-6 bg-gradient-to-br " + config.bg + " border border-border backdrop-blur-xl"}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={"w-16 h-16 rounded-xl bg-gradient-to-br " + config.bg + " flex items-center justify-center text-3xl"}>
              {dna.classification === "PRIME" ? "💎" : 
               dna.classification === "NEAR_PRIME" ? "✨" :
               dna.classification === "REBUILDER" ? "🔨" :
               dna.classification === "SUBPRIME" ? "🔥" : "📄"}
            </div>
            <div>
              <h2 className={"text-2xl font-bold " + config.color}>
                {dna.classification.replace("_", " ")}
              </h2>
              <p className="text-muted-foreground text-sm max-w-md">{dna.classificationDescription}</p>
            </div>
          </div>

          {/* Score Circle */}
          <div className="relative w-32 h-32">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#1e293b" strokeWidth="8" />
              <circle 
                cx="50" cy="50" r="42" fill="none"
                stroke={dna.scores.average >= 670 ? "#10b981" : dna.scores.average >= 580 ? "#f59e0b" : "#ef4444"}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={264 * scorePercent / 100 + " 264"}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold">{dna.scores.average}</span>
              <span className="text-xs text-muted-foreground">AVG SCORE</span>
            </div>
          </div>
        </div>

        {/* Bureau Scores */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[
            { label: "TransUnion", key: "TU", color: "bg-sky-500" },
            { label: "Experian", key: "EX", color: "bg-blue-500" },
            { label: "Equifax", key: "EQ", color: "bg-red-500" },
          ].map((bureau) => (
            <div key={bureau.key} className="bg-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={"w-2 h-2 rounded-full " + bureau.color} />
                <span className="text-xs text-muted-foreground">{bureau.label}</span>
              </div>
              <span className="text-2xl font-bold">
                {dna.scores.current[bureau.key as keyof typeof dna.scores.current] || "—"}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Main Grid */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card backdrop-blur-xl border border-border rounded-2xl p-6"
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            Health Metrics
          </h3>
          <div className="space-y-4">
            {[
              { label: "Overall Health", value: dna.metrics.overallHealth, color: "bg-purple-500" },
              { label: "Payment History", value: dna.metrics.paymentHistory, color: "bg-emerald-500" },
              { label: "Credit Utilization", value: dna.metrics.creditUtilization, color: "bg-blue-500" },
              { label: "Credit Age", value: dna.metrics.creditAge, color: "bg-amber-500" },
              { label: "Credit Mix", value: dna.metrics.creditMix, color: "bg-pink-500" },
              { label: "New Credit", value: dna.metrics.newCredit, color: "bg-cyan-500" },
            ].map((metric) => (
              <div key={metric.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{metric.label}</span>
                  <span className="font-medium">{metric.value}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={metric.color + " h-full rounded-full transition-all duration-500"}
                    style={{ width: metric.value + "%" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Improvement Potential */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card backdrop-blur-xl border border-border rounded-2xl p-6"
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Improvement Potential
          </h3>
          <div className="text-center mb-6">
            <span className="text-4xl font-bold text-emerald-400">{dna.improvement.score}%</span>
            <p className="text-muted-foreground text-sm mt-1">Potential: {dna.improvement.totalPotential}</p>
          </div>
          <div className="space-y-3">
            {dna.improvement.factors.map((factor, i) => (
              <div key={i} className="bg-muted rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">{factor.factor}</span>
                  <span className="text-emerald-400 text-sm font-medium">{factor.impact}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: factor.probability + "%" }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{factor.probability}%</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Urgency & Strategy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card backdrop-blur-xl border border-border rounded-2xl p-6"
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Urgency & Strategy
          </h3>
          
          {/* Urgency Meter */}
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Urgency Level</span>
              <span className={"font-semibold " + (dna.urgency.level === "HIGH" ? "text-red-400" : dna.urgency.level === "MEDIUM" ? "text-amber-400" : "text-emerald-400")}>
                {dna.urgency.level}
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div 
                className={"h-full rounded-full " + (dna.urgency.score > 70 ? "bg-red-500" : dna.urgency.score > 40 ? "bg-amber-500" : "bg-emerald-500")}
                style={{ width: dna.urgency.score + "%" }}
              />
            </div>
            <div className="mt-3 space-y-1">
              {dna.urgency.reasons.map((reason, i) => (
                <p key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                  <AlertTriangle className="w-3 h-3 mt-0.5 text-amber-400 flex-shrink-0" />
                  {reason}
                </p>
              ))}
            </div>
          </div>

          {/* Strategy */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Recommended Flow</span>
            </div>
            <div className={"inline-block px-3 py-1 rounded-lg text-sm font-medium " + (dna.strategy.recommendedFlow === "COLLECTION" ? "bg-red-500/20 text-red-400" : "bg-primary/20 text-primary")}>
              {dna.strategy.recommendedFlow}
            </div>
            <p className="text-xs text-muted-foreground mt-3">{dna.strategy.approach}</p>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span>Est. {dna.strategy.estimatedRounds}</span>
              {dna.strategy.cfpbRecommended && (
                <span className="flex items-center gap-1 text-purple-400">
                  <Shield className="w-3 h-3" />
                  CFPB Recommended
                </span>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Account Breakdown & Risk Factors */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Account Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card backdrop-blur-xl border border-border rounded-2xl p-6"
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-primary" />
            Account Breakdown
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total", value: dna.accountBreakdown.total, color: "text-foreground" },
              { label: "Positive", value: dna.accountBreakdown.positive, color: "text-emerald-400" },
              { label: "Negative", value: dna.accountBreakdown.negative, color: "text-red-400" },
              { label: "Collections", value: dna.accountBreakdown.collections, color: "text-amber-400" },
              { label: "Charge-offs", value: dna.accountBreakdown.chargeoffs, color: "text-orange-400" },
              { label: "Late Payments", value: dna.accountBreakdown.latePayments, color: "text-yellow-400" },
            ].map((item) => (
              <div key={item.label} className="bg-muted rounded-lg p-3 text-center">
                <span className={"text-2xl font-bold " + item.color}>{item.value}</span>
                <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Risk Factors */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-card backdrop-blur-xl border border-border rounded-2xl p-6"
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            Risk & Opportunity Factors
          </h3>
          <div className="space-y-3">
            {dna.riskFactors.map((rf, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={"w-2 h-2 rounded-full mt-1.5 flex-shrink-0 " + (rf.type === "positive" ? "bg-emerald-500" : rf.type === "negative" ? "bg-red-500" : "bg-slate-500")} />
                <span className="text-sm text-muted-foreground">{rf.factor}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Priority Accounts */}
      {dna.strategy.priorityAccounts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="relative z-10 mt-6 bg-card backdrop-blur-xl border border-border rounded-2xl p-6"
        >
          <h3 className="text-lg font-semibold mb-4">Priority Accounts</h3>
          <div className="flex flex-wrap gap-2">
            {dna.strategy.priorityAccounts.map((account, i) => (
              <span key={i} className="px-3 py-1.5 bg-muted rounded-lg text-sm">
                {i + 1}. {account}
              </span>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
