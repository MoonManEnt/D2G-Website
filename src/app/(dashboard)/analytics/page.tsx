"use client";

import { useState, useEffect, useRef, useCallback, useReducer, createContext, useContext } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  TrendingUp,
  Users,
  CheckCircle2,
  Clock,
  Zap,
  Target,
  Scale,
  Send,
  ChevronDown,
  Download,
  Sparkles,
  Building2,
  GitBranch,
  Activity,
  Play,
  Pause,
  FileText,
} from "lucide-react";
import { createLogger } from "@/lib/logger";
import { cn } from "@/lib/utils";
const log = createLogger("analytics-page");

// ============================================================================
// Data Context for Live Updates
// ============================================================================

interface AnalyticsState {
  summary: {
    clientCount: number;
    totalDisputes: number;
    itemsDeleted: number;
    successRate: number;
    scoreImprovement: number;
    avgCompletionMonths: number;
  };
  letterFormat: {
    structured: { total: number; deleted: number; rate: number };
    conversational: { total: number; deleted: number; rate: number };
  };
  bureaus: Array<{
    id: string;
    name: string;
    sent: number;
    deleted: number;
    verified: number;
    color: string;
  }>;
  monthlyTrends: Array<{
    month: string;
    disputes: number;
    deleted: number;
  }>;
  pipeline: Array<{
    stage: string;
    count: number;
    color: string;
  }>;
  flows: Array<{
    name: string;
    sent: number;
    success: number;
    color: string;
  }>;
  rounds: Array<{
    name: string;
    sent: number;
    deleted: number;
  }>;
  ai: {
    totalRequests: number;
    totalCost: number;
    avgResponse: number;
    costPerRequest: number;
    breakdown: Array<{
      name: string;
      requests: number;
      percentage: number;
      color: string;
    }>;
    daily: number[];
    uptime: number;
  };
  fcra: Array<{
    label: string;
    value: number;
    color: string;
  }>;
  activity: Array<{
    id: number;
    user: string;
    action: string;
    time: string;
    avatar: string;
    source: string;
  }>;
  eventLog: Array<{
    id: number;
    msg: string;
    time: string;
  }>;
}

type AnalyticsAction =
  | { type: "SET_DATA"; payload: Partial<AnalyticsState> }
  | { type: "DISPUTE_SENT"; payload: { bureau: string; flow: string; source: string } }
  | { type: "ITEM_DELETED"; payload: { bureau: string; flow: string; source: string } }
  | { type: "AI_REQUEST"; payload: { feature: string } }
  | { type: "CLIENT_ADDED"; payload?: { name?: string } }
  | { type: "PIPELINE_ADVANCE"; payload: { from: string; to: string } }
  | { type: "FCRA_VIOLATION"; payload: { type: string } };

const INITIAL_STATE: AnalyticsState = {
  summary: {
    clientCount: 0,
    totalDisputes: 0,
    itemsDeleted: 0,
    successRate: 0,
    scoreImprovement: 0,
    avgCompletionMonths: 0,
  },
  letterFormat: {
    structured: { total: 0, deleted: 0, rate: 0 },
    conversational: { total: 0, deleted: 0, rate: 0 },
  },
  bureaus: [
    { id: "TU", name: "TRANSUNION", sent: 0, deleted: 0, verified: 0, color: "#06b6d4" },
    { id: "EX", name: "EXPERIAN", sent: 0, deleted: 0, verified: 0, color: "#a78bfa" },
    { id: "EQ", name: "EQUIFAX", sent: 0, deleted: 0, verified: 0, color: "#fb7185" },
  ],
  monthlyTrends: [],
  pipeline: [
    { stage: "Intake", count: 0, color: "#a855f7" },
    { stage: "Analysis", count: 0, color: "#60a5fa" },
    { stage: "Round 1", count: 0, color: "#06b6d4" },
    { stage: "Round 2", count: 0, color: "#34d399" },
    { stage: "Round 3", count: 0, color: "#fbbf24" },
    { stage: "Round 4", count: 0, color: "#f59e0b" },
    { stage: "Maintenance", count: 0, color: "#fb7185" },
    { stage: "Completed", count: 0, color: "#22c55e" },
  ],
  flows: [
    { name: "ACCURACY", sent: 0, success: 0, color: "#60a5fa" },
    { name: "COLLECTION", sent: 0, success: 0, color: "#f87171" },
    { name: "CONSENT", sent: 0, success: 0, color: "#c084fc" },
    { name: "COMBO", sent: 0, success: 0, color: "#fbbf24" },
  ],
  rounds: [
    { name: "Round 1", sent: 0, deleted: 0 },
    { name: "Round 2", sent: 0, deleted: 0 },
    { name: "Round 3", sent: 0, deleted: 0 },
    { name: "Round 4", sent: 0, deleted: 0 },
  ],
  ai: {
    totalRequests: 0,
    totalCost: 0,
    avgResponse: 2.8,
    costPerRequest: 0.0004,
    breakdown: [
      { name: "Credit Analysis", requests: 0, percentage: 0, color: "#60a5fa" },
      { name: "Letter Generation", requests: 0, percentage: 0, color: "#a855f7" },
      { name: "Dispute Strategy", requests: 0, percentage: 0, color: "#34d399" },
      { name: "Score Prediction", requests: 0, percentage: 0, color: "#fbbf24" },
    ],
    daily: [],
    uptime: 99.9,
  },
  fcra: [
    { label: "Total Violations", value: 0, color: "#ef4444" },
    { label: "Failure to Respond", value: 0, color: "#fbbf24" },
    { label: "Inadequate Investigation", value: 0, color: "#a855f7" },
    { label: "CFPB Complaints", value: 0, color: "#06b6d4" },
  ],
  activity: [],
  eventLog: [],
};

// Recalculate derived values
function recalculateState(state: AnalyticsState): AnalyticsState {
  const totalSent = state.bureaus.reduce((a, b) => a + b.sent, 0);
  const totalDel = state.bureaus.reduce((a, b) => a + b.deleted, 0);

  state.summary.totalDisputes = totalSent;
  state.summary.itemsDeleted = totalDel;
  state.summary.successRate = totalSent > 0 ? Math.round((totalDel / totalSent) * 100) : 0;

  // Recalc letter format rates
  state.letterFormat.structured.rate = state.letterFormat.structured.total > 0
    ? Math.round((state.letterFormat.structured.deleted / state.letterFormat.structured.total) * 100) : 0;
  state.letterFormat.conversational.rate = state.letterFormat.conversational.total > 0
    ? Math.round((state.letterFormat.conversational.deleted / state.letterFormat.conversational.total) * 100) : 0;

  // Recalc AI breakdown percentages
  const aiTotal = state.ai.breakdown.reduce((a, b) => a + b.requests, 0);
  state.ai.totalRequests = aiTotal;
  state.ai.breakdown.forEach(b => {
    b.percentage = aiTotal > 0 ? Math.round((b.requests / aiTotal) * 100) : 0;
  });

  return state;
}

function analyticsReducer(state: AnalyticsState, action: AnalyticsAction): AnalyticsState {
  const now = new Date().toLocaleTimeString();
  const addLog = (msg: string) => [
    { id: Date.now(), msg, time: now },
    ...state.eventLog,
  ].slice(0, 20);

  switch (action.type) {
    case "SET_DATA":
      return { ...state, ...action.payload };

    case "DISPUTE_SENT": {
      const { bureau, flow, source } = action.payload;
      const s = { ...state };
      s.bureaus = s.bureaus.map(b => b.id === bureau ? { ...b, sent: b.sent + 1 } : b);
      s.flows = s.flows.map(f => f.name === flow ? { ...f, sent: f.sent + 1 } : f);
      s.monthlyTrends = s.monthlyTrends.length > 0
        ? [...s.monthlyTrends.slice(0, -1), { ...s.monthlyTrends[s.monthlyTrends.length - 1], disputes: s.monthlyTrends[s.monthlyTrends.length - 1].disputes + 1 }]
        : s.monthlyTrends;
      // Track by letter format
      if (source === "structured") {
        s.letterFormat = { ...s.letterFormat, structured: { ...s.letterFormat.structured, total: s.letterFormat.structured.total + 1 } };
      } else {
        s.letterFormat = { ...s.letterFormat, conversational: { ...s.letterFormat.conversational, total: s.letterFormat.conversational.total + 1 } };
      }
      s.rounds = [{ ...s.rounds[0], sent: s.rounds[0].sent + 1 }, ...s.rounds.slice(1)];
      s.activity = [{ id: Date.now(), user: "System", action: `Dispute sent to ${bureau} — ${flow} (${source === "structured" ? "Structured" : "Conversational"})`, time: "Just now", avatar: "📤", source }, ...s.activity].slice(0, 10);
      s.eventLog = addLog(`DISPUTE_SENT → ${bureau} / ${flow} (${source})`);
      return recalculateState(s);
    }

    case "ITEM_DELETED": {
      const { bureau, flow, source } = action.payload;
      const s = { ...state };
      s.bureaus = s.bureaus.map(b => b.id === bureau ? { ...b, deleted: b.deleted + 1 } : b);
      s.flows = s.flows.map(f => f.name === flow ? { ...f, success: f.success + 1 } : f);
      s.monthlyTrends = s.monthlyTrends.length > 0
        ? [...s.monthlyTrends.slice(0, -1), { ...s.monthlyTrends[s.monthlyTrends.length - 1], deleted: s.monthlyTrends[s.monthlyTrends.length - 1].deleted + 1 }]
        : s.monthlyTrends;
      // Track by letter format
      if (source === "structured") {
        s.letterFormat = { ...s.letterFormat, structured: { ...s.letterFormat.structured, deleted: s.letterFormat.structured.deleted + 1 } };
      } else {
        s.letterFormat = { ...s.letterFormat, conversational: { ...s.letterFormat.conversational, deleted: s.letterFormat.conversational.deleted + 1 } };
      }
      s.rounds = [{ ...s.rounds[0], deleted: s.rounds[0].deleted + 1 }, ...s.rounds.slice(1)];
      s.summary = { ...s.summary, scoreImprovement: s.summary.scoreImprovement + Math.floor(Math.random() * 5 + 2) };
      s.activity = [{ id: Date.now(), user: "System", action: `Item deleted from ${bureau} — ${flow} success`, time: "Just now", avatar: "✅", source }, ...s.activity].slice(0, 10);
      s.eventLog = addLog(`ITEM_DELETED → ${bureau} / ${flow} (${source})`);
      return recalculateState(s);
    }

    case "AI_REQUEST": {
      const { feature } = action.payload;
      const s = { ...state };
      s.ai = { ...s.ai };
      s.ai.breakdown = s.ai.breakdown.map(b => b.name === feature ? { ...b, requests: b.requests + 1 } : b);
      s.ai.totalCost = +(s.ai.totalCost + 0.0004).toFixed(4);
      s.ai.daily = s.ai.daily.length > 0
        ? [...s.ai.daily.slice(0, -1), s.ai.daily[s.ai.daily.length - 1] + 1]
        : [1];
      s.activity = [{ id: Date.now(), user: "AMELIA", action: `AI ${feature} request completed`, time: "Just now", avatar: "✦", source: "ai" }, ...s.activity].slice(0, 10);
      s.eventLog = addLog(`AI_REQUEST → ${feature}`);
      return recalculateState(s);
    }

    case "CLIENT_ADDED": {
      const s = { ...state };
      s.summary = { ...s.summary, clientCount: s.summary.clientCount + 1 };
      s.pipeline = s.pipeline.map((p, i) => i === 0 ? { ...p, count: p.count + 1 } : p);
      s.activity = [{ id: Date.now(), user: action.payload?.name || "New Client", action: "Client onboarded", time: "Just now", avatar: "👤", source: "manual" }, ...s.activity].slice(0, 10);
      s.eventLog = addLog(`CLIENT_ADDED → ${action.payload?.name || "New Client"}`);
      return recalculateState(s);
    }

    case "PIPELINE_ADVANCE": {
      const { from, to } = action.payload;
      const s = { ...state };
      s.pipeline = s.pipeline.map(p => {
        if (p.stage === from) return { ...p, count: Math.max(0, p.count - 1) };
        if (p.stage === to) return { ...p, count: p.count + 1 };
        return p;
      });
      s.eventLog = addLog(`PIPELINE_ADVANCE → ${from} → ${to}`);
      return recalculateState(s);
    }

    case "FCRA_VIOLATION": {
      const { type } = action.payload;
      const s = { ...state };
      s.fcra = s.fcra.map(f => f.label === type ? { ...f, value: f.value + 1 } : f);
      s.fcra = s.fcra.map(f => f.label === "Total Violations" ? { ...f, value: f.value + 1 } : f);
      s.activity = [{ id: Date.now(), user: "System", action: `FCRA violation: ${type}`, time: "Just now", avatar: "⚖️", source: "system" }, ...s.activity].slice(0, 10);
      s.eventLog = addLog(`FCRA_VIOLATION → ${type}`);
      return recalculateState(s);
    }

    default:
      return state;
  }
}

const DataContext = createContext<{
  state: AnalyticsState;
  dispatch: React.Dispatch<AnalyticsAction>;
} | null>(null);

function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within DataProvider");
  return context;
}

// ============================================================================
// UI Primitives
// ============================================================================

function LiveNumber({
  value,
  prefix = "",
  suffix = ""
}: {
  value: number;
  prefix?: string;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (value !== prevRef.current) {
      setFlash(true);
      const step = () => {
        setDisplay(d => {
          const diff = value - d;
          if (Math.abs(diff) < 1) return value;
          return d + Math.sign(diff) * Math.max(1, Math.floor(Math.abs(diff) / 4));
        });
      };
      const id = setInterval(step, 30);
      const flashOff = setTimeout(() => setFlash(false), 600);
      prevRef.current = value;
      return () => { clearInterval(id); clearTimeout(flashOff); };
    }
  }, [value]);

  useEffect(() => { setDisplay(value); }, []);

  return (
    <span className={cn("transition-all duration-300", flash && "brightness-125")}>
      {prefix}{Math.round(display)}{suffix}
    </span>
  );
}

function RevealAnimation({
  children,
  delay = 0,
  direction = "up"
}: {
  children: React.ReactNode;
  delay?: number;
  direction?: "up" | "left" | "right";
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const transforms: Record<string, string> = {
    up: "translate-y-4",
    left: "translate-x-4",
    right: "-translate-x-4",
  };

  return (
    <div
      className={cn(
        "transition-all duration-500 ease-out",
        visible ? "opacity-100 translate-y-0 translate-x-0" : `opacity-0 ${transforms[direction]}`
      )}
    >
      {children}
    </div>
  );
}

function Sparkline({
  data,
  color,
  width = 120,
  height = 40
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (!data || data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((v, i) =>
    `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`
  ).join(" ");

  const lastY = height - ((data[data.length - 1] - min) / range) * (height - 4) - 2;
  const gradientId = `sg-${color.replace('#', '')}`;

  return (
    <svg width={width} height={height} className="block">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#${gradientId})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={width} cy={lastY} r="3" fill={color} />
    </svg>
  );
}

function ProgressBar({
  value,
  max,
  color,
  height = 6
}: {
  value: number;
  max: number;
  color: string;
  height?: number;
}) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <div
      className="rounded-full bg-muted overflow-hidden"
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${percentage}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ============================================================================
// Navigation
// ============================================================================

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: BarChart3, desc: "Full dashboard" },
  { id: "format", label: "Letter Format", icon: FileText, desc: "Format comparison" },
  { id: "ai", label: "AI Usage", icon: Sparkles, desc: "AMELIA metrics" },
  { id: "bureau", label: "Bureau Analysis", icon: Building2, desc: "CRA breakdown" },
  { id: "pipeline", label: "Pipeline & Flows", icon: GitBranch, desc: "Client stages" },
  { id: "compliance", label: "Compliance", icon: Scale, desc: "FCRA + activity" },
];

type TimeRange = "1M" | "3M" | "6M" | "1Y" | "ALL";

// ============================================================================
// Sections
// ============================================================================

function StatsRow({ delay = 0 }: { delay?: number }) {
  const { state } = useData();

  const stats = [
    { icon: Users, value: state.summary.clientCount, label: "TOTAL CLIENTS" },
    { icon: Send, value: state.summary.totalDisputes, label: "TOTAL DISPUTES" },
    { icon: CheckCircle2, value: state.summary.itemsDeleted, label: "ITEMS DELETED", color: "text-emerald-400" },
    { icon: TrendingUp, value: state.summary.successRate, label: "SUCCESS RATE", suffix: "%", color: "text-amber-400" },
    { icon: Target, value: state.summary.scoreImprovement, label: "SCORE IMPROVEMENT", prefix: "+", color: "text-emerald-400" },
    { icon: Clock, value: state.summary.avgCompletionMonths, label: "AVG COMPLETION", suffix: "mo" },
  ];

  return (
    <RevealAnimation delay={delay}>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {stats.map((stat, i) => (
          <Card key={i} className="bg-card/50 backdrop-blur-xl border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-[10px] font-bold tracking-wider text-muted-foreground font-mono">
                  {stat.label}
                </span>
              </div>
              <div className={cn("text-2xl font-bold", stat.color || "text-foreground")}>
                <LiveNumber value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </RevealAnimation>
  );
}

function LetterFormatSection({ delay = 0 }: { delay?: number }) {
  const { state } = useData();

  const structuredBetter = state.letterFormat.structured.rate - state.letterFormat.conversational.rate;

  const sides = [
    {
      key: "structured",
      label: "Structured Format",
      iconEmoji: "📋",
      color: "#a855f7",
      desc: "Bold headers, detailed explanations",
      data: state.letterFormat.structured,
    },
    {
      key: "conversational",
      label: "Conversational Format",
      iconEmoji: "💬",
      color: "#60a5fa",
      desc: "Casual headers, combined sections",
      data: state.letterFormat.conversational,
    },
  ];

  return (
    <RevealAnimation delay={delay}>
      <Card className="bg-card/50 backdrop-blur-xl border-border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5 text-muted-foreground" />
              Letter Format Comparison
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                LIVE
              </Badge>
              <Badge variant="outline" className="text-muted-foreground">
                {state.letterFormat.structured.total + state.letterFormat.conversational.total} total
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sides.map((side) => (
              <div
                key={side.key}
                className="p-5 rounded-xl border"
                style={{
                  borderColor: `${side.color}20`,
                  backgroundColor: `${side.color}05`,
                }}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
                    style={{
                      backgroundColor: `${side.color}15`,
                      border: `1px solid ${side.color}25`,
                    }}
                  >
                    {side.iconEmoji}
                  </div>
                  <div>
                    <div className="font-bold" style={{ color: side.color }}>
                      {side.label}
                    </div>
                    <div className="text-xs text-muted-foreground">{side.desc}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-2xl font-bold">
                      <LiveNumber value={side.data.total} />
                    </div>
                    <div className="text-xs text-muted-foreground font-mono mt-1">Total Sent</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-emerald-400">
                      <LiveNumber value={side.data.deleted} />
                    </div>
                    <div className="text-xs text-muted-foreground font-mono mt-1">Deleted</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      <LiveNumber value={side.data.rate} suffix="%" />
                    </div>
                    <div className="text-xs text-muted-foreground font-mono mt-1">Success</div>
                  </div>
                </div>
                <div className="mt-4">
                  <ProgressBar value={side.data.rate} max={100} color={side.color} height={5} />
                </div>
              </div>
            ))}
          </div>

          {structuredBetter > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-3">
              <span className="text-lg">💡</span>
              <span className="text-sm text-muted-foreground">
                Structured format has a{" "}
                <strong className="text-emerald-400">{structuredBetter}% higher</strong> success rate
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </RevealAnimation>
  );
}

function AISection({ delay = 0 }: { delay?: number }) {
  const { state } = useData();
  const ai = state.ai;

  const metrics = [
    { value: ai.totalRequests, label: "Total Requests", color: "text-purple-400", isNumber: true },
    { value: `$${ai.totalCost.toFixed(2)}`, label: "Total Cost", color: "text-emerald-400" },
    { value: `${ai.avgResponse}s`, label: "Avg Response", color: "text-blue-400" },
    { value: `$${ai.costPerRequest.toFixed(4)}`, label: "Cost / Request", color: "text-green-400" },
  ];

  return (
    <RevealAnimation delay={delay}>
      <Card className="bg-card/50 backdrop-blur-xl border-border">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                AMELIA AI Usage
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                AI-powered dispute strategy and letter generation
              </p>
            </div>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20">
              Last 30 Days
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Metrics row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {metrics.map((m, i) => (
              <div key={i} className="text-center p-4 rounded-xl bg-background/50 border border-border">
                <div className={cn("text-2xl font-bold", m.color)}>
                  {m.isNumber ? <LiveNumber value={m.value as number} /> : m.value}
                </div>
                <div className="text-xs text-muted-foreground font-mono mt-2">{m.label}</div>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Request Activity */}
            <div className="p-5 rounded-xl bg-background/50 border border-border">
              <div className="flex justify-between items-center mb-4">
                <span className="font-semibold">Request Activity</span>
                <span className="text-xs text-muted-foreground font-mono">14 days</span>
              </div>
              {ai.daily.length > 1 ? (
                <Sparkline data={ai.daily} color="#a855f7" width={280} height={56} />
              ) : (
                <div className="h-14 flex items-center justify-center text-sm text-muted-foreground">
                  No activity data yet
                </div>
              )}
            </div>

            {/* By Feature */}
            <div className="p-5 rounded-xl bg-background/50 border border-border">
              <div className="font-semibold mb-4">By Feature</div>
              <div className="space-y-3">
                {ai.breakdown.map((b, i) => (
                  <div key={i}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-sm text-muted-foreground">{b.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {b.requests} ({b.percentage}%)
                      </span>
                    </div>
                    <ProgressBar value={b.percentage} max={100} color={b.color} height={4} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Provider info */}
          <div className="flex justify-between items-center p-4 rounded-xl bg-background/50 border border-border">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/15 flex items-center justify-center">
                <Zap className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <div className="font-semibold">CLAUDE</div>
                <div className="text-xs text-muted-foreground font-mono">claude-sonnet-4-5-20250929</div>
              </div>
            </div>
            <div className="flex gap-6 items-center">
              <div className="text-center">
                <div className="text-lg font-bold text-emerald-400">{ai.uptime}%</div>
                <div className="text-[10px] text-muted-foreground">Uptime</div>
              </div>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                ACTIVE
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </RevealAnimation>
  );
}

function BureauSection({ delay = 0 }: { delay?: number }) {
  const { state } = useData();

  return (
    <RevealAnimation delay={delay}>
      <Card className="bg-card/50 backdrop-blur-xl border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="w-4 h-4" />
            Success by Bureau
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            {state.bureaus.map((bureau) => {
              const rate = bureau.sent > 0 ? Math.round((bureau.deleted / bureau.sent) * 100) : 0;
              return (
                <div key={bureau.id}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="font-semibold">{bureau.name}</span>
                    <span className="text-lg font-bold" style={{ color: bureau.color }}>
                      <LiveNumber value={rate} suffix="%" />
                    </span>
                  </div>
                  <ProgressBar value={rate} max={100} color={bureau.color} height={6} />
                  <div className="flex gap-4 mt-2 text-sm">
                    <span className="text-muted-foreground">
                      Sent: <strong className="text-foreground">{bureau.sent}</strong>
                    </span>
                    <span className="text-emerald-400">
                      Deleted: <strong>{bureau.deleted}</strong>
                    </span>
                    <span className="text-amber-400">
                      Verified: <strong>{bureau.verified}</strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </RevealAnimation>
  );
}

function TrendsSection({ delay = 0 }: { delay?: number }) {
  const { state } = useData();
  const maxDisputes = Math.max(...state.monthlyTrends.map(m => m.disputes), 1);

  return (
    <RevealAnimation delay={delay}>
      <Card className="bg-card/50 backdrop-blur-xl border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <BarChart3 className="w-4 h-4" />
            Monthly Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-36 flex items-end justify-between gap-3 mb-4">
            {state.monthlyTrends.map((month, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div className="w-full flex gap-1 h-28 items-end">
                  <div
                    className="flex-1 bg-blue-500 rounded-t transition-all duration-700"
                    style={{
                      height: `${(month.disputes / maxDisputes) * 100}%`,
                      minHeight: month.disputes > 0 ? 4 : 0,
                    }}
                  />
                  <div
                    className="flex-1 bg-emerald-500 rounded-t transition-all duration-700"
                    style={{
                      height: `${(month.deleted / maxDisputes) * 100}%`,
                      minHeight: month.deleted > 0 ? 4 : 0,
                    }}
                  />
                </div>
                <span className="text-xs text-muted-foreground mt-2 font-mono">
                  {month.month}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded" />
              <span className="text-xs text-muted-foreground">Disputes Sent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-emerald-500 rounded" />
              <span className="text-xs text-muted-foreground">Items Deleted</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </RevealAnimation>
  );
}

function PipelineSection({ delay = 0 }: { delay?: number }) {
  const { state } = useData();
  const maxCount = Math.max(...state.pipeline.map(p => p.count), 1);

  return (
    <RevealAnimation delay={delay}>
      <Card className="bg-card/50 backdrop-blur-xl border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <GitBranch className="w-4 h-4" />
            Client Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {state.pipeline.map((p) => (
              <div key={p.stage} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-mono w-24 text-right shrink-0">
                  {p.stage}
                </span>
                <div className="flex-1 h-7 rounded-lg bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-lg flex items-center px-3 transition-all duration-700"
                    style={{
                      width: `${(p.count / maxCount) * 100}%`,
                      minWidth: p.count > 0 ? 30 : 0,
                      backgroundColor: p.color,
                    }}
                  >
                    {p.count > 0 && (
                      <span className="text-xs font-bold text-white font-mono">{p.count}</span>
                    )}
                  </div>
                </div>
                {p.count === 0 && (
                  <span className="text-xs text-muted-foreground font-mono">0</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </RevealAnimation>
  );
}

function FlowSection({ delay = 0 }: { delay?: number }) {
  const { state } = useData();

  return (
    <RevealAnimation delay={delay}>
      <Card className="bg-card/50 backdrop-blur-xl border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Zap className="w-4 h-4" />
            Success by Flow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {state.flows.map((flow) => {
              const rate = flow.sent > 0 ? Math.round((flow.success / flow.sent) * 100) : 0;
              return (
                <div
                  key={flow.name}
                  className="flex items-center gap-3 p-3 rounded-xl bg-background/50 border border-border"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold font-mono"
                    style={{
                      backgroundColor: `${flow.color}15`,
                      color: flow.color,
                    }}
                  >
                    {flow.name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{flow.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {flow.success}/{flow.sent}
                    </div>
                  </div>
                  <span className="text-lg font-bold" style={{ color: flow.color }}>
                    {rate}%
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </RevealAnimation>
  );
}

function RoundsSection({ delay = 0 }: { delay?: number }) {
  const { state } = useData();

  return (
    <RevealAnimation delay={delay}>
      <Card className="bg-card/50 backdrop-blur-xl border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Target className="w-4 h-4" />
            Round Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {state.rounds.map((round) => {
              const rate = round.sent > 0 ? Math.round((round.deleted / round.sent) * 100) : 0;
              return (
                <div key={round.name}>
                  <div className="flex justify-between mb-1.5">
                    <span className="font-semibold">{round.name}</span>
                    <span className={cn(
                      "text-lg font-bold",
                      round.sent > 0 ? "text-emerald-400" : "text-muted-foreground"
                    )}>
                      {rate}%
                    </span>
                  </div>
                  <ProgressBar value={round.deleted} max={round.sent || 1} color="#34d399" height={5} />
                  <div className="flex gap-4 mt-1.5 text-sm">
                    <span className="text-muted-foreground">
                      Sent: <strong className="text-foreground">{round.sent}</strong>
                    </span>
                    <span className="text-emerald-400">
                      Deleted: <strong>{round.deleted}</strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </RevealAnimation>
  );
}

function ComplianceSection({ delay = 0 }: { delay?: number }) {
  const { state } = useData();

  return (
    <RevealAnimation delay={delay}>
      <Card className="bg-card/50 backdrop-blur-xl border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Scale className="w-4 h-4" />
            FCRA Compliance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {state.fcra.map((f) => (
              <div
                key={f.label}
                className="p-4 rounded-xl bg-background/50 border border-border text-center"
              >
                <div className="text-2xl font-bold" style={{ color: f.color }}>
                  <LiveNumber value={f.value} />
                </div>
                <div className="text-xs text-muted-foreground mt-1">{f.label}</div>
              </div>
            ))}
          </div>
          <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 text-center">
            <span className="text-xs text-muted-foreground">
              Violations strengthen future disputes and support potential litigation.
            </span>
          </div>
        </CardContent>
      </Card>
    </RevealAnimation>
  );
}

function ActivitySection({ delay = 0 }: { delay?: number }) {
  const { state } = useData();

  const sourceColors: Record<string, string> = {
    structured: "#a855f7",
    conversational: "#60a5fa",
    ai: "#34d399",
    system: "#ef4444",
  };

  return (
    <RevealAnimation delay={delay}>
      <Card className="bg-card/50 backdrop-blur-xl border-border">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="w-4 h-4" />
              Recent Activity
            </CardTitle>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              LIVE
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {state.activity.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No recent activity
            </div>
          ) : (
            <div className="space-y-0">
              {state.activity.map((a, i) => (
                <div
                  key={a.id}
                  className={cn(
                    "flex items-center gap-3 py-3",
                    i < state.activity.length - 1 && "border-b border-border",
                    a.time === "Just now" && "animate-in fade-in duration-300"
                  )}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0"
                    style={{
                      backgroundColor: `${sourceColors[a.source] || "#a855f7"}15`,
                      color: sourceColors[a.source] || "#a855f7",
                    }}
                  >
                    {a.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm">
                      <strong>{a.user}</strong>
                      <span className="text-muted-foreground"> — {a.action}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant="outline"
                      className="text-[10px]"
                      style={{
                        borderColor: `${sourceColors[a.source] || "#a855f7"}30`,
                        color: sourceColors[a.source] || "#a855f7",
                      }}
                    >
                      {a.source}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">{a.time}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </RevealAnimation>
  );
}

function SimulationPanel({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { state, dispatch } = useData();
  const [autoRun, setAutoRun] = useState(false);
  const autoRef = useRef<NodeJS.Timeout | null>(null);

  const randomEvent = useCallback(() => {
    const bureaus = ["TU", "EX", "EQ"];
    const flows = ["ACCURACY", "COLLECTION", "CONSENT", "COMBO"];
    const features = ["Credit Analysis", "Letter Generation", "Dispute Strategy", "Score Prediction"];

    const events = [
      () => dispatch({
        type: "DISPUTE_SENT",
        payload: {
          bureau: bureaus[Math.floor(Math.random() * bureaus.length)],
          flow: flows[Math.floor(Math.random() * flows.length)],
          source: Math.random() > 0.4 ? "structured" : "conversational"
        }
      }),
      () => dispatch({
        type: "ITEM_DELETED",
        payload: {
          bureau: bureaus[Math.floor(Math.random() * bureaus.length)],
          flow: flows[Math.floor(Math.random() * 2)],
          source: Math.random() > 0.4 ? "structured" : "conversational"
        }
      }),
      () => dispatch({
        type: "AI_REQUEST",
        payload: { feature: features[Math.floor(Math.random() * features.length)] }
      }),
      () => dispatch({ type: "PIPELINE_ADVANCE", payload: { from: "Intake", to: "Analysis" } }),
    ];

    events[Math.floor(Math.random() * events.length)]();
  }, [dispatch]);

  useEffect(() => {
    if (autoRun) {
      autoRef.current = setInterval(randomEvent, 2500);
    } else if (autoRef.current) {
      clearInterval(autoRef.current);
    }
    return () => {
      if (autoRef.current) clearInterval(autoRef.current);
    };
  }, [autoRun, randomEvent]);

  return (
    <Card className="bg-card/50 backdrop-blur-xl border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onToggle} className="flex items-center gap-2 group">
            <span>🧪</span>
            <span className="font-semibold text-sm">Live Simulation</span>
            <ChevronDown
              className={cn(
                "w-4 h-4 text-muted-foreground transition-transform duration-200",
                collapsed ? "-rotate-90" : "rotate-0"
              )}
            />
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRun(!autoRun)}
            className={cn(
              "text-xs",
              autoRun && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            )}
          >
            {autoRun ? <Pause className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
            {autoRun ? "Stop" : "Auto-Run"}
          </Button>
        </div>

        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            collapsed ? "max-h-0 opacity-0" : "max-h-[300px] opacity-100"
          )}
        >
          <div className="flex flex-wrap gap-1.5 mb-3">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => dispatch({ type: "DISPUTE_SENT", payload: { bureau: "EX", flow: "ACCURACY", source: "structured" } })}
            >
              📋 Structured
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => dispatch({ type: "DISPUTE_SENT", payload: { bureau: "TU", flow: "COLLECTION", source: "conversational" } })}
            >
              💬 Conversational
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => dispatch({ type: "ITEM_DELETED", payload: { bureau: "EX", flow: "ACCURACY", source: "structured" } })}
            >
              ✅ Deleted
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => dispatch({ type: "AI_REQUEST", payload: { feature: "Letter Generation" } })}
            >
              ✦ AI
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => dispatch({ type: "CLIENT_ADDED", payload: { name: "New Client" } })}
            >
              👤 Client
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => dispatch({ type: "FCRA_VIOLATION", payload: { type: "Failure to Respond" } })}
            >
              ⚖️ FCRA
            </Button>
          </div>

          <div className="max-h-28 overflow-auto rounded-lg bg-background/50 p-2">
            {state.eventLog.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">
                Click buttons or enable auto-run to see live events...
              </div>
            ) : (
              state.eventLog.map(e => (
                <div
                  key={e.id}
                  className="text-[11px] font-mono text-muted-foreground py-1 border-b border-border animate-in fade-in duration-300"
                >
                  <span className="text-muted-foreground/60">{e.time}</span>
                  <span className="text-emerald-400"> → </span>
                  {e.msg}
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function AnalyticsPage() {
  const [state, dispatch] = useReducer(analyticsReducer, INITIAL_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("6M");
  const [section, setSection] = useState("overview");
  const [quickViewCollapsed, setQuickViewCollapsed] = useState(false);
  const [simulationCollapsed, setSimulationCollapsed] = useState(false);

  // Fetch initial data
  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const response = await fetch(`/api/analytics?range=${timeRange.toLowerCase()}`);
        if (response.ok) {
          const data = await response.json();

          // Map API data to our state structure
          dispatch({
            type: "SET_DATA",
            payload: {
              summary: {
                clientCount: data.summary?.clientCount || 0,
                totalDisputes: (data.summary?.activeDisputeCount || 0) + (data.summary?.resolvedDisputeCount || 0),
                itemsDeleted: data.summary?.totalItemsDeleted || data.summary?.resolvedDisputeCount || 0,
                successRate: data.summary?.overallSuccessRate || data.summary?.resolutionRate || 0,
                scoreImprovement: data.summary?.avgScoreImprovement || 0,
                avgCompletionMonths: data.summary?.avgCompletionMonths ||
                  (data.summary?.avgResolutionDays ? Number((data.summary.avgResolutionDays / 30).toFixed(1)) : 0),
              },
              letterFormat: {
                structured: {
                  total: data.successByFormat?.STRUCTURED?.total || 0,
                  deleted: data.successByFormat?.STRUCTURED?.deleted || 0,
                  rate: data.successByFormat?.STRUCTURED?.rate || 0,
                },
                conversational: {
                  total: data.successByFormat?.CONVERSATIONAL?.total || 0,
                  deleted: data.successByFormat?.CONVERSATIONAL?.deleted || 0,
                  rate: data.successByFormat?.CONVERSATIONAL?.rate || 0,
                },
              },
              bureaus: data.successByCRA
                ? Object.entries(data.successByCRA).map(([cra, stats]: [string, any]) => ({
                    id: cra === "TRANSUNION" ? "TU" : cra === "EXPERIAN" ? "EX" : "EQ",
                    name: cra,
                    sent: stats.sent || 0,
                    deleted: stats.deleted || 0,
                    verified: stats.verified || 0,
                    color: cra === "TRANSUNION" ? "#06b6d4" : cra === "EXPERIAN" ? "#a78bfa" : "#fb7185",
                  }))
                : INITIAL_STATE.bureaus,
              monthlyTrends: data.monthlyTrends?.map((m: any) => ({
                month: m.month,
                disputes: m.disputes || 0,
                deleted: m.deleted || 0,
              })) || [],
              pipeline: data.clientFunnel
                ? Object.entries(data.clientFunnel).map(([stage, count], i) => ({
                    stage,
                    count: count as number,
                    color: ["#a855f7", "#60a5fa", "#06b6d4", "#34d399", "#fbbf24", "#f59e0b", "#fb7185", "#22c55e"][i % 8],
                  }))
                : INITIAL_STATE.pipeline,
              flows: data.successByFlow
                ? Object.entries(data.successByFlow).map(([flow, stats]: [string, any]) => ({
                    name: flow,
                    sent: stats.total || 0,
                    success: stats.success || 0,
                    color: flow === "ACCURACY" ? "#60a5fa" : flow === "COLLECTION" ? "#f87171" : flow === "CONSENT" ? "#c084fc" : "#fbbf24",
                  }))
                : INITIAL_STATE.flows,
              rounds: data.roundPerformance?.map((r: any) => ({
                name: r.round,
                sent: r.sent || 0,
                deleted: r.deleted || 0,
              })) || INITIAL_STATE.rounds,
              ai: {
                totalRequests: data.llmStats?.totalRequests || 0,
                totalCost: (data.llmStats?.totalCostCents || 0) / 100,
                avgResponse: data.llmStats?.avgLatencyMs ? data.llmStats.avgLatencyMs / 1000 : 2.8,
                costPerRequest: data.llmStats?.totalRequests
                  ? ((data.llmStats.totalCostCents || 0) / 100) / data.llmStats.totalRequests
                  : 0.0004,
                breakdown: data.llmStats?.byTaskType
                  ? Object.entries(data.llmStats.byTaskType).map(([name, stats]: [string, any], i) => ({
                      name,
                      requests: stats.requests || 0,
                      percentage: data.llmStats.totalRequests
                        ? Math.round((stats.requests / data.llmStats.totalRequests) * 100)
                        : 0,
                      color: ["#60a5fa", "#a855f7", "#34d399", "#fbbf24"][i % 4],
                    }))
                  : INITIAL_STATE.ai.breakdown,
                daily: Array.from({ length: 14 }, () => Math.floor(Math.random() * 30 + 10)),
                uptime: 99.9,
              },
              fcra: [
                { label: "Total Violations", value: data.fcraViolations?.total || 0, color: "#ef4444" },
                { label: "Failure to Respond", value: data.fcraViolations?.failureToRespond || 0, color: "#fbbf24" },
                { label: "Inadequate Investigation", value: data.fcraViolations?.inadequateInvestigation || 0, color: "#a855f7" },
                { label: "CFPB Complaints", value: data.fcraViolations?.cfpbComplaints || 0, color: "#06b6d4" },
              ],
              activity: data.recentActivity?.map((a: any, i: number) => ({
                id: i,
                user: a.client || "System",
                action: a.details || a.type,
                time: a.date,
                avatar: a.type === "deletion" ? "✅" : a.type === "sent" ? "📤" : "📬",
                source: a.type === "deletion" ? "structured" : "conversational",
              })) || [],
            },
          });
        }
      } catch (error) {
        log.error({ err: error }, "Error fetching analytics");
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnalytics();
  }, [timeRange]);

  const show = (id: string) => section === "overview" || section === id;

  if (isLoading) {
    return <AnalyticsSkeleton />;
  }

  return (
    <DataContext.Provider value={{ state, dispatch }}>
      <div className="relative min-h-full">
        {/* Ambient glow effects */}
        <div className="fixed top-[10%] left-[20%] w-[600px] h-[600px] bg-[radial-gradient(ellipse,rgba(124,58,237,0.08)_0%,transparent_70%)] pointer-events-none" />
        <div className="fixed bottom-[20%] right-[10%] w-[400px] h-[400px] bg-[radial-gradient(ellipse,rgba(16,185,129,0.06)_0%,transparent_70%)] pointer-events-none" />

        <div className="relative z-10 max-w-[1480px] mx-auto space-y-6">
          {/* Header */}
          <RevealAnimation delay={40}>
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <BarChart3 className="w-6 h-6 text-muted-foreground" />
                  Analytics & Reporting
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Business performance, AI usage, and dispute insights
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Time Range Selector */}
                <div className="flex bg-card rounded-lg p-1 border border-border">
                  {(["1M", "3M", "6M", "1Y", "ALL"] as TimeRange[]).map((range) => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={cn(
                        "px-4 py-2 rounded-md text-xs font-medium transition-all",
                        timeRange === range
                          ? "bg-amber-500/20 text-amber-400"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {range}
                    </button>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="w-4 h-4" />
                  Export Report
                </Button>
              </div>
            </div>
          </RevealAnimation>

          {/* Two-panel layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 items-start">
            {/* Sidebar */}
            <RevealAnimation delay={80} direction="left">
              <div className="sticky top-6 space-y-4">
                {/* Navigation */}
                <Card className="bg-card/50 backdrop-blur-xl border-border">
                  <CardContent className="p-3">
                    <div className="text-[10px] font-bold tracking-wider text-muted-foreground font-mono px-3 py-2">
                      NAVIGATE
                    </div>
                    {NAV_ITEMS.map((nav) => {
                      const isActive = section === nav.id;
                      return (
                        <button
                          key={nav.id}
                          onClick={() => setSection(nav.id)}
                          className={cn(
                            "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-all relative",
                            isActive ? "bg-amber-500/10" : "hover:bg-muted/50"
                          )}
                        >
                          {isActive && (
                            <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded bg-amber-500" />
                          )}
                          <nav.icon className={cn(
                            "w-4 h-4",
                            isActive ? "text-amber-400" : "text-muted-foreground"
                          )} />
                          <div>
                            <div className={cn(
                              "text-sm font-medium",
                              isActive ? "text-amber-400" : "text-foreground"
                            )}>
                              {nav.label}
                            </div>
                            <div className="text-[10px] text-muted-foreground">{nav.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* Quick Stats */}
                <Card className="bg-card/50 backdrop-blur-xl border-border">
                  <CardContent className="p-4">
                    <button
                      onClick={() => setQuickViewCollapsed(!quickViewCollapsed)}
                      className="w-full flex items-center justify-between group"
                    >
                      <div className="text-[10px] font-bold tracking-wider text-muted-foreground font-mono">
                        QUICK VIEW
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-muted-foreground transition-transform duration-200",
                          quickViewCollapsed ? "-rotate-90" : "rotate-0"
                        )}
                      />
                    </button>
                    <div
                      className={cn(
                        "overflow-hidden transition-all duration-300 ease-in-out",
                        quickViewCollapsed ? "max-h-0 opacity-0 mt-0" : "max-h-[400px] opacity-100 mt-4"
                      )}
                    >
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between mb-1.5">
                            <span className="text-sm text-muted-foreground">Overall Success</span>
                            <span className="text-sm font-bold text-amber-400">
                              <LiveNumber value={state.summary.successRate} suffix="%" />
                            </span>
                          </div>
                          <ProgressBar value={state.summary.successRate} max={100} color="#f59e0b" height={5} />
                        </div>
                        <div>
                          <div className="flex justify-between mb-1.5">
                            <span className="text-sm text-muted-foreground">Structured Rate</span>
                            <span className="text-sm font-bold text-purple-400">
                              <LiveNumber value={state.letterFormat.structured.rate} suffix="%" />
                            </span>
                          </div>
                          <ProgressBar value={state.letterFormat.structured.rate} max={100} color="#a855f7" height={5} />
                        </div>
                        <div>
                          <div className="flex justify-between mb-1.5">
                            <span className="text-sm text-muted-foreground">AI Requests</span>
                            <span className="text-sm font-bold text-blue-400">
                              <LiveNumber value={state.ai.totalRequests} />
                            </span>
                          </div>
                          {state.ai.daily.length > 1 && (
                            <Sparkline data={state.ai.daily} color="#60a5fa" width={188} height={28} />
                          )}
                        </div>
                        <div className="pt-3 border-t border-border">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Score Change</span>
                            <span className="text-sm font-bold text-emerald-400">
                              +<LiveNumber value={state.summary.scoreImprovement} />
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Simulation Panel */}
                <SimulationPanel
                  collapsed={simulationCollapsed}
                  onToggle={() => setSimulationCollapsed(!simulationCollapsed)}
                />
              </div>
            </RevealAnimation>

            {/* Main Content */}
            <div key={section} className="animate-in fade-in duration-300">
              <StatsRow delay={100} />

              {show("format") && <LetterFormatSection delay={160} />}

              {show("ai") && (
                <div className="mt-4">
                  <AISection delay={200} />
                </div>
              )}

              {show("bureau") && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                  <TrendsSection delay={240} />
                  <BureauSection delay={270} />
                </div>
              )}

              {show("pipeline") && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
                  <PipelineSection delay={300} />
                  <FlowSection delay={330} />
                  <RoundsSection delay={360} />
                </div>
              )}

              {show("compliance") && (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4 mt-4">
                  <ComplianceSection delay={400} />
                  <ActivitySection delay={430} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DataContext.Provider>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardContent className="p-3">
              <Skeleton className="h-4 w-20 mb-4" />
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full mb-2" />
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="bg-card border-border">
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-card border-border">
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
