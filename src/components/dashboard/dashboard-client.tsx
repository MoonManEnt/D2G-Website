"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AmeliaChatDrawer } from "@/components/amelia/amelia-chat-drawer";
import { cn } from "@/lib/utils";

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

interface BureauScore {
  id: string;
  name: string;
  short: string;
  colorKey: "tu" | "ex" | "eq";
  score: number;
  prev: number;
  goal: number;
}

interface CreditVital {
  label: string;
  value: number;
  max: number;
  unit?: string;
  status: string;
  color: string;
}

interface ClientData {
  id: string;
  name: string;
  initials: string;
  joined: string;
  round: number;
  category: string;
  categoryLabel: string;
  bureaus: BureauScore[];
  vitals: CreditVital[];
  trend: number[];
  trendStart: string;
  trendEnd: string;
  amelia: string;
  queue: Array<{ id: number; icon: string; title: string; sub: string; time: string; color: string }>;
  deletions: number;
  activeDisputes: number;
  successRate: number;
}

// ============================================================================
// THEME COLORS
// ============================================================================

const COLORS = {
  tu: "#06b6d4",
  ex: "#a78bfa",
  eq: "#fb7185",
  accent: "#f59e0b",
  green: "#22c55e",
  emerald: "#34d399",
  red: "#ef4444",
  yellow: "#fbbf24",
  blue: "#60a5fa",
  purple: "#a855f7",
  cyan: "#06b6d4",
  violet: "#a78bfa",
  rose: "#fb7185",
  indigo: "#818cf8",
};

const CATEGORIES = [
  { id: "best", label: "Best Performing", icon: "🏆", color: "green", desc: "Highest scores" },
  { id: "improved", label: "Most Improved", icon: "📈", color: "emerald", desc: "Biggest gains" },
  { id: "help", label: "Needs Most Help", icon: "🆘", color: "red", desc: "Lowest scores" },
  { id: "newest", label: "Newest Client", icon: "✨", color: "blue", desc: "Just onboarded" },
  { id: "risk", label: "At Risk", icon: "⚠️", color: "yellow", desc: "Score declining" },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const hexAlpha = (hex: string, alpha: number) => {
  try {
    return hex + Math.round(alpha * 255).toString(16).padStart(2, "0");
  } catch {
    return hex;
  }
};

const getComposite = (bureaus: BureauScore[]) =>
  bureaus.length > 0 ? Math.round(bureaus.reduce((a, b) => a + b.score, 0) / bureaus.length) : 0;

const getGrade = (s: number) =>
  s >= 750 ? "A" : s >= 700 ? "B+" : s >= 650 ? "B" : s >= 600 ? "C+" : s >= 550 ? "C" : s >= 500 ? "D" : "F";

const getLabel = (s: number) =>
  s >= 750 ? "Excellent" : s >= 700 ? "Good" : s >= 650 ? "Fair" : s >= 600 ? "Building" : s >= 550 ? "Developing" : s >= 500 ? "Emerging" : "Needs Attention";

const getGreeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

// ============================================================================
// ANIMATED NUMBER COMPONENT
// ============================================================================

function AnimatedNumber({ value, duration = 900 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    let start: number;
    const from = prevRef.current;

    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + eased * (value - from)));
      if (progress < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
    prevRef.current = value;
  }, [value, duration]);

  return <>{display}</>;
}

// ============================================================================
// REVEAL ANIMATION
// ============================================================================

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={cn(
        "transition-all duration-500 ease-out",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================================================
// BREATHING DOT
// ============================================================================

function BreathingDot({ color, size = 8 }: { color: string; size?: number }) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setPulse((v) => !v), 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="rounded-full transition-shadow duration-[1500ms]"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        boxShadow: pulse ? `0 0 ${size + 2}px ${hexAlpha(color, 0.5)}` : "none",
      }}
    />
  );
}

// ============================================================================
// PROGRESS BAR
// ============================================================================

function ProgressBar({ value, max, color, height = 5 }: { value: number; max: number; color: string; height?: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <div className="rounded-full bg-muted overflow-hidden" style={{ height }}>
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ============================================================================
// BADGE COMPONENT
// ============================================================================

function Badge({ label, color, large = false }: { label: string; color: string; large?: boolean }) {
  return (
    <span
      className="font-mono font-bold whitespace-nowrap leading-none"
      style={{
        fontSize: large ? 11 : 10,
        padding: large ? "4px 10px" : "3px 8px",
        borderRadius: 5,
        background: hexAlpha(color, 0.1),
        color,
        border: `1px solid ${hexAlpha(color, 0.12)}`,
      }}
    >
      {label}
    </span>
  );
}

// ============================================================================
// BUREAU ARC
// ============================================================================

// Bureau logo paths
const BUREAU_LOGOS: Record<string, string> = {
  TU: "/logos/transunion.svg",
  EX: "/logos/experian.svg",
  EQ: "/logos/equifax.svg",
};

function BureauArc({ bureau, size = 105, strokeW = 6 }: { bureau: BureauScore; size?: number; strokeW?: number }) {
  const color = COLORS[bureau.colorKey];
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, (bureau.score - 300) / (850 - 300));
  const offset = circ * (1 - pct);
  const change = bureau.score - bureau.prev;
  const logoUrl = BUREAU_LOGOS[bureau.short];

  return (
    <div className="flex flex-col items-center">
      {/* Bureau Logo */}
      <div className="mb-2 h-5 flex items-center justify-center">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={bureau.name}
            className="h-4 w-auto object-contain opacity-80"
            style={{ filter: "brightness(1.2)" }}
          />
        ) : (
          <span className="text-[11px] font-semibold text-muted-foreground">{bureau.name}</span>
        )}
      </div>

      {/* Score Arc */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeW} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 5px ${hexAlpha(color, 0.25)})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-extrabold">
            <AnimatedNumber value={bureau.score} duration={800} />
          </div>
          <div className="text-[9px] font-bold font-mono mt-0.5" style={{ color, letterSpacing: 1 }}>
            {bureau.short}
          </div>
        </div>
      </div>

      {/* Score Change */}
      <div className="mt-1.5 flex items-center gap-1">
        <span
          className="text-[11px] font-bold"
          style={{ color: change > 0 ? COLORS.green : change < 0 ? COLORS.red : "hsl(var(--muted-foreground))" }}
        >
          {change > 0 ? "▲" : change < 0 ? "▼" : "—"} {Math.abs(change)}
        </span>
        <span className="text-[10px] text-muted-foreground">pts</span>
      </div>
    </div>
  );
}

// ============================================================================
// COMPOSITE RING
// ============================================================================

function CompositeRing({ score, size = 146, strokeW = 8 }: { score: number; size?: number; strokeW?: number }) {
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, (score - 300) / (850 - 300));
  const offset = circ * (1 - pct);
  const grade = getGrade(score);
  const label = getLabel(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeW} />
        <defs>
          <linearGradient id="compGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={COLORS.accent} />
            <stop offset="50%" stopColor={COLORS.emerald} />
            <stop offset="100%" stopColor={COLORS.cyan} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#compGrad)"
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="transition-all duration-[1400ms] ease-out"
          style={{ filter: `drop-shadow(0 0 7px ${hexAlpha(COLORS.accent, 0.2)})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-4xl font-extrabold tracking-tight">
          <AnimatedNumber value={score} duration={1000} />
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[15px] font-extrabold" style={{ color: COLORS.accent }}>
            {grade}
          </span>
          <span className="text-[10px] text-muted-foreground font-semibold">{label}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CLIENT OSCILLATOR
// ============================================================================

function ClientOscillator({
  activeCategory,
  onCategoryChange,
  client,
}: {
  activeCategory: string;
  onCategoryChange: (id: string) => void;
  client: ClientData | null;
}) {
  return (
    <div className="rounded-2xl bg-card/50 backdrop-blur-xl border border-border p-3.5 mb-3.5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Category pills */}
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat.id;
            const color = COLORS[cat.color as keyof typeof COLORS] || COLORS.accent;
            return (
              <button
                key={cat.id}
                onClick={() => onCategoryChange(cat.id)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{
                  border: `1.5px solid ${active ? color : "hsl(var(--border))"}`,
                  background: active ? hexAlpha(color, 0.08) : "transparent",
                  color: active ? color : "hsl(var(--muted-foreground))",
                  fontWeight: active ? 700 : 500,
                }}
              >
                <span className="text-sm">{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Active client pill */}
        {client && (
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-muted/50 border border-border">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold font-mono"
              style={{
                background: hexAlpha(COLORS.accent, 0.12),
                border: `1.5px solid ${COLORS.accent}`,
                color: COLORS.accent,
              }}
            >
              {client.initials}
            </div>
            <div>
              <div className="text-[13px] font-bold leading-tight">{client.name}</div>
              <div className="text-[10px] text-muted-foreground font-mono">
                Round {client.round} · Joined {client.joined}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SPARKLINE
// ============================================================================

function Sparkline({ data, clientId }: { data: number[]; clientId: string }) {
  if (data.length < 2) return null;

  const w = 260;
  const h = 46;
  const mx = Math.max(...data);
  const mn = Math.min(...data);
  const rng = mx - mn || 1;

  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - mn) / rng) * (h - 8) - 4}`).join(" ");
  const lastY = h - ((data[data.length - 1] - mn) / rng) * (h - 8) - 4;
  const trending = data[data.length - 1] >= data[0];
  const lineColor = trending ? COLORS.green : COLORS.red;

  return (
    <svg width={w} height={h} className="block w-full">
      <defs>
        <linearGradient id={`tf-${clientId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.1" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#tf-${clientId})`} />
      <polyline points={pts} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={lastY} r="3" fill={lineColor} />
    </svg>
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
  const [activeCat, setActiveCat] = useState("best");
  const [filter, setFilter] = useState("All");
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const localTime = time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  // Fetch clients and categorize them
  useEffect(() => {
    async function fetchClients() {
      try {
        const res = await fetch("/api/clients?limit=50");
        if (res.ok) {
          const data = await res.json();
          // API returns { data: [...], pagination: {...} } format
          const clientList = data.data || data.clients || [];

          // Transform and categorize clients
          const transformed: ClientData[] = clientList.map((c: any, index: number) => {
            // Get latest scores from credit report data (use real data when available)
            const hasScores = c.latestScores && (c.latestScores.TRANSUNION || c.latestScores.EXPERIAN || c.latestScores.EQUIFAX);
            const tuScore = c.latestScores?.TRANSUNION || (hasScores ? 0 : 0);
            const exScore = c.latestScores?.EXPERIAN || (hasScores ? 0 : 0);
            const eqScore = c.latestScores?.EQUIFAX || (hasScores ? 0 : 0);

            // Previous scores for change calculation
            const prevTu = c.previousScores?.TRANSUNION || tuScore;
            const prevEx = c.previousScores?.EXPERIAN || exScore;
            const prevEq = c.previousScores?.EQUIFAX || eqScore;

            // Calculate composite (average of available scores)
            const availableScores = [tuScore, exScore, eqScore].filter(s => s > 0);
            const composite = availableScores.length > 0
              ? Math.round(availableScores.reduce((a, b) => a + b, 0) / availableScores.length)
              : 0;
            const prevAvailableScores = [prevTu, prevEx, prevEq].filter(s => s > 0);
            const prevComposite = prevAvailableScores.length > 0
              ? Math.round(prevAvailableScores.reduce((a, b) => a + b, 0) / prevAvailableScores.length)
              : 0;
            const change = composite - prevComposite;
            const round = c.currentRound || 0;

            // Determine category based on real data
            let category = "newest";
            let categoryLabel = "Newest Client";

            // Check if new client (within 14 days)
            const isNewClient = c.createdAt && new Date(c.createdAt) > new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

            if (!hasScores && isNewClient) {
              category = "newest";
              categoryLabel = "Newest Client";
            } else if (composite >= 680) {
              category = "best";
              categoryLabel = "Best Performing";
            } else if (change >= 50) {
              category = "improved";
              categoryLabel = "Most Improved";
            } else if (composite > 0 && composite < 500) {
              category = "help";
              categoryLabel = "Needs Most Help";
            } else if (change < -10) {
              category = "risk";
              categoryLabel = "At Risk";
            } else if (isNewClient) {
              category = "newest";
              categoryLabel = "Newest Client";
            }

            // Generate trend data based on actual score change
            const trendBase = prevComposite > 0 ? prevComposite - 20 : composite - 20;
            const trend = composite > 0
              ? Array.from({ length: 13 }, (_, i) => {
                  const progress = i / 12;
                  return Math.round(Math.max(300, trendBase + progress * (composite - trendBase)));
                })
              : Array.from({ length: 13 }, () => 0);

            // Use real utilization data when available
            const utilization = c.utilization ?? 0;

            // Calculate payment history estimate based on score
            const paymentHistory = composite >= 700 ? 95 : composite >= 650 ? 85 : composite >= 600 ? 70 : composite >= 500 ? 55 : 40;

            // Estimate account age based on client creation date
            const clientAgeMonths = c.createdAt
              ? Math.floor((Date.now() - new Date(c.createdAt).getTime()) / (30 * 24 * 60 * 60 * 1000))
              : 0;
            const accountAge = Math.min(10, Math.max(1, Math.floor(clientAgeMonths / 12) + 1));

            // Estimate credit mix based on dispute count
            const creditMix = Math.min(5, Math.max(1, Math.ceil((c.totalDisputes || 0) / 3) + 1));

            // Use 0 for unknown inquiries
            const inquiries = 0;

            // Use real negative accounts count
            const derogatoryMarks = c.negativeAccounts || 0;

            return {
              id: c.id,
              name: `${c.firstName} ${c.lastName}`,
              initials: `${c.firstName?.[0] || "?"}${c.lastName?.[0] || "?"}`.toUpperCase(),
              joined: new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
              round,
              category,
              categoryLabel,
              bureaus: [
                { id: "TU", name: "TransUnion", short: "TU", colorKey: "tu" as const, score: tuScore, prev: prevTu, goal: 750 },
                { id: "EX", name: "Experian", short: "EX", colorKey: "ex" as const, score: exScore, prev: prevEx, goal: 750 },
                { id: "EQ", name: "Equifax", short: "EQ", colorKey: "eq" as const, score: eqScore, prev: prevEq, goal: 750 },
              ],
              vitals: [
                { label: "Payment History", value: paymentHistory, max: 100, status: paymentHistory >= 90 ? "excellent" : paymentHistory >= 70 ? "building" : "critical", color: paymentHistory >= 90 ? "green" : paymentHistory >= 70 ? "yellow" : "red" },
                { label: "Credit Utilization", value: utilization, max: 100, status: utilization <= 30 ? "optimal" : utilization <= 50 ? "moderate" : "high", color: utilization <= 30 ? "green" : utilization <= 50 ? "yellow" : "red" },
                { label: "Account Age", value: accountAge, max: 10, unit: "yrs", status: accountAge >= 7 ? "mature" : accountAge >= 4 ? "building" : "new", color: accountAge >= 7 ? "green" : accountAge >= 4 ? "blue" : "yellow" },
                { label: "Credit Mix", value: creditMix, max: 5, unit: "types", status: creditMix >= 4 ? "diverse" : creditMix >= 2 ? "growing" : "limited", color: creditMix >= 4 ? "green" : creditMix >= 2 ? "blue" : "violet" },
                { label: "Hard Inquiries", value: inquiries, max: 10, status: inquiries <= 2 ? "minimal" : inquiries <= 5 ? "moderate" : "excessive", color: inquiries <= 2 ? "green" : inquiries <= 5 ? "yellow" : "red" },
                { label: "Derogatory Marks", value: derogatoryMarks, max: 10, status: derogatoryMarks === 0 ? "clear" : derogatoryMarks <= 2 ? "improving" : "severe", color: derogatoryMarks === 0 ? "green" : derogatoryMarks <= 2 ? "yellow" : "red" },
              ],
              trend,
              trendStart: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              trendEnd: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              amelia: hasScores
                ? generateAmeliaInsight(c.firstName, composite, change, derogatoryMarks, utilization)
                : `${c.firstName} is a new client. Upload their credit report to get started with dispute analysis and personalized recommendations.`,
              queue: generateClientQueue(c, actionQueue),
              deletions: c.deletedItems || 0,
              activeDisputes: c.activeDisputeCount || 0,
              successRate: c.successRate || 0,
            };
          });

          setClients(transformed);
        }
      } catch (error) {
        console.error("Failed to fetch clients:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchClients();
  }, [actionQueue]);

  // Create a placeholder client when no real clients exist
  const placeholderClient: ClientData = useMemo(() => ({
    id: "placeholder",
    name: "Add Your First Client",
    initials: "??",
    joined: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    round: 0,
    category: "newest",
    categoryLabel: "Get Started",
    bureaus: [
      { id: "TU", name: "TransUnion", short: "TU", colorKey: "tu" as const, score: 0, prev: 0, goal: 750 },
      { id: "EX", name: "Experian", short: "EX", colorKey: "ex" as const, score: 0, prev: 0, goal: 750 },
      { id: "EQ", name: "Equifax", short: "EQ", colorKey: "eq" as const, score: 0, prev: 0, goal: 750 },
    ],
    vitals: [
      { label: "Payment History", value: 0, max: 100, status: "pending", color: "blue" },
      { label: "Credit Utilization", value: 0, max: 100, status: "pending", color: "blue" },
      { label: "Account Age", value: 0, max: 10, unit: "yrs", status: "pending", color: "blue" },
      { label: "Credit Mix", value: 0, max: 5, unit: "types", status: "pending", color: "blue" },
      { label: "Hard Inquiries", value: 0, max: 10, status: "pending", color: "blue" },
      { label: "Derogatory Marks", value: 0, max: 10, status: "pending", color: "blue" },
    ],
    trend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    trendStart: "—",
    trendEnd: "—",
    amelia: "Welcome to Dispute2Go! Upload your first client's credit report to get started. I'll analyze it and help you identify the best disputes to file.",
    queue: [],
    deletions: 0,
    activeDisputes: 0,
    successRate: 0,
  }), []);

  // Get client for active category
  const client = useMemo(() => {
    const found = clients.find((c) => c.category === activeCat);
    return found || clients[0] || null;
  }, [clients, activeCat]);

  // Use placeholder if no clients
  const displayClient = client || (clients.length === 0 ? placeholderClient : null);
  const activeClient = displayClient || placeholderClient;

  // Calculate composite and changes
  const composite = getComposite(activeClient.bureaus);
  const avgChange = Math.round(activeClient.bureaus.reduce((a, b) => a + (b.score - b.prev), 0) / activeClient.bureaus.length);
  const trendStart = activeClient.trend[0] || 0;
  const catInfo = CATEGORIES.find((c) => c.id === activeCat);
  const catColor = COLORS[catInfo?.color as keyof typeof COLORS] || COLORS.accent;

  const QUEUE_FILTERS = ["All", "Urgent", "Letters", "Responses"];

  // Filter client queue
  const filteredQueue = activeClient.queue.filter((item) => {
    if (filter === "All") return true;
    if (filter === "Urgent") return item.color === "#ef4444";
    if (filter === "Letters") return item.title.toLowerCase().includes("letter");
    if (filter === "Responses") return item.title.toLowerCase().includes("response") || item.title.toLowerCase().includes("verified");
    return true;
  });

  // Show loading only briefly, then show the dashboard even with empty data
  if (loading && clients.length === 0) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full text-foreground relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-200px] right-[-100px] w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.035)_0%,transparent_70%)] blur-[80px]" />
        <div className="absolute bottom-[-100px] left-[-200px] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(6,182,212,0.018)_0%,transparent_70%)] blur-[60px]" />
      </div>

      <div className="relative z-10 max-w-[1280px] mx-auto">
        {/* Header */}
        <Reveal delay={30}>
          <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
            <div>
              <div className="text-[11px] text-muted-foreground font-mono tracking-widest mb-1">
                {getGreeting().toUpperCase()}
              </div>
              <h1 className="text-[28px] font-extrabold tracking-tight">{userName}</h1>
            </div>
            <div className="flex items-center gap-3">
              {/* Portfolio summary */}
              <div className="flex gap-4 px-4 py-2 rounded-lg bg-muted/50 border border-border">
                {[
                  { l: "Clients", v: stats.totalClients },
                  { l: "Active", v: stats.activeDisputes },
                  { l: "Deletions", v: stats.deletionsThisMonth },
                ].map((s, i) => (
                  <div key={i} className="text-center">
                    <div className="text-base font-extrabold leading-none">{s.v}</div>
                    <div className="text-[9px] text-muted-foreground font-mono mt-0.5">{s.l}</div>
                  </div>
                ))}
              </div>
              <span className="font-mono font-semibold text-[13px] tracking-wide">{localTime}</span>
              <Link
                href="/clients"
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-bold bg-primary text-primary-foreground shadow-lg transition-all hover:scale-105"
              >
                📋 Upload Report
              </Link>
            </div>
          </div>
        </Reveal>

        {/* Client Oscillator */}
        <Reveal delay={60}>
          <ClientOscillator activeCategory={activeCat} onCategoryChange={setActiveCat} client={displayClient} />
        </Reveal>

        {displayClient && (
          <div key={displayClient.id} className="animate-in fade-in duration-300">
            {/* Bureau Scores + Sidebar */}
            <Reveal delay={80}>
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_330px] gap-3.5 mb-3.5">
                {/* Score vitals */}
                <div className="rounded-2xl bg-card/50 backdrop-blur-xl border border-border p-6 relative overflow-hidden">
                  <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] rounded-full blur-[40px] pointer-events-none"
                    style={{ background: `radial-gradient(circle, ${hexAlpha(catColor, 0.025)} 0%, transparent 60%)` }}
                  />
                  <div className="relative">
                    <div className="flex justify-between items-center mb-5">
                      <div>
                        <div className="text-[10px] font-bold tracking-widest text-muted-foreground font-mono">CREDIT VITALS</div>
                        <div className="text-[15px] font-bold mt-0.5 flex items-center gap-2">
                          {displayClient.name} <Badge label={catInfo?.label || ""} color={catColor} />
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <Badge label={avgChange >= 0 ? `AVG +${avgChange}` : `AVG ${avgChange}`} color={avgChange >= 0 ? COLORS.green : COLORS.red} large />
                        <Badge label={`R${displayClient.round}`} color={COLORS.accent} large />
                      </div>
                    </div>

                    {/* 3 bureau arcs + composite */}
                    <div className="flex items-center justify-center gap-7 mb-5">
                      <BureauArc bureau={displayClient.bureaus[0]} size={100} strokeW={6} />
                      <div className="flex flex-col items-center">
                        <CompositeRing score={composite} size={140} strokeW={8} />
                        <div className="text-[9px] font-mono text-muted-foreground tracking-widest mt-1.5">COMPOSITE</div>
                      </div>
                      <BureauArc bureau={displayClient.bureaus[1]} size={100} strokeW={6} />
                    </div>
                    <div className="flex justify-center -mt-2 mb-2.5">
                      <BureauArc bureau={displayClient.bureaus[2]} size={100} strokeW={6} />
                    </div>

                    {/* Goal strip */}
                    <div
                      className="flex items-center justify-center gap-3.5 mt-2.5 px-4 py-2.5 rounded-lg"
                      style={{
                        background: hexAlpha(catColor, 0.03),
                        border: `1px solid ${hexAlpha(catColor, 0.07)}`,
                      }}
                    >
                      <BreathingDot color={catColor} />
                      <span className="text-xs text-muted-foreground">
                        Target: <strong className="text-emerald-600 dark:text-emerald-400">{displayClient.bureaus[0].goal}</strong>
                      </span>
                      <div className="w-px h-3.5 bg-border" />
                      <span className="text-xs text-muted-foreground">
                        Gap:{" "}
                        <strong style={{ color: displayClient.bureaus[0].goal - composite > 50 ? COLORS.accent : COLORS.green }}>
                          {displayClient.bureaus[0].goal - composite > 0 ? `+${displayClient.bureaus[0].goal - composite}` : "✓ Achieved"}
                        </strong>
                      </span>
                      <div className="w-px h-3.5 bg-border" />
                      <span className="text-xs text-muted-foreground">
                        Journey:{" "}
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          {Math.min(100, Math.round(((composite - 300) / (displayClient.bureaus[0].goal - 300)) * 100))}%
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right sidebar */}
                <div className="flex flex-col gap-3.5">
                  {/* Bureau breakdown */}
                  <div className="rounded-2xl bg-card/50 backdrop-blur-xl border border-border p-4">
                    <div className="text-[10px] font-bold tracking-widest text-muted-foreground font-mono mb-3">BUREAU BREAKDOWN</div>
                    {displayClient.bureaus.map((b, i) => {
                      const color = COLORS[b.colorKey];
                      const change = b.score - b.prev;
                      const pct = Math.max(0, ((b.score - 300) / (850 - 300)) * 100);
                      return (
                        <div key={b.id} className={i < displayClient.bureaus.length - 1 ? "mb-3.5" : ""}>
                          <div className="flex justify-between items-center mb-1.5">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-extrabold font-mono"
                                style={{ background: hexAlpha(color, 0.12), border: `1.5px solid ${color}`, color }}
                              >
                                {b.short}
                              </div>
                              <span className="text-[13px] font-semibold">{b.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[17px] font-extrabold" style={{ color }}>
                                {b.score}
                              </span>
                              <span
                                className="text-[11px] font-bold"
                                style={{ color: change > 0 ? COLORS.green : change < 0 ? COLORS.red : "hsl(var(--muted-foreground))" }}
                              >
                                {change > 0 ? "+" : ""}
                                {change}
                              </span>
                            </div>
                          </div>
                          <ProgressBar value={pct} max={100} color={color} height={4} />
                          <div className="flex justify-between mt-1">
                            <span className="text-[10px] text-muted-foreground font-mono">From {b.prev}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">Goal: {b.goal}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Trend */}
                  <div className="rounded-2xl bg-card/50 backdrop-blur-xl border border-border p-4">
                    <div className="text-[10px] font-bold tracking-widest text-muted-foreground font-mono mb-2.5">COMPOSITE TREND</div>
                    <Sparkline data={displayClient.trend} clientId={displayClient.id} />
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[10px] text-muted-foreground font-mono">{displayClient.trendStart}</span>
                      <span
                        className="text-[10px] font-bold"
                        style={{ color: composite >= trendStart ? COLORS.green : COLORS.red }}
                      >
                        {composite >= trendStart ? "+" : ""}
                        {composite - trendStart} composite
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">{displayClient.trendEnd}</span>
                    </div>
                  </div>

                  {/* Client stats */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { l: "Deletions", v: displayClient.deletions, c: COLORS.green },
                      { l: "Active", v: displayClient.activeDisputes, c: COLORS.blue },
                      { l: "Success", v: `${displayClient.successRate}%`, c: COLORS.accent },
                    ].map((s, i) => (
                      <div key={i} className="px-2.5 py-3 rounded-lg bg-muted/50 border border-border text-center">
                        <div className="text-xl font-extrabold leading-none" style={{ color: s.c }}>
                          {s.v}
                        </div>
                        <div className="text-[9px] text-muted-foreground font-mono mt-0.5">{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>

            {/* AMELIA Strip */}
            <Reveal delay={120}>
              <div
                className="rounded-2xl border p-3.5 mb-3.5"
                style={{
                  background: "linear-gradient(90deg, rgba(168,85,247,0.04), rgba(6,182,212,0.015))",
                  borderColor: hexAlpha(COLORS.purple, 0.08),
                }}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-[38px] h-[38px] rounded-xl flex items-center justify-center text-lg shrink-0"
                    style={{ background: hexAlpha(COLORS.purple, 0.12) }}
                  >
                    ✦
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[13px] font-bold" style={{ color: COLORS.purple }}>
                        AMELIA
                      </span>
                      <Badge label={`RE: ${displayClient.name.split(" ")[0]}`} color={COLORS.purple} />
                    </div>
                    <div className="text-[13px] text-muted-foreground leading-relaxed">{displayClient.amelia}</div>
                  </div>
                  <BreathingDot color={COLORS.purple} size={10} />
                </div>
              </div>
            </Reveal>

            {/* Credit Health Factors */}
            <Reveal delay={160}>
              <div className="mb-3.5">
                <div className="text-[10px] font-bold tracking-widest text-muted-foreground font-mono mb-2.5 pl-1">
                  CREDIT HEALTH FACTORS
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                  {displayClient.vitals.map((v, i) => {
                    const c = COLORS[v.color as keyof typeof COLORS] || COLORS.accent;
                    const isWarning = ["critical", "maxed", "severe", "excessive", "slipping", "rising", "new added", "high"].includes(v.status);
                    return (
                      <div
                        key={i}
                        className="px-3.5 py-3 rounded-lg transition-all"
                        style={{
                          background: isWarning ? hexAlpha(COLORS.red, 0.02) : "hsl(var(--muted) / 0.5)",
                          border: `1px solid ${isWarning ? hexAlpha(COLORS.red, 0.08) : "hsl(var(--border))"}`,
                        }}
                      >
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[11px] text-muted-foreground font-semibold">{v.label}</span>
                          <span className="text-[10px] font-bold font-mono uppercase" style={{ color: c }}>
                            {v.status}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-0.5 mb-1.5">
                          <span className="text-xl font-extrabold leading-none">{v.value}</span>
                          {v.unit && <span className="text-[11px] text-muted-foreground font-mono">{v.unit}</span>}
                          {!v.unit && <span className="text-[11px] text-muted-foreground font-mono">/{v.max}</span>}
                        </div>
                        <ProgressBar
                          value={v.label === "Credit Utilization" || v.label === "Hard Inquiries" || v.label === "Derogatory Marks" ? v.max - v.value : v.value}
                          max={v.max}
                          color={c}
                          height={4}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </Reveal>

            {/* Action Queue + Sidebar */}
            <Reveal delay={200}>
              <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-3.5">
                <div className="rounded-2xl bg-card/50 backdrop-blur-xl border border-border p-5">
                  <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[15px] font-bold">Action Queue</span>
                      <Badge
                        label={`${displayClient.queue.length} items`}
                        color={displayClient.queue.length > 0 ? COLORS.accent : COLORS.green}
                      />
                    </div>
                    <div className="flex gap-0.5">
                      {QUEUE_FILTERS.map((f) => (
                        <button
                          key={f}
                          onClick={() => setFilter(f)}
                          className="px-3 py-1.5 rounded-md text-xs transition-all"
                          style={{
                            border: `1px solid ${filter === f ? COLORS.accent : "hsl(var(--border))"}`,
                            background: filter === f ? hexAlpha(COLORS.accent, 0.06) : "transparent",
                            color: filter === f ? COLORS.accent : "hsl(var(--muted-foreground))",
                            fontWeight: filter === f ? 700 : 400,
                          }}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  {filteredQueue.length === 0 ? (
                    <div className="py-9 text-center">
                      <div
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-2.5"
                        style={{ background: hexAlpha(COLORS.green, 0.06), border: `1px solid ${hexAlpha(COLORS.green, 0.1)}` }}
                      >
                        <BreathingDot color={COLORS.green} />
                        <span className="text-[13px] font-bold" style={{ color: COLORS.green }}>
                          All Clear
                        </span>
                      </div>
                      <div className="text-[13px] text-muted-foreground">No pending actions for this client.</div>
                    </div>
                  ) : (
                    filteredQueue.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-3.5 py-3 rounded-lg mb-1.5 bg-muted/50 animate-in fade-in"
                        style={{ border: `1px solid ${item.color === "#ef4444" ? hexAlpha(COLORS.red, 0.08) : "hsl(var(--border))"}` }}
                      >
                        <div className="w-1 h-8 rounded-sm shrink-0" style={{ background: item.color }} />
                        <div className="flex-1">
                          <div className="text-[13px] font-semibold">{item.title}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">{item.sub}</div>
                        </div>
                        <span
                          className="text-[11px] font-mono"
                          style={{
                            color: item.color === "#ef4444" ? COLORS.red : "hsl(var(--muted-foreground))",
                            fontWeight: item.color === "#ef4444" ? 700 : 400,
                          }}
                        >
                          {item.time}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex flex-col gap-3.5">
                  <div className="rounded-2xl bg-card/50 backdrop-blur-xl border border-border p-5">
                    <div className="flex justify-between mb-2.5">
                      <span className="text-sm font-bold flex items-center gap-1.5">📩 Responses</span>
                      <Link href="/responses" className="text-xs font-semibold text-primary hover:underline">
                        View All →
                      </Link>
                    </div>
                    {responses.length === 0 ? (
                      <div className="py-3.5 text-center text-muted-foreground text-xs italic">Waiting on bureaus</div>
                    ) : (
                      responses.slice(0, 3).map((r) => (
                        <Link key={r.id} href={`/clients/${r.clientId}`}>
                          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors mb-1.5 cursor-pointer">
                            <div
                              className="w-8 h-8 rounded flex items-center justify-center text-[10px] font-bold text-white"
                              style={{
                                background: r.bureau === "TU" ? COLORS.tu : r.bureau === "EX" ? COLORS.ex : COLORS.eq,
                              }}
                            >
                              {r.bureau}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold truncate">{r.client}</div>
                              <div className="text-[10px] text-muted-foreground">{r.time}</div>
                            </div>
                            <div
                              className="px-2 py-1 rounded text-[10px] font-semibold"
                              style={{
                                background: r.result === "success" ? hexAlpha(COLORS.green, 0.15) : r.result === "stall" ? hexAlpha(COLORS.yellow, 0.15) : hexAlpha(COLORS.blue, 0.15),
                                color: r.result === "success" ? COLORS.green : r.result === "stall" ? COLORS.yellow : COLORS.blue,
                              }}
                            >
                              {r.result === "success" ? `${r.deleted} deleted` : r.result === "stall" ? "Stall" : "Mixed"}
                            </div>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>

                  <div className="rounded-2xl bg-card/50 backdrop-blur-xl border border-border p-5">
                    <div className="flex justify-between mb-2.5">
                      <span className="text-sm font-bold flex items-center gap-1.5">⏰ Deadlines</span>
                      <Link href="/responses" className="text-xs font-semibold text-primary hover:underline">
                        View All →
                      </Link>
                    </div>
                    {deadlines.length === 0 ? (
                      <div className="py-3.5 text-center text-muted-foreground text-xs italic">No active timers</div>
                    ) : (
                      deadlines.slice(0, 3).map((d) => (
                        <Link key={d.id} href={`/clients/${d.clientId}`}>
                          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors mb-1.5 cursor-pointer">
                            <div
                              className="w-9 h-9 rounded flex items-center justify-center text-[12px] font-bold"
                              style={{
                                background: d.daysLeft <= 5 ? hexAlpha(COLORS.red, 0.15) : d.daysLeft <= 10 ? hexAlpha(COLORS.yellow, 0.15) : hexAlpha(COLORS.green, 0.15),
                                color: d.daysLeft <= 5 ? COLORS.red : d.daysLeft <= 10 ? COLORS.yellow : COLORS.green,
                                border: `1px solid ${d.daysLeft <= 5 ? hexAlpha(COLORS.red, 0.3) : d.daysLeft <= 10 ? hexAlpha(COLORS.yellow, 0.3) : hexAlpha(COLORS.green, 0.3)}`,
                              }}
                            >
                              {d.daysLeft}d
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold truncate">{d.client}</div>
                              <div className="text-[10px] text-muted-foreground">
                                R{d.round} · {d.bureau} · Sent {d.sentDate}
                              </div>
                            </div>
                            {d.daysLeft <= 5 && (
                              <span
                                className="px-2 py-0.5 rounded text-[9px] font-bold uppercase"
                                style={{ background: hexAlpha(COLORS.red, 0.15), color: COLORS.red }}
                              >
                                Urgent
                              </span>
                            )}
                          </div>
                        </Link>
                      ))
                    )}
                  </div>

                  <div className="rounded-2xl bg-muted/50 border border-border p-5">
                    <div className="text-[13px] font-bold mb-2.5">Quick Actions</div>
                    {[
                      { l: "Upload Report", icon: "📋", primary: true, href: "/clients" },
                      { l: "New Dispute", icon: "✉️", href: "/disputes" },
                      { l: "View All Clients", icon: "👥", href: "/clients" },
                    ].map((a, i) => (
                      <Link key={i} href={a.href}>
                        <button
                          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-[13px] mb-1.5 text-left transition-all"
                          style={{
                            border: a.primary ? "none" : "1px solid hsl(var(--border))",
                            background: a.primary ? COLORS.accent : "hsl(var(--card))",
                            color: a.primary ? "#000" : "hsl(var(--muted-foreground))",
                            fontWeight: a.primary ? 700 : 500,
                          }}
                        >
                          <span>{a.icon}</span>
                          {a.l}
                        </button>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        )}
      </div>

      {/* Amelia Chat Drawer */}
      <AmeliaChatDrawer />
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateAmeliaInsight(
  firstName: string,
  composite: number,
  change: number,
  derogatoryMarks: number,
  utilization: number
): string {
  if (composite >= 700 && change > 0) {
    return `${firstName} is on track for excellent credit. All indicators are positive — focus on maintaining low utilization and avoiding new inquiries.`;
  } else if (change >= 50) {
    return `${firstName} gained ${change}+ composite points recently — exceptional progress. Continue the current strategy and consider targeting remaining derogatory marks.`;
  } else if (derogatoryMarks > 3) {
    return `${firstName}'s profile has ${derogatoryMarks} derogatory marks — this is the primary focus. Recommend disputing collections first as they have highest deletion rates.`;
  } else if (utilization > 70) {
    return `${firstName}'s utilization at ${utilization}% is hurting their score significantly. Recommend a paydown strategy targeting highest-balance cards first.`;
  } else if (change < -10) {
    return `${firstName}'s score dropped recently — investigate for new negative items or missed payments. Immediate review recommended.`;
  } else {
    return `${firstName}'s credit profile is stable. Continue monitoring and address any negative items as they appear on updated reports.`;
  }
}

function generateClientQueue(client: any, actionQueue: ActionQueueItem[]): Array<{ id: number; icon: string; title: string; sub: string; time: string; color: string }> {
  const queue: Array<{ id: number; icon: string; title: string; sub: string; time: string; color: string }> = [];

  // Find action queue items for this client
  const clientActions = actionQueue.filter((a) => a.client.id === client.id);

  clientActions.forEach((action, i) => {
    queue.push({
      id: i + 1,
      icon: action.type === "response" ? "📩" : action.type === "send" ? "📄" : action.type === "escalate" ? "🔴" : "📋",
      title: action.title,
      sub: action.detail,
      time: action.age,
      color: action.priority === "urgent" ? "#ef4444" : action.priority === "high" ? "#fbbf24" : "#60a5fa",
    });
  });

  // Add some default items if no actions
  if (queue.length === 0 && client.activeDisputes > 0) {
    queue.push({
      id: 1,
      icon: "📄",
      title: "Review dispute status",
      sub: `${client.activeDisputes || 0} active disputes pending`,
      time: "Check",
      color: "#60a5fa",
    });
  }

  return queue.slice(0, 4);
}
