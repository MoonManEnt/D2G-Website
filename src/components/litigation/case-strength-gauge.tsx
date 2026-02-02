"use client";

import { motion } from "framer-motion";

interface CaseStrengthGaugeProps {
  score: number;
  label: string; // STRONG, MODERATE, WEAK
  size?: "sm" | "md" | "lg";
}

const sizeConfig = {
  sm: { dimension: 80, strokeWidth: 6, fontSize: "text-lg", labelSize: "text-[9px]" },
  md: { dimension: 120, strokeWidth: 8, fontSize: "text-2xl", labelSize: "text-xs" },
  lg: { dimension: 160, strokeWidth: 10, fontSize: "text-3xl", labelSize: "text-sm" },
};

const labelConfig: Record<string, { color: string; trackColor: string; glowColor: string }> = {
  STRONG: {
    color: "#22c55e",
    trackColor: "rgba(34, 197, 94, 0.15)",
    glowColor: "rgba(34, 197, 94, 0.3)",
  },
  MODERATE: {
    color: "#eab308",
    trackColor: "rgba(234, 179, 8, 0.15)",
    glowColor: "rgba(234, 179, 8, 0.3)",
  },
  WEAK: {
    color: "#ef4444",
    trackColor: "rgba(239, 68, 68, 0.15)",
    glowColor: "rgba(239, 68, 68, 0.3)",
  },
};

const labelTextConfig: Record<string, { textColor: string; bgColor: string }> = {
  STRONG: { textColor: "text-green-400", bgColor: "bg-green-500/15" },
  MODERATE: { textColor: "text-yellow-400", bgColor: "bg-yellow-500/15" },
  WEAK: { textColor: "text-red-400", bgColor: "bg-red-500/15" },
};

export function CaseStrengthGauge({
  score,
  label,
  size = "md",
}: CaseStrengthGaugeProps) {
  const config = sizeConfig[size];
  const colors = labelConfig[label] || labelConfig.MODERATE;
  const labelText = labelTextConfig[label] || labelTextConfig.MODERATE;

  const dimension = config.dimension;
  const strokeWidth = config.strokeWidth;
  const radius = (dimension - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = dimension / 2;

  // Clamp score between 0 and 100
  const clampedScore = Math.max(0, Math.min(100, score));
  const progressOffset = circumference - (clampedScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative"
        style={{ width: dimension, height: dimension }}
      >
        <svg
          width={dimension}
          height={dimension}
          viewBox={`0 0 ${dimension} ${dimension}`}
          className="transform -rotate-90"
        >
          {/* Background track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={colors.trackColor}
            strokeWidth={strokeWidth}
          />

          {/* Animated progress arc */}
          <motion.circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={colors.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: progressOffset }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
            style={{
              filter: `drop-shadow(0 0 6px ${colors.glowColor})`,
            }}
          />
        </svg>

        {/* Center score text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className={`${config.fontSize} font-bold text-slate-100`}
          >
            {clampedScore}
          </motion.span>
        </div>
      </div>

      {/* Label below gauge */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.8 }}
        className={`${labelText.bgColor} px-3 py-1 rounded-full`}
      >
        <span className={`${config.labelSize} font-semibold ${labelText.textColor} uppercase tracking-wider`}>
          {label}
        </span>
      </motion.div>
    </div>
  );
}

export default CaseStrengthGauge;
