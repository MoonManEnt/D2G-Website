"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, User, FileText, AlertTriangle, Scale, Upload, Phone, Mail, MapPin,
  Calendar, Edit, Loader2, ShieldAlert, CheckCircle, TrendingUp, Dna, Activity,
  Target, Zap, RefreshCw, ChevronRight, ChevronDown, ChevronUp, BarChart3,
  Shield, Clock, Lightbulb, Trash2, Download, History, Eye, EyeOff,
} from "lucide-react";
import { ScoreChart, AddScoreModal, OrbitalViz } from "@/components/credit-scores";
import { GlassCard, AnimNum, Reveal, ProgressRing } from "@/components/ui/glass-card";
import { useToast } from "@/lib/use-toast";
import { DisputeCommandCenter } from "@/components/disputes/dispute-command-center";
import { AmeliaChatDrawer } from "@/components/amelia/amelia-chat-drawer";
import { GoalTracker } from "@/components/client/goal-tracker";
import {
  getDNAClassificationLabel,
  getDNAClassificationDescription,
  getDNARecommendedStrategy,
  type CreditDNAProfile,
  type DNAClassification,
} from "@/lib/credit-dna";

// ═══════════════════════════════════════════════════════════
// D2G ATLAS COMMAND CENTER - Client Detail Page v2
// ═══════════════════════════════════════════════════════════

// Safe date formatting helpers
const safeFormatDate = (dateInput: string | Date | null | undefined, fallback: string = "Unknown"): string => {
  if (!dateInput) return fallback;
  try {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) return fallback;
    return date.toLocaleDateString();
  } catch {
    return fallback;
  }
};

const safeFormatDateTime = (dateInput: string | Date | null | undefined, fallback: string = "Unknown"): string => {
  if (!dateInput) return fallback;
  try {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) return fallback;
    return `${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
  } catch {
    return fallback;
  }
};

// ═══ TYPES ═══
interface ClientData {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  ssnLast4: string | null;
  dateOfBirth: string | null;
  notes: string | null;
  sentryModeEnabled?: boolean;
  createdAt: string;
  reports: Array<{
    id: string;
    reportType: string;
    reportDate: string | null;
    parseStatus: string;
    parseError: string | null;
    createdAt: string;
    originalFile: { id: string; filename: string; mimeType: string; sizeBytes: number } | null;
    _count: { accounts: number };
  }>;
  accounts: Array<{
    id: string;
    creditorName: string;
    maskedAccountId: string | null;
    cra: string;
    accountStatus: string;
    balance: number | null;
    pastDue: number | null;
    issueCount: number;
    detectedIssues: string | null;
    suggestedFlow: string | null;
    sourcePageNum: number | null;
    reportId: string;
  }>;
  disputes: Array<{
    id: string;
    status: string;
    cra: string;
    round: number;
    flow: string;
    sentDate: string | null;
    createdAt: string;
  }>;
}

interface Summary {
  totalReports: number;
  totalAccounts: number;
  totalDisputes: number;
  negativeItems: number;
  highSeverityIssues: number;
}

interface CreditScore {
  id: string;
  cra: string;
  score: number;
  scoreDate: string;
  scoreType: string;
  factorsPositive?: string;
  factorsNegative?: string;
}

interface ScoreStats {
  latest: Record<string, number>;
  change30Days: Record<string, number>;
  change90Days: Record<string, number>;
  highest: Record<string, number>;
  lowest: Record<string, number>;
}

interface ChartDataPoint {
  date: string;
  TRANSUNION?: number;
  EXPERIAN?: number;
  EQUIFAX?: number;
}

// ═══ COLOR HELPERS ═══
const scoreHealthColor = (score: number) =>
  score >= 700 ? "text-emerald-400" : score >= 600 ? "text-amber-400" : score >= 500 ? "text-orange-400" : "text-red-400";

const scoreHealthBg = (score: number) =>
  score >= 700 ? "bg-emerald-500/10 border-emerald-500/20" :
  score >= 600 ? "bg-amber-500/10 border-amber-500/20" :
  score >= 500 ? "bg-orange-500/10 border-orange-500/20" : "bg-red-500/10 border-red-500/20";

function getCRABadgeStyle(cra: string): string {
  const styles: Record<string, string> = {
    TRANSUNION: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    EXPERIAN: "bg-violet-500/20 text-violet-400 border-violet-500/30",
    EQUIFAX: "bg-rose-500/20 text-rose-400 border-rose-500/30",
  };
  return styles[cra] || "bg-muted/50 text-muted-foreground border-border";
}

// DNA Color Helpers
function getDNABorderColor(classification: DNAClassification): string {
  const colors: Record<DNAClassification, string> = {
    THIN_FILE_REBUILDER: "border-amber-500/50", THICK_FILE_DEROG: "border-red-500/50",
    CLEAN_THIN: "border-green-500/50", COLLECTION_HEAVY: "border-red-500/50",
    LATE_PAYMENT_PATTERN: "border-orange-500/50", MIXED_FILE: "border-blue-500/50",
    INQUIRY_DAMAGED: "border-purple-500/50", CHARGE_OFF_HEAVY: "border-red-500/50",
    IDENTITY_ISSUES: "border-yellow-500/50", HIGH_UTILIZATION: "border-orange-500/50",
    RECOVERING: "border-emerald-500/50", NEAR_PRIME: "border-teal-500/50",
  };
  return colors[classification];
}

function getDNABgColor(classification: DNAClassification): string {
  const colors: Record<DNAClassification, string> = {
    THIN_FILE_REBUILDER: "bg-amber-500/20", THICK_FILE_DEROG: "bg-red-500/20",
    CLEAN_THIN: "bg-green-500/20", COLLECTION_HEAVY: "bg-red-500/20",
    LATE_PAYMENT_PATTERN: "bg-orange-500/20", MIXED_FILE: "bg-blue-500/20",
    INQUIRY_DAMAGED: "bg-purple-500/20", CHARGE_OFF_HEAVY: "bg-red-500/20",
    IDENTITY_ISSUES: "bg-yellow-500/20", HIGH_UTILIZATION: "bg-orange-500/20",
    RECOVERING: "bg-emerald-500/20", NEAR_PRIME: "bg-teal-500/20",
  };
  return colors[classification];
}

function getDNAIconColor(classification: DNAClassification): string {
  const colors: Record<DNAClassification, string> = {
    THIN_FILE_REBUILDER: "text-amber-400", THICK_FILE_DEROG: "text-red-400",
    CLEAN_THIN: "text-green-400", COLLECTION_HEAVY: "text-red-400",
    LATE_PAYMENT_PATTERN: "text-orange-400", MIXED_FILE: "text-blue-400",
    INQUIRY_DAMAGED: "text-purple-400", CHARGE_OFF_HEAVY: "text-red-400",
    IDENTITY_ISSUES: "text-yellow-400", HIGH_UTILIZATION: "text-orange-400",
    RECOVERING: "text-emerald-400", NEAR_PRIME: "text-teal-400",
  };
  return colors[classification];
}

function getDNABadgeColor(level: "LOW" | "MEDIUM" | "HIGH"): string {
  return { LOW: "bg-red-500/20 text-red-400", MEDIUM: "bg-amber-500/20 text-amber-400", HIGH: "bg-green-500/20 text-green-400" }[level];
}

function getThicknessBadgeColor(thickness: string): string {
  const colors: Record<string, string> = {
    ULTRA_THIN: "bg-red-500/20 text-red-400", THIN: "bg-amber-500/20 text-amber-400",
    MODERATE: "bg-blue-500/20 text-blue-400", THICK: "bg-green-500/20 text-green-400",
    VERY_THICK: "bg-emerald-500/20 text-emerald-400",
  };
  return colors[thickness] || "bg-muted/50 text-muted-foreground";
}

function getSeverityBadgeColor(severity: string): string {
  const colors: Record<string, string> = {
    NONE: "bg-green-500/20 text-green-400", LIGHT: "bg-blue-500/20 text-blue-400",
    MODERATE: "bg-amber-500/20 text-amber-400", HEAVY: "bg-orange-500/20 text-orange-400",
    SEVERE: "bg-red-500/20 text-red-400",
  };
  return colors[severity] || "bg-muted/50 text-muted-foreground";
}

function getUtilBadgeColor(status: string): string {
  const colors: Record<string, string> = {
    EXCELLENT: "bg-green-500/20 text-green-400", GOOD: "bg-emerald-500/20 text-emerald-400",
    FAIR: "bg-amber-500/20 text-amber-400", POOR: "bg-orange-500/20 text-orange-400",
    CRITICAL: "bg-red-500/20 text-red-400",
  };
  return colors[status] || "bg-muted/50 text-muted-foreground";
}

function getInquiryBadgeColor(status: string): string {
  const colors: Record<string, string> = {
    MINIMAL: "bg-green-500/20 text-green-400", LIGHT: "bg-blue-500/20 text-blue-400",
    MODERATE: "bg-amber-500/20 text-amber-400", HEAVY: "bg-orange-500/20 text-orange-400",
    EXCESSIVE: "bg-red-500/20 text-red-400",
  };
  return colors[status] || "bg-muted/50 text-muted-foreground";
}

function getStrengthBadgeColor(strength: string): string {
  const colors: Record<string, string> = {
    WEAK: "bg-red-500/20 text-red-400", FAIR: "bg-amber-500/20 text-amber-400",
    MODERATE: "bg-blue-500/20 text-blue-400", STRONG: "bg-green-500/20 text-green-400",
    EXCELLENT: "bg-emerald-500/20 text-emerald-400",
  };
  return colors[strength] || "bg-muted/50 text-muted-foreground";
}

function getComplexityBadgeColor(complexity: string): string {
  const colors: Record<string, string> = {
    SIMPLE: "bg-green-500/20 text-green-400", MODERATE: "bg-blue-500/20 text-blue-400",
    COMPLEX: "bg-amber-500/20 text-amber-400", VERY_COMPLEX: "bg-red-500/20 text-red-400",
  };
  return colors[complexity] || "bg-muted/50 text-muted-foreground";
}

// ═══════════════════════════════════════════════════════════
// ACTION TOOLBAR - Delete · Insights · Gavel
// ═══════════════════════════════════════════════════════════
function ActionToolbar({
  onDelete,
  onInsights,
  onGavel
}: {
  onDelete: () => void;
  onInsights: () => void;
  onGavel: () => void;
}) {
  const [hov, setHov] = useState<string | null>(null);

  const actions = [
    { id: "delete", icon: "🗑️", label: "Delete", color: "red" },
    { id: "insights", icon: "👁️", label: "Insights", color: "cyan" },
    { id: "gavel", icon: "⚖️", label: "Gavel", color: "purple" },
  ];

  const colorMap: Record<string, string> = {
    red: "border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50 text-red-400",
    cyan: "border-cyan-500/30 hover:bg-cyan-500/10 hover:border-cyan-500/50 text-cyan-400",
    purple: "border-purple-500/30 hover:bg-purple-500/10 hover:border-purple-500/50 text-purple-400",
  };

  const handleClick = (id: string) => {
    if (id === "delete") onDelete();
    else if (id === "insights") onInsights();
    else if (id === "gavel") onGavel();
  };

  return (
    <div className="flex gap-2">
      {actions.map(a => (
        <button
          key={a.id}
          onClick={() => handleClick(a.id)}
          onMouseEnter={() => setHov(a.id)}
          onMouseLeave={() => setHov(null)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm font-medium ${colorMap[a.color]} ${hov === a.id ? 'scale-[1.02]' : ''}`}
        >
          <span className="text-base">{a.icon}</span>
          <span>{a.label}</span>
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// GAVEL MODAL - Glassmorphic dispute flow picker with skeleton loading
// ═══════════════════════════════════════════════════════════
function GavelModal({
  client,
  onClose,
  onSelect
}: {
  client: ClientData;
  onClose: () => void;
  onSelect: (flowId: string) => void;
}) {
  const router = useRouter();
  const [hov, setHov] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const negItems = client.accounts.length;

  const flows = [
    {
      id: "disputes",
      icon: "✦",
      name: "Create Dispute",
      tagline: "AI-Powered Letters",
      color: "cyan",
      description: "AMELIA analyzes the credit report, identifies the strongest dispute angles, and generates legally-optimized letters with Kitchen Table voice.",
      features: ["AI-selected dispute reasons", "FCRA/CFPB compliance built-in", "Auto-deadline tracking", "Bureau response monitoring"],
      badge: "RECOMMENDED",
      loadingText: "Initializing AMELIA...",
      loadingSteps: ["Loading client profile", "Analyzing credit report", "Identifying dispute angles", "Preparing dispute interface"],
    },
  ];

  const colorStyles: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    cyan: { bg: "bg-cyan-500/5 hover:bg-cyan-500/10", border: "border-cyan-500/20 hover:border-cyan-500/40", text: "text-cyan-400", glow: "shadow-cyan-500/20" },
  };

  const handleFlowSelect = (flowId: string) => {
    setLoading(flowId);
    onSelect(flowId);

    // Navigate after showing loading state
    setTimeout(() => {
      router.push(`/disputes?clientId=${client.id}`);
    }, 1800);
  };

  // Skeleton Loading Screen
  if (loading) {
    const flow = flows.find(f => f.id === loading)!;
    const styles = colorStyles[flow.color];

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
        <div className="w-[500px] p-10 rounded-2xl bg-white/5 dark:bg-white/[0.03] backdrop-blur-2xl border border-white/10 shadow-2xl text-center">
          {/* Animated Icon */}
          <div className="relative mb-6">
            <div className={`w-20 h-20 mx-auto rounded-2xl ${styles.bg} border ${styles.border} flex items-center justify-center text-4xl animate-pulse`}>
              {flow.icon}
            </div>
            <div className={`absolute inset-0 w-20 h-20 mx-auto rounded-2xl ${styles.border} border-2 animate-ping opacity-30`} />
          </div>

          {/* Loading Text */}
          <h2 className={`text-xl font-bold mb-2 ${styles.text}`}>{flow.loadingText}</h2>
          <p className="text-sm text-muted-foreground mb-8">
            Preparing {flow.name} for <strong className="text-foreground">{client.firstName} {client.lastName}</strong>
          </p>

          {/* Skeleton Steps */}
          <div className="space-y-3 mb-8">
            {flow.loadingSteps.map((step, i) => (
              <div
                key={i}
                className="flex items-center gap-3 animate-in slide-in-from-left duration-300"
                style={{ animationDelay: `${i * 200}ms`, animationFillMode: 'both' }}
              >
                <div className={`w-5 h-5 rounded-full ${styles.bg} border ${styles.border} flex items-center justify-center`}>
                  <div className={`w-2 h-2 rounded-full ${styles.text.replace('text-', 'bg-')} animate-pulse`} />
                </div>
                <div className="flex-1 h-3 rounded bg-white/5 overflow-hidden">
                  <div
                    className={`h-full ${styles.text.replace('text-', 'bg-')} opacity-40 animate-pulse`}
                    style={{
                      width: `${Math.min(100, (i + 1) * 25)}%`,
                      animationDelay: `${i * 150}ms`
                    }}
                  />
                </div>
                <span className="text-xs text-muted-foreground font-mono w-20 text-left">{step.split(' ').slice(-1)[0]}</span>
              </div>
            ))}
          </div>

          {/* Progress Bar */}
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full ${styles.text.replace('text-', 'bg-')} rounded-full transition-all duration-[1800ms] ease-out`}
              style={{ width: '100%', animation: 'grow 1.8s ease-out forwards' }}
            />
          </div>
          <style jsx>{`
            @keyframes grow {
              from { width: 0%; }
              to { width: 100%; }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl animate-in fade-in duration-200"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-[600px] p-8 rounded-2xl bg-white/5 dark:bg-white/[0.03] backdrop-blur-2xl border border-white/10 shadow-2xl"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">⚖️</div>
          <h2 className="text-xl font-bold">Choose Dispute Flow</h2>
          <p className="text-sm text-muted-foreground mt-2">
            For <strong className="text-foreground">{client.firstName} {client.lastName}</strong> · {negItems} negative items
          </p>
        </div>

        {/* Flow cards */}
        <div className="space-y-3 mb-6">
          {flows.map(f => {
            const styles = colorStyles[f.color];
            return (
              <div
                key={f.id}
                onClick={() => handleFlowSelect(f.id)}
                onMouseEnter={() => setHov(f.id)}
                onMouseLeave={() => setHov(null)}
                className={`p-5 rounded-xl cursor-pointer transition-all duration-300 border ${styles.bg} ${styles.border} ${hov === f.id ? 'scale-[1.01] shadow-lg' : ''}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl ${styles.bg} border ${styles.border} flex items-center justify-center text-2xl flex-shrink-0`}>
                    {f.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-bold">{f.name}</span>
                      {f.badge && (
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${styles.bg} ${styles.text} font-mono tracking-wider`}>
                          {f.badge}
                        </span>
                      )}
                    </div>
                    <div className={`text-xs font-semibold ${styles.text} font-mono mb-2`}>{f.tagline}</div>
                    <p className="text-sm text-muted-foreground mb-3">{f.description}</p>
                    <div className="flex gap-2 flex-wrap">
                      {f.features.map((feat, i) => (
                        <span key={i} className={`text-[10px] px-2 py-1 rounded border ${styles.border} text-muted-foreground font-mono`}>
                          ✓ {feat}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className={`text-lg ${hov === f.id ? styles.text : 'text-muted-foreground'} transition-colors`}>→</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="text-center">
          <Button variant="ghost" onClick={onClose} className="text-muted-foreground">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SCORE ARC - SVG circular score display
// ═══════════════════════════════════════════════════════════
function ScoreArc({ score, color, size = 64, strokeW = 5 }: { score: number; color: string; size?: number; strokeW?: number }) {
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, (score - 300) / 550);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth={strokeW} className="text-muted/20" />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeW}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold font-mono">{score}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// BUREAU MINI - Inline bureau scores
// ═══════════════════════════════════════════════════════════
function BureauMini({ scores }: { scores: Record<string, number> }) {
  const bureaus = [
    { key: "TRANSUNION", abbr: "TU", color: "bg-cyan-400" },
    { key: "EXPERIAN", abbr: "EX", color: "bg-violet-400" },
    { key: "EQUIFAX", abbr: "EQ", color: "bg-rose-400" },
  ];

  return (
    <div className="flex gap-3 items-center">
      {bureaus.map(b => (
        <div key={b.key} className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${b.color}`} />
          <span className="text-[11px] text-muted-foreground font-mono">{b.abbr}</span>
          <span className="text-sm font-bold font-mono">{scores[b.key] || "—"}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// NEGATIVE ITEM CARD
// ═══════════════════════════════════════════════════════════
function NegativeItemCard({ account, onViewDetails }: { account: ClientData["accounts"][0]; onViewDetails: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const issues = account.detectedIssues ? JSON.parse(account.detectedIssues) : [];
  const visibleIssues = expanded ? issues : issues.slice(0, 2);
  const hiddenCount = issues.length - 2;

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "—";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <Card className="bg-card border-border hover:border-input/50 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="font-semibold text-foreground text-lg">{account.creditorName}</span>
              <Badge variant="outline" className={getCRABadgeStyle(account.cra)}>{account.cra}</Badge>
              {account.issueCount > 0 && <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{account.issueCount} Issues</Badge>}
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm mb-3">
              <div><span className="text-muted-foreground">Account: </span><span className="text-muted-foreground font-mono">{account.maskedAccountId || "N/A"}</span></div>
              <div><span className="text-muted-foreground">Status: </span><span className="text-red-400 font-medium">{account.accountStatus}</span></div>
              <div><span className="text-muted-foreground">Balance: </span><span className="text-muted-foreground">{formatCurrency(account.balance)}</span></div>
              <div><span className="text-muted-foreground">Past Due: </span><span className={account.pastDue && account.pastDue > 0 ? "text-red-400" : "text-muted-foreground"}>{formatCurrency(account.pastDue)}</span></div>
            </div>
            {issues.length > 0 && (
              <div className="space-y-1.5">
                {visibleIssues.map((issue: { severity: string; description: string }, idx: number) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Badge className={`text-[10px] px-1.5 py-0.5 flex-shrink-0 ${issue.severity === "HIGH" ? "bg-red-500/20 text-red-400" : issue.severity === "MEDIUM" ? "bg-amber-500/20 text-amber-400" : "bg-muted/50 text-muted-foreground"}`}>
                      {issue.severity}
                    </Badge>
                    <span className="text-sm text-muted-foreground leading-tight">{issue.description}</span>
                  </div>
                ))}
                {!expanded && hiddenCount > 0 && (
                  <button onClick={() => setExpanded(true)} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 mt-1">
                    +{hiddenCount} more <ChevronDown className="w-3 h-3" />
                  </button>
                )}
                {expanded && issues.length > 2 && (
                  <button onClick={() => setExpanded(false)} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 mt-1">
                    Show less <ChevronUp className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={onViewDetails} className="bg-card border-input hover:bg-muted text-foreground">
            View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════
export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const clientId = params.id as string;

  // State
  const [client, setClient] = useState<ClientData | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addScoreModalOpen, setAddScoreModalOpen] = useState(false);
  const [creditScores, setCreditScores] = useState<CreditScore[]>([]);
  const [scoreStats, setScoreStats] = useState<ScoreStats | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [dnaProfile, setDnaProfile] = useState<CreditDNAProfile | null>(null);
  const [dnaLoading, setDnaLoading] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", email: "", phone: "", addressLine1: "", city: "", state: "", zipCode: "", ssnLast4: "", dateOfBirth: "" });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [showSSN, setShowSSN] = useState(true);
  const [deleteReportDialogOpen, setDeleteReportDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<{ id: string; filename: string } | null>(null);
  const [deletingReport, setDeletingReport] = useState(false);

  // Atlas Command Center state
  const [page, setPage] = useState<"main" | "insights">("main");
  const [gavelModalOpen, setGavelModalOpen] = useState(false);
  const [gavelConfirm, setGavelConfirm] = useState<{ flow: string } | null>(null);

  // Fetch functions
  const fetchClient = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setClient(data.client);
        setSummary(data.summary);
        setEditForm({
          firstName: data.client.firstName, lastName: data.client.lastName,
          email: data.client.email || "", phone: data.client.phone || "",
          addressLine1: data.client.addressLine1 || "", city: data.client.city || "",
          state: data.client.state || "", zipCode: data.client.zipCode || "",
          ssnLast4: data.client.ssnLast4 || "",
          dateOfBirth: data.client.dateOfBirth ? data.client.dateOfBirth.split("T")[0] : "",
        });
      } else {
        toast({ title: "Error", description: "Client not found", variant: "destructive" });
        router.push("/clients");
      }
    } catch {
      toast({ title: "Error", description: "Failed to load client", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [clientId, router, toast]);

  const fetchCreditScores = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}/scores`);
      if (res.ok) {
        const data = await res.json();
        setCreditScores(data.scores || []);
        setScoreStats(data.stats || null);
        setChartData(data.chartData || []);
      }
    } catch { /* ignore */ }
  }, [clientId]);

  const fetchDNA = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}/dna`);
      if (res.ok) {
        const data = await res.json();
        if (data.profile) setDnaProfile(data.profile);
      }
    } catch { /* ignore */ }
  }, [clientId]);

  useEffect(() => {
    fetchClient();
    fetchCreditScores();
    fetchDNA();
  }, [fetchClient, fetchCreditScores, fetchDNA]);

  // Handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("clientId", clientId);
      const res = await fetch("/api/reports/upload", { method: "POST", body: formData });
      if (res.ok) {
        toast({ title: "Success", description: "Report uploaded. Parsing in progress..." });
        setTimeout(fetchClient, 3000);
      } else {
        const err = await res.json();
        toast({ title: "Upload Failed", description: err.error || "Could not upload report", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to upload report", variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        toast({ title: "Success", description: "Client updated" });
        setEditDialogOpen(false);
        fetchClient();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to update client", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to update client", variant: "destructive" });
    }
  };

  const handleDeleteClient = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Client Archived", description: "Client has been archived and can be restored within 90 days" });
        router.push("/clients");
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to delete client", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete client", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteReport = async () => {
    if (!reportToDelete) return;
    setDeletingReport(true);
    try {
      const res = await fetch(`/api/reports/${reportToDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Report Deleted", description: "Report and associated data have been removed" });
        setDeleteReportDialogOpen(false);
        setReportToDelete(null);
        fetchClient();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to delete report", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete report", variant: "destructive" });
    } finally {
      setDeletingReport(false);
    }
  };

  const generateDNA = async () => {
    setDnaLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/dna`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setDnaProfile(data.profile);
        toast({ title: "DNA Generated", description: "Credit DNA profile has been analyzed" });
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to generate DNA", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to generate DNA", variant: "destructive" });
    } finally {
      setDnaLoading(false);
    }
  };

  const handleGavelSelect = (flowId: string) => {
    setGavelModalOpen(false);
    setGavelConfirm({ flow: "Create Dispute" });
    setTimeout(() => setGavelConfirm(null), 3000);
    // Navigate to the disputes page
    router.push(`/disputes?clientId=${clientId}`);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Client not found</p>
      </div>
    );
  }

  // Calculate metrics
  const avgScore = scoreStats?.latest ? Math.round(Object.values(scoreStats.latest).reduce((a, b) => a + b, 0) / Object.values(scoreStats.latest).length) : 0;
  const clientInitials = `${client.firstName[0]}${client.lastName[0]}`.toUpperCase();

  // ═══════════════════════════════════════════════════════════
  // INSIGHTS PAGE
  // ═══════════════════════════════════════════════════════════
  if (page === "insights") {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
        <Button variant="outline" onClick={() => setPage("main")} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Client
        </Button>

        {/* Hero */}
        <GlassCard className="p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-gradient-radial from-amber-500/10 to-transparent blur-3xl pointer-events-none" />
          <div className="relative flex items-center gap-4 mb-6">
            <div className={`w-14 h-14 rounded-2xl ${scoreHealthBg(avgScore)} flex items-center justify-center text-xl font-bold ${scoreHealthColor(avgScore)} font-mono`}>
              {clientInitials}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{client.firstName} {client.lastName}</h1>
              <p className="text-sm text-muted-foreground">{client.email} · Client since {safeFormatDate(client.createdAt)}</p>
            </div>
            <div className="text-right">
              <div className={`text-4xl font-bold ${scoreHealthColor(avgScore)}`}>{avgScore || "—"}</div>
              <div className="text-[10px] text-muted-foreground font-mono tracking-wider">COMPOSITE AVG</div>
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { l: "Risk Level", v: dnaProfile?.classification ? "Moderate" : "Unknown", c: "text-amber-400" },
              { l: "Trajectory", v: scoreStats?.change30Days ? (Object.values(scoreStats.change30Days).reduce((a, b) => a + b, 0) > 0 ? "Ascending" : "Stable") : "Unknown", c: "text-emerald-400" },
              { l: "Est. Timeline", v: "4-6 months", c: "text-blue-400" },
              { l: "Success Rate", v: summary?.totalDisputes ? "72%" : "Pending", c: "text-green-400" },
              { l: "Round", v: client.disputes.length > 0 ? `Round ${Math.max(...client.disputes.map(d => d.round))}` : "Pre-Dispute", c: "text-amber-400" },
            ].map((k, i) => (
              <div key={i} className="p-3 rounded-xl bg-card/50 dark:bg-white/[0.02] border border-border text-center">
                <div className="text-[10px] text-muted-foreground font-mono mb-1">{k.l}</div>
                <div className={`text-sm font-bold ${k.c}`}>{k.v}</div>
              </div>
            ))}
          </div>
        </GlassCard>

        <div className="grid grid-cols-2 gap-4">
          {/* Bureau Analysis */}
          <GlassCard className="p-5">
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2">📊 Bureau Analysis</h3>
            {[
              { k: "TRANSUNION", name: "TransUnion", color: "cyan" },
              { k: "EQUIFAX", name: "Equifax", color: "rose" },
              { k: "EXPERIAN", name: "Experian", color: "violet" },
            ].map(b => {
              const score = scoreStats?.latest?.[b.k] || 0;
              const change = scoreStats?.change30Days?.[b.k] || 0;
              return (
                <div key={b.k} className={`flex items-center gap-3 mb-3 p-3 rounded-xl bg-${b.color}-500/5 border border-${b.color}-500/10`}>
                  <div className={`w-7 h-7 rounded-lg bg-${b.color}-500/20 border border-${b.color}-500/30 flex items-center justify-center text-[9px] font-bold text-${b.color}-400 font-mono`}>
                    {b.k.slice(0, 2)}
                  </div>
                  <div className="flex-1"><div className="text-sm font-medium">{b.name}</div></div>
                  <div className={`text-2xl font-bold text-${b.color}-400`}>{score || "—"}</div>
                  {change !== 0 && <span className={`text-sm font-bold ${change > 0 ? "text-green-400" : "text-red-400"}`}>{change > 0 ? "▲" : "▼"}{Math.abs(change)}</span>}
                </div>
              );
            })}
          </GlassCard>

          {/* Key Factors */}
          <GlassCard className="p-5">
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2">🔑 Key Factors</h3>
            {dnaProfile?.keyInsights?.slice(0, 4).map((f, i) => (
              <div key={i} className="flex gap-3 items-start mb-3">
                <div className={`w-6 h-6 rounded-md ${scoreHealthBg(avgScore)} flex items-center justify-center text-[10px] font-bold ${scoreHealthColor(avgScore)} font-mono`}>
                  {i + 1}
                </div>
                <span className="text-sm text-muted-foreground">{f}</span>
              </div>
            )) || <p className="text-sm text-muted-foreground">Generate DNA profile for insights</p>}
          </GlassCard>

          {/* AMELIA Note */}
          <GlassCard className="p-5 bg-gradient-to-br from-purple-500/5 to-cyan-500/5 border-purple-500/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center text-lg">✦</div>
              <span className="text-sm font-bold text-purple-400">AMELIA Analysis</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {dnaProfile?.summary || `${client.firstName}'s credit profile shows ${summary?.negativeItems || 0} negative items across the bureaus. Generate a DNA profile for detailed strategic recommendations.`}
            </p>
          </GlassCard>

          {/* Recommended Actions */}
          <GlassCard className="p-5">
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2">🎯 Recommended Actions</h3>
            {dnaProfile?.immediateActions?.slice(0, 4).map((o, i) => (
              <div key={i} className="flex gap-3 items-center p-2.5 rounded-lg bg-card/50 dark:bg-white/[0.02] border border-border mb-2 cursor-pointer hover:border-primary/30 transition-colors">
                <div className="w-5 h-5 rounded border border-border flex items-center justify-center flex-shrink-0" />
                <span className="text-sm text-muted-foreground flex-1">{o}</span>
                <span className="text-sm text-amber-400 font-semibold">→</span>
              </div>
            )) || <p className="text-sm text-muted-foreground">Generate DNA profile for recommendations</p>}
          </GlassCard>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // MAIN PAGE
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen relative">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-200px] right-[-100px] w-[600px] h-[600px] rounded-full bg-gradient-radial from-amber-500/5 to-transparent blur-3xl" />
        <div className="absolute bottom-[-100px] left-[-200px] w-[500px] h-[500px] rounded-full bg-gradient-radial from-cyan-500/5 to-transparent blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <Reveal delay={20}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push("/clients")} className="rounded-xl">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl ${scoreHealthBg(avgScore)} border-2 flex items-center justify-center text-xl font-bold ${scoreHealthColor(avgScore)} font-mono`}>
                  {clientInitials}
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{client.firstName} {client.lastName}</h1>
                  <p className="text-sm text-muted-foreground">Client since {safeFormatDate(client.createdAt)}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ActionToolbar
                onDelete={() => setDeleteDialogOpen(true)}
                onInsights={() => setPage("insights")}
                onGavel={() => setGavelModalOpen(true)}
              />
              <input type="file" id="file-upload" accept=".pdf,image/*" onChange={handleFileUpload} className="hidden" />
              <Button variant="outline" onClick={() => document.getElementById("file-upload")?.click()} disabled={uploading} className="gap-2">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Upload Report
              </Button>
              <Button variant="outline" onClick={() => setEditDialogOpen(true)} className="gap-2">
                <Edit className="w-4 h-4" /> Edit
              </Button>
            </div>
          </div>
        </Reveal>

        {/* Metric Strip */}
        <Reveal delay={60}>
          <div className="grid grid-cols-6 gap-3">
            {[
              { l: "Avg Score", v: avgScore || "—", icon: "📊", c: avgScore >= 700 ? "text-green-400" : avgScore >= 600 ? "text-amber-400" : "text-red-400" },
              { l: "Neg Items", v: summary?.negativeItems || 0, icon: "⚠️", c: "text-red-400" },
              { l: "Reports", v: client.reports.length, icon: "📁", c: "text-blue-400" },
              { l: "Disputes", v: summary?.totalDisputes || 0, icon: "⚖️", c: "text-purple-400" },
              { l: "Creditors", v: summary?.totalAccounts || 0, icon: "🏦", c: "text-muted-foreground" },
              { l: "Success", v: summary?.totalDisputes ? "72%" : "—", icon: "📈", c: "text-green-400" },
            ].map((m, i) => (
              <div key={i} className="p-4 rounded-xl bg-card/50 dark:bg-white/[0.025] border border-border flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-lg">{m.icon}</div>
                <div>
                  <div className={`text-xl font-bold ${m.c}`}>{m.v}</div>
                  <div className="text-[10px] text-muted-foreground font-mono tracking-wide">{m.l}</div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* Bureau Scores Row */}
        {scoreStats?.latest && (
          <Reveal delay={100}>
            <div className="grid grid-cols-3 gap-4">
              {[
                { k: "TRANSUNION", name: "TransUnion", color: "#06b6d4" },
                { k: "EXPERIAN", name: "Experian", color: "#a78bfa" },
                { k: "EQUIFAX", name: "Equifax", color: "#fb7185" },
              ].map(b => {
                const score = scoreStats.latest[b.k] || 0;
                const change = scoreStats.change30Days?.[b.k] || 0;
                return (
                  <GlassCard key={b.k} className="p-4 flex items-center gap-4">
                    <ScoreArc score={score} color={b.color} size={64} strokeW={5} />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-muted-foreground">{b.name}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold" style={{ color: b.color }}>{score}</span>
                        {change !== 0 && (
                          <span className={`text-sm font-bold ${change > 0 ? "text-green-400" : "text-red-400"}`}>
                            {change > 0 ? "▲" : "▼"}{Math.abs(change)}
                          </span>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          </Reveal>
        )}

        {/* Contact Info & DNA Summary */}
        <Reveal delay={140}>
          <div className="grid grid-cols-2 gap-4">
            {/* Contact */}
            <GlassCard className="p-5">
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2">👤 Contact Information</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /><span className="text-muted-foreground">{client.email || "—"}</span></div>
                <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /><span className="text-muted-foreground">{client.phone || "—"}</span></div>
                <div className="flex items-center gap-2 col-span-2"><MapPin className="w-4 h-4 text-muted-foreground" /><span className="text-muted-foreground">{client.addressLine1 ? `${client.addressLine1}, ${client.city}, ${client.state} ${client.zipCode}` : "—"}</span></div>
                <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-muted-foreground" /><span className="text-muted-foreground">DOB: {safeFormatDate(client.dateOfBirth)}</span></div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground font-mono">SSN: {showSSN ? `***-**-${client.ssnLast4 || "****"}` : "•••••••••"}</span>
                  <button onClick={() => setShowSSN(!showSSN)} className="text-muted-foreground hover:text-foreground">
                    {showSSN ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </GlassCard>

            {/* DNA Summary */}
            <GlassCard className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold flex items-center gap-2">🧬 Credit DNA</h3>
                <Button variant="ghost" size="sm" onClick={generateDNA} disabled={dnaLoading} className="text-xs">
                  {dnaLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                </Button>
              </div>
              {dnaProfile ? (
                <>
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${getDNABgColor(dnaProfile.classification)} border ${getDNABorderColor(dnaProfile.classification)} mb-3`}>
                    <Dna className={`w-4 h-4 ${getDNAIconColor(dnaProfile.classification)}`} />
                    <span className={`text-sm font-bold ${getDNAIconColor(dnaProfile.classification)}`}>
                      {getDNAClassificationLabel(dnaProfile.classification)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{getDNAClassificationDescription(dnaProfile.classification)}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Generate DNA profile for detailed analysis</p>
              )}
            </GlassCard>
          </div>
        </Reveal>

        {/* Tabs */}
        <Reveal delay={180}>
          <Tabs defaultValue="negative" className="flex-1">
            <TabsList className="bg-transparent border-b border-border p-0 h-auto flex-shrink-0 gap-0.5">
              {[
                { v: "negative", l: "Negative Items", c: summary?.negativeItems || 0 },
                { v: "reports", l: "Reports", c: client.reports.length },
                { v: "disputes", l: "Disputes", c: summary?.totalDisputes || 0 },
                { v: "scores", l: "Scores", c: null },
                { v: "dna", l: "Credit DNA", c: null },
                { v: "readiness", l: "Readiness", c: null },
                { v: "litigation", l: "Litigation", c: null },
              ].map(t => (
                <TabsTrigger
                  key={t.v}
                  value={t.v}
                  className="gap-1.5 px-4 py-2.5 rounded-none border-b-2 border-transparent data-[state=active]:border-amber-500 data-[state=active]:text-amber-400 data-[state=active]:bg-amber-500/10 text-muted-foreground hover:text-foreground text-sm font-medium transition-all -mb-px"
                >
                  {t.l}
                  {t.c !== null && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted font-mono">{t.c}</span>}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Negative Items Tab */}
            <TabsContent value="negative" className="mt-4">
              {client.accounts.length === 0 ? (
                <Card className="bg-card border-border">
                  <CardContent className="py-12 text-center">
                    <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
                    <h3 className="text-lg font-medium mt-4">No Negative Items Found</h3>
                    <p className="text-muted-foreground mt-2">Upload a credit report to analyze for issues</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {client.accounts.map(account => (
                    <NegativeItemCard key={account.id} account={account} onViewDetails={() => router.push(`/disputes?account=${account.id}`)} />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Reports Tab */}
            <TabsContent value="reports" className="mt-4">
              {client.reports.length === 0 ? (
                <Card className="bg-card border-border">
                  <CardContent className="py-12 text-center">
                    <FileText className="w-12 h-12 mx-auto text-muted-foreground/50" />
                    <h3 className="text-lg font-medium mt-4">No Reports</h3>
                    <p className="text-muted-foreground mt-2">Upload a credit report to get started</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <History className="w-5 h-5 text-muted-foreground" />
                    <h3 className="text-lg font-medium">Report History</h3>
                  </div>
                  <div className="relative">
                    <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />
                    {client.reports.map((report, index) => {
                      const isLatest = index === 0;
                      const formattedDate = safeFormatDateTime(report.createdAt);
                      const fileSize = report.originalFile?.sizeBytes ? (report.originalFile.sizeBytes / (1024 * 1024)).toFixed(2) + " MB" : "Unknown size";
                      return (
                        <div key={report.id} className="relative pl-12 pb-6 last:pb-0">
                          <div className={`absolute left-3 w-5 h-5 rounded-full border-2 flex items-center justify-center ${isLatest ? "bg-blue-500 border-blue-400" : report.parseStatus === "COMPLETED" ? "bg-green-500/20 border-green-500" : report.parseStatus === "FAILED" ? "bg-red-500/20 border-red-500" : "bg-amber-500/20 border-amber-500"}`}>
                            {isLatest && <div className="w-2 h-2 bg-white rounded-full" />}
                          </div>
                          <Card className={`bg-card border-border ${isLatest ? "ring-1 ring-primary/30" : ""}`}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-4 flex-1">
                                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${isLatest ? "bg-primary/20" : "bg-muted"}`}>
                                    <FileText className={`w-6 h-6 ${isLatest ? "text-primary" : "text-muted-foreground"}`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-medium truncate">{report.originalFile?.filename || "Credit Report"}</p>
                                      {isLatest && <Badge className="bg-primary/20 text-primary text-xs">Latest</Badge>}
                                      <Badge className={report.parseStatus === "COMPLETED" ? "bg-green-500/20 text-green-400" : report.parseStatus === "FAILED" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"}>
                                        {report.parseStatus}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formattedDate}</span>
                                      <span>•</span>
                                      <span>{fileSize}</span>
                                    </div>
                                    <div className="flex items-center gap-4 mt-2 text-sm">
                                      <span className="text-muted-foreground">Accounts parsed: <span className="font-medium">{report._count.accounts}</span></span>
                                    </div>
                                    {report.parseStatus === "FAILED" && report.parseError && <p className="mt-1 text-xs text-red-400">{report.parseError}</p>}
                                    {report.parseStatus === "FAILED" && (
                                      <Button size="sm" variant="outline" className="mt-2 gap-1.5 text-xs text-amber-400" onClick={async () => {
                                        const reparseRes = await fetch(`/api/reports/${report.id}/parse`, { method: "POST" });
                                        if (reparseRes.ok) {
                                          toast({ title: "Re-parsing", description: "Report is being re-parsed..." });
                                          setTimeout(fetchClient, 3000);
                                        }
                                      }}>
                                        <RefreshCw className="w-3 h-3" /> Re-parse Report
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {report.originalFile && (
                                    <Button size="sm" variant="outline" className="gap-1.5" onClick={async () => {
                                      const res = await fetch(`/api/files/${report.originalFile!.id}/download`);
                                      if (res.ok) {
                                        const data = await res.json();
                                        if (data.url) window.open(data.url, "_blank");
                                      }
                                    }}>
                                      <Download className="w-4 h-4" /> Download
                                    </Button>
                                  )}
                                  <Button size="sm" variant="outline" className="gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => {
                                    setReportToDelete({ id: report.id, filename: report.originalFile?.filename || "Credit Report" });
                                    setDeleteReportDialogOpen(true);
                                  }}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Disputes Tab */}
            <TabsContent value="disputes" className="mt-4">
              <DisputeCommandCenter
                clientId={clientId}
                accounts={client.accounts.map(a => ({
                  id: a.id, creditorName: a.creditorName, maskedAccountId: a.maskedAccountId,
                  accountType: null, accountStatus: a.accountStatus, balance: a.balance,
                  cra: a.cra, detectedIssues: a.detectedIssues, issueCount: a.issueCount,
                }))}
                existingDisputes={client.disputes.map(d => ({
                  id: d.id, cra: d.cra, round: d.round, status: d.status,
                  flow: d.flow, sentDate: d.sentDate || undefined, createdAt: d.createdAt,
                }))}
                onDisputeCreated={fetchClient}
              />
            </TabsContent>

            {/* Scores Tab */}
            <TabsContent value="scores" className="mt-4">
              {scoreStats ? (
                <ScoreChart scores={creditScores} stats={scoreStats} chartData={chartData} onAddScore={() => setAddScoreModalOpen(true)} />
              ) : (
                <Card className="bg-card border-border">
                  <CardContent className="py-12 text-center">
                    <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground/50" />
                    <h3 className="text-lg font-medium mt-4">No Credit Scores</h3>
                    <p className="text-muted-foreground mt-2">Track credit score changes over time</p>
                    <Button className="mt-4" onClick={() => setAddScoreModalOpen(true)}>Add First Score</Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* DNA Tab */}
            <TabsContent value="dna" className="mt-4">
              {dnaProfile ? (
                <div className="space-y-4">
                  <Card className={`bg-card/50 border-2 ${getDNABorderColor(dnaProfile.classification)}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${getDNABgColor(dnaProfile.classification)}`}>
                            <Dna className={`w-8 h-8 ${getDNAIconColor(dnaProfile.classification)}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h2 className="text-2xl font-bold">{getDNAClassificationLabel(dnaProfile.classification)}</h2>
                              <Badge className={getDNABadgeColor(dnaProfile.confidenceLevel)}>{dnaProfile.confidenceLevel} Confidence</Badge>
                            </div>
                            <p className="text-muted-foreground max-w-2xl">{getDNAClassificationDescription(dnaProfile.classification)}</p>
                          </div>
                        </div>
                        <Button variant="outline" onClick={generateDNA} disabled={dnaLoading}>
                          {dnaLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                          Refresh Analysis
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-card border-border"><CardContent className="p-4"><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /><span className="text-sm text-muted-foreground">Health Score</span></div><span className="text-2xl font-bold">{dnaProfile.overallHealthScore}</span></div><Progress value={dnaProfile.overallHealthScore} className="h-2" /></CardContent></Card>
                    <Card className="bg-card border-border"><CardContent className="p-4"><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><Target className="w-4 h-4 text-green-400" /><span className="text-sm text-muted-foreground">Improvement Potential</span></div><span className="text-2xl font-bold">{dnaProfile.improvementPotential}</span></div><Progress value={dnaProfile.improvementPotential} className="h-2 [&>div]:bg-green-500" /></CardContent></Card>
                    <Card className="bg-card border-border"><CardContent className="p-4"><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><Zap className="w-4 h-4 text-amber-400" /><span className="text-sm text-muted-foreground">Urgency Score</span></div><span className="text-2xl font-bold">{dnaProfile.urgencyScore}</span></div><Progress value={dnaProfile.urgencyScore} className="h-2 [&>div]:bg-amber-500" /></CardContent></Card>
                  </div>
                </div>
              ) : (
                <Card className="bg-card border-border">
                  <CardContent className="py-12 text-center">
                    <Dna className="w-12 h-12 mx-auto text-muted-foreground/50" />
                    <h3 className="text-lg font-medium mt-4">No DNA Profile</h3>
                    <p className="text-muted-foreground mt-2">Generate a Credit DNA profile for detailed analysis</p>
                    <Button className="mt-4" onClick={generateDNA} disabled={dnaLoading}>
                      {dnaLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Dna className="w-4 h-4 mr-2" />}
                      Generate DNA Profile
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Readiness Tab */}
            <TabsContent value="readiness" className="mt-4">
              <div className="bg-card/50 rounded-xl border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2"><Target className="w-5 h-5 text-primary" />Credit Readiness Analysis</h3>
                  <Link href={`/clients/${clientId}/readiness`} className="text-sm text-primary hover:text-primary/80 flex items-center gap-1">Full Analysis<ChevronRight className="w-4 h-4" /></Link>
                </div>
                <p className="text-muted-foreground text-sm mb-4">Analyze approval likelihood across different credit products.</p>
                <div className="grid grid-cols-3 gap-3">
                  {[{ label: "Mortgage", desc: "FICO 2/4/5" }, { label: "Auto Loan", desc: "FICO Auto 8" }, { label: "Credit Card", desc: "FICO Bankcard 8" }, { label: "Personal Loan", desc: "FICO 8" }, { label: "Business LOC", desc: "Highest Score" }, { label: "General", desc: "FICO 8 Baseline" }].map(p => (
                    <Link key={p.label} href={`/clients/${clientId}/readiness`} className="bg-muted/30 rounded-lg p-3 hover:bg-muted transition-colors">
                      <span className="text-sm font-medium">{p.label}</span>
                      <p className="text-xs text-muted-foreground mt-1">{p.desc}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Litigation Tab */}
            <TabsContent value="litigation" className="mt-4">
              <div className="bg-card/50 rounded-xl border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2"><Scale className="w-5 h-5 text-red-400" />Litigation Scanner</h3>
                  <Link href={`/clients/${clientId}/litigation`} className="text-sm text-primary hover:text-primary/80 flex items-center gap-1">Full Scanner<ChevronRight className="w-4 h-4" /></Link>
                </div>
                <p className="text-muted-foreground text-sm mb-4">Scan for actionable FCRA/FDCPA violations.</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-muted/30 rounded-lg p-4"><div className="flex items-center gap-2 mb-1"><Shield className="w-4 h-4 text-purple-400" /><span className="text-sm font-medium">FCRA Violations</span></div><p className="text-xs text-muted-foreground">Accuracy, furnisher duties, obsolete info</p></div>
                  <div className="bg-muted/30 rounded-lg p-4"><div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-primary" /><span className="text-sm font-medium">FDCPA Violations</span></div><p className="text-xs text-muted-foreground">False representations, wrong amounts</p></div>
                  <div className="bg-muted/30 rounded-lg p-4"><div className="flex items-center gap-2 mb-1"><Activity className="w-4 h-4 text-amber-400" /><span className="text-sm font-medium">Metro 2 Errors</span></div><p className="text-xs text-muted-foreground">Field inconsistencies, code errors</p></div>
                </div>
                <Link href={`/clients/${clientId}/litigation`} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors">
                  <Scale className="w-4 h-4" />Run Litigation Scan
                </Link>
              </div>
            </TabsContent>
          </Tabs>
        </Reveal>
      </div>

      {/* Goal Tracker - Sentry Mode */}
      {client?.sentryModeEnabled && (
        <Reveal delay={250}>
          <GoalTracker clientId={clientId} />
        </Reveal>
      )}

      {/* Modals */}
      <AddScoreModal open={addScoreModalOpen} onOpenChange={setAddScoreModalOpen} clientId={clientId} onScoreAdded={fetchCreditScores} />

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription className="text-muted-foreground">Update client information</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateClient} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>First Name</Label><Input value={editForm.firstName} onChange={e => setEditForm({ ...editForm, firstName: e.target.value })} className="bg-muted border-input" required /></div>
              <div className="space-y-2"><Label>Last Name</Label><Input value={editForm.lastName} onChange={e => setEditForm({ ...editForm, lastName: e.target.value })} className="bg-muted border-input" required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="bg-muted border-input" /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className="bg-muted border-input" /></div>
            </div>
            <div className="space-y-2"><Label>Address</Label><Input value={editForm.addressLine1} onChange={e => setEditForm({ ...editForm, addressLine1: e.target.value })} className="bg-muted border-input" placeholder="Street address" /></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label>City</Label><Input value={editForm.city} onChange={e => setEditForm({ ...editForm, city: e.target.value })} className="bg-muted border-input" /></div>
              <div className="space-y-2"><Label>State</Label><Input value={editForm.state} onChange={e => setEditForm({ ...editForm, state: e.target.value })} className="bg-muted border-input" maxLength={2} /></div>
              <div className="space-y-2"><Label>ZIP Code</Label><Input value={editForm.zipCode} onChange={e => setEditForm({ ...editForm, zipCode: e.target.value })} className="bg-muted border-input" maxLength={10} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" value={editForm.dateOfBirth} onChange={e => setEditForm({ ...editForm, dateOfBirth: e.target.value })} className="bg-muted border-input" /></div>
              <div className="space-y-2"><Label>SSN Last 4</Label><Input value={editForm.ssnLast4} onChange={e => setEditForm({ ...editForm, ssnLast4: e.target.value.replace(/\D/g, "").slice(0, 4) })} className="bg-muted border-input" placeholder="****" maxLength={4} /></div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={open => { setDeleteDialogOpen(open); if (!open) setDeleteConfirmText(""); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Trash2 className="w-5 h-5 text-red-400" />Delete Client</DialogTitle>
            <DialogDescription className="text-muted-foreground">This will archive the client and all their data. You can restore within 90 days.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm"><strong>Warning:</strong> This will archive:</p>
              <ul className="text-red-400/80 text-sm mt-2 list-disc list-inside space-y-1">
                <li>{summary?.totalReports || 0} credit reports</li>
                <li>{summary?.totalAccounts || 0} creditors</li>
                <li>{summary?.totalDisputes || 0} disputes</li>
              </ul>
            </div>
            <div className="space-y-2">
              <Label>Type <span className="font-mono text-red-400">DELETE</span> to confirm</Label>
              <Input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value.toUpperCase())} placeholder="Type DELETE" className="bg-muted border-input font-mono" />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => { setDeleteDialogOpen(false); setDeleteConfirmText(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteClient} disabled={deleteConfirmText !== "DELETE" || deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting...</> : <><Trash2 className="w-4 h-4 mr-2" />Delete Client</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Report Dialog */}
      <Dialog open={deleteReportDialogOpen} onOpenChange={open => { setDeleteReportDialogOpen(open); if (!open) setReportToDelete(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Trash2 className="w-5 h-5 text-red-400" />Delete Report</DialogTitle>
            <DialogDescription className="text-muted-foreground">Are you sure? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm font-medium">{reportToDelete?.filename}</p>
              <p className="text-red-400/80 text-sm mt-2">Deleting this report will also remove all parsed accounts.</p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => { setDeleteReportDialogOpen(false); setReportToDelete(null); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteReport} disabled={deletingReport} className="bg-red-600 hover:bg-red-700">
              {deletingReport ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting...</> : <><Trash2 className="w-4 h-4 mr-2" />Delete Report</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Gavel Modal */}
      {gavelModalOpen && client && <GavelModal client={client} onClose={() => setGavelModalOpen(false)} onSelect={handleGavelSelect} />}

      {/* Gavel Confirm Toast */}
      {gavelConfirm && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-green-500/10 border border-green-500/20 backdrop-blur-xl shadow-lg animate-in fade-in slide-in-from-bottom-4 flex items-center gap-3">
          <span className="text-lg">✅</span>
          <span className="text-sm font-medium">Launched <strong className="text-green-400">{gavelConfirm.flow}</strong></span>
        </div>
      )}

      {/* Amelia Chat Drawer */}
      <AmeliaChatDrawer clientId={clientId} clientName={client ? `${client.firstName} ${client.lastName}` : undefined} />
    </div>
  );
}
