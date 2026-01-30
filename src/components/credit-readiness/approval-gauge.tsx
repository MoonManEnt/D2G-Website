"use client";

import { motion } from "framer-motion";

const TIER_COLORS: Record<string, string> = {
  LIKELY: "#10b981",
  POSSIBLE: "#f59e0b",
  UNLIKELY: "#f97316",
  NOT_READY: "#ef4444",
};

const TIER_LABELS: Record<string, string> = {
  LIKELY: "Likely",
  POSSIBLE: "Possible",
  UNLIKELY: "Unlikely",
  NOT_READY: "Not Ready",
};

interface ApprovalGaugeProps {
  likelihood: number;
  tier: string;
  size?: "sm" | "lg";
}

export function ApprovalGauge({ likelihood, tier, size = "lg" }: ApprovalGaugeProps) {
  const color = TIER_COLORS[tier] || TIER_COLORS.POSSIBLE;
  const label = TIER_LABELS[tier] || tier;
  const isLarge = size === "lg";

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dashTarget = (likelihood / 100) * circumference;

  return (
    <div className={`relative ${isLarge ? "w-40 h-40" : "w-20 h-20"}`}>
      <svg
        className="w-full h-full -rotate-90"
        viewBox="0 0 100 100"
      >
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#1e293b"
          strokeWidth={8}
        />
        {/* Animated progress circle */}
        <motion.circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - dashTarget }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      {/* Center text overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`font-bold ${isLarge ? "text-3xl" : "text-sm"}`}
          style={{ color }}
        >
          {likelihood}%
        </span>
        {isLarge && (
          <span
            className="text-xs font-medium mt-1"
            style={{ color }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
