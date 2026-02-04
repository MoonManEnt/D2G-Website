"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ScoreGaugeProps {
  score: number;
  /** Minimum score on the gauge (default 300) */
  min?: number;
  /** Maximum score on the gauge (default 850) */
  max?: number;
  /** Size of the gauge in pixels (default 160) */
  size?: number;
  /** Animation duration in ms (default 1500) */
  animationDuration?: number;
  className?: string;
}

/**
 * Color stops for the gauge arc: red -> orange -> yellow -> lime -> green
 * Matches the MyFICO / Credit Karma style score dial
 */
const GAUGE_COLORS = [
  { offset: 0, color: "#EF4444" },     // Red - Poor (300)
  { offset: 0.25, color: "#F97316" },   // Orange - Fair low
  { offset: 0.4, color: "#EAB308" },    // Yellow - Fair high
  { offset: 0.6, color: "#84CC16" },    // Lime - Good
  { offset: 0.8, color: "#22C55E" },    // Green - Very Good
  { offset: 1, color: "#059669" },      // Emerald - Exceptional
];

function getScoreColor(normalizedValue: number): string {
  for (let i = 0; i < GAUGE_COLORS.length - 1; i++) {
    const curr = GAUGE_COLORS[i];
    const next = GAUGE_COLORS[i + 1];
    if (normalizedValue >= curr.offset && normalizedValue <= next.offset) {
      return next.color;
    }
  }
  return GAUGE_COLORS[GAUGE_COLORS.length - 1].color;
}

/**
 * Animated semicircle score gauge that transitions from red to green.
 * Re-animates every time the component becomes visible (tab switch, scroll).
 */
export function ScoreGauge({
  score,
  min = 300,
  max = 850,
  size = 160,
  animationDuration = 1500,
  className,
}: ScoreGaugeProps) {
  const [displayScore, setDisplayScore] = useState(min);
  const [needleAngle, setNeedleAngle] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const idRef = useRef(0);

  const clampedScore = Math.max(min, Math.min(max, score));
  const normalizedTarget = (clampedScore - min) / (max - min);

  const runAnimation = useCallback(() => {
    // Cancel any running animation
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    // Reset
    setDisplayScore(min);
    setNeedleAngle(0);
    startTimeRef.current = 0;

    const thisId = ++idRef.current;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (timestamp: number) => {
      if (thisId !== idRef.current) return; // stale animation
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const rawProgress = Math.min(elapsed / animationDuration, 1);
      const progress = easeOutCubic(rawProgress);

      setDisplayScore(Math.round(min + (clampedScore - min) * progress));
      setNeedleAngle(normalizedTarget * progress);

      if (rawProgress < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      }
    };

    animFrameRef.current = requestAnimationFrame(tick);
  }, [clampedScore, normalizedTarget, min, animationDuration]);

  // IntersectionObserver: re-animate every time visible
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          runAnimation();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [runAnimation]);

  // SVG dimensions
  const cx = size / 2;
  const cy = size / 2 + 4;
  const radius = size / 2 - 14;
  const strokeWidth = 12;

  // Arc: 180-degree semicircle (left to right)
  const startAngleDeg = -180;
  const endAngleDeg = 0;
  const totalArcDeg = endAngleDeg - startAngleDeg;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const arcPath = (startDeg: number, endDeg: number) => {
    const startRad = toRad(startDeg);
    const endRad = toRad(endDeg);
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  // Needle
  const needleDeg = startAngleDeg + totalArcDeg * needleAngle;
  const needleRad = toRad(needleDeg);
  const needleLength = radius - 4;
  const needleX = cx + needleLength * Math.cos(needleRad);
  const needleY = cy + needleLength * Math.sin(needleRad);

  const scoreColor = getScoreColor(needleAngle);
  const gradientId = `gauge-grad-${size}-${score}`;

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex flex-col items-center ${className || ""}`}
    >
      <svg
        width={size}
        height={size / 2 + 20}
        viewBox={`0 0 ${size} ${size / 2 + 20}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            {GAUGE_COLORS.map((stop) => (
              <stop
                key={stop.offset}
                offset={`${stop.offset * 100}%`}
                stopColor={stop.color}
              />
            ))}
          </linearGradient>
        </defs>

        {/* Background track */}
        <path
          d={arcPath(startAngleDeg, endAngleDeg)}
          fill="none"
          stroke="currentColor"
          className="text-muted/30"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Colored arc (gradient) */}
        <path
          d={arcPath(startAngleDeg, endAngleDeg)}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity={0.85}
        />

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke={scoreColor}
          strokeWidth={3}
          strokeLinecap="round"
        />

        {/* Center dot */}
        <circle cx={cx} cy={cy} r={5} fill={scoreColor} />
        <circle cx={cx} cy={cy} r={2.5} fill="currentColor" className="text-card" />

        {/* Min / Max labels */}
        <text
          x={cx - radius - 2}
          y={cy + 16}
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize="10"
          fontFamily="system-ui, sans-serif"
        >
          {min}
        </text>
        <text
          x={cx + radius + 2}
          y={cy + 16}
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize="10"
          fontFamily="system-ui, sans-serif"
        >
          {max}
        </text>
      </svg>

      {/* Animated score number */}
      <div className="absolute" style={{ bottom: 2, left: "50%", transform: "translateX(-50%)" }}>
        <span
          className="text-3xl font-bold tabular-nums"
          style={{ color: scoreColor }}
        >
          {displayScore}
        </span>
      </div>
    </div>
  );
}
