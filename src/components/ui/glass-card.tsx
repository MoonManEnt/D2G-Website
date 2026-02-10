"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Glass Card Component
 * A card with glassmorphism effect that responds to hover
 */
interface GlassCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
  onClick?: () => void;
}

export function GlassCard({ children, className, glowColor, onClick }: GlassCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "relative overflow-hidden rounded-xl border transition-all duration-300",
        "bg-card/50 backdrop-blur-xl",
        "border-border/50 hover:border-border",
        "shadow-sm hover:shadow-md",
        isHovered && "translate-y-[-2px]",
        onClick && "cursor-pointer",
        className
      )}
    >
      {glowColor && (
        <div
          className="absolute top-0 left-0 right-0 h-[2px] opacity-50"
          style={{
            background: `linear-gradient(90deg, transparent, ${glowColor}, transparent)`,
          }}
        />
      )}
      {children}
    </div>
  );
}

/**
 * Animated Number Component
 * Animates a number from 0 to the target value
 */
interface AnimNumProps {
  value: number;
  duration?: number;
  delay?: number;
  className?: string;
}

export function AnimNum({ value, duration = 1200, delay = 0, className }: AnimNumProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  useEffect(() => {
    if (!started) return;

    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out quart
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(Math.floor(eased * value));
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }, [started, value, duration]);

  return <span className={className}>{displayValue}</span>;
}

/**
 * Reveal Animation Component
 * Reveals children with a smooth animation
 */
interface RevealProps {
  children: ReactNode;
  delay?: number;
  direction?: "up" | "left" | "right" | "scale";
  className?: string;
}

export function Reveal({ children, delay = 0, direction = "up", className }: RevealProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  const transforms = {
    up: "translate-y-6",
    left: "translate-x-6",
    right: "-translate-x-6",
    scale: "scale-95",
  };

  return (
    <div
      className={cn(
        "transition-all duration-700 ease-out",
        visible ? "opacity-100 translate-y-0 translate-x-0 scale-100" : `opacity-0 ${transforms[direction]}`,
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Progress Ring Component
 * Circular progress indicator
 */
interface ProgressRingProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  delay?: number;
  className?: string;
}

export function ProgressRing({
  value,
  max = 100,
  size = 36,
  strokeWidth = 3,
  color,
  delay = 0,
  className,
}: ProgressRingProps) {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = started ? circumference * (1 - value / max) : circumference;

  return (
    <svg width={size} height={size} className={cn("-rotate-90", className)}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/20"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{
          transition: `stroke-dashoffset 1.4s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
        }}
      />
    </svg>
  );
}

/**
 * Status Badge Component
 * Colored badge for status indicators
 */
interface StatusBadgeProps {
  status: string;
  color: string;
  className?: string;
}

export function StatusBadge({ status, color, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "text-[9px] font-bold tracking-wider px-2 py-0.5 rounded font-mono uppercase",
        className
      )}
      style={{
        backgroundColor: `${color}15`,
        color: color,
        border: `1px solid ${color}25`,
      }}
    >
      {status}
    </span>
  );
}

/**
 * Severity Badge Component
 */
interface SeverityBadgeProps {
  level: "HIGH" | "MED" | "LOW";
  className?: string;
}

export function SeverityBadge({ level, className }: SeverityBadgeProps) {
  const colors = {
    HIGH: "#ef4444",
    MED: "#fbbf24",
    LOW: "#06b6d4",
  };

  return (
    <span
      className={cn(
        "text-[9px] font-bold tracking-widest px-2 py-0.5 rounded font-mono",
        className
      )}
      style={{
        backgroundColor: `${colors[level]}20`,
        color: colors[level],
      }}
    >
      {level}
    </span>
  );
}

/**
 * Stat Card Component
 * Card displaying a stat with icon
 */
interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: number;
  color?: string;
  alert?: boolean;
  delay?: number;
}

export function StatCard({ icon, label, value, color, alert, delay = 0 }: StatCardProps) {
  return (
    <GlassCard className="p-4 text-center" glowColor={alert ? color : undefined}>
      <div className="text-base opacity-30 mb-2 font-mono">{icon}</div>
      <div
        className="text-2xl font-extrabold leading-none"
        style={{ color: color || "inherit" }}
      >
        <AnimNum value={value} delay={delay} />
      </div>
      <div className="text-[9px] text-muted-foreground mt-2 tracking-widest uppercase font-mono">
        {label}
      </div>
    </GlassCard>
  );
}
