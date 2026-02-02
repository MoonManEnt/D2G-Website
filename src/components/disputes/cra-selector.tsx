"use client";

import { cn } from "@/lib/utils";
import { CRA_COLORS } from "./types";

interface CRASelectorProps {
  selectedCRA: string;
  onSelectCRA: (cra: string) => void;
  scores?: { TU?: number | null; EX?: number | null; EQ?: number | null };
  className?: string;
}

const CRAS = [
  { id: "TRANSUNION", name: "TransUnion", abbrev: "TU" },
  { id: "EXPERIAN", name: "Experian", abbrev: "EX" },
  { id: "EQUIFAX", name: "Equifax", abbrev: "EQ" },
];

export function CRASelector({ selectedCRA, onSelectCRA, scores, className }: CRASelectorProps) {
  return (
    <div className={cn("flex gap-3", className)}>
      {CRAS.map((cra) => {
        const isSelected = selectedCRA === cra.id;
        const colors = CRA_COLORS[cra.id];
        const score = scores?.[cra.abbrev as keyof typeof scores];

        return (
          <button
            key={cra.id}
            onClick={() => onSelectCRA(cra.id)}
            className={cn(
              "flex-1 flex items-center gap-3 p-3 rounded-lg border transition-all",
              isSelected
                ? colors.tailwind
                : "bg-muted border-input hover:border-border"
            )}
          >
            <div className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold",
              isSelected ? "bg-white/10" : "bg-muted"
            )}>
              {cra.abbrev}
            </div>
            <div className="flex flex-col items-start text-left">
              <span className={cn(
                "text-sm font-semibold",
                isSelected ? "" : "text-muted-foreground"
              )}>
                {cra.name}
              </span>
              {score !== undefined && score !== null && (
                <span className="text-xs text-muted-foreground">
                  Score: {score}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
