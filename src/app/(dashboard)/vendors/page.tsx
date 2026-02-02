"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/lib/use-toast";
import {
  Handshake,
  Plus,
  Edit,
  Trash2,
  Settings,
  BarChart3,
  Users,
  CheckCircle,
  XCircle,
  ExternalLink,
  DollarSign,
  Filter,
  Building,
} from "lucide-react";
import { VendorForm } from "@/components/vendors/vendor-form";
import { VendorRuleBuilder } from "@/components/vendors/vendor-rule-builder";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VendorRule {
  id: string;
  vendorId: string;
  name: string;
  description: string | null;
  priority: number;
  isActive: boolean;
  conditions: any[];
  recommendationTitle: string;
  recommendationBody: string;
  recommendationCTA: string | null;
  customAffiliateUrl: string | null;
}

interface Vendor {
  id: string;
  name: string;
  description: string | null;
  category: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  affiliateUrl: string | null;
  affiliateCode: string | null;
  contactName: string | null;
  contactEmail: string | null;
  isActive: boolean;
  commissionType: string | null;
  commissionValue: number | null;
  createdAt: string;
  rules: VendorRule[];
  _count: { referrals: number };
}

interface Referral {
  id: string;
  vendorId: string;
  clientId: string;
  organizationId: string;
  triggerType: string;
  status: string;
  clickedAt: string | null;
  convertedAt: string | null;
  commissionEarned: number | null;
  createdAt: string;
  vendor: { id: string; name: string; category?: string; logoUrl?: string | null };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  CREDIT_REPAIR: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  DEBT_MANAGEMENT: "bg-primary/20 text-primary border-primary/30",
  FINANCIAL_COACHING: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  CREDIT_MONITORING: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  CREDIT_BUILDER: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  OTHER: "bg-muted text-muted-foreground border-border",
};

const STATUS_COLORS: Record<string, string> = {
  RECOMMENDED: "bg-primary/20 text-primary border-primary/30",
  CLICKED: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  CONVERTED: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  EXPIRED: "bg-muted text-muted-foreground border-border",
};

function formatCategory(cat: string): string {
  return cat
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function VendorsPage() {
  const { toast } = useToast();

  // Data
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [vendorFormOpen, setVendorFormOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | undefined>(undefined);
  const [ruleBuilderOpen, setRuleBuilderOpen] = useState(false);
  const [selectedVendorForRules, setSelectedVendorForRules] = useState<string>("");
  const [selectedRule, setSelectedRule] = useState<VendorRule | undefined>(undefined);

  // Rule tab: vendor selector for adding new rules
  const [ruleVendorSelect, setRuleVendorSelect] = useState<string>("");

  // ---- Fetch Data ----

  async function fetchData() {
    setLoading(true);
    try {
      const [vendorRes, referralRes] = await Promise.all([
        fetch("/api/vendors"),
        fetch("/api/referrals"),
      ]);

      if (vendorRes.ok) {
        const vData = await vendorRes.json();
        setVendors(vData.vendors || []);
      }
      if (referralRes.ok) {
        const rData = await referralRes.json();
        setReferrals(rData.referrals || []);
      }
    } catch (error) {
      console.error("Error fetching vendor data:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  // ---- Computed Stats ----

  const allRules = useMemo(
    () => vendors.flatMap((v) => v.rules.map((r) => ({ ...r, vendorName: v.name, vendorId: v.id }))),
    [vendors]
  );

  const activeRulesCount = useMemo(
    () => allRules.filter((r) => r.isActive).length,
    [allRules]
  );

  const conversionsCount = useMemo(
    () => referrals.filter((r) => r.status === "CONVERTED").length,
    [referrals]
  );

  // ---- Actions ----

  function handleEditVendor(vendor: Vendor) {
    setSelectedVendor(vendor);
    setVendorFormOpen(true);
  }

  function handleAddVendor() {
    setSelectedVendor(undefined);
    setVendorFormOpen(true);
  }

  async function handleDeleteVendor(vendor: Vendor) {
    if (!window.confirm(`Are you sure you want to delete "${vendor.name}"? This will also remove all its rules and referrals.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/vendors/${vendor.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete vendor");
      }
      toast({
        title: "Vendor deleted",
        description: `"${vendor.name}" has been deleted.`,
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete vendor",
        variant: "destructive",
      });
    }
  }

  function handleEditRule(rule: VendorRule & { vendorId: string }) {
    setSelectedVendorForRules(rule.vendorId);
    setSelectedRule(rule);
    setRuleBuilderOpen(true);
  }

  function handleAddRule() {
    if (!ruleVendorSelect) {
      toast({
        title: "Select a vendor first",
        description: "Choose a vendor from the dropdown before adding a rule.",
        variant: "destructive",
      });
      return;
    }
    setSelectedVendorForRules(ruleVendorSelect);
    setSelectedRule(undefined);
    setRuleBuilderOpen(true);
  }

  function handleViewRules(vendor: Vendor) {
    setRuleVendorSelect(vendor.id);
    // Switch to rules tab (will auto-filter if we add filter later)
    const tabsTrigger = document.querySelector('[data-value="rules"]') as HTMLButtonElement | null;
    if (tabsTrigger) {
      tabsTrigger.click();
    }
  }

  // ---- Render ----

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background text-foreground p-6">
      {/* Ambient glow effects */}
      <div className="fixed top-[10%] left-[20%] w-[600px] h-[600px] bg-[radial-gradient(ellipse,rgba(124,58,237,0.08)_0%,transparent_70%)] pointer-events-none" />
      <div className="fixed bottom-[20%] right-[10%] w-[400px] h-[400px] bg-[radial-gradient(ellipse,rgba(16,185,129,0.06)_0%,transparent_70%)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6 relative z-10"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent flex items-center gap-2">
              <Handshake className="w-7 h-7 text-foreground" />
              Vendors &amp; Partners
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage vendor partnerships, rules, and track referrals
            </p>
          </div>
          <Button onClick={handleAddVendor} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Vendor
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Handshake className="w-5 h-5 text-primary" />}
            value={vendors.length}
            label="Total Vendors"
          />
          <StatCard
            icon={<Settings className="w-5 h-5 text-purple-400" />}
            value={activeRulesCount}
            label="Active Rules"
          />
          <StatCard
            icon={<Users className="w-5 h-5 text-amber-400" />}
            value={referrals.length}
            label="Total Referrals"
          />
          <StatCard
            icon={<CheckCircle className="w-5 h-5 text-emerald-400" />}
            value={conversionsCount}
            label="Conversions"
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="vendors" className="space-y-4">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="vendors" className="gap-2 data-[state=active]:bg-muted" data-value="vendors">
              <Building className="w-4 h-4" />
              Vendors
            </TabsTrigger>
            <TabsTrigger value="rules" className="gap-2 data-[state=active]:bg-muted" data-value="rules">
              <Settings className="w-4 h-4" />
              Rules
            </TabsTrigger>
            <TabsTrigger value="referrals" className="gap-2 data-[state=active]:bg-muted" data-value="referrals">
              <BarChart3 className="w-4 h-4" />
              Referrals
            </TabsTrigger>
          </TabsList>

          {/* ---- Tab 1: Vendors ---- */}
          <TabsContent value="vendors">
            {loading ? (
              <LoadingSkeleton />
            ) : vendors.length === 0 ? (
              <EmptyState
                icon={<Handshake className="w-12 h-12 text-muted-foreground" />}
                title="No vendors yet"
                description='Add your first vendor partner by clicking "Add Vendor" above.'
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {vendors.map((vendor) => (
                  <VendorCard
                    key={vendor.id}
                    vendor={vendor}
                    onEdit={() => handleEditVendor(vendor)}
                    onDelete={() => handleDeleteVendor(vendor)}
                    onViewRules={() => handleViewRules(vendor)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ---- Tab 2: Rules ---- */}
          <TabsContent value="rules">
            {loading ? (
              <LoadingSkeleton />
            ) : (
              <div className="space-y-4">
                {/* Add Rule Row */}
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={ruleVendorSelect}
                    onChange={(e) => setRuleVendorSelect(e.target.value)}
                    className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">Select a vendor...</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                  <Button onClick={handleAddRule} size="sm" className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Rule
                  </Button>
                </div>

                {allRules.length === 0 ? (
                  <EmptyState
                    icon={<Filter className="w-12 h-12 text-muted-foreground" />}
                    title="No rules yet"
                    description="Create rules to automatically recommend vendors to clients based on their profile."
                  />
                ) : (
                  <div className="space-y-2">
                    {allRules.map((rule) => (
                      <RuleRow
                        key={rule.id}
                        rule={rule}
                        onEdit={() => handleEditRule(rule)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ---- Tab 3: Referrals ---- */}
          <TabsContent value="referrals">
            {loading ? (
              <LoadingSkeleton />
            ) : (
              <div className="space-y-4">
                {/* Summary stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-card backdrop-blur-xl border border-border rounded-xl p-4 text-center">
                    <span className="block text-2xl font-bold text-primary">
                      {referrals.filter((r) => r.status === "RECOMMENDED").length}
                    </span>
                    <span className="text-xs text-muted-foreground">Recommended</span>
                  </div>
                  <div className="bg-card backdrop-blur-xl border border-border rounded-xl p-4 text-center">
                    <span className="block text-2xl font-bold text-amber-400">
                      {referrals.filter((r) => r.status === "CLICKED").length}
                    </span>
                    <span className="text-xs text-muted-foreground">Clicked</span>
                  </div>
                  <div className="bg-card backdrop-blur-xl border border-border rounded-xl p-4 text-center">
                    <span className="block text-2xl font-bold text-emerald-400">
                      {conversionsCount}
                    </span>
                    <span className="text-xs text-muted-foreground">Converted</span>
                  </div>
                  <div className="bg-card backdrop-blur-xl border border-border rounded-xl p-4 text-center">
                    <span className="block text-2xl font-bold text-muted-foreground">
                      {referrals.filter((r) => r.status === "EXPIRED").length}
                    </span>
                    <span className="text-xs text-muted-foreground">Expired</span>
                  </div>
                </div>

                {referrals.length === 0 ? (
                  <EmptyState
                    icon={<BarChart3 className="w-12 h-12 text-muted-foreground" />}
                    title="No referrals yet"
                    description="Referrals are tracked when vendor recommendations are shown or clicked by clients."
                  />
                ) : (
                  <div className="space-y-2">
                    {referrals.map((referral) => (
                      <ReferralRow key={referral.id} referral={referral} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* ---- Dialogs ---- */}
      <VendorForm
        open={vendorFormOpen}
        onOpenChange={setVendorFormOpen}
        vendor={selectedVendor}
        onSaved={fetchData}
      />

      {selectedVendorForRules && (
        <VendorRuleBuilder
          open={ruleBuilderOpen}
          onOpenChange={setRuleBuilderOpen}
          vendorId={selectedVendorForRules}
          rule={selectedRule}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}

// ===========================================================================
// Sub-components
// ===========================================================================

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="bg-card backdrop-blur-xl border border-border rounded-2xl p-6">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <span className="text-2xl font-bold text-foreground">{value}</span>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        </div>
      </div>
    </div>
  );
}

function VendorCard({
  vendor,
  onEdit,
  onDelete,
  onViewRules,
}: {
  vendor: Vendor;
  onEdit: () => void;
  onDelete: () => void;
  onViewRules: () => void;
}) {
  const catColor = CATEGORY_COLORS[vendor.category] || CATEGORY_COLORS.OTHER;

  return (
    <div className="bg-card backdrop-blur-xl border border-border rounded-2xl p-6 hover:border-input transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">{vendor.name}</h3>
          <Badge
            className={`text-[10px] ${
              vendor.isActive
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                : "bg-muted text-muted-foreground border-border"
            }`}
          >
            {vendor.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </div>

      {/* Category */}
      <Badge className={`text-[10px] border mb-3 ${catColor}`}>
        {formatCategory(vendor.category)}
      </Badge>

      {/* Description */}
      {vendor.description && (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{vendor.description}</p>
      )}

      {/* Stat row */}
      <div className="flex items-center gap-4 mb-3 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Settings className="w-3.5 h-3.5" />
          {vendor.rules.length} rule{vendor.rules.length !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          {vendor._count.referrals} referral{vendor._count.referrals !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Commission */}
      {vendor.commissionType && vendor.commissionValue != null && (
        <div className="flex items-center gap-1.5 text-sm text-emerald-400 mb-3">
          <DollarSign className="w-3.5 h-3.5" />
          <span>
            {vendor.commissionType === "PERCENTAGE"
              ? `${vendor.commissionValue}%`
              : vendor.commissionType === "FLAT"
              ? `$${vendor.commissionValue.toFixed(2)}`
              : `Tiered ($${vendor.commissionValue.toFixed(2)} base)`}
          </span>
        </div>
      )}

      {/* Affiliate link */}
      {vendor.affiliateUrl && (
        <a
          href={vendor.affiliateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:text-blue-300 transition-colors mb-4"
        >
          <ExternalLink className="w-3 h-3" />
          Affiliate Link
        </a>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-3 border-t border-border">
        <Button variant="ghost" size="sm" onClick={onEdit} className="gap-1.5 text-muted-foreground">
          <Edit className="w-3.5 h-3.5" />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onViewRules}
          className="gap-1.5 text-muted-foreground"
        >
          <Settings className="w-3.5 h-3.5" />
          Rules
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="gap-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 ml-auto"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </Button>
      </div>
    </div>
  );
}

function RuleRow({
  rule,
  onEdit,
}: {
  rule: VendorRule & { vendorName: string; vendorId: string };
  onEdit: () => void;
}) {
  const conditionsArray = Array.isArray(rule.conditions) ? rule.conditions : [];
  const previewText = rule.recommendationBody
    ? rule.recommendationBody.substring(0, 80) + (rule.recommendationBody.length > 80 ? "..." : "")
    : "";

  return (
    <div className="bg-card backdrop-blur-xl border border-border rounded-xl p-4 hover:border-input transition-colors">
      <div className="flex flex-wrap items-center gap-3">
        {/* Vendor tag */}
        <Badge className="bg-muted text-muted-foreground border-input text-[10px]">
          {rule.vendorName}
        </Badge>

        {/* Rule name */}
        <span className="font-medium text-foreground text-sm">{rule.name}</span>

        {/* Priority badge */}
        <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
          Priority: {rule.priority}
        </Badge>

        {/* Active status */}
        {rule.isActive ? (
          <CheckCircle className="w-4 h-4 text-emerald-400" />
        ) : (
          <XCircle className="w-4 h-4 text-muted-foreground" />
        )}

        {/* Condition count */}
        <span className="text-xs text-muted-foreground">
          {conditionsArray.length} condition{conditionsArray.length !== 1 ? "s" : ""}
        </span>

        {/* Edit button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="gap-1.5 text-muted-foreground ml-auto"
        >
          <Edit className="w-3.5 h-3.5" />
          Edit
        </Button>
      </div>

      {previewText && (
        <p className="text-xs text-muted-foreground mt-2 ml-1">{previewText}</p>
      )}
    </div>
  );
}

function ReferralRow({ referral }: { referral: Referral }) {
  const statusColor = STATUS_COLORS[referral.status] || STATUS_COLORS.EXPIRED;

  return (
    <div className="bg-card backdrop-blur-xl border border-border rounded-xl p-4 hover:border-input transition-colors">
      <div className="flex flex-wrap items-center gap-3">
        {/* Date */}
        <span className="text-xs text-muted-foreground min-w-[90px]">
          {formatDate(referral.createdAt)}
        </span>

        {/* Vendor name */}
        <span className="font-medium text-foreground text-sm">{referral.vendor.name}</span>

        {/* Trigger type badge */}
        <Badge className="bg-muted text-muted-foreground border-input text-[10px]">
          {referral.triggerType.replace(/_/g, " ")}
        </Badge>

        {/* Status badge */}
        <Badge className={`text-[10px] border ${statusColor}`}>
          {referral.status}
        </Badge>

        {/* Commission earned */}
        {referral.commissionEarned != null && referral.commissionEarned > 0 && (
          <span className="text-xs text-emerald-400 flex items-center gap-1 ml-auto">
            <DollarSign className="w-3 h-3" />
            {referral.commissionEarned.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-medium text-muted-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md">{description}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-card border border-border rounded-2xl p-6 animate-pulse"
        >
          <div className="h-5 w-48 bg-muted rounded mb-3" />
          <div className="h-4 w-32 bg-muted rounded mb-2" />
          <div className="h-3 w-full bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}
