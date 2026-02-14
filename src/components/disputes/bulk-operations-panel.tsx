"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Sparkles,
  Layers,
  CheckCircle,
  AlertTriangle,
  FileStack,
  ArrowRight,
} from "lucide-react";
import { useToast } from "@/lib/use-toast";

interface BulkPreviewItem {
  cra: string;
  accounts: Array<{
    id: string;
    creditorName: string;
    suggestedFlow: string | null;
  }>;
  suggestedFlow: string;
  accountsInDispute: string[];
}

interface BulkOperationsPanelProps {
  clientId: string;
  selectedAccountIds: string[];
  onComplete?: () => void;
  onPreviewGenerated?: (preview: BulkPreviewItem[]) => void;
}

export function BulkOperationsPanel({
  clientId,
  selectedAccountIds,
  onComplete,
  onPreviewGenerated,
}: BulkOperationsPanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState<BulkPreviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{
    success: boolean;
    summary?: {
      totalAccountsRequested: number;
      accountsProcessed: number;
      accountsSkipped: number;
      disputesCreated: number;
    };
    disputes?: Array<{
      disputeId: string;
      cra: string;
      flow: string;
      accountCount: number;
      isExisting: boolean;
    }>;
  } | null>(null);

  // Fetch preview
  const fetchPreview = async () => {
    setLoading(true);
    setError(null);
    setPreview(null);
    setResults(null);

    try {
      const accountIdsParam = selectedAccountIds.join(",");
      // GET /api/disputes/bulk returns preview data
      const previewRes = await fetch(
        `/api/disputes/bulk?clientId=${clientId}&accountIds=${accountIdsParam}`,
        { method: "GET" }
      );

      if (!previewRes.ok) {
        const errData = await previewRes.json().catch(() => null);
        if (errData?.code === "TIER_REQUIRED") {
          setError(`Bulk operations require ${errData.requiredTier} tier or higher.`);
        } else {
          setError(errData?.error || "Failed to generate preview");
        }
        return;
      }

      const data = await previewRes.json();
      setPreview(data.preview || []);
      onPreviewGenerated?.(data.preview || []);
    } catch {
      setError("Could not connect to the server");
    } finally {
      setLoading(false);
    }
  };

  // Create bulk disputes
  const createBulkDisputes = async () => {
    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/disputes/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          accountIds: selectedAccountIds,
          groupByCRA: true, // Always group by CRA for bulk operations
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        if (errData?.code === "TIER_REQUIRED") {
          setError(`Bulk operations require ${errData.requiredTier} tier or higher.`);
        } else {
          setError(errData?.error || "Failed to create disputes");
        }
        return;
      }

      const data = await res.json();
      setResults(data);

      toast({
        title: "Bulk Disputes Created",
        description: `Created ${data.summary.disputesCreated} disputes for ${data.summary.accountsProcessed} accounts`,
      });

      onComplete?.();
    } catch {
      setError("Failed to create disputes");
    } finally {
      setCreating(false);
    }
  };

  // Don't show if no accounts selected
  if (selectedAccountIds.length === 0) {
    return null;
  }

  // Show results after creation
  if (results) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <span className="font-bold text-emerald-400">Bulk Disputes Created</span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-background/50 text-center">
            <div className="text-2xl font-bold">{results.summary?.disputesCreated || 0}</div>
            <div className="text-xs text-muted-foreground">Disputes Created</div>
          </div>
          <div className="p-3 rounded-lg bg-background/50 text-center">
            <div className="text-2xl font-bold">{results.summary?.accountsProcessed || 0}</div>
            <div className="text-xs text-muted-foreground">Accounts Included</div>
          </div>
        </div>

        {results.disputes && results.disputes.length > 0 && (
          <div className="space-y-2 mb-4">
            {results.disputes.map((d, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 rounded-lg bg-background/30"
              >
                <div className="flex items-center gap-2">
                  <Badge className={cn(
                    "text-[10px] font-mono",
                    d.cra === "TRANSUNION" && "bg-cyan-500/15 text-cyan-400",
                    d.cra === "EXPERIAN" && "bg-violet-500/15 text-violet-400",
                    d.cra === "EQUIFAX" && "bg-rose-500/15 text-rose-400"
                  )}>
                    {d.cra}
                  </Badge>
                  <span className="text-sm">{d.flow}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {d.accountCount} account{d.accountCount > 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        )}

        {results.summary?.accountsSkipped !== undefined && results.summary.accountsSkipped > 0 && (
          <p className="text-xs text-amber-400 mb-4">
            {results.summary.accountsSkipped} accounts skipped (already in active disputes)
          </p>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setResults(null);
            setPreview(null);
          }}
          className="w-full"
        >
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Layers className="w-5 h-5 text-primary" />
        <span className="font-bold">Bulk Operations</span>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          {selectedAccountIds.length} selected
        </Badge>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-4">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {!preview ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Create disputes for all selected accounts at once. Accounts will be
            automatically grouped by bureau.
          </p>

          <Button
            onClick={fetchPreview}
            disabled={loading}
            className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
            variant="outline"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <FileStack className="w-4 h-4 mr-2" />
                Preview Bulk Disputes
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Preview Summary */}
          <div className="text-sm text-muted-foreground">
            The following disputes will be created:
          </div>

          <div className="space-y-2">
            {preview.map((group, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border"
              >
                <div className="flex items-center gap-3">
                  <Badge className={cn(
                    "text-[10px] font-mono",
                    group.cra === "TRANSUNION" && "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
                    group.cra === "EXPERIAN" && "bg-violet-500/15 text-violet-400 border-violet-500/20",
                    group.cra === "EQUIFAX" && "bg-rose-500/15 text-rose-400 border-rose-500/20"
                  )}>
                    {group.cra}
                  </Badge>
                  <div>
                    <div className="text-sm font-medium">
                      {group.accounts.length} account{group.accounts.length > 1 ? "s" : ""}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {group.suggestedFlow} flow
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            ))}
          </div>

          {/* Accounts already in dispute warning */}
          {preview.some(g => g.accountsInDispute.length > 0) && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400">
                Some accounts are already in active disputes and will be skipped.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreview(null)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={createBulkDisputes}
              disabled={creating || preview.every(g => g.accounts.length === 0)}
              size="sm"
              className="flex-1 bg-emerald-600 hover:bg-emerald-500"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Create All
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
