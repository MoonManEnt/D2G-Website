"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const PRIORITY_COLORS: Record<string, { text: string; bg: string; fill: string }> = {
  CRITICAL: { text: "text-red-400", bg: "bg-red-500/20", fill: "bg-red-500" },
  HIGH: { text: "text-orange-400", bg: "bg-orange-500/20", fill: "bg-orange-500" },
  MEDIUM: { text: "text-amber-400", bg: "bg-amber-500/20", fill: "bg-amber-500" },
  LOW: { text: "text-slate-400", bg: "bg-slate-500/20", fill: "bg-slate-500" },
};

interface ScoreGapFactor {
  factor: string;
  currentImpact: string;
  potentialGain: number;
  action: string;
  priority?: string;
}

interface ScoreGapChartProps {
  currentScore: number;
  targetScore: number;
  pointsNeeded: number;
  estimatedMonths: string;
  factors: ScoreGapFactor[];
}

export function ScoreGapChart({
  currentScore,
  targetScore,
  pointsNeeded,
  estimatedMonths,
  factors,
}: ScoreGapChartProps) {
  const maxGain = Math.max(...factors.map((f) => f.potentialGain), 1);

  return (
    <div className="space-y-5">
      {/* Header: current -> target */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-slate-100">{currentScore}</span>
          <ArrowRight className="w-5 h-5 text-slate-500" />
          <span className="text-2xl font-bold text-emerald-400">{targetScore}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-lg text-sm font-medium bg-blue-500/20 text-blue-400">
            +{pointsNeeded} pts needed
          </span>
          <span className="px-3 py-1 rounded-lg text-sm font-medium bg-slate-700/50 text-slate-300">
            ~{estimatedMonths}
          </span>
        </div>
      </div>

      {/* Factor list */}
      <div className="space-y-3">
        {factors.map((factor, i) => {
          const priority = factor.priority || "MEDIUM";
          const colors = PRIORITY_COLORS[priority] || PRIORITY_COLORS.MEDIUM;
          const barWidth = Math.min((factor.potentialGain / (pointsNeeded || 1)) * 100, 100);

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-slate-700/30 rounded-lg p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-200">{factor.factor}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${colors.text}`}>
                    +{factor.potentialGain} pts
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
                    {priority}
                  </span>
                </div>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${colors.fill}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={{ duration: 0.6, delay: i * 0.05 }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">{factor.action}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
