"use client";

import { cn } from "@/lib/utils";
import { FLOW_INFO } from "./types";

interface FlowSelectorProps {
  selectedFlow: string;
  onSelectFlow: (flow: string) => void;
  className?: string;
}

const FLOWS = ["ACCURACY", "COLLECTION", "CONSENT", "COMBO"] as const;

export function FlowSelector({ selectedFlow, onSelectFlow, className }: FlowSelectorProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {FLOWS.map((flow) => {
        const info = FLOW_INFO[flow];
        const isSelected = selectedFlow === flow;

        return (
          <button
            key={flow}
            onClick={() => onSelectFlow(flow)}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
              isSelected
                ? "border-opacity-50"
                : "bg-slate-700/30 border-slate-600/50 hover:border-slate-500/50"
            )}
            style={isSelected ? {
              background: `${info.color}20`,
              borderColor: `${info.color}50`,
            } : undefined}
          >
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: info.color }}
            />
            <div className="flex-1">
              <span
                className={cn(
                  "block text-sm font-semibold",
                  isSelected ? "" : "text-slate-400"
                )}
                style={isSelected ? { color: info.color } : undefined}
              >
                {flow}
              </span>
              <span className="block text-xs text-slate-500">
                {info.description}
              </span>
            </div>
            <span className="text-xs text-slate-500 px-2 py-1 bg-slate-700/30 rounded">
              R1-R{info.maxRounds}
            </span>
          </button>
        );
      })}
    </div>
  );
}
