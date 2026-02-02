"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import { useToast } from "@/lib/use-toast";
import { Loader2 } from "lucide-react";

interface VendorFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor?: any;
  onSaved: () => void;
}

const CATEGORY_OPTIONS = [
  { value: "CREDIT_REPAIR", label: "Credit Repair" },
  { value: "DEBT_MANAGEMENT", label: "Debt Management" },
  { value: "FINANCIAL_COACHING", label: "Financial Coaching" },
  { value: "CREDIT_MONITORING", label: "Credit Monitoring" },
  { value: "CREDIT_BUILDER", label: "Credit Builder" },
  { value: "OTHER", label: "Other" },
];

const COMMISSION_TYPE_OPTIONS = [
  { value: "", label: "None" },
  { value: "FLAT", label: "Flat Rate" },
  { value: "PERCENTAGE", label: "Percentage" },
  { value: "TIERED", label: "Tiered" },
];

export function VendorForm({ open, onOpenChange, vendor, onSaved }: VendorFormProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("CREDIT_MONITORING");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [affiliateUrl, setAffiliateUrl] = useState("");
  const [affiliateCode, setAffiliateCode] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [commissionType, setCommissionType] = useState("");
  const [commissionValue, setCommissionValue] = useState<number | string>("");
  const [isActive, setIsActive] = useState(true);

  const isEdit = !!vendor;

  // Populate form when editing
  useEffect(() => {
    if (vendor) {
      setName(vendor.name || "");
      setDescription(vendor.description || "");
      setCategory(vendor.category || "CREDIT_MONITORING");
      setWebsiteUrl(vendor.websiteUrl || "");
      setAffiliateUrl(vendor.affiliateUrl || "");
      setAffiliateCode(vendor.affiliateCode || "");
      setContactName(vendor.contactName || "");
      setContactEmail(vendor.contactEmail || "");
      setCommissionType(vendor.commissionType || "");
      setCommissionValue(vendor.commissionValue ?? "");
      setIsActive(vendor.isActive ?? true);
    } else {
      setName("");
      setDescription("");
      setCategory("CREDIT_MONITORING");
      setWebsiteUrl("");
      setAffiliateUrl("");
      setAffiliateCode("");
      setContactName("");
      setContactEmail("");
      setCommissionType("");
      setCommissionValue("");
      setIsActive(true);
    }
  }, [vendor, open]);

  async function handleSave() {
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || null,
        category,
        websiteUrl: websiteUrl.trim() || null,
        affiliateUrl: affiliateUrl.trim() || null,
        affiliateCode: affiliateCode.trim() || null,
        contactName: contactName.trim() || null,
        contactEmail: contactEmail.trim() || null,
        isActive,
        commissionType: commissionType || null,
        commissionValue: commissionValue !== "" ? Number(commissionValue) : null,
        logoUrl: vendor?.logoUrl || null,
      };

      const url = isEdit ? `/api/vendors/${vendor.id}` : "/api/vendors";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save vendor");
      }

      toast({
        title: isEdit ? "Vendor updated" : "Vendor created",
        description: `${name} has been ${isEdit ? "updated" : "created"} successfully.`,
      });

      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save vendor",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent size="lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {isEdit ? "Edit Vendor" : "Add Vendor"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {isEdit
              ? "Update vendor partnership details."
              : "Add a new vendor partner to your organization."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="space-y-5">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="vendor-name">Name *</Label>
            <Input
              id="vendor-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., IDIQ/MyScoreIQ"
              className="bg-card border-border"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="vendor-description">Description</Label>
            <Textarea
              id="vendor-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Credit monitoring and identity protection..."
              className="bg-card border-border"
              rows={3}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="vendor-category">Category</Label>
            <select
              id="vendor-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Website URL */}
          <div className="space-y-2">
            <Label htmlFor="vendor-website">Website URL</Label>
            <Input
              id="vendor-website"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://www.example.com"
              className="bg-card border-border"
            />
          </div>

          {/* Affiliate URL + Code */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendor-affiliate-url">Affiliate URL</Label>
              <Input
                id="vendor-affiliate-url"
                value={affiliateUrl}
                onChange={(e) => setAffiliateUrl(e.target.value)}
                placeholder="https://www.example.com/ref?code=..."
                className="bg-card border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-affiliate-code">Affiliate Code</Label>
              <Input
                id="vendor-affiliate-code"
                value={affiliateCode}
                onChange={(e) => setAffiliateCode(e.target.value)}
                placeholder="e.g., 432142HO"
                className="bg-card border-border"
              />
            </div>
          </div>

          {/* Contact fields side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendor-contact-name">Contact Name</Label>
              <Input
                id="vendor-contact-name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="John Smith"
                className="bg-card border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-contact-email">Contact Email</Label>
              <Input
                id="vendor-contact-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="john@example.com"
                className="bg-card border-border"
              />
            </div>
          </div>

          {/* Commission fields side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendor-commission-type">Commission Type</Label>
              <select
                id="vendor-commission-type"
                value={commissionType}
                onChange={(e) => setCommissionType(e.target.value)}
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              >
                {COMMISSION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-commission-value">Commission Value</Label>
              <Input
                id="vendor-commission-value"
                type="number"
                value={commissionValue}
                onChange={(e) => setCommissionValue(e.target.value)}
                placeholder="e.g., 15.00"
                className="bg-card border-border"
                step="0.01"
                min="0"
              />
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isActive ? "bg-emerald-600" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isActive ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <Label className="cursor-pointer" onClick={() => setIsActive(!isActive)}>
              {isActive ? "Active" : "Inactive"}
            </Label>
          </div>
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEdit ? "Update Vendor" : "Create Vendor"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
