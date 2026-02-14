"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Plus, Search, User, FileText, ChevronRight, Users, AlertTriangle, Clock,
  TrendingUp, Zap, LayoutGrid, List, Eye, Gavel, X, Mail, Phone, MapPin,
  Calendar, Shield, CheckCircle, Scale, AlertOctagon, Save, Loader2, Trash2, CreditCard,
} from "lucide-react";
import { CreditReportsPanel, ReportComparisonModal } from "@/components/client";
import { useToast } from "@/lib/use-toast";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import { GlassCard, Reveal } from "@/components/ui/glass-card";

// ═══════════════════════════════════════════════════════════
// D2G CLIENT COMMAND CENTER v2 - List Page
// ═══════════════════════════════════════════════════════════

// Safe date formatting helpers
const safeFormat = (dateStr: string | Date | null | undefined, formatStr: string) => {
  if (!dateStr) return "Unknown";
  try {
    const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
    if (isNaN(date.getTime())) return "Unknown";
    return format(date, formatStr);
  } catch {
    return "Unknown";
  }
};

const safeFormatDistance = (dateStr: string | Date | null | undefined) => {
  if (!dateStr) return "Never";
  try {
    const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
    if (isNaN(date.getTime())) return "Never";
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return "Never";
  }
};

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  dateOfBirth?: string | null;
  ssnLast4?: string | null;
  isActive: boolean;
  createdAt: string;
  priority: string;
  segment: string;
  stage: string;
  successRate: number | null;
  activeBureaus: string[];
  currentRound: number;
  derivedStage: string;
  lastActivity: string;
  activeDisputeCount: number;
  totalDisputes: number;
  latestDisputeStatus: string | null;
  _count: { reports: number; disputes: number };
}

interface ClientDetail {
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
  dateOfBirth: string | null;
  ssnLast4: string | null;
  createdAt: string;
  priority: string;
  segment: string;
  stage: string;
  _count: { reports: number; disputes: number };
  reports: { id: string }[];
  disputes: { id: string; status: string }[];
}

interface Stats {
  totalClients: number;
  urgentClients: number;
  activeDisputes: number;
  needsActionCount: number;
  newThisWeek: number;
  avgSuccessRate: number;
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { type: "spring" as const, damping: 25, stiffness: 300 } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

// ═══════════════════════════════════════════════════════════
// METRIC STRIP - 6 KPI cards at top
// ═══════════════════════════════════════════════════════════
function MetricStrip({ stats }: { stats: Stats | null }) {
  if (!stats) return null;

  const metrics = [
    { label: "Total Clients", value: stats.totalClients, icon: "👥", color: null },
    { label: "Urgent", value: stats.urgentClients, icon: "⚠️", color: "red" },
    { label: "Active Cases", value: stats.activeDisputes, icon: "📋", color: "blue" },
    { label: "Needs Action", value: stats.needsActionCount, icon: "⏰", color: "amber" },
    { label: "Success Rate", value: `${stats.avgSuccessRate}%`, icon: "📈", color: "green" },
    { label: "New This Week", value: stats.newThisWeek, icon: "⚡", color: "purple" },
  ];

  const colorMap: Record<string, string> = {
    red: "text-red-400",
    blue: "text-blue-400",
    amber: "text-amber-400",
    green: "text-emerald-400",
    purple: "text-purple-400",
  };

  return (
    <div className="grid grid-cols-6 gap-3 mb-4">
      {metrics.map((m, i) => (
        <Reveal key={i} delay={40 + i * 20}>
          <div className="p-4 rounded-xl bg-card/50 dark:bg-white/[0.025] border border-border flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-lg">
              {m.icon}
            </div>
            <div>
              <div className={`text-xl font-bold ${m.color ? colorMap[m.color] : "text-foreground"} ${m.value === 0 ? "text-muted-foreground" : ""}`}>
                {m.value}
              </div>
              <div className="text-[10px] text-muted-foreground font-mono tracking-wide">{m.label}</div>
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// BADGE COMPONENTS
// ═══════════════════════════════════════════════════════════
function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    URGENT: { bg: "bg-red-500/20", text: "text-red-400", label: "Urgent" },
    HIGH: { bg: "bg-orange-500/20", text: "text-orange-400", label: "High" },
    STANDARD: { bg: "bg-muted/50", text: "text-muted-foreground", label: "Standard" },
    LOW: { bg: "bg-muted/20", text: "text-muted-foreground", label: "Low" },
  };
  const { bg, text, label } = config[priority] || config.STANDARD;
  return <Badge className={`${bg} ${text} text-xs font-medium border-0`}>{label}</Badge>;
}

function SegmentBadge({ segment }: { segment: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    VIP: { bg: "bg-amber-500/20", text: "text-amber-400", label: "VIP" },
    RETURNING: { bg: "bg-blue-500/20", text: "text-blue-400", label: "Returning" },
    NEW: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "New" },
    STANDARD: { bg: "bg-muted/50", text: "text-muted-foreground", label: "Standard" },
  };
  const { bg, text, label } = config[segment] || config.STANDARD;
  return <Badge className={`${bg} ${text} text-xs font-medium border-0`}>{label}</Badge>;
}

function StageBadge({ stage }: { stage: string }) {
  const getStageLabel = (s: string) => {
    if (s.startsWith("ROUND_")) return `Round ${s.split("_")[1]}`;
    const labels: Record<string, string> = {
      INTAKE: "Intake", ANALYSIS: "Analysis", AWAITING_RESPONSE: "Awaiting",
      MAINTENANCE: "Maintenance", COMPLETED: "Completed", ESCALATED: "Escalated",
    };
    return labels[s] || s;
  };

  const getStageColor = (s: string) => {
    if (s.startsWith("ROUND_")) return "bg-purple-500/20 text-purple-400";
    const colors: Record<string, string> = {
      INTAKE: "bg-violet-500/20 text-violet-400", ANALYSIS: "bg-blue-500/20 text-blue-400",
      AWAITING_RESPONSE: "bg-amber-500/20 text-amber-400", MAINTENANCE: "bg-emerald-500/20 text-emerald-400",
      COMPLETED: "bg-emerald-500/20 text-emerald-400", ESCALATED: "bg-red-500/20 text-red-400",
    };
    return colors[s] || "bg-muted/50 text-muted-foreground";
  };

  return <Badge className={`${getStageColor(stage)} text-xs font-medium border-0`}>{getStageLabel(stage)}</Badge>;
}

function BureauBadges({ bureaus }: { bureaus: string[] }) {
  if (bureaus.length === 0) return <span className="text-muted-foreground text-xs">—</span>;

  const colors: Record<string, string> = {
    TU: "bg-cyan-500/20 text-cyan-400",
    EQ: "bg-rose-500/20 text-rose-400",
    EX: "bg-violet-500/20 text-violet-400",
  };

  return (
    <div className="flex gap-1">
      {bureaus.map((bureau) => (
        <span key={bureau} className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${colors[bureau] || "bg-muted/50 text-muted-foreground"}`}>
          {bureau}
        </span>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ACTION TOOLBAR - Eye · Gavel · Trash
// ═══════════════════════════════════════════════════════════
function ActionToolbar({
  onView,
  onGavel,
  onDelete,
}: {
  onView: (e: React.MouseEvent) => void;
  onGavel: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <button onClick={onView} className="p-2 rounded-lg hover:bg-cyan-500/10 transition-colors" title="Quick View">
        <Eye className="w-4 h-4 text-cyan-400" />
      </button>
      <button onClick={onGavel} className="p-2 rounded-lg hover:bg-purple-500/10 transition-colors" title="Gavel - Disputes">
        <Gavel className="w-4 h-4 text-purple-400" />
      </button>
      <button onClick={onDelete} className="p-2 rounded-lg hover:bg-red-500/10 transition-colors" title="Delete">
        <Trash2 className="w-4 h-4 text-red-400" />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CLIENT QUICK VIEW MODAL
// ═══════════════════════════════════════════════════════════
function ClientQuickViewModal({
  client,
  isOpen,
  onClose,
  onUpdate,
}: {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"profile" | "reports">("reports");
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [comparisonReports, setComparisonReports] = useState<unknown[]>([]);
  const [editForm, setEditForm] = useState({
    email: "", phone: "", addressLine1: "", addressLine2: "",
    city: "", state: "", zipCode: "", dateOfBirth: "", ssnLast4: "",
  });
  const [accountStats, setAccountStats] = useState({ totalAccounts: 0, negativeItems: 0, highSeverity: 0 });

  const fetchClientDetail = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`);
      if (res.ok) {
        const data = await res.json();
        const clientData = data.client || data;
        setDetail(clientData);
        setEditForm({
          email: clientData.email || "", phone: clientData.phone || "",
          addressLine1: clientData.addressLine1 || "", addressLine2: clientData.addressLine2 || "",
          city: clientData.city || "", state: clientData.state || "",
          zipCode: clientData.zipCode || "",
          dateOfBirth: clientData.dateOfBirth ? clientData.dateOfBirth.split("T")[0] : "",
          ssnLast4: clientData.ssnLast4 || "",
        });
        const accountsRes = await fetch(`/api/accounts/negative?clientId=${client.id}`);
        if (accountsRes.ok) {
          const accountsData = await accountsRes.json();
          setAccountStats({
            totalAccounts: accountsData.total || 0,
            negativeItems: accountsData.negative || 0,
            highSeverity: accountsData.highSeverity || 0,
          });
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (isOpen && client) fetchClientDetail();
  }, [isOpen, client, fetchClientDetail]);

  const handleSave = async () => {
    if (!client) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editForm, dateOfBirth: editForm.dateOfBirth || null }),
      });
      if (res.ok) {
        toast({ title: "Client Updated", description: "Changes saved successfully." });
        onUpdate();
        fetchClientDetail();
      } else {
        toast({ title: "Error", description: "Failed to save changes", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (permanent: boolean) => {
    if (!client) return;
    setDeleting(true);
    try {
      const url = permanent ? `/api/clients/${client.id}?permanent=true` : `/api/clients/${client.id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (res.ok) {
        toast({
          title: permanent ? "Client Deleted" : "Client Archived",
          description: permanent ? "Client and all data permanently deleted." : "Client archived. Can be restored within 90 days.",
        });
        onClose();
        onUpdate();
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error.error || "Failed to delete", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" });
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!client) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div variants={backdropVariants} initial="hidden" animate="visible" exit="exit" className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit" className="w-full max-w-5xl max-h-[85vh] flex flex-col">
              <div className="flex-1 min-h-0 rounded-2xl bg-background/80 backdrop-blur-xl border border-border shadow-2xl shadow-black/50 flex flex-col overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none" />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

                {/* Header */}
                <div className="relative px-4 py-3 border-b border-border flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/30 to-purple-500/30 flex items-center justify-center border-2 border-primary/30 flex-shrink-0">
                      <span className="text-sm font-bold text-foreground">{client.firstName.charAt(0)}{client.lastName.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-bold text-foreground">{client.firstName} {client.lastName}</h2>
                      <p className="text-muted-foreground text-xs">Client since {detail ? safeFormat(detail.createdAt, "M/d/yyyy") : "..."}</p>
                    </div>
                    <div className="flex items-center gap-0.5 bg-card rounded-lg p-0.5">
                      <button onClick={() => setActiveTab("reports")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === "reports" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
                        <CreditCard className="w-3.5 h-3.5" />Credit Reports
                      </button>
                      <button onClick={() => setActiveTab("profile")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === "profile" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
                        <User className="w-3.5 h-3.5" />Profile
                      </button>
                    </div>
                    <button onClick={onClose} className="ml-3 p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0">
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="relative flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
                  {activeTab === "reports" ? (
                    <CreditReportsPanel
                      clientId={client.id}
                      clientName={`${client.firstName} ${client.lastName}`}
                      onStartDisputes={() => { onClose(); router.push(`/disputes?clientId=${client.id}`); }}
                      onCompareAll={(reports) => { setComparisonReports(reports); setShowComparisonModal(true); }}
                    />
                  ) : loading ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                        <div className="p-3 rounded-xl bg-card border border-border text-center"><FileText className="w-5 h-5 mx-auto mb-1 text-primary" /><p className="text-xl font-bold text-foreground">{client._count?.reports || 0}</p><p className="text-[10px] text-muted-foreground">Reports</p></div>
                        <div className="p-3 rounded-xl bg-card border border-border text-center"><Users className="w-5 h-5 mx-auto mb-1 text-purple-400" /><p className="text-xl font-bold text-foreground">{accountStats.totalAccounts}</p><p className="text-[10px] text-muted-foreground">Accounts</p></div>
                        <div className="p-3 rounded-xl bg-card border border-border text-center"><AlertTriangle className="w-5 h-5 mx-auto mb-1 text-amber-400" /><p className="text-xl font-bold text-amber-400">{accountStats.negativeItems}</p><p className="text-[10px] text-muted-foreground">Negative Items</p></div>
                        <div className="p-3 rounded-xl bg-card border border-border text-center"><AlertOctagon className="w-5 h-5 mx-auto mb-1 text-red-400" /><p className="text-xl font-bold text-red-400">{accountStats.highSeverity}</p><p className="text-[10px] text-muted-foreground">High Severity</p></div>
                        <div className="p-3 rounded-xl bg-card border border-border text-center"><Scale className="w-5 h-5 mx-auto mb-1 text-emerald-400" /><p className="text-xl font-bold text-foreground">{client.totalDisputes}</p><p className="text-[10px] text-muted-foreground">Disputes</p></div>
                        <div className="p-3 rounded-xl bg-card border border-border text-center"><CheckCircle className="w-5 h-5 mx-auto mb-1 text-emerald-400" /><p className="text-xl font-bold text-emerald-400">{client.successRate !== null ? `${client.successRate}%` : "—"}</p><p className="text-[10px] text-muted-foreground">Success</p></div>
                      </div>

                      <div className="rounded-xl bg-card/30 border border-border p-4">
                        <h3 className="text-sm font-semibold text-foreground mb-4">Contact Information</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email</Label><Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="email@example.com" className="bg-muted border-input text-foreground h-9" /></div>
                          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Phone</Label><Input type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="(555) 555-5555" className="bg-muted border-input text-foreground h-9" /></div>
                          <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs text-muted-foreground flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Street Address</Label><Input value={editForm.addressLine1} onChange={(e) => setEditForm({ ...editForm, addressLine1: e.target.value })} placeholder="123 Main Street" className="bg-muted border-input text-foreground h-9" /></div>
                          <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs text-muted-foreground">Apt/Suite/Unit</Label><Input value={editForm.addressLine2} onChange={(e) => setEditForm({ ...editForm, addressLine2: e.target.value })} placeholder="Apt 4B" className="bg-muted border-input text-foreground h-9" /></div>
                          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">City</Label><Input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} placeholder="City" className="bg-muted border-input text-foreground h-9" /></div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">State</Label><Input value={editForm.state} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} placeholder="TX" maxLength={2} className="bg-muted border-input text-foreground h-9 uppercase" /></div>
                            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">ZIP</Label><Input value={editForm.zipCode} onChange={(e) => setEditForm({ ...editForm, zipCode: e.target.value })} placeholder="12345" className="bg-muted border-input text-foreground h-9" /></div>
                          </div>
                          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Date of Birth</Label><Input type="date" value={editForm.dateOfBirth} onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })} className="bg-muted border-input text-foreground h-9" /></div>
                          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Last 4 of SSN</Label><Input type="text" value={editForm.ssnLast4} onChange={(e) => { const val = e.target.value.replace(/\D/g, "").slice(0, 4); setEditForm({ ...editForm, ssnLast4: val }); }} placeholder="••••" maxLength={4} className="bg-muted border-input text-foreground h-9 font-mono" /></div>
                        </div>
                      </div>

                      <div className="rounded-xl bg-card/30 border border-border p-4">
                        <h3 className="text-sm font-semibold text-foreground mb-3">Quick Info</h3>
                        <div className="flex flex-wrap gap-2">
                          <PriorityBadge priority={client.priority} />
                          <SegmentBadge segment={client.segment} />
                          <StageBadge stage={client.derivedStage || client.stage} />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground"><Clock className="w-4 h-4" /><span>Last active: {client.lastActivity ? safeFormatDistance(client.lastActivity) : "Never"}</span></div>
                          <div className="flex items-center gap-2 text-muted-foreground"><span>Bureaus:</span><BureauBadges bureaus={client.activeBureaus} /></div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className="relative px-4 py-2.5 border-t border-border flex-shrink-0">
                  {activeTab === "reports" ? (
                    <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={onClose}>Close</Button></div>
                  ) : showDeleteConfirm ? (
                    <div className="space-y-3">
                      <p className="text-sm text-foreground">How do you want to remove this client?</p>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleDelete(false)} disabled={deleting} className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10">{deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Archive (90 days)</Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(true)} disabled={deleting} className="border-red-500/50 text-red-400 hover:bg-red-500/10">{deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Delete Permanently</Button>
                        <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between">
                      <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(true)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5 mr-1.5" />Delete</Button>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
                        <Button size="sm" onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">{saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}Save Changes</Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          <ReportComparisonModal isOpen={showComparisonModal} onClose={() => setShowComparisonModal(false)} reports={comparisonReports as Parameters<typeof ReportComparisonModal>[0]["reports"]} clientName={`${client.firstName} ${client.lastName}`} />
        </>
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════
export default function ClientsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [quickViewClient, setQuickViewClient] = useState<Client | null>(null);
  const [hardDeleteClient, setHardDeleteClient] = useState<Client | null>(null);
  const [isHardDeleting, setIsHardDeleting] = useState(false);
  const [newClient, setNewClient] = useState({
    firstName: "", lastName: "", email: "", phone: "", addressLine1: "",
    city: "", state: "", zipCode: "", ssnLast4: "", priority: "STANDARD", segment: "NEW",
  });

  const fetchClients = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (stageFilter !== "all") params.set("stage", stageFilter);
      if (segmentFilter !== "all") params.set("segment", segmentFilter);

      const res = await fetch(`/api/clients?${params.toString()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setClients(Array.isArray(data) ? data : data.data || []);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/clients/stats", { cache: "no-store" });
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchClients();
    fetchStats();
  }, [searchQuery, priorityFilter, stageFilter, segmentFilter]);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (session?.user?.subscriptionTier === "FREE") {
      toast({ title: "Upgrade Required", description: "Free plan is limited to viewing. Upgrade to Pro to add clients.", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newClient),
      });
      if (res.ok) {
        toast({ title: "Client Added", description: `${newClient.firstName} ${newClient.lastName} has been added.` });
        setIsAddDialogOpen(false);
        setNewClient({ firstName: "", lastName: "", email: "", phone: "", addressLine1: "", city: "", state: "", zipCode: "", ssnLast4: "", priority: "STANDARD", segment: "NEW" });
        fetchClients();
        fetchStats();
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error.message || error.error || "Failed to add client", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" });
    }
  };

  const handleQuickView = (e: React.MouseEvent, client: Client) => { e.stopPropagation(); setQuickViewClient(client); };
  const handleDisputeAction = (e: React.MouseEvent, client: Client) => { e.stopPropagation(); router.push(`/disputes?clientId=${client.id}`); };
  const handleHardDeleteClick = (e: React.MouseEvent, client: Client) => { e.stopPropagation(); setHardDeleteClient(client); };

  const handleConfirmHardDelete = async () => {
    if (!hardDeleteClient) return;
    setIsHardDeleting(true);
    try {
      const res = await fetch(`/api/clients/${hardDeleteClient.id}?permanent=true`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Client Permanently Deleted", description: `${hardDeleteClient.firstName} ${hardDeleteClient.lastName} and all associated data have been permanently removed.` });
        setHardDeleteClient(null);
        fetchClients();
        fetchStats();
      } else {
        const error = await res.json();
        toast({ title: "Delete Failed", description: error.error || "Failed to delete client", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" });
    } finally {
      setIsHardDeleting(false);
    }
  };

  return (
    <motion.div className="min-h-screen relative" initial="hidden" animate="visible" variants={containerVariants}>
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-200px] right-[-100px] w-[600px] h-[600px] rounded-full bg-gradient-radial from-amber-500/5 to-transparent blur-3xl" />
        <div className="absolute bottom-[-100px] left-[-200px] w-[500px] h-[500px] rounded-full bg-gradient-radial from-cyan-500/5 to-transparent blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto p-6 space-y-4">
        {/* Quick View Modal */}
        <ClientQuickViewModal client={quickViewClient} isOpen={!!quickViewClient} onClose={() => setQuickViewClient(null)} onUpdate={() => { fetchClients(); fetchStats(); }} />

        {/* Header */}
        <Reveal delay={20}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Client Command Center</h1>
              <p className="text-muted-foreground text-sm mt-1">Manage and track your client portfolio</p>
            </div>
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex gap-0.5 p-0.5 rounded-lg bg-card border border-border">
                <button onClick={() => setViewMode("list")} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  <List className="w-4 h-4" />
                </button>
                <button onClick={() => setViewMode("grid")} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
              <ResponsiveDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <ResponsiveDialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-2" />Add Client</Button>
                </ResponsiveDialogTrigger>
                <ResponsiveDialogContent size="sm">
                  <ResponsiveDialogHeader>
                    <ResponsiveDialogTitle>Add New Client</ResponsiveDialogTitle>
                    <ResponsiveDialogDescription>Enter the client&apos;s information to create their profile.</ResponsiveDialogDescription>
                  </ResponsiveDialogHeader>
                  <form onSubmit={handleAddClient}>
                    <ResponsiveDialogBody className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label htmlFor="firstName" className="text-foreground">First Name</Label><Input id="firstName" value={newClient.firstName} onChange={(e) => setNewClient({ ...newClient, firstName: e.target.value })} required className="bg-muted border-input text-foreground" /></div>
                        <div className="space-y-2"><Label htmlFor="lastName" className="text-foreground">Last Name</Label><Input id="lastName" value={newClient.lastName} onChange={(e) => setNewClient({ ...newClient, lastName: e.target.value })} required className="bg-muted border-input text-foreground" /></div>
                      </div>
                      <div className="space-y-2"><Label htmlFor="email" className="text-foreground">Email</Label><Input id="email" type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} className="bg-muted border-input text-foreground" /></div>
                      <div className="space-y-2"><Label htmlFor="phone" className="text-foreground">Phone</Label><Input id="phone" type="tel" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} className="bg-muted border-input text-foreground" /></div>
                      <div className="space-y-2"><Label htmlFor="addressLine1" className="text-foreground">Street Address</Label><Input id="addressLine1" value={newClient.addressLine1} onChange={(e) => setNewClient({ ...newClient, addressLine1: e.target.value })} placeholder="123 Main Street" className="bg-muted border-input text-foreground" /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label htmlFor="city" className="text-foreground">City</Label><Input id="city" value={newClient.city} onChange={(e) => setNewClient({ ...newClient, city: e.target.value })} className="bg-muted border-input text-foreground" /></div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-2"><Label htmlFor="state" className="text-foreground">State</Label><Input id="state" value={newClient.state} onChange={(e) => setNewClient({ ...newClient, state: e.target.value.toUpperCase() })} placeholder="TX" maxLength={2} className="bg-muted border-input text-foreground uppercase" /></div>
                          <div className="space-y-2"><Label htmlFor="zipCode" className="text-foreground">ZIP</Label><Input id="zipCode" value={newClient.zipCode} onChange={(e) => setNewClient({ ...newClient, zipCode: e.target.value })} placeholder="12345" maxLength={10} className="bg-muted border-input text-foreground" /></div>
                        </div>
                      </div>
                      <div className="space-y-2"><Label htmlFor="ssnLast4" className="text-foreground">Last 4 of SSN</Label><Input id="ssnLast4" value={newClient.ssnLast4} onChange={(e) => { const val = e.target.value.replace(/\D/g, "").slice(0, 4); setNewClient({ ...newClient, ssnLast4: val }); }} placeholder="••••" maxLength={4} className="bg-muted border-input text-foreground font-mono" /><p className="text-xs text-muted-foreground">Required for CRA identification on dispute letters</p></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label className="text-foreground">Priority</Label><Select value={newClient.priority} onValueChange={(v) => setNewClient({ ...newClient, priority: v })}><SelectTrigger className="bg-muted border-input text-foreground"><SelectValue /></SelectTrigger><SelectContent className="bg-card border-border"><SelectItem value="URGENT">Urgent</SelectItem><SelectItem value="HIGH">High</SelectItem><SelectItem value="STANDARD">Standard</SelectItem><SelectItem value="LOW">Low</SelectItem></SelectContent></Select></div>
                        <div className="space-y-2"><Label className="text-foreground">Segment</Label><Select value={newClient.segment} onValueChange={(v) => setNewClient({ ...newClient, segment: v })}><SelectTrigger className="bg-muted border-input text-foreground"><SelectValue /></SelectTrigger><SelectContent className="bg-card border-border"><SelectItem value="VIP">VIP</SelectItem><SelectItem value="RETURNING">Returning</SelectItem><SelectItem value="NEW">New</SelectItem><SelectItem value="STANDARD">Standard</SelectItem></SelectContent></Select></div>
                      </div>
                    </ResponsiveDialogBody>
                    <ResponsiveDialogFooter>
                      <Button type="button" variant="ghost" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                      <Button type="submit">Add Client</Button>
                    </ResponsiveDialogFooter>
                  </form>
                </ResponsiveDialogContent>
              </ResponsiveDialog>
            </div>
          </div>
        </Reveal>

        {/* Metric Strip */}
        <MetricStrip stats={stats} />

        {/* Filter Bar */}
        <Reveal delay={100}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search by name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-card/50 border-border text-foreground" />
            </div>
            <div className="flex gap-2">
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[130px] bg-card/50 border-border text-foreground"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent className="bg-card border-border"><SelectItem value="all">All Priority</SelectItem><SelectItem value="URGENT">Urgent</SelectItem><SelectItem value="HIGH">High</SelectItem><SelectItem value="STANDARD">Standard</SelectItem><SelectItem value="LOW">Low</SelectItem></SelectContent>
              </Select>
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-[130px] bg-card/50 border-border text-foreground"><SelectValue placeholder="Stage" /></SelectTrigger>
                <SelectContent className="bg-card border-border"><SelectItem value="all">All Stages</SelectItem><SelectItem value="INTAKE">Intake</SelectItem><SelectItem value="ROUND_1">Round 1</SelectItem><SelectItem value="ROUND_2">Round 2</SelectItem><SelectItem value="ROUND_3">Round 3</SelectItem><SelectItem value="ROUND_4">Round 4</SelectItem><SelectItem value="COMPLETED">Completed</SelectItem></SelectContent>
              </Select>
              <Select value={segmentFilter} onValueChange={setSegmentFilter}>
                <SelectTrigger className="w-[130px] bg-card/50 border-border text-foreground"><SelectValue placeholder="Segment" /></SelectTrigger>
                <SelectContent className="bg-card border-border"><SelectItem value="all">All Segments</SelectItem><SelectItem value="VIP">VIP</SelectItem><SelectItem value="RETURNING">Returning</SelectItem><SelectItem value="NEW">New</SelectItem><SelectItem value="STANDARD">Standard</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
        </Reveal>

        {/* Clients Table */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading clients...</div>
        ) : clients.length === 0 ? (
          <Reveal delay={140}>
            <div className="rounded-2xl bg-card/40 border border-border py-12 text-center">
              <User className="w-12 h-12 mx-auto text-muted-foreground/50" />
              <h3 className="text-lg font-medium text-foreground mt-4">No clients found</h3>
              <p className="text-muted-foreground mt-2">{searchQuery || priorityFilter !== "all" || stageFilter !== "all" ? "Try adjusting your filters" : "Add your first client to get started"}</p>
            </div>
          </Reveal>
        ) : viewMode === "list" ? (
          <Reveal delay={140}>
            <div className="rounded-2xl bg-card/40 border border-border overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-card/60 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <div className="col-span-3">Client</div>
                <div className="col-span-1">Priority</div>
                <div className="col-span-1">Segment</div>
                <div className="col-span-1">Stage</div>
                <div className="col-span-1">Disputes</div>
                <div className="col-span-1">Success</div>
                <div className="col-span-1">Bureaus</div>
                <div className="col-span-2">Last Active</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-border/30">
                {clients.map((client, index) => (
                  <motion.div
                    key={client.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => router.push(`/clients/${client.id}`)}
                    className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors items-center group"
                  >
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center border border-input/50">
                        <span className="text-sm font-medium text-foreground">{client.firstName.charAt(0)}{client.lastName.charAt(0)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{client.firstName} {client.lastName}</p>
                        <p className="text-xs text-muted-foreground truncate">{client.email || "No email"}</p>
                      </div>
                    </div>
                    <div className="col-span-1"><PriorityBadge priority={client.priority} /></div>
                    <div className="col-span-1"><SegmentBadge segment={client.segment} /></div>
                    <div className="col-span-1"><StageBadge stage={client.derivedStage || client.stage} /></div>
                    <div className="col-span-1"><span className="text-foreground text-sm">{client.activeDisputeCount}/{client.totalDisputes}</span></div>
                    <div className="col-span-1">
                      {client.successRate !== null ? (
                        <span className={`font-medium text-sm ${client.successRate >= 70 ? "text-emerald-400" : client.successRate >= 40 ? "text-amber-400" : "text-muted-foreground"}`}>{client.successRate}%</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="col-span-1"><BureauBadges bureaus={client.activeBureaus} /></div>
                    <div className="col-span-2"><span className="text-sm text-muted-foreground">{client.lastActivity ? safeFormatDistance(client.lastActivity) : "Never"}</span></div>
                    <div className="col-span-1 flex items-center justify-end">
                      <ActionToolbar
                        onView={(e) => handleQuickView(e, client)}
                        onGavel={(e) => handleDisputeAction(e, client)}
                        onDelete={(e) => handleHardDeleteClick(e, client)}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </Reveal>
        ) : (
          /* Grid View */
          <Reveal delay={140}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {clients.map((client, index) => (
                <motion.div
                  key={client.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => router.push(`/clients/${client.id}`)}
                  className="relative rounded-xl bg-card/40 border border-border p-4 hover:bg-card/60 hover:border-input/50 transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center border border-input/50">
                        <span className="font-medium text-foreground">{client.firstName.charAt(0)}{client.lastName.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{client.firstName} {client.lastName}</p>
                        <p className="text-xs text-muted-foreground">{client.email || "No email"}</p>
                      </div>
                    </div>
                    <ActionToolbar
                      onView={(e) => handleQuickView(e, client)}
                      onGavel={(e) => handleDisputeAction(e, client)}
                      onDelete={(e) => handleHardDeleteClick(e, client)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <PriorityBadge priority={client.priority} />
                    <SegmentBadge segment={client.segment} />
                    <StageBadge stage={client.derivedStage || client.stage} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-muted/30">
                      <p className="text-lg font-bold text-foreground">{client.totalDisputes}</p>
                      <p className="text-xs text-muted-foreground">Disputes</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/30">
                      <p className={`text-lg font-bold ${client.successRate !== null && client.successRate >= 70 ? "text-emerald-400" : "text-foreground"}`}>{client.successRate !== null ? `${client.successRate}%` : "—"}</p>
                      <p className="text-xs text-muted-foreground">Success</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/30">
                      <p className="text-lg font-bold text-foreground">{client.currentRound || 0}</p>
                      <p className="text-xs text-muted-foreground">Round</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                    <BureauBadges bureaus={client.activeBureaus} />
                    <span className="text-xs text-muted-foreground">{client.lastActivity ? safeFormatDistance(client.lastActivity) : "Never"}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </Reveal>
        )}
      </div>

      {/* Hard Delete Confirmation Dialog */}
      <ResponsiveDialog open={!!hardDeleteClient} onOpenChange={(open) => !open && setHardDeleteClient(null)}>
        <ResponsiveDialogContent size="sm">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="text-red-400 flex items-center gap-2"><Trash2 className="w-5 h-5" />Permanently Delete Client</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>This action cannot be undone. All data will be permanently removed.</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogBody className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-sm text-red-300 mb-3">You are about to permanently delete <span className="font-bold text-foreground">{hardDeleteClient?.firstName} {hardDeleteClient?.lastName}</span> and ALL associated data:</p>
              <ul className="text-xs text-muted-foreground space-y-1.5 ml-4">
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />All credit reports and parsed data</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />All disputes and generated letters</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />All response tracking and FCRA records</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />All activity history and audit logs</li>
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">After deletion, you can re-add this person as a brand new client to start fresh.</p>
          </ResponsiveDialogBody>
          <ResponsiveDialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setHardDeleteClient(null)} disabled={isHardDeleting} className="border-input">Cancel</Button>
            <Button onClick={handleConfirmHardDelete} disabled={isHardDeleting} className="bg-red-600 hover:bg-red-700 text-white">
              {isHardDeleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting...</> : <><Trash2 className="w-4 h-4 mr-2" />Delete Forever</>}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </motion.div>
  );
}
