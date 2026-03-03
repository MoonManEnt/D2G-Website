"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Sparkles, Crown, User, ArrowRight, CheckCircle2,
  Users, FileText, BarChart3, Shield, Upload, Zap,
  Brain, Scale, AlertTriangle, Palette, Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ── Motivational quotes ──
const QUOTES = [
  { text: "To be successful, you must act big, think big, and talk big.", author: "Reginald F. Lewis" },
  { text: "Don't wait for opportunity. Create it.", author: "Madam C.J. Walker" },
  { text: "If there is no struggle, there is no progress.", author: "Frederick Douglass" },
  { text: "The time is always right to do what is right.", author: "Martin Luther King Jr." },
  { text: "Build your own dreams, or someone else will hire you to build theirs.", author: "Farrah Gray" },
  { text: "I got my start by giving myself a start.", author: "Madam C.J. Walker" },
  { text: "Keep going. No matter what.", author: "Reginald F. Lewis" },
  { text: "You become what you believe.", author: "Oprah Winfrey" },
  { text: "Define yourself, or someone else will define you for you.", author: "Chadwick Boseman" },
  { text: "Education is the passport to the future, for tomorrow belongs to those who prepare for it today.", author: "Malcolm X" },
];

function getDailyQuote() {
  const day = Math.floor(Date.now() / 86400000);
  return QUOTES[day % QUOTES.length];
}

// ── Tier configuration ──
const TIER_CONFIG: Record<string, {
  name: string;
  icon: typeof Sparkles;
  gradient: string;
  badgeClass: string;
  limits: { clients: string; disputes: string; storage: string; seats: string };
  features: { name: string; icon: typeof Sparkles; description: string; href: string }[];
}> = {
  FREE: {
    name: "Free",
    icon: User,
    gradient: "from-slate-500/20 to-zinc-500/20",
    badgeClass: "bg-muted text-foreground",
    limits: { clients: "3", disputes: "10/mo", storage: "500 MB", seats: "1" },
    features: [
      { name: "Client Management", icon: Users, description: "Add and manage up to 3 clients", href: "/clients" },
      { name: "Credit Reports", icon: Upload, description: "Upload and parse IdentityIQ reports", href: "/clients" },
      { name: "AI Letters", icon: Zap, description: "Generate FCRA-compliant dispute letters", href: "/disputes" },
      { name: "Dispute Tracking", icon: FileText, description: "Track dispute status and responses", href: "/disputes" },
    ],
  },
  SOLO: {
    name: "Solo",
    icon: User,
    gradient: "from-blue-500/20 to-cyan-500/20",
    badgeClass: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    limits: { clients: "10", disputes: "40/mo", storage: "2 GB", seats: "1" },
    features: [
      { name: "Client Management", icon: Users, description: "Manage up to 10 clients", href: "/clients" },
      { name: "Credit DNA Analysis", icon: Brain, description: "AI-powered credit profile analysis and recommendations", href: "/clients" },
      { name: "AI Letters", icon: Zap, description: "Generate FCRA-compliant dispute letters", href: "/disputes" },
      { name: "Dispute Tracking", icon: FileText, description: "Track disputes and manage responses", href: "/disputes" },
    ],
  },
  STARTER: {
    name: "Starter",
    icon: Sparkles,
    gradient: "from-purple-500/20 to-indigo-500/20",
    badgeClass: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    limits: { clients: "50", disputes: "150/mo", storage: "10 GB", seats: "5" },
    features: [
      { name: "Client Management", icon: Users, description: "Manage up to 50 clients with team access", href: "/clients" },
      { name: "Bulk Disputes", icon: FileText, description: "Create and send multiple disputes at once", href: "/disputes" },
      { name: "Credit DNA Analysis", icon: Brain, description: "AI-powered credit profile insights", href: "/clients" },
      { name: "AI Letters", icon: Zap, description: "Generate dispute letters with AI precision", href: "/disputes" },
      { name: "Analytics Dashboard", icon: BarChart3, description: "Track performance metrics and outcomes", href: "/analytics" },
    ],
  },
  PROFESSIONAL: {
    name: "Professional",
    icon: Crown,
    gradient: "from-amber-500/20 to-orange-500/20",
    badgeClass: "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0",
    limits: { clients: "250", disputes: "500/mo", storage: "50 GB", seats: "15" },
    features: [
      { name: "Client Management", icon: Users, description: "Manage up to 250 clients with full team", href: "/clients" },
      { name: "Sentry Mode", icon: Bot, description: "AI-powered autonomous dispute workflow", href: "/clients" },
      { name: "Litigation Scanner", icon: Scale, description: "Identify potential FCRA violations", href: "/litigation" },
      { name: "CFPB Complaints", icon: AlertTriangle, description: "Generate professional CFPB complaint drafts", href: "/disputes" },
      { name: "Bulk Disputes", icon: FileText, description: "Create and send multiple disputes at once", href: "/disputes" },
      { name: "Credit DNA Analysis", icon: Brain, description: "AI-powered credit profile analysis", href: "/clients" },
      { name: "White-Label Branding", icon: Palette, description: "Customize letters with your branding", href: "/settings" },
      { name: "Analytics", icon: BarChart3, description: "Advanced performance metrics", href: "/analytics" },
    ],
  },
  ENTERPRISE: {
    name: "Enterprise",
    icon: Shield,
    gradient: "from-emerald-500/20 to-teal-500/20",
    badgeClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    limits: { clients: "Unlimited", disputes: "Unlimited", storage: "100 GB", seats: "Unlimited" },
    features: [
      { name: "Everything in Professional", icon: Crown, description: "All Professional features included", href: "/dashboard" },
      { name: "API Access", icon: Zap, description: "Integrate Dispute2Go with your systems", href: "/settings" },
      { name: "Custom Integrations", icon: Sparkles, description: "Build custom workflows and connections", href: "/settings" },
      { name: "Dedicated Support", icon: Shield, description: "Priority support and dedicated account manager", href: "/settings" },
    ],
  },
};

const CHECKLIST_KEY = "dispute2go_welcome_checklist";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  href: string;
  completed: boolean;
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: "add-client", label: "Add your first client", description: "Create a client profile to get started", href: "/clients?action=new", completed: false },
  { id: "upload-report", label: "Upload a credit report", description: "Import an IdentityIQ report for parsing", href: "/clients", completed: false },
  { id: "create-dispute", label: "Create your first dispute", description: "Generate AI-powered dispute letters", href: "/disputes", completed: false },
  { id: "explore-dashboard", label: "Explore your dashboard", description: "View your analytics and activity", href: "/dashboard", completed: false },
];

export default function WelcomePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);
  const quote = getDailyQuote();

  const tier = (session?.user as any)?.subscriptionTier || "FREE";
  const userName = session?.user?.name || "there";
  const firstName = userName.split(" ")[0];
  const config = TIER_CONFIG[tier] || TIER_CONFIG.FREE;
  const TierIcon = config.icon;

  // Load checklist from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(CHECKLIST_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setChecklist(DEFAULT_CHECKLIST.map((item) => ({
            ...item,
            completed: parsed[item.id] || false,
          })));
        } catch {
          // ignore parse errors
        }
      }
      // Mark that user has been through welcome (skip welcome modal)
      localStorage.setItem("dispute2go_checkout_completed", "true");
    }
  }, []);

  const toggleChecklist = (id: string) => {
    setChecklist((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      );
      // Persist to localStorage
      if (typeof window !== "undefined") {
        const state: Record<string, boolean> = {};
        updated.forEach((item) => { state[item.id] = item.completed; });
        localStorage.setItem(CHECKLIST_KEY, JSON.stringify(state));
      }
      return updated;
    });
  };

  const completedCount = checklist.filter((i) => i.completed).length;

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      {/* Hero Section */}
      <div className={`bg-gradient-to-r ${config.gradient} rounded-2xl p-8 border border-border relative overflow-hidden`}>
        {/* Decorative dots */}
        <div className="absolute top-4 right-4 opacity-20">
          <div className="grid grid-cols-4 gap-1.5">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-foreground/40" />
            ))}
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="bg-background/50 rounded-xl p-3 border border-border">
            <TierIcon className="w-8 h-8 text-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-foreground">
                Welcome, {firstName}!
              </h1>
              <Badge className={config.badgeClass}>{config.name}</Badge>
            </div>
            <p className="text-muted-foreground text-lg">
              {tier === "FREE"
                ? "Your free account is ready. Start managing clients and creating disputes."
                : `Your ${config.name} plan is active. All ${config.name} features are unlocked and ready to go.`}
            </p>
          </div>
        </div>

        {/* Quote */}
        <div className="mt-6 p-4 bg-background/30 rounded-lg border border-border/50">
          <p className="text-sm italic text-muted-foreground">
            &ldquo;{quote.text}&rdquo;
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            — {quote.author}
          </p>
        </div>
      </div>

      {/* Plan Limits */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Your Plan at a Glance</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Clients", value: config.limits.clients, icon: Users },
            { label: "Disputes", value: config.limits.disputes, icon: FileText },
            { label: "Storage", value: config.limits.storage, icon: Upload },
            { label: "Team Seats", value: config.limits.seats, icon: Users },
          ].map((item) => (
            <Card key={item.label} className="bg-card border-border">
              <CardContent className="pt-4 pb-4 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <item.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
                <p className="text-xl font-bold text-foreground">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Features Grid */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          {tier === "FREE" ? "What's Included" : "Features Unlocked"}
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {config.features.map((feature) => (
            <Card
              key={feature.name}
              className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer group"
              onClick={() => router.push(feature.href)}
            >
              <CardContent className="pt-4 pb-4 px-4 flex items-start gap-3">
                <div className="bg-primary/10 rounded-lg p-2 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {feature.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {feature.description}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Getting Started Checklist */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Getting Started</h2>
          <span className="text-xs text-muted-foreground">
            {completedCount}/{checklist.length} completed
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-muted rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / checklist.length) * 100}%` }}
          />
        </div>
        <div className="space-y-2">
          {checklist.map((item) => (
            <Card
              key={item.id}
              className={`bg-card border-border transition-colors ${item.completed ? "opacity-60" : ""}`}
            >
              <CardContent className="pt-3 pb-3 px-4 flex items-center gap-3">
                <button
                  onClick={() => toggleChecklist(item.id)}
                  className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    item.completed
                      ? "bg-primary border-primary"
                      : "border-muted-foreground/30 hover:border-primary/50"
                  }`}
                >
                  {item.completed && <CheckCircle2 className="w-4 h-4 text-primary-foreground" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${item.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => router.push(item.href)}
                >
                  Go <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="flex justify-center pt-2 pb-8">
        <Button
          size="lg"
          className="bg-primary text-primary-foreground hover:bg-primary/90 px-8"
          onClick={() => router.push("/clients?action=new")}
        >
          Let&apos;s Get Started <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
