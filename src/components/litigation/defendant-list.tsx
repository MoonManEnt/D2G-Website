"use client";

import { Building2, Shield, Landmark, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DefendantListProps {
  defendants: Array<{
    name: string;
    type: string; // CRA, FURNISHER, COLLECTOR
    violationCount: number;
    primaryStatutes: string[];
    estimatedLiabilityMin: number;
    estimatedLiabilityMax: number;
  }>;
}

const typeConfig: Record<
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

function formatCentsAsDollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function DefendantList({ defendants }: DefendantListProps) {
  // Sort by violation count descending
  const sortedDefendants = [...defendants].sort(
    (a, b) => b.violationCount - a.violationCount
  );

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-300">
        Defendants ({sortedDefendants.length})
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sortedDefendants.map((defendant, idx) => {
          const config = typeConfig[defendant.type] || typeConfig.FURNISHER;
          const TypeIcon = config.icon;

          return (
            <Card
              key={idx}
              className={`bg-slate-800/50 ${config.border} hover:shadow-lg transition-shadow duration-200`}
            >
              <CardContent className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg ${config.bg}`}>
                      <TypeIcon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-100">
                        {defendant.name}
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        {config.label}
                      </p>
                    </div>
                  </div>

                  {/* Type badge */}
                  <Badge
                    className={`${config.bg} ${config.color} text-[10px] px-2 py-0.5 border-0`}
                  >
                    {defendant.type}
                  </Badge>
                </div>

                {/* Violation count */}
                <div className="flex items-center justify-between mb-3 bg-slate-900/40 rounded-lg px-3 py-2">
                  <span className="text-xs text-slate-400">Violations</span>
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

                {/* Primary statutes */}
                {defendant.primaryStatutes.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Primary Statutes
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {defendant.primaryStatutes.map((statute, sIdx) => (
                        <span
                          key={sIdx}
                          className="text-[10px] font-mono text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded"
                        >
                          {statute}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Estimated liability */}
                <div className="bg-emerald-500/8 rounded-lg px-3 py-2 border border-emerald-500/15">
                  <p className="text-[10px] text-slate-500 mb-0.5">
                    Estimated Liability
                  </p>
                  <p className="text-sm font-bold text-emerald-400">
                    {formatCentsAsDollars(defendant.estimatedLiabilityMin)} -{" "}
                    {formatCentsAsDollars(defendant.estimatedLiabilityMax)}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default DefendantList;
