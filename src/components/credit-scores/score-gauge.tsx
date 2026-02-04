"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ScoreGaugeProps {
  score: number;
  min?: number;
  max?: number;
  size?: number;
  animationDuration?: number;
  className?: string;
}

/**
 * Gradient stops mapped to actual score positions on the 300-850 range.
 *
 * Normalized positions (score → offset):
 *   300 = 0.00   →  Deep red
 *   450 = 0.27   →  Red
 *   530 = 0.42   →  Red-orange
 *   580 = 0.51   →  Orange
 *   640 = 0.62   →  Orange-yellow
 *   670 = 0.67   →  Yellow
 *   720 = 0.76   →  Yellow-green
 *   760 = 0.84   →  Green
 *   810 = 0.93   →  Dark green
 *   850 = 1.00   →  Emerald
 */
const GAUGE_COLORS = [
  { offset: 0,    color: "#DC2626" },  // 300 - Deep red
  { offset: 0.27, color: "#EF4444" },  // ~450 - Red
  { offset: 0.42, color: "#F97316" },  // ~530 - Red-orange
  { offset: 0.51, color: "#FB923C" },  // ~580 - Orange
  { offset: 0.62, color: "#FBBF24" },  // ~640 - Orange-yellow
  { offset: 0.67, color: "#EAB308" },  // ~670 - Yellow
  { offset: 0.76, color: "#A3E635" },  // ~720 - Yellow-green
  { offset: 0.84, color: "#22C55E" },  // ~760 - Green
  { offset: 0.93, color: "#16A34A" },  // ~810 - Dark green
  { offset: 1,    color: "#059669" },  // 850 - Emerald
];

function getScoreColor(normalizedValue: number): string {
  // Find the two stops we're between and return the closer one
  for (let i = 0; i < GAUGE_COLORS.length - 1; i++) {
    const curr = GAUGE_COLORS[i];
    const next = GAUGE_COLORS[i + 1];
    if (normalizedValue <= next.offset) {
      // Interpolate: pick whichever stop we're closer to
      const mid = (curr.offset + next.offset) / 2;
      return normalizedValue < mid ? curr.color : next.color;
    }
  }
  return GAUGE_COLORS[GAUGE_COLORS.length - 1].color;
}

/**
 * Animated semicircle score gauge (red → green).
 * Re-animates every time the component becomes visible (tab switch, scroll).
 * Score number is displayed BELOW the arc, separated from the needle.
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
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    setDisplayScore(min);
    setNeedleAngle(0);
    startTimeRef.current = 0;

    const thisId = ++idRef.current;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (timestamp: number) => {
      if (thisId !== idRef.current) return;
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

  // SVG layout
  const cx = size / 2;
  const arcCy = size / 2 - 6; // move arc up to leave room for score below
  const radius = size / 2 - 16;
  const strokeWidth = 14;

  const startAngleDeg = -180;
  const endAngleDeg = 0;
  const totalArcDeg = endAngleDeg - startAngleDeg;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const arcPath = (startDeg: number, endDeg: number) => {
    const startRad = toRad(startDeg);
    const endRad = toRad(endDeg);
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = arcCy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = arcCy + radius * Math.sin(endRad);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  // Needle — shorter so it doesn't reach center where score will be
  const needleDeg = startAngleDeg + totalArcDeg * needleAngle;
  const needleRad = toRad(needleDeg);
  const needleInnerRadius = 18; // gap from center pivot
  const needleOuterRadius = radius - 6;
  const needleInnerX = cx + needleInnerRadius * Math.cos(needleRad);
  const needleInnerY = arcCy + needleInnerRadius * Math.sin(needleRad);
  const needleOuterX = cx + needleOuterRadius * Math.cos(needleRad);
  const needleOuterY = arcCy + needleOuterRadius * Math.sin(needleRad);

  const scoreColor = getScoreColor(needleAngle);
  const gradientId = `gauge-grad-${size}-${score}`;

  // Total SVG height: arc area + score number below
  const svgHeight = size / 2 + 40;

  return (
    <div
      ref={containerRef}
      className={`inline-flex flex-col items-center ${className || ""}`}
    >
      <svg
        width={size}
        height={svgHeight}
        viewBox={`0 0 ${size} ${svgHeight}`}
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
          className="text-muted/20"
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
          opacity={0.9}
        />

        {/* Needle — line from inner radius to outer radius */}
        <line
          x1={needleInnerX}
          y1={needleInnerY}
          x2={needleOuterX}
          y2={needleOuterY}
          stroke="white"
          strokeWidth={2.5}
          strokeLinecap="round"
          opacity={0.95}
        />

        {/* Center pivot dot */}
        <circle cx={cx} cy={arcCy} r={4} fill="white" opacity={0.9} />
        <circle cx={cx} cy={arcCy} r={1.5} fill="currentColor" className="text-card" />

        {/* Min / Max labels */}
        <text
          x={cx - radius - 2}
          y={arcCy + 14}
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize="9"
          fontFamily="system-ui, sans-serif"
        >
          {min}
        </text>
        <text
          x={cx + radius + 2}
          y={arcCy + 14}
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize="9"
          fontFamily="system-ui, sans-serif"
        >
          {max}
        </text>

        {/* Score number — below the arc baseline, cleanly separated */}
        <text
          x={cx}
          y={arcCy + 34}
          textAnchor="middle"
          fontFamily="system-ui, sans-serif"
          fontWeight="700"
          fontSize="28"
          fill={scoreColor}
          className="tabular-nums"
        >
          {displayScore}
        </text>
      </svg>
    </div>
  );
}
