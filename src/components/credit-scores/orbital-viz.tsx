"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ScoreData {
  bureau: string;
  score: number;
}

interface OrbitalVizProps {
  scores: ScoreData[];
  delay?: number;
  className?: string;
}

const getScoreColor = (score: number) => {
  if (score < 580) return "#ef4444"; // red
  if (score < 670) return "#fbbf24"; // yellow
  if (score < 740) return "#34d399"; // emerald
  return "#06b6d4"; // cyan
};

const getScoreLabel = (score: number) => {
  if (score < 580) return "Poor";
  if (score < 670) return "Fair";
  if (score < 740) return "Good";
  return "Excellent";
};

export function OrbitalViz({ scores, delay = 0, className }: OrbitalVizProps) {
  const [active, setActive] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setActive(true), delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  const avg = Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length);
  const avgColor = getScoreColor(avg);

  // Arc geometry - 240 degree sweep from 150 to 390 degrees
  const cx = 200;
  const cy = 200;
  const startAngle = 150;
  const sweepAngle = 240;

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const arcPath = (r: number, startDeg: number, endDeg: number) => {
    const s = toRad(startDeg);
    const e = toRad(endDeg);
    const x1 = cx + r * Math.cos(s);
    const y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e);
    const y2 = cy + r * Math.sin(e);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  const scoreToAngle = (s: number) => startAngle + ((s - 300) / 550) * sweepAngle;
  const arcLength = (r: number, angleDeg: number) => (angleDeg / 360) * 2 * Math.PI * r;

  // Tick marks
  const ticks = [];
  for (let s = 300; s <= 850; s += 10) {
    const ang = toRad(scoreToAngle(s));
    const isMajor = s % 100 === 0;
    const outerR = 172;
    const innerR = isMajor ? 162 : 166;
    ticks.push({
      x1: cx + outerR * Math.cos(ang),
      y1: cy + outerR * Math.sin(ang),
      x2: cx + innerR * Math.cos(ang),
      y2: cy + innerR * Math.sin(ang),
      isMajor,
      score: s,
      lx: cx + 182 * Math.cos(ang),
      ly: cy + 182 * Math.sin(ang),
    });
  }

  // Score zones
  const zones = [
    { from: 300, to: 580, color: "#ef4444" },
    { from: 580, to: 670, color: "#fbbf24" },
    { from: 670, to: 740, color: "#34d399" },
    { from: 740, to: 850, color: "#06b6d4" },
  ];

  // Bureau config
  const bureauConfig = [
    { radius: 130, width: 14, ...scores[0] },
    { radius: 108, width: 14, ...scores[1] },
    { radius: 86, width: 14, ...scores[2] },
  ];

  return (
    <div className={cn("relative w-full h-[340px] flex items-center justify-center", className)}>
      <svg viewBox="0 0 400 400" className="w-[340px] h-[340px] overflow-visible">
        <defs>
          <filter id="glowSoft">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {bureauConfig.map((b, i) => {
            const color = getScoreColor(b.score);
            return (
              <linearGradient key={`grad-${i}`} id={`arcGrad${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={color} stopOpacity="0.4" />
                <stop offset="60%" stopColor={color} stopOpacity="0.85" />
                <stop offset="100%" stopColor={color} stopOpacity="1" />
              </linearGradient>
            );
          })}
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={avgColor} stopOpacity="0.12" />
            <stop offset="50%" stopColor={avgColor} stopOpacity="0.04" />
            <stop offset="100%" stopColor={avgColor} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Center glow */}
        <circle
          cx={cx}
          cy={cy}
          r="100"
          fill="url(#centerGlow)"
          style={{
            opacity: active ? 1 : 0,
            transition: "opacity 1.5s ease 0.3s",
          }}
        />

        {/* Zone bands */}
        {zones.map((z, i) => (
          <path
            key={`zone-${i}`}
            d={arcPath(150, scoreToAngle(z.from), scoreToAngle(z.to))}
            fill="none"
            stroke={z.color}
            strokeWidth="2"
            strokeLinecap="round"
            style={{
              strokeOpacity: active ? 0.08 : 0,
              transition: `stroke-opacity 0.8s ease ${0.2 + i * 0.1}s`,
            }}
          />
        ))}

        {/* Tick marks */}
        {ticks.map((tk, i) => (
          <g
            key={`tick-${i}`}
            style={{
              opacity: active ? 1 : 0,
              transition: `opacity 0.5s ease ${0.3 + i * 0.008}s`,
            }}
          >
            <line
              x1={tk.x1}
              y1={tk.y1}
              x2={tk.x2}
              y2={tk.y2}
              stroke="currentColor"
              strokeWidth={tk.isMajor ? 1.5 : 0.5}
              strokeOpacity={tk.isMajor ? 0.2 : 0.06}
              strokeLinecap="round"
              className="text-foreground"
            />
            {tk.isMajor && (
              <text
                x={tk.lx}
                y={tk.ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="currentColor"
                fillOpacity="0.2"
                fontSize="8"
                fontFamily="monospace"
                fontWeight="500"
                className="text-foreground"
              >
                {tk.score}
              </text>
            )}
          </g>
        ))}

        {/* Track arcs */}
        {bureauConfig.map((b, i) => (
          <path
            key={`track-${i}`}
            d={arcPath(b.radius, startAngle, startAngle + sweepAngle)}
            fill="none"
            stroke="currentColor"
            strokeWidth={b.width}
            strokeOpacity={0.03}
            strokeLinecap="round"
            className="text-foreground"
            style={{
              opacity: active ? 1 : 0,
              transition: `opacity 0.6s ease ${0.2 + i * 0.1}s`,
            }}
          />
        ))}

        {/* Score arcs */}
        {bureauConfig.map((b, i) => {
          const color = getScoreColor(b.score);
          const endAngle = scoreToAngle(b.score);
          const totalLen = arcLength(b.radius, sweepAngle);
          const scoreLen = arcLength(b.radius, endAngle - startAngle);
          const isHovered = hoveredIndex === i;

          const ang = toRad(endAngle);
          const ex = cx + b.radius * Math.cos(ang);
          const ey = cy + b.radius * Math.sin(ang);

          return (
            <g key={`arc-${i}`}>
              <path
                d={arcPath(b.radius, startAngle, startAngle + sweepAngle)}
                fill="none"
                stroke={`url(#arcGrad${i})`}
                strokeWidth={isHovered ? b.width + 4 : b.width}
                strokeLinecap="round"
                strokeDasharray={`${scoreLen} ${totalLen}`}
                strokeDashoffset={active ? 0 : scoreLen}
                filter={isHovered ? "url(#glowSoft)" : undefined}
                style={{
                  transition: `stroke-dashoffset 1.8s cubic-bezier(0.16, 1, 0.3, 1) ${0.5 + i * 0.2}s, stroke-width 0.3s ease`,
                  cursor: "pointer",
                }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />

              {/* Endpoint marker */}
              <g
                style={{
                  opacity: active ? 1 : 0,
                  transition: `opacity 0.5s ease ${1.2 + i * 0.2}s`,
                }}
              >
                <circle
                  cx={ex}
                  cy={ey}
                  r={isHovered ? 14 : 10}
                  fill="none"
                  stroke={color}
                  strokeWidth="1"
                  strokeOpacity={isHovered ? 0.3 : 0.15}
                  style={{ transition: "all 0.3s ease" }}
                />
                <circle
                  cx={ex}
                  cy={ey}
                  r={isHovered ? 5 : 3.5}
                  fill={color}
                  filter="url(#glowSoft)"
                  style={{ transition: "all 0.3s ease" }}
                />
                {isHovered && (
                  <g>
                    <rect
                      x={ex - 22}
                      y={ey - 28}
                      width="44"
                      height="20"
                      rx="6"
                      className="fill-background"
                      stroke={color}
                      strokeWidth="1"
                      strokeOpacity="0.3"
                    />
                    <text
                      x={ex}
                      y={ey - 15}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={color}
                      fontSize="11"
                      fontWeight="700"
                    >
                      {b.score}
                    </text>
                  </g>
                )}
              </g>
            </g>
          );
        })}

        {/* Center content */}
        <g
          style={{
            opacity: active ? 1 : 0,
            transition: "opacity 0.8s ease 0.9s",
          }}
        >
          <text
            x={cx}
            y={cy - 12}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="52"
            fontWeight="800"
            className="fill-foreground"
          >
            {active ? avg : "—"}
          </text>
          <text
            x={cx}
            y={cy + 22}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="10"
            fontFamily="monospace"
            letterSpacing="2.5"
            fontWeight="500"
            className="fill-muted-foreground"
          >
            AVG SCORE
          </text>
          <rect
            x={cx - 24}
            y={cy + 36}
            width="48"
            height="18"
            rx="9"
            fill={avgColor}
            fillOpacity="0.12"
            stroke={avgColor}
            strokeWidth="0.5"
            strokeOpacity="0.2"
          />
          <text
            x={cx}
            y={cy + 46}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={avgColor}
            fontSize="8"
            fontWeight="700"
            fontFamily="monospace"
            letterSpacing="1.5"
          >
            {getScoreLabel(avg).toUpperCase()}
          </text>
        </g>
      </svg>

      {/* Bureau legend */}
      <div className="absolute right-[-8px] top-1/2 -translate-y-1/2 flex flex-col gap-1.5">
        {scores.map((s, i) => {
          const color = getScoreColor(s.score);
          const isHovered = hoveredIndex === i;
          return (
            <div
              key={i}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer border transition-all duration-300",
                isHovered ? "bg-muted/50 border-border" : "bg-transparent border-transparent"
              )}
              style={{
                opacity: active ? 1 : 0,
                transform: active ? "translateX(0)" : "translateX(16px)",
                transitionDelay: `${0.9 + i * 0.12}s`,
              }}
            >
              <div
                className="w-[3px] h-7 rounded"
                style={{
                  backgroundColor: color,
                  boxShadow: isHovered ? `0 0 8px ${color}` : "none",
                  transition: "box-shadow 0.3s",
                }}
              />
              <div>
                <div className="text-[9px] font-semibold tracking-widest text-muted-foreground font-mono mb-0.5">
                  {s.bureau}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-extrabold leading-none" style={{ color }}>
                    {s.score}
                  </span>
                  <span className="text-[9px] font-semibold opacity-60 font-mono" style={{ color }}>
                    {getScoreLabel(s.score)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
