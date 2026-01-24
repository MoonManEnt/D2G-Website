"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Plus,
  Search,
  User,
  FileText,
  ChevronRight,
  Users,
  AlertTriangle,
  Clock,
  TrendingUp,
  Zap,
  LayoutGrid,
  List,
  Eye,
  Gavel,
  X,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
  CheckCircle,
  Scale,
  AlertOctagon,
  Save,
  Loader2,
} from "lucide-react";
import { useToast } from "@/lib/use-toast";
import { useRouter, useSearchParams } from "next/navigation";
import { Spotlight, useOnboarding } from "@/components/onboarding";
import { formatDistanceToNow, format } from "date-fns";

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
  _count: {
    reports: number;
    disputes: number;
  };
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
  _count: {
    reports: number;
    disputes: number;
  };
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
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring" as const, damping: 25, stiffness: 300 }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: { duration: 0.2 }
  },
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

// Stat card component
function StatCard({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: typeof Users;
  value: string | number;
  label: string;
  color: string;
}) {
  const colorClasses: Record<string, { bg: string; text: string; icon: string }> = {
    blue: { bg: "bg-blue-500/10", text: "text-blue-400", icon: "text-blue-400" },
    red: { bg: "bg-red-500/10", text: "text-red-400", icon: "text-red-400" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-400", icon: "text-amber-400" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", icon: "text-emerald-400" },
    purple: { bg: "bg-purple-500/10", text: "text-purple-400", icon: "text-purple-400" },
    slate: { bg: "bg-slate-500/10", text: "text-slate-400", icon: "text-slate-400" },
  };

  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <div className={`rounded-xl ${colors.bg} border border-slate-700/50 p-4`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colors.bg}`}>
          <Icon className={`w-5 h-5 ${colors.icon}`} />
        </div>
        <div>
          <p className={`text-2xl font-bold ${colors.text}`}>{value}</p>
          <p className="text-xs text-slate-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

// Priority badge component
function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    URGENT: { bg: "bg-red-500/20", text: "text-red-400", label: "Urgent" },
    HIGH: { bg: "bg-orange-500/20", text: "text-orange-400", label: "High" },
    STANDARD: { bg: "bg-slate-500/20", text: "text-slate-400", label: "Standard" },
    LOW: { bg: "bg-slate-600/20", text: "text-slate-500", label: "Low" },
  };
  const { bg, text, label } = config[priority] || config.STANDARD;
  return <Badge className={`${bg} ${text} text-xs font-medium`}>{label}</Badge>;
}

// Segment badge component
function SegmentBadge({ segment }: { segment: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    VIP: { bg: "bg-amber-500/20", text: "text-amber-400", label: "VIP" },
    RETURNING: { bg: "bg-blue-500/20", text: "text-blue-400", label: "Returning" },
    NEW: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "New" },
    STANDARD: { bg: "bg-slate-500/20", text: "text-slate-400", label: "Standard" },
  };
  const { bg, text, label } = config[segment] || config.STANDARD;
  return <Badge className={`${bg} ${text} text-xs font-medium`}>{label}</Badge>;
}

// Stage badge component
function StageBadge({ stage }: { stage: string }) {
  const getStageLabel = (s: string) => {
    if (s.startsWith("ROUND_")) return `Round ${s.split("_")[1]}`;
    const labels: Record<string, string> = {
      INTAKE: "Intake",
      ANALYSIS: "Analysis",
      AWAITING_RESPONSE: "Awaiting",
      MAINTENANCE: "Maintenance",
      COMPLETED: "Completed",
      ESCALATED: "Escalated",
    };
    return labels[s] || s;
  };

  const getStageColor = (s: string) => {
    if (s.startsWith("ROUND_")) return "bg-purple-500/20 text-purple-400";
    const colors: Record<string, string> = {
      INTAKE: "bg-slate-500/20 text-slate-400",
      ANALYSIS: "bg-blue-500/20 text-blue-400",
      AWAITING_RESPONSE: "bg-amber-500/20 text-amber-400",
      MAINTENANCE: "bg-emerald-500/20 text-emerald-400",
      COMPLETED: "bg-emerald-500/20 text-emerald-400",
      ESCALATED: "bg-red-500/20 text-red-400",
    };
    return colors[s] || "bg-slate-500/20 text-slate-400";
  };

  return (
    <Badge className={`${getStageColor(stage)} text-xs font-medium`}>
      {getStageLabel(stage)}
    </Badge>
  );
}

// Bureau badges component
function BureauBadges({ bureaus }: { bureaus: string[] }) {
  if (bureaus.length === 0) return <span className="text-slate-500 text-xs">—</span>;

  const colors: Record<string, string> = {
    TU: "bg-blue-500/20 text-blue-400",
    EQ: "bg-amber-500/20 text-amber-400",
    EX: "bg-purple-500/20 text-purple-400",
  };

  return (
    <div className="flex gap-1">
      {bureaus.map((bureau) => (
        <span
          key={bureau}
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[bureau] || "bg-slate-500/20 text-slate-400"}`}
        >
          {bureau}
        </span>
      ))}
    </div>
  );
}

// Client Quick View Modal Component
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
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    email: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    zipCode: "",
    dateOfBirth: "",
    ssnLast4: "",
  });
  const [accountStats, setAccountStats] = useState({
    totalAccounts: 0,
    negativeItems: 0,
    highSeverity: 0,
  });

  const fetchClientDetail = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`);
      if (res.ok) {
        const data = await res.json();
        setDetail(data);
        setEditForm({
          email: data.email || "",
          phone: data.phone || "",
          addressLine1: data.addressLine1 || "",
          addressLine2: data.addressLine2 || "",
          city: data.city || "",
          state: data.state || "",
          zipCode: data.zipCode || "",
          dateOfBirth: data.dateOfBirth ? data.dateOfBirth.split("T")[0] : "",
          ssnLast4: data.ssnLast4 || "",
        });

        // Fetch account stats
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
    } catch (error) {
      console.error("Failed to fetch client detail:", error);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (isOpen && client) {
      fetchClientDetail();
    }
  }, [isOpen, client, fetchClientDetail]);

  const handleSave = async () => {
    if (!client) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          dateOfBirth: editForm.dateOfBirth || null,
        }),
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

  const formatAddress = () => {
    if (!editForm.addressLine1) return null;
    const parts = [
      editForm.addressLine1,
      editForm.addressLine2,
      [editForm.city, editForm.state, editForm.zipCode].filter(Boolean).join(", "),
    ].filter(Boolean);
    return parts.join(", ");
  };

  if (!client) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[90vw] sm:max-w-3xl sm:max-h-[85vh] z-50 overflow-hidden"
          >
            <div className="h-full rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 shadow-2xl shadow-black/50 overflow-hidden flex flex-col">
              {/* Glassmorphic gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

              {/* Header */}
              <div className="relative p-6 border-b border-slate-700/50">
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>

                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center border-2 border-blue-500/30">
                    <span className="text-xl font-bold text-white">
                      {client.firstName.charAt(0)}{client.lastName.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      {client.firstName} {client.lastName}
                    </h2>
                    <p className="text-slate-400 text-sm">
                      Client since {detail ? format(new Date(detail.createdAt), "M/d/yyyy") : "..."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="relative flex-1 overflow-y-auto p-6 space-y-6">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                  </div>
                ) : (
                  <>
                    {/* Stats Row */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                      <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                        <FileText className="w-5 h-5 mx-auto mb-1 text-blue-400" />
                        <p className="text-xl font-bold text-white">{client._count?.reports || 0}</p>
                        <p className="text-[10px] text-slate-400">Reports</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                        <Users className="w-5 h-5 mx-auto mb-1 text-purple-400" />
                        <p className="text-xl font-bold text-white">{accountStats.totalAccounts}</p>
                        <p className="text-[10px] text-slate-400">Accounts</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                        <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-amber-400" />
                        <p className="text-xl font-bold text-amber-400">{accountStats.negativeItems}</p>
                        <p className="text-[10px] text-slate-400">Negative Items</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                        <AlertOctagon className="w-5 h-5 mx-auto mb-1 text-red-400" />
                        <p className="text-xl font-bold text-red-400">{accountStats.highSeverity}</p>
                        <p className="text-[10px] text-slate-400">High Severity</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                        <Scale className="w-5 h-5 mx-auto mb-1 text-emerald-400" />
                        <p className="text-xl font-bold text-white">{client.totalDisputes}</p>
                        <p className="text-[10px] text-slate-400">Disputes</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                        <CheckCircle className="w-5 h-5 mx-auto mb-1 text-emerald-400" />
                        <p className="text-xl font-bold text-emerald-400">
                          {client.successRate !== null ? `${client.successRate}%` : "—"}
                        </p>
                        <p className="text-[10px] text-slate-400">Success</p>
                      </div>
                    </div>

                    {/* Contact Information - Editable */}
                    <div className="rounded-xl bg-slate-800/30 border border-slate-700/50 p-4">
                      <h3 className="text-sm font-semibold text-white mb-4">Contact Information</h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Email */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-slate-400 flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5" /> Email
                          </Label>
                          <Input
                            type="email"
                            value={editForm.email}
                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            placeholder="email@example.com"
                            className="bg-slate-700/50 border-slate-600 text-white h-9"
                          />
                        </div>

                        {/* Phone */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-slate-400 flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5" /> Phone
                          </Label>
                          <Input
                            type="tel"
                            value={editForm.phone}
                            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                            placeholder="(555) 555-5555"
                            className="bg-slate-700/50 border-slate-600 text-white h-9"
                          />
                        </div>

                        {/* Address Line 1 */}
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-xs text-slate-400 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5" /> Street Address
                          </Label>
                          <Input
                            value={editForm.addressLine1}
                            onChange={(e) => setEditForm({ ...editForm, addressLine1: e.target.value })}
                            placeholder="123 Main Street"
                            className="bg-slate-700/50 border-slate-600 text-white h-9"
                          />
                        </div>

                        {/* Address Line 2 */}
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-xs text-slate-400">Apt/Suite/Unit</Label>
                          <Input
                            value={editForm.addressLine2}
                            onChange={(e) => setEditForm({ ...editForm, addressLine2: e.target.value })}
                            placeholder="Apt 4B"
                            className="bg-slate-700/50 border-slate-600 text-white h-9"
                          />
                        </div>

                        {/* City */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-slate-400">City</Label>
                          <Input
                            value={editForm.city}
                            onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                            placeholder="City"
                            className="bg-slate-700/50 border-slate-600 text-white h-9"
                          />
                        </div>

                        {/* State & Zip */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-400">State</Label>
                            <Input
                              value={editForm.state}
                              onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                              placeholder="TX"
                              maxLength={2}
                              className="bg-slate-700/50 border-slate-600 text-white h-9 uppercase"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-400">ZIP</Label>
                            <Input
                              value={editForm.zipCode}
                              onChange={(e) => setEditForm({ ...editForm, zipCode: e.target.value })}
                              placeholder="12345"
                              className="bg-slate-700/50 border-slate-600 text-white h-9"
                            />
                          </div>
                        </div>

                        {/* Date of Birth */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-slate-400 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" /> Date of Birth
                          </Label>
                          <Input
                            type="date"
                            value={editForm.dateOfBirth}
                            onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                            className="bg-slate-700/50 border-slate-600 text-white h-9"
                          />
                        </div>

                        {/* SSN Last 4 */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-slate-400 flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5" /> Last 4 of SSN
                          </Label>
                          <Input
                            type="text"
                            value={editForm.ssnLast4}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                              setEditForm({ ...editForm, ssnLast4: val });
                            }}
                            placeholder="••••"
                            maxLength={4}
                            className="bg-slate-700/50 border-slate-600 text-white h-9 font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Quick Info Display */}
                    <div className="rounded-xl bg-slate-800/30 border border-slate-700/50 p-4">
                      <h3 className="text-sm font-semibold text-white mb-3">Quick Info</h3>
                      <div className="flex flex-wrap gap-2">
                        <PriorityBadge priority={client.priority} />
                        <SegmentBadge segment={client.segment} />
                        <StageBadge stage={client.derivedStage || client.stage} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Clock className="w-4 h-4" />
                          <span>
                            Last active:{" "}
                            {client.lastActivity
                              ? formatDistanceToNow(new Date(client.lastActivity), { addSuffix: true })
                              : "Never"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                          <span>Bureaus:</span>
                          <BureauBadges bureaus={client.activeBureaus} />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="relative p-4 border-t border-slate-700/50 flex justify-end gap-3">
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function ClientsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { steps, currentStep } = useOnboarding();

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
  const [newClient, setNewClient] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    priority: "STANDARD",
    segment: "NEW",
  });

  const fetchClients = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (stageFilter !== "all") params.set("stage", stageFilter);
      if (segmentFilter !== "all") params.set("segment", segmentFilter);

      const res = await fetch(`/api/clients?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (error) {
      console.error("Failed to fetch clients:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/clients/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  useEffect(() => {
    fetchClients();
    fetchStats();
  }, [searchQuery, priorityFilter, stageFilter, segmentFilter]);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();

    if (session?.user?.subscriptionTier === "FREE") {
      toast({
        title: "Upgrade Required",
        description: "Free plan is limited to viewing. Upgrade to Pro to add clients.",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newClient),
      });

      if (res.ok) {
        toast({
          title: "Client Added",
          description: `${newClient.firstName} ${newClient.lastName} has been added.`,
        });
        setIsAddDialogOpen(false);
        setNewClient({ firstName: "", lastName: "", email: "", phone: "", priority: "STANDARD", segment: "NEW" });
        fetchClients();
        fetchStats();
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.message || "Failed to add client",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const handleQuickView = (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    setQuickViewClient(client);
  };

  const handleDisputeAction = (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    router.push(`/clients/${client.id}?tab=disputes`);
  };

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Quick View Modal */}
      <ClientQuickViewModal
        client={quickViewClient}
        isOpen={!!quickViewClient}
        onClose={() => setQuickViewClient(null)}
        onUpdate={fetchClients}
      />

      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Client Command Center</h1>
          <p className="text-slate-400 mt-1">Manage and track your client portfolio</p>
        </div>
        <ResponsiveDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <Spotlight
            active={!steps.find(s => s.id === "add-client")?.completed && steps[currentStep]?.id === "add-client"}
            message="Start here by adding your first client."
          >
            <ResponsiveDialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Client
              </Button>
            </ResponsiveDialogTrigger>
          </Spotlight>
          <ResponsiveDialogContent size="sm">
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>Add New Client</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                Enter the client&apos;s information to create their profile.
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <form onSubmit={handleAddClient}>
              <ResponsiveDialogBody className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-slate-200">First Name</Label>
                    <Input
                      id="firstName"
                      value={newClient.firstName}
                      onChange={(e) => setNewClient({ ...newClient, firstName: e.target.value })}
                      required
                      className="bg-slate-700/50 border-slate-600 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-slate-200">Last Name</Label>
                    <Input
                      id="lastName"
                      value={newClient.lastName}
                      onChange={(e) => setNewClient({ ...newClient, lastName: e.target.value })}
                      required
                      className="bg-slate-700/50 border-slate-600 text-white"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-200">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    className="bg-slate-700/50 border-slate-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-slate-200">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                    className="bg-slate-700/50 border-slate-600 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-200">Priority</Label>
                    <Select value={newClient.priority} onValueChange={(v) => setNewClient({ ...newClient, priority: v })}>
                      <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="URGENT">Urgent</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="STANDARD">Standard</SelectItem>
                        <SelectItem value="LOW">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-200">Segment</Label>
                    <Select value={newClient.segment} onValueChange={(v) => setNewClient({ ...newClient, segment: v })}>
                      <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="VIP">VIP</SelectItem>
                        <SelectItem value="RETURNING">Returning</SelectItem>
                        <SelectItem value="NEW">New</SelectItem>
                        <SelectItem value="STANDARD">Standard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </ResponsiveDialogBody>
              <ResponsiveDialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Client</Button>
              </ResponsiveDialogFooter>
            </form>
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      </motion.div>

      {/* Stats Grid */}
      {stats && (
        <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={Users} value={stats.totalClients} label="Total Clients" color="blue" />
          <StatCard icon={AlertTriangle} value={stats.urgentClients} label="Urgent" color="red" />
          <StatCard icon={FileText} value={stats.activeDisputes} label="Active Cases" color="amber" />
          <StatCard icon={Clock} value={stats.needsActionCount} label="Needs Action" color="purple" />
          <StatCard icon={TrendingUp} value={`${stats.avgSuccessRate}%`} label="Success Rate" color="emerald" />
          <StatCard icon={Zap} value={stats.newThisWeek} label="New This Week" color="slate" />
        </motion.div>
      )}

      {/* Search and Filters */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-800/50 border-slate-700 text-white"
          />
        </div>
        <div className="flex gap-2">
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[130px] bg-slate-800/50 border-slate-700 text-white">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="URGENT">Urgent</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="STANDARD">Standard</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[130px] bg-slate-800/50 border-slate-700 text-white">
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all">All Stages</SelectItem>
              <SelectItem value="INTAKE">Intake</SelectItem>
              <SelectItem value="ROUND_1">Round 1</SelectItem>
              <SelectItem value="ROUND_2">Round 2</SelectItem>
              <SelectItem value="ROUND_3">Round 3</SelectItem>
              <SelectItem value="ROUND_4">Round 4</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={segmentFilter} onValueChange={setSegmentFilter}>
            <SelectTrigger className="w-[130px] bg-slate-800/50 border-slate-700 text-white">
              <SelectValue placeholder="Segment" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all">All Segments</SelectItem>
              <SelectItem value="VIP">VIP</SelectItem>
              <SelectItem value="RETURNING">Returning</SelectItem>
              <SelectItem value="NEW">New</SelectItem>
              <SelectItem value="STANDARD">Standard</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex border border-slate-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 ${viewMode === "list" ? "bg-slate-700" : "bg-slate-800/50 hover:bg-slate-800"}`}
            >
              <List className="w-4 h-4 text-slate-400" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 ${viewMode === "grid" ? "bg-slate-700" : "bg-slate-800/50 hover:bg-slate-800"}`}
            >
              <LayoutGrid className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Clients Table/List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading clients...</div>
      ) : clients.length === 0 ? (
        <motion.div
          variants={itemVariants}
          className="rounded-2xl bg-slate-800/40 border border-slate-700/50 py-12 text-center"
        >
          <User className="w-12 h-12 mx-auto text-slate-600" />
          <h3 className="text-lg font-medium text-white mt-4">No clients found</h3>
          <p className="text-slate-400 mt-2">
            {searchQuery || priorityFilter !== "all" || stageFilter !== "all"
              ? "Try adjusting your filters"
              : "Add your first client to get started"}
          </p>
        </motion.div>
      ) : viewMode === "list" ? (
        /* List View - Table */
        <motion.div
          variants={itemVariants}
          className="rounded-2xl bg-slate-800/40 border border-slate-700/50 overflow-hidden"
        >
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-slate-800/60 border-b border-slate-700/50 text-xs font-semibold text-slate-400 uppercase tracking-wide">
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
          <div className="divide-y divide-slate-700/30">
            {clients.map((client, index) => (
              <motion.div
                key={client.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => router.push(`/clients/${client.id}`)}
                className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-slate-700/30 cursor-pointer transition-colors items-center group"
              >
                {/* Client */}
                <div className="col-span-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-slate-600/50">
                    <span className="text-sm font-medium text-white">
                      {client.firstName.charAt(0)}{client.lastName.charAt(0)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">
                      {client.firstName} {client.lastName}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{client.email || "No email"}</p>
                  </div>
                </div>

                {/* Priority */}
                <div className="col-span-1">
                  <PriorityBadge priority={client.priority} />
                </div>

                {/* Segment */}
                <div className="col-span-1">
                  <SegmentBadge segment={client.segment} />
                </div>

                {/* Stage */}
                <div className="col-span-1">
                  <StageBadge stage={client.derivedStage || client.stage} />
                </div>

                {/* Disputes */}
                <div className="col-span-1">
                  <span className="text-white text-sm">{client.activeDisputeCount}/{client.totalDisputes}</span>
                </div>

                {/* Success Rate */}
                <div className="col-span-1">
                  {client.successRate !== null ? (
                    <span className={`font-medium text-sm ${client.successRate >= 70 ? "text-emerald-400" : client.successRate >= 40 ? "text-amber-400" : "text-slate-400"}`}>
                      {client.successRate}%
                    </span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </div>

                {/* Active Bureaus */}
                <div className="col-span-1">
                  <BureauBadges bureaus={client.activeBureaus} />
                </div>

                {/* Last Active */}
                <div className="col-span-2">
                  <span className="text-sm text-slate-400">
                    {client.lastActivity
                      ? formatDistanceToNow(new Date(client.lastActivity), { addSuffix: true })
                      : "Never"}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="col-span-1 flex items-center justify-end gap-1">
                  <button
                    onClick={(e) => handleQuickView(e, client)}
                    className="p-2 rounded-lg hover:bg-slate-600/50 transition-colors opacity-60 group-hover:opacity-100"
                    title="Quick View"
                  >
                    <Eye className="w-4 h-4 text-blue-400" />
                  </button>
                  <button
                    onClick={(e) => handleDisputeAction(e, client)}
                    className="p-2 rounded-lg hover:bg-slate-600/50 transition-colors opacity-60 group-hover:opacity-100"
                    title="Disputes"
                  >
                    <Gavel className="w-4 h-4 text-amber-400" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      ) : (
        /* Grid View - Cards */
        <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client, index) => (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="rounded-xl bg-slate-800/40 border border-slate-700/50 p-4 hover:bg-slate-800/60 hover:border-slate-600/50 transition-all group"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => router.push(`/clients/${client.id}`)}
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-slate-600/50">
                    <span className="font-medium text-white">
                      {client.firstName.charAt(0)}{client.lastName.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-white">{client.firstName} {client.lastName}</p>
                    <p className="text-xs text-slate-400">{client.email || "No email"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleQuickView(e, client)}
                    className="p-1.5 rounded-lg hover:bg-slate-600/50 transition-colors"
                    title="Quick View"
                  >
                    <Eye className="w-4 h-4 text-blue-400" />
                  </button>
                  <button
                    onClick={(e) => handleDisputeAction(e, client)}
                    className="p-1.5 rounded-lg hover:bg-slate-600/50 transition-colors"
                    title="Disputes"
                  >
                    <Gavel className="w-4 h-4 text-amber-400" />
                  </button>
                </div>
              </div>

              {/* Badges Row */}
              <div className="flex flex-wrap gap-2 mb-4">
                <PriorityBadge priority={client.priority} />
                <SegmentBadge segment={client.segment} />
                <StageBadge stage={client.derivedStage || client.stage} />
              </div>

              {/* Stats Row */}
              <div
                className="grid grid-cols-3 gap-2 text-center cursor-pointer"
                onClick={() => router.push(`/clients/${client.id}`)}
              >
                <div className="p-2 rounded-lg bg-slate-700/30">
                  <p className="text-lg font-bold text-white">{client.totalDisputes}</p>
                  <p className="text-xs text-slate-400">Disputes</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-700/30">
                  <p className={`text-lg font-bold ${client.successRate !== null && client.successRate >= 70 ? "text-emerald-400" : "text-white"}`}>
                    {client.successRate !== null ? `${client.successRate}%` : "—"}
                  </p>
                  <p className="text-xs text-slate-400">Success</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-700/30">
                  <p className="text-lg font-bold text-white">{client.currentRound || 0}</p>
                  <p className="text-xs text-slate-400">Round</p>
                </div>
              </div>

              {/* Footer */}
              <div
                className="flex items-center justify-between mt-4 pt-3 border-t border-slate-700/50 cursor-pointer"
                onClick={() => router.push(`/clients/${client.id}`)}
              >
                <BureauBadges bureaus={client.activeBureaus} />
                <span className="text-xs text-slate-500">
                  {client.lastActivity
                    ? formatDistanceToNow(new Date(client.lastActivity), { addSuffix: true })
                    : "Never"}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
