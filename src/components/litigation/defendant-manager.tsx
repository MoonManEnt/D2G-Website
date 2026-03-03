"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Landmark,
  AlertTriangle,
  MapPin,
  Pencil,
  Check,
  X,
  Clock,
  Mail,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/lib/use-toast";

// =============================================================================
// TYPES
// =============================================================================

interface Defendant {
  id: string;
  entityName: string;
  entityType: string;
  violationCount: number;
  estimatedLiabilityMin: number;
  estimatedLiabilityMax: number;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  serviceStatus?: string | null;
  servedAt?: string | null;
  responseDeadline?: string | null;
  hasResponded?: boolean;
}

interface DefendantManagerProps {
  defendants: Defendant[];
  caseId: string;
  clientId: string;
  onUpdate: (defendant: Defendant) => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TYPE_CONFIG: Record<
  string,
  {
    color: string;
    bg: string;
    border: string;
    icon: React.ElementType;
    label: string;
  }
> = {
  CRA: {
    color: "text-blue-400",
    bg: "bg-blue-500/15",
    border: "border-blue-500/30",
    icon: Landmark,
    label: "Credit Reporting Agency",
  },
  FURNISHER: {
    color: "text-purple-400",
    bg: "bg-purple-500/15",
    border: "border-purple-500/30",
    icon: Building2,
    label: "Data Furnisher",
  },
  COLLECTOR: {
    color: "text-red-400",
    bg: "bg-red-500/15",
    border: "border-red-500/30",
    icon: AlertTriangle,
    label: "Debt Collector",
  },
};

// =============================================================================
// HELPERS
// =============================================================================

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// =============================================================================
// DEFENDANT CARD SUB-COMPONENT
// =============================================================================

function DefendantCard({
  defendant,
  caseId,
  clientId,
  onUpdate,
}: {
  defendant: Defendant;
  caseId: string;
  clientId: string;
  onUpdate: (defendant: Defendant) => void;
}) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    address: defendant.address || "",
    city: defendant.city || "",
    state: defendant.state || "",
    zipCode: defendant.zipCode || "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const config = TYPE_CONFIG[defendant.entityType] || TYPE_CONFIG.FURNISHER;
  const TypeIcon = config.icon;

  const isServed = defendant.serviceStatus === "SERVED" || !!defendant.servedAt;

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/clients/${clientId}/litigation-cases/${caseId}/defendants/${defendant.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editForm),
        }
      );

      if (!response.ok) throw new Error("Failed to update defendant");

      const updated = await response.json();
      onUpdate({ ...defendant, ...editForm, ...updated });
      toast({
        title: "Defendant Updated",
        description: `${defendant.entityName} details saved.`,
      });
      setIsEditing(false);
    } catch {
      toast({
        title: "Update Failed",
        description: "Could not update defendant details.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [clientId, caseId, defendant, editForm, onUpdate, toast]);

  const handleCancel = () => {
    setEditForm({
      address: defendant.address || "",
      city: defendant.city || "",
      state: defendant.state || "",
      zipCode: defendant.zipCode || "",
    });
    setIsEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className={`bg-card ${config.border} hover:shadow-lg transition-shadow duration-200`}>
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-lg ${config.bg}`}>
                <TypeIcon className={`w-4 h-4 ${config.color}`} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  {defendant.entityName}
                </h4>
                <p className="text-[10px] text-muted-foreground">
                  {config.label}
                </p>
              </div>
            </div>

            <Badge
              className={`${config.bg} ${config.color} text-[10px] px-2 py-0.5 border-0`}
            >
              {defendant.entityType}
            </Badge>
          </div>

          {/* Violation count */}
          <div className="flex items-center justify-between mb-3 bg-background rounded-lg px-3 py-2">
            <span className="text-xs text-muted-foreground">Violations</span>
            <Badge
              className={`text-xs font-bold px-2.5 py-0.5 border-0 ${
                defendant.violationCount >= 5
                  ? "bg-red-500/20 text-red-400"
                  : defendant.violationCount >= 3
                  ? "bg-orange-500/20 text-orange-400"
                  : "bg-yellow-500/20 text-yellow-400"
              }`}
            >
              {defendant.violationCount}
            </Badge>
          </div>

          {/* Liability range */}
          <div className="bg-emerald-500/10 rounded-lg px-3 py-2 border border-emerald-500/15 mb-3">
            <p className="text-[10px] text-muted-foreground mb-0.5">
              Estimated Liability
            </p>
            <p className="text-sm font-bold text-emerald-400">
              {formatCurrency(defendant.estimatedLiabilityMin)} -{" "}
              {formatCurrency(defendant.estimatedLiabilityMax)}
            </p>
          </div>

          {/* Address section */}
          {isEditing ? (
            <div className="space-y-2 mb-3 bg-background rounded-lg p-3 border border-border">
              <div className="space-y-1.5">
                <Label className="text-[10px]">Street Address</Label>
                <Input
                  value={editForm.address}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, address: e.target.value }))
                  }
                  className="h-8 text-xs"
                  placeholder="123 Main St"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-[10px]">City</Label>
                  <Input
                    value={editForm.city}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, city: e.target.value }))
                    }
                    className="h-8 text-xs"
                    placeholder="City"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px]">State</Label>
                  <Input
                    value={editForm.state}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, state: e.target.value }))
                    }
                    className="h-8 text-xs"
                    placeholder="ST"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px]">ZIP</Label>
                  <Input
                    value={editForm.zipCode}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, zipCode: e.target.value }))
                    }
                    className="h-8 text-xs"
                    placeholder="12345"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-1.5 pt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={handleCancel}
                >
                  <X className="w-3 h-3 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  <Check className="w-3 h-3 mr-1" />
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="mb-3">
              {defendant.address ? (
                <div className="flex items-start gap-2 bg-background rounded-lg px-3 py-2 border border-border">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground flex-1">
                    {defendant.address}
                    {defendant.city && `, ${defendant.city}`}
                    {defendant.state && `, ${defendant.state}`}
                    {defendant.zipCode && ` ${defendant.zipCode}`}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 flex-shrink-0"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="w-3 h-3 text-muted-foreground" />
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-xs text-muted-foreground"
                  onClick={() => setIsEditing(true)}
                >
                  <MapPin className="w-3 h-3 mr-1" />
                  Add Address
                </Button>
              )}
            </div>
          )}

          {/* Service & Response Status */}
          <div className="grid grid-cols-2 gap-2">
            {/* Service status */}
            <div
              className={`rounded-lg px-3 py-2 border ${
                isServed
                  ? "bg-emerald-500/10 border-emerald-500/15"
                  : "bg-red-500/10 border-red-500/15"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <Mail className={`w-3 h-3 ${isServed ? "text-emerald-400" : "text-red-400"}`} />
                <p className="text-[10px] text-muted-foreground">Service</p>
              </div>
              <p className={`text-xs font-medium ${isServed ? "text-emerald-400" : "text-red-400"}`}>
                {isServed
                  ? `Served ${defendant.servedAt ? formatDate(defendant.servedAt) : ""}`
                  : "Not Served"}
              </p>
            </div>

            {/* Response status */}
            <div className="rounded-lg px-3 py-2 bg-background border border-border">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <p className="text-[10px] text-muted-foreground">Response</p>
              </div>
              {defendant.hasResponded ? (
                <p className="text-xs font-medium text-emerald-400">Responded</p>
              ) : defendant.responseDeadline ? (
                <p className="text-xs font-medium text-amber-400">
                  Due {formatDate(defendant.responseDeadline)}
                </p>
              ) : (
                <p className="text-xs font-medium text-muted-foreground">
                  Awaiting
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DefendantManager({
  defendants,
  caseId,
  clientId,
  onUpdate,
}: DefendantManagerProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground">
        Defendants ({defendants.length})
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {defendants.map((defendant) => (
          <DefendantCard
            key={defendant.id}
            defendant={defendant}
            caseId={caseId}
            clientId={clientId}
            onUpdate={onUpdate}
          />
        ))}
      </div>

      {defendants.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No defendants have been added to this case.</p>
        </div>
      )}
    </div>
  );
}

export default DefendantManager;
