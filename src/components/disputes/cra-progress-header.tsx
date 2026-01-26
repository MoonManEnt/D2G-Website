"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface CRAStatus {
  currentRound: number;
  hasActive: boolean;
  latestStatus: "DRAFT" | "SENT" | "RESPONDED" | "RESOLVED" | null;
  statusText: string;
}

interface CRAProgressHeaderProps {
  status: {
    TRANSUNION: CRAStatus;
    EQUIFAX: CRAStatus;
    EXPERIAN: CRAStatus;
  };
  selectedCRA?: string;
  onSelectCRA?: (cra: string) => void;
}

const CRA_CONFIG = {
  TRANSUNION: {
    name: "TransUnion",
    shortName: "TU",
    color: "blue",
    bgClass: "bg-blue-500/10",
    borderClass: "border-blue-500/30",
    textClass: "text-blue-400",
    dotActive: "bg-blue-500",
    dotInactive: "bg-blue-500/30",
  },
  EQUIFAX: {
    name: "Equifax",
    shortName: "EQ",
    color: "red",
    bgClass: "bg-red-500/10",
    borderClass: "border-red-500/30",
    textClass: "text-red-400",
    dotActive: "bg-red-500",
    dotInactive: "bg-red-500/30",
  },
  EXPERIAN: {
    name: "Experian",
    shortName: "EX",
    color: "purple",
    bgClass: "bg-purple-500/10",
    borderClass: "border-purple-500/30",
    textClass: "text-purple-400",
    dotActive: "bg-purple-500",
    dotInactive: "bg-purple-500/30",
  },
} as const;

const STATUS_STYLES = {
  DRAFT: "bg-slate-500/20 text-slate-400",
  SENT: "bg-blue-500/20 text-blue-400",
  RESPONDED: "bg-amber-500/20 text-amber-400",
  RESOLVED: "bg-emerald-500/20 text-emerald-400",
};

export function CRAProgressHeader({
  status,
  selectedCRA,
  onSelectCRA,
}: CRAProgressHeaderProps) {
  const cras = ["TRANSUNION", "EQUIFAX", "EXPERIAN"] as const;

  return (
    <div className="grid grid-cols-3 gap-4">
      {cras.map((cra) => {
        const config = CRA_CONFIG[cra];
        const craStatus = status[cra];
        const isSelected = selectedCRA === cra;

        return (
          <div
            key={cra}
            className={cn(
              "p-4 rounded-xl border transition-all cursor-pointer",
              config.bgClass,
              isSelected ? config.borderClass : "border-slate-700/50",
              isSelected && "ring-1 ring-offset-1 ring-offset-slate-900",
              isSelected && cra === "TRANSUNION" && "ring-blue-500/50",
              isSelected && cra === "EQUIFAX" && "ring-red-500/50",
              isSelected && cra === "EXPERIAN" && "ring-purple-500/50",
              !isSelected && "hover:border-slate-600"
            )}
            onClick={() => onSelectCRA?.(cra)}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <span className={cn("font-semibold", config.textClass)}>
                {config.name}
              </span>
              {craStatus.latestStatus ? (
                <Badge
                  className={cn("text-[10px]", STATUS_STYLES[craStatus.latestStatus])}
                >
                  {craStatus.latestStatus}
                </Badge>
              ) : (
                <Badge className="text-[10px] bg-slate-700/50 text-slate-500">
                  Not Started
                </Badge>
              )}
            </div>

            {/* Round Progress Dots */}
            <div className="flex items-center gap-2 mb-2">
              {[1, 2, 3, 4].map((round) => {
                const isCompleted = round < craStatus.currentRound;
                const isCurrent = round === craStatus.currentRound;
                const isActive = isCurrent && craStatus.hasActive;

                return (
                  <div key={round} className="flex flex-col items-center gap-1">
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full transition-all",
                        isCompleted && "bg-emerald-500",
                        isCurrent && isActive && config.dotActive,
                        isCurrent && isActive && "animate-pulse",
                        isCurrent && !isActive && "bg-slate-500",
                        !isCompleted && !isCurrent && config.dotInactive
                      )}
                      title={`Round ${round}${isCompleted ? " (Complete)" : isCurrent ? " (Current)" : ""}`}
                    />
                    <span className="text-[9px] text-slate-500">R{round}</span>
                  </div>
                );
              })}
            </div>

            {/* Status Text */}
            <p className="text-xs text-slate-400 truncate">
              {craStatus.statusText}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// Helper function to calculate CRA status from disputes
export function calculateCRAStatus(
  disputes: Array<{
    cra: string;
    round: number;
    status: string;
    sentDate?: string;
    createdAt?: string;
  }>
): {
  TRANSUNION: CRAStatus;
  EQUIFAX: CRAStatus;
  EXPERIAN: CRAStatus;
} {
  const result: {
    TRANSUNION: CRAStatus;
    EQUIFAX: CRAStatus;
    EXPERIAN: CRAStatus;
  } = {
    TRANSUNION: { currentRound: 1, hasActive: false, latestStatus: null, statusText: "No disputes yet" },
    EQUIFAX: { currentRound: 1, hasActive: false, latestStatus: null, statusText: "No disputes yet" },
    EXPERIAN: { currentRound: 1, hasActive: false, latestStatus: null, statusText: "No disputes yet" },
  };

  for (const cra of ["TRANSUNION", "EQUIFAX", "EXPERIAN"] as const) {
    const craDisputes = disputes
      .filter((d) => d.cra === cra)
      .sort((a, b) => b.round - a.round);

    if (craDisputes.length === 0) continue;

    const latest = craDisputes[0];
    const maxRound = Math.max(...craDisputes.map((d) => d.round));

    result[cra] = {
      currentRound: maxRound,
      hasActive: latest.status === "DRAFT" || latest.status === "SENT",
      latestStatus: latest.status as CRAStatus["latestStatus"],
      statusText: getStatusText(latest),
    };
  }

  return result;
}

function getStatusText(dispute: {
  status: string;
  round: number;
  sentDate?: string;
}): string {
  switch (dispute.status) {
    case "DRAFT":
      return `Round ${dispute.round} draft ready`;
    case "SENT":
      if (dispute.sentDate) {
        const sent = new Date(dispute.sentDate);
        const deadline = new Date(sent.getTime() + 30 * 24 * 60 * 60 * 1000);
        const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
        return daysLeft > 0 ? `${daysLeft} days until response` : `Response overdue`;
      }
      return `Round ${dispute.round} sent`;
    case "RESPONDED":
      return `Round ${dispute.round} response received`;
    case "RESOLVED":
      return `Completed through Round ${dispute.round}`;
    default:
      return `Round ${dispute.round}`;
  }
}
