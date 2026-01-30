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
import { Plus, X, Loader2, Info } from "lucide-react";

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

interface VendorRuleBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  rule?: any;
  onSaved: () => void;
}

interface Condition {
  field: string;
  operator: string;
  value: any;
  valueEnd?: any;
}

const FIELD_LABELS: Record<string, string> = {
  credit_score_min: "Credit Score (Min)",
  credit_score_max: "Credit Score (Max)",
  credit_score_avg: "Credit Score (Avg)",
  has_collections: "Has Collections",
  collection_count_min: "Collection Count (Min)",
  collection_balance_min: "Collection Balance (Min)",
  has_charge_offs: "Has Charge-Offs",
  charge_off_count_min: "Charge-Off Count (Min)",
  total_debt_min: "Total Debt (Min)",
  total_debt_max: "Total Debt (Max)",
  account_count_min: "Account Count (Min)",
  account_count_max: "Account Count (Max)",
  dispute_stage: "Dispute Stage",
  dna_classification: "DNA Classification",
  health_score_min: "Health Score (Min)",
  health_score_max: "Health Score (Max)",
  utilization_min: "Utilization % (Min)",
  utilization_max: "Utilization % (Max)",
  has_income: "Has Income Data",
  income_min: "Income (Min)",
  income_max: "Income (Max)",
  readiness_product_type: "Readiness Product Type",
  approval_likelihood_max: "Approval Likelihood (Max)",
  approval_likelihood_min: "Approval Likelihood (Min)",
  inquiry_count_min: "Inquiry Count (Min)",
};

const BOOLEAN_FIELDS = ["has_collections", "has_charge_offs", "has_income"];

const STRING_FIELDS = ["dispute_stage", "dna_classification", "readiness_product_type"];

const ALL_FIELDS = Object.keys(FIELD_LABELS);

const ALL_OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not Equals" },
  { value: "greater_than", label: "Greater Than" },
  { value: "less_than", label: "Less Than" },
  { value: "in", label: "In" },
  { value: "not_in", label: "Not In" },
  { value: "between", label: "Between" },
];

function getOperatorsForField(field: string) {
  if (BOOLEAN_FIELDS.includes(field)) {
    return ALL_OPERATORS.filter((op) => op.value === "equals" || op.value === "not_equals");
  }
  if (STRING_FIELDS.includes(field)) {
    return ALL_OPERATORS;
  }
  // Numeric fields: all except in/not_in
  return ALL_OPERATORS.filter((op) => op.value !== "in" && op.value !== "not_in");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VendorRuleBuilder({
  open,
  onOpenChange,
  vendorId,
  rule,
  onSaved,
}: VendorRuleBuilderProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Basic info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);

  // Conditions
  const [conditions, setConditions] = useState<Condition[]>([]);

  // Recommendation
  const [recommendationTitle, setRecommendationTitle] = useState("");
  const [recommendationBody, setRecommendationBody] = useState("");
  const [recommendationCTA, setRecommendationCTA] = useState("");
  const [customAffiliateUrl, setCustomAffiliateUrl] = useState("");

  const isEdit = !!rule;

  // Populate form when editing
  useEffect(() => {
    if (rule) {
      setName(rule.name || "");
      setDescription(rule.description || "");
      setPriority(rule.priority ?? 0);
      setIsActive(rule.isActive ?? true);
      setConditions(
        Array.isArray(rule.conditions) ? rule.conditions : []
      );
      setRecommendationTitle(rule.recommendationTitle || "");
      setRecommendationBody(rule.recommendationBody || "");
      setRecommendationCTA(rule.recommendationCTA || "");
      setCustomAffiliateUrl(rule.customAffiliateUrl || "");
    } else {
      setName("");
      setDescription("");
      setPriority(0);
      setIsActive(true);
      setConditions([]);
      setRecommendationTitle("");
      setRecommendationBody("");
      setRecommendationCTA("");
      setCustomAffiliateUrl("");
    }
  }, [rule, open]);

  // ---- Condition Helpers ----

  function addCondition() {
    setConditions([
      ...conditions,
      { field: "credit_score_avg", operator: "less_than", value: "" },
    ]);
  }

  function removeCondition(index: number) {
    setConditions(conditions.filter((_, i) => i !== index));
  }

  function updateCondition(index: number, updates: Partial<Condition>) {
    setConditions(
      conditions.map((c, i) => (i === index ? { ...c, ...updates } : c))
    );
  }

  function handleFieldChange(index: number, newField: string) {
    const isBool = BOOLEAN_FIELDS.includes(newField);
    const ops = getOperatorsForField(newField);
    const currentOp = conditions[index].operator;
    const validOp = ops.find((o) => o.value === currentOp) ? currentOp : ops[0].value;

    updateCondition(index, {
      field: newField,
      operator: validOp,
      value: isBool ? true : "",
      valueEnd: undefined,
    });
  }

  // ---- Save ----

  async function handleSave() {
    if (!name.trim()) {
      toast({ title: "Rule name is required", variant: "destructive" });
      return;
    }
    if (!recommendationTitle.trim()) {
      toast({ title: "Recommendation title is required", variant: "destructive" });
      return;
    }
    if (!recommendationBody.trim()) {
      toast({ title: "Recommendation body is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || null,
        priority,
        isActive,
        conditions: conditions.map((c) => {
          const cleaned: Record<string, unknown> = {
            field: c.field,
            operator: c.operator,
            value: BOOLEAN_FIELDS.includes(c.field)
              ? Boolean(c.value)
              : typeof c.value === "string" && !isNaN(Number(c.value)) && !STRING_FIELDS.includes(c.field)
              ? Number(c.value)
              : c.value,
          };
          if (c.operator === "between" && c.valueEnd !== undefined) {
            cleaned.valueEnd =
              typeof c.valueEnd === "string" && !isNaN(Number(c.valueEnd))
                ? Number(c.valueEnd)
                : c.valueEnd;
          }
          return cleaned;
        }),
        recommendationTitle: recommendationTitle.trim(),
        recommendationBody: recommendationBody.trim(),
        recommendationCTA: recommendationCTA.trim() || null,
        customAffiliateUrl: customAffiliateUrl.trim() || null,
      };

      const url = isEdit
        ? `/api/vendors/${vendorId}/rules/${rule.id}`
        : `/api/vendors/${vendorId}/rules`;
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save rule");
      }

      toast({
        title: isEdit ? "Rule updated" : "Rule created",
        description: `"${name}" has been ${isEdit ? "updated" : "created"} successfully.`,
      });

      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save rule",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  // ---- Render ----

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent size="lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {isEdit ? "Edit Rule" : "Create Rule"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {isEdit
              ? "Update the targeting rule and recommendation content."
              : "Define conditions that match client profiles and the recommendation to show."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="space-y-6">
          {/* ---- Basic Info ---- */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Basic Info
            </h3>

            <div className="space-y-2">
              <Label htmlFor="rule-name">Rule Name *</Label>
              <Input
                id="rule-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Low Score Collections"
                className="bg-slate-800 border-slate-700"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-description">Description</Label>
              <Textarea
                id="rule-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe when this rule should trigger..."
                className="bg-slate-800 border-slate-700"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rule-priority">Priority</Label>
                <Input
                  id="rule-priority"
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  placeholder="0"
                  className="bg-slate-800 border-slate-700"
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isActive}
                    onClick={() => setIsActive(!isActive)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isActive ? "bg-emerald-600" : "bg-slate-600"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isActive ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <span className="text-sm text-slate-300">
                    {isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ---- Conditions Builder ---- */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Conditions (ALL must match)
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={addCondition}
                className="text-blue-400 hover:text-blue-300"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Condition
              </Button>
            </div>

            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-300">
                All conditions use AND logic. A client must match every condition for this rule to
                trigger.
              </p>
            </div>

            {conditions.length === 0 && (
              <div className="text-center py-6 text-slate-500 text-sm border border-dashed border-slate-700 rounded-lg">
                No conditions added. Click &quot;Add Condition&quot; to start building.
              </div>
            )}

            <div className="space-y-3">
              {conditions.map((condition, index) => {
                const isBool = BOOLEAN_FIELDS.includes(condition.field);
                const isString = STRING_FIELDS.includes(condition.field);
                const operators = getOperatorsForField(condition.field);
                const isBetween = condition.operator === "between";

                return (
                  <div
                    key={index}
                    className="bg-slate-700/20 rounded-lg p-3 flex items-center gap-3 flex-wrap"
                  >
                    {/* Field */}
                    <select
                      value={condition.field}
                      onChange={(e) => handleFieldChange(index, e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 min-w-[180px]"
                    >
                      {ALL_FIELDS.map((f) => (
                        <option key={f} value={f}>
                          {FIELD_LABELS[f]}
                        </option>
                      ))}
                    </select>

                    {/* Operator */}
                    <select
                      value={condition.operator}
                      onChange={(e) =>
                        updateCondition(index, {
                          operator: e.target.value,
                          ...(e.target.value !== "between" ? { valueEnd: undefined } : {}),
                        })
                      }
                      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 min-w-[130px]"
                    >
                      {operators.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>

                    {/* Value */}
                    {isBool ? (
                      <select
                        value={String(condition.value)}
                        onChange={(e) =>
                          updateCondition(index, {
                            value: e.target.value === "true",
                          })
                        }
                        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 min-w-[100px]"
                      >
                        <option value="true">True</option>
                        <option value="false">False</option>
                      </select>
                    ) : isString ? (
                      <Input
                        value={condition.value || ""}
                        onChange={(e) =>
                          updateCondition(index, { value: e.target.value })
                        }
                        placeholder="Value..."
                        className="bg-slate-800 border-slate-700 w-[150px]"
                      />
                    ) : (
                      <>
                        <Input
                          type="number"
                          value={condition.value ?? ""}
                          onChange={(e) =>
                            updateCondition(index, { value: e.target.value })
                          }
                          placeholder="Value"
                          className="bg-slate-800 border-slate-700 w-[110px]"
                        />
                        {isBetween && (
                          <>
                            <span className="text-slate-500 text-sm">and</span>
                            <Input
                              type="number"
                              value={condition.valueEnd ?? ""}
                              onChange={(e) =>
                                updateCondition(index, { valueEnd: e.target.value })
                              }
                              placeholder="End"
                              className="bg-slate-800 border-slate-700 w-[110px]"
                            />
                          </>
                        )}
                      </>
                    )}

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => removeCondition(index)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-auto"
                      aria-label="Remove condition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ---- Recommendation ---- */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Recommendation
            </h3>

            <div className="space-y-2">
              <Label htmlFor="rec-title">Recommendation Title *</Label>
              <Input
                id="rec-title"
                value={recommendationTitle}
                onChange={(e) => setRecommendationTitle(e.target.value)}
                placeholder="e.g., Credit Monitoring Recommended"
                className="bg-slate-800 border-slate-700"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rec-body">Recommendation Body *</Label>
              <Textarea
                id="rec-body"
                value={recommendationBody}
                onChange={(e) => setRecommendationBody(e.target.value)}
                placeholder="Based on your profile, we recommend..."
                className="bg-slate-800 border-slate-700"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rec-cta">CTA Text</Label>
                <Input
                  id="rec-cta"
                  value={recommendationCTA}
                  onChange={(e) => setRecommendationCTA(e.target.value)}
                  placeholder="e.g., Sign Up Now"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rec-affiliate">Custom Affiliate URL</Label>
                <Input
                  id="rec-affiliate"
                  value={customAffiliateUrl}
                  onChange={(e) => setCustomAffiliateUrl(e.target.value)}
                  placeholder="https://... (optional override)"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
            </div>
          </div>
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEdit ? "Update Rule" : "Create Rule"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
