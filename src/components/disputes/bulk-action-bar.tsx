"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Zap } from "lucide-react";
import { type DisputeFlow, getFlowDescription } from "@/lib/flow-detector";

interface BulkActionBarProps {
  selections: {
    TRANSUNION: string[];
    EQUIFAX: string[];
    EXPERIAN: string[];
  };
  detectedFlows: {
    TRANSUNION: DisputeFlow | null;
    EQUIFAX: DisputeFlow | null;
    EXPERIAN: DisputeFlow | null;
  };
  onCreateDispute: (cra: "TRANSUNION" | "EQUIFAX" | "EXPERIAN") => Promise<void>;
  onCreateAll: () => Promise<void>;
  isCreating: boolean;
  creatingCRA?: string | null;
}

const CRA_CONFIG = {
  TRANSUNION: {
    name: "TransUnion",
    shortName: "TU",
    textClass: "text-primary",
    bgClass: "bg-primary/10",
    borderClass: "border-primary/30",
    hoverClass: "hover:bg-primary/20 hover:border-blue-500/50",
  },
  EQUIFAX: {
    name: "Equifax",
    shortName: "EQ",
    textClass: "text-red-400",
    bgClass: "bg-red-500/10",
    borderClass: "border-red-500/30",
    hoverClass: "hover:bg-red-500/20 hover:border-red-500/50",
  },
  EXPERIAN: {
    name: "Experian",
    shortName: "EX",
    textClass: "text-purple-400",
    bgClass: "bg-purple-500/10",
    borderClass: "border-purple-500/30",
    hoverClass: "hover:bg-purple-500/20 hover:border-purple-500/50",
  },
} as const;

const FLOW_COLORS: Record<DisputeFlow, string> = {
  ACCURACY: "#3b82f6",
  COLLECTION: "#f59e0b",
  CONSENT: "#8b5cf6",
  COMBO: "#ec4899",
};

export function BulkActionBar({
  selections,
  detectedFlows,
  onCreateDispute,
  onCreateAll,
  isCreating,
  creatingCRA,
}: BulkActionBarProps) {
  const cras = ["TRANSUNION", "EQUIFAX", "EXPERIAN"] as const;

  // Count how many CRAs have selections
  const activeCRAs = cras.filter((cra) => selections[cra].length > 0);
  const totalSelected = cras.reduce((sum, cra) => sum + selections[cra].length, 0);

  if (totalSelected === 0) {
    return (
      <div className="p-4 bg-card border border-border rounded-xl text-center">
        <p className="text-sm text-muted-foreground">
          Select accounts above to create disputes
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-card border border-border rounded-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Bulk Actions</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalSelected} account{totalSelected !== 1 ? "s" : ""} selected across {activeCRAs.length} bureau{activeCRAs.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Create All Button */}
        {activeCRAs.length > 1 && (
          <Button
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
            onClick={onCreateAll}
            disabled={isCreating}
          >
            {isCreating && !creatingCRA ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Create All ({activeCRAs.length})
              </>
            )}
          </Button>
        )}
      </div>

      {/* Individual CRA Buttons */}
      <div className="grid grid-cols-3 gap-3">
        {cras.map((cra) => {
          const config = CRA_CONFIG[cra];
          const count = selections[cra].length;
          const flow = detectedFlows[cra];
          const isThisCRACreating = isCreating && creatingCRA === cra;
          const isDisabled = count === 0 || isCreating;

          return (
            <Button
              key={cra}
              variant="outline"
              className={cn(
                "flex flex-col items-center gap-2 h-auto py-3 transition-all",
                config.bgClass,
                config.borderClass,
                !isDisabled && config.hoverClass,
                isDisabled && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => onCreateDispute(cra)}
              disabled={isDisabled}
            >
              {isThisCRACreating ? (
                <Loader2 className={cn("w-5 h-5 animate-spin", config.textClass)} />
              ) : (
                <Sparkles className={cn("w-5 h-5", config.textClass)} />
              )}

              <div className="text-center">
                <span className={cn("block text-sm font-semibold", config.textClass)}>
                  {config.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {count > 0 ? `${count} account${count !== 1 ? "s" : ""}` : "None selected"}
                </span>
              </div>

              {flow && (
                <Badge
                  className="text-[10px] mt-1"
                  style={{
                    background: `${FLOW_COLORS[flow]}20`,
                    color: FLOW_COLORS[flow],
                  }}
                >
                  {flow}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>

      {/* Flow Detection Summary */}
      {activeCRAs.length > 0 && (
        <div className="pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Auto-detected flows:</p>
          <div className="flex flex-wrap gap-2">
            {activeCRAs.map((cra) => {
              const flow = detectedFlows[cra];
              if (!flow) return null;

              const flowInfo = getFlowDescription(flow);
              return (
                <div
                  key={cra}
                  className="flex items-center gap-2 px-2 py-1 bg-muted rounded text-xs"
                >
                  <span className={CRA_CONFIG[cra].textClass}>{CRA_CONFIG[cra].shortName}</span>
                  <span className="text-muted-foreground">→</span>
                  <span
                    style={{ color: FLOW_COLORS[flow] }}
                    title={flowInfo.description}
                  >
                    {flow}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
