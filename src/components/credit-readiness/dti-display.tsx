"use client";

import { motion } from "framer-motion";

const STATUS_COLORS: Record<string, { text: string; bg: string; fill: string }> = {
  GOOD: { text: "text-emerald-400", bg: "bg-emerald-500/20", fill: "bg-emerald-500" },
  BORDERLINE: { text: "text-amber-400", bg: "bg-amber-500/20", fill: "bg-amber-500" },
  HIGH: { text: "text-orange-400", bg: "bg-orange-500/20", fill: "bg-orange-500" },
  CRITICAL: { text: "text-red-400", bg: "bg-red-500/20", fill: "bg-red-500" },
};

interface DTIDisplayProps {
  ratio: number;
  status: string;
  monthlyDebt: number;
  monthlyIncome: number;
  maxDTI: number;
  details?: string;
}

export function DTIDisplay({ ratio, status, monthlyDebt, monthlyIncome, maxDTI, details }: DTIDisplayProps) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.GOOD;
  const ratioPercent = Math.min(ratio, 100);
  const maxDTIPercent = Math.min(maxDTI, 100);

  return (
    <div className="space-y-4">
      {/* Large ratio + status badge */}
      <div className="flex items-center gap-3">
        <span className={`text-3xl font-bold ${colors.text}`}>
          {ratio.toFixed(1)}%
        </span>
        <span className={`px-3 py-1 rounded-lg text-sm font-medium ${colors.bg} ${colors.text}`}>
          {status}
        </span>
      </div>

      {/* Visual bar */}
      <div className="relative">
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${colors.fill}`}
            initial={{ width: 0 }}
            animate={{ width: `${ratioPercent}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
        {/* Max DTI marker */}
        <div
          className="absolute top-0 h-3 w-0.5 bg-muted-foreground"
          style={{ left: `${maxDTIPercent}%` }}
        />
        {/* Labels below bar */}
        <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
          <span>0%</span>
          <span
            className="absolute text-muted-foreground font-medium"
            style={{ left: `${maxDTIPercent}%`, transform: "translateX(-50%)" }}
          >
            {maxDTI}% Max
          </span>
          <span>100%</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="bg-muted rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Monthly Debt</p>
          <span className="text-lg font-bold text-red-400">
            ${monthlyDebt.toLocaleString()}
          </span>
        </div>
        <div className="bg-muted rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Monthly Income</p>
          <span className="text-lg font-bold text-emerald-400">
            ${monthlyIncome.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Details text */}
      {details && (
        <p className="text-xs text-muted-foreground mt-2">{details}</p>
      )}
    </div>
  );
}
