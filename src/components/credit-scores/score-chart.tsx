"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  BarChart3,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

interface CreditScore {
  id: string;
  cra: string;
  score: number;
  scoreDate: string;
  scoreType: string;
  factorsPositive?: string;
  factorsNegative?: string;
}

interface ScoreStats {
  latest: Record<string, number>;
  change30Days: Record<string, number>;
  change90Days: Record<string, number>;
  highest: Record<string, number>;
  lowest: Record<string, number>;
}

interface ChartDataPoint {
  date: string;
  TRANSUNION?: number;
  EXPERIAN?: number;
  EQUIFAX?: number;
}

interface ScoreChartProps {
  scores: CreditScore[];
  stats: ScoreStats;
  chartData: ChartDataPoint[];
  onAddScore?: () => void;
}

const CRA_COLORS = {
  TRANSUNION: { bg: "bg-sky-500", text: "text-sky-400", border: "border-sky-500" },
  EXPERIAN: { bg: "bg-blue-500", text: "text-blue-400", border: "border-blue-500" },
  EQUIFAX: { bg: "bg-red-500", text: "text-red-400", border: "border-red-500" },
};

const SCORE_RANGES = [
  { min: 800, max: 850, label: "Exceptional", color: "text-emerald-400" },
  { min: 740, max: 799, label: "Very Good", color: "text-green-400" },
  { min: 670, max: 739, label: "Good", color: "text-lime-400" },
  { min: 580, max: 669, label: "Fair", color: "text-yellow-400" },
  { min: 300, max: 579, label: "Poor", color: "text-red-400" },
];

function getScoreLabel(score: number) {
  const range = SCORE_RANGES.find((r) => score >= r.min && score <= r.max);
  return range || SCORE_RANGES[SCORE_RANGES.length - 1];
}

export function ScoreChart({ scores, stats, chartData, onAddScore }: ScoreChartProps) {
  const [timeRange, setTimeRange] = useState<"30" | "90" | "180" | "365">("90");
  const [selectedCRA, setSelectedCRA] = useState<string>("all");

  // Filter chart data based on time range
  const filteredChartData = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(timeRange));

    return chartData.filter((d) => new Date(d.date) >= cutoffDate);
  }, [chartData, timeRange]);

  // Calculate chart dimensions
  const chartHeight = 200;
  const chartWidth = 100; // percentage
  const minScore = 300;
  const maxScore = 850;
  const scoreRange = maxScore - minScore;

  // Generate SVG path for each CRA
  const generatePath = (cra: string) => {
    const points = filteredChartData
      .filter((d) => d[cra as keyof ChartDataPoint] !== undefined)
      .map((d, i, arr) => {
        const x = (i / (arr.length - 1 || 1)) * 100;
        const score = d[cra as keyof ChartDataPoint] as number;
        const y = chartHeight - ((score - minScore) / scoreRange) * chartHeight;
        return `${x},${y}`;
      });

    if (points.length < 2) return "";
    return `M ${points.join(" L ")}`;
  };

  const cras = ["TRANSUNION", "EXPERIAN", "EQUIFAX"];

  return (
    <div className="space-y-6">
      {/* Score Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cras.map((cra) => {
          const score = stats.latest[cra];
          const change30 = stats.change30Days[cra] || 0;
          const change90 = stats.change90Days[cra] || 0;
          const scoreLabel = score ? getScoreLabel(score) : null;
          const colors = CRA_COLORS[cra as keyof typeof CRA_COLORS];

          return (
            <Card
              key={cra}
              className={`bg-slate-800/50 border-slate-700 ${
                selectedCRA === cra ? `ring-2 ring-offset-2 ring-offset-slate-900 ${colors.border}` : ""
              }`}
              onClick={() => setSelectedCRA(selectedCRA === cra ? "all" : cra)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge className={`${colors.bg} text-white`}>{cra}</Badge>
                  {score && (
                    <span className={`text-xs ${scoreLabel?.color}`}>
                      {scoreLabel?.label}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {score ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-white">{score}</span>
                      {change30 !== 0 && (
                        <span
                          className={`flex items-center text-sm ${
                            change30 > 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {change30 > 0 ? (
                            <ArrowUp className="w-4 h-4" />
                          ) : (
                            <ArrowDown className="w-4 h-4" />
                          )}
                          {Math.abs(change30)}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                      <span>30d: {change30 >= 0 ? "+" : ""}{change30}</span>
                      <span>90d: {change90 >= 0 ? "+" : ""}{change90}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                      <span>High: {stats.highest[cra]}</span>
                      <span>Low: {stats.lowest[cra]}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-slate-500 text-sm">No score recorded</div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Chart */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Score History
              </CardTitle>
              <CardDescription className="text-slate-400">
                Track credit score changes over time
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
                <SelectTrigger className="w-32 bg-slate-700/50 border-slate-600 text-white">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">6 months</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                </SelectContent>
              </Select>
              {onAddScore && (
                <Button onClick={onAddScore} size="sm">
                  Add Score
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredChartData.length < 2 ? (
            <div className="h-[200px] flex items-center justify-center text-slate-500">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Not enough data to display chart</p>
                <p className="text-sm">Add at least 2 score entries</p>
              </div>
            </div>
          ) : (
            <div className="relative">
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col justify-between text-xs text-slate-500 pr-2">
                <span>850</span>
                <span>700</span>
                <span>550</span>
                <span>300</span>
              </div>

              {/* Chart area */}
              <div className="ml-12">
                <svg
                  viewBox={`0 0 100 ${chartHeight}`}
                  preserveAspectRatio="none"
                  className="w-full h-[200px]"
                >
                  {/* Grid lines */}
                  {[300, 550, 700, 850].map((score) => {
                    const y = chartHeight - ((score - minScore) / scoreRange) * chartHeight;
                    return (
                      <line
                        key={score}
                        x1="0"
                        y1={y}
                        x2="100"
                        y2={y}
                        stroke="#334155"
                        strokeWidth="0.5"
                        strokeDasharray="2,2"
                      />
                    );
                  })}

                  {/* Score lines */}
                  {cras.map((cra) => {
                    if (selectedCRA !== "all" && selectedCRA !== cra) return null;
                    const colors = CRA_COLORS[cra as keyof typeof CRA_COLORS];
                    const path = generatePath(cra);
                    if (!path) return null;

                    return (
                      <g key={cra}>
                        <path
                          d={path}
                          fill="none"
                          stroke={
                            cra === "TRANSUNION"
                              ? "#0ea5e9"
                              : cra === "EXPERIAN"
                              ? "#3b82f6"
                              : "#ef4444"
                          }
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {/* Data points */}
                        {filteredChartData
                          .filter((d) => d[cra as keyof ChartDataPoint] !== undefined)
                          .map((d, i, arr) => {
                            const x = (i / (arr.length - 1 || 1)) * 100;
                            const score = d[cra as keyof ChartDataPoint] as number;
                            const y =
                              chartHeight - ((score - minScore) / scoreRange) * chartHeight;
                            return (
                              <circle
                                key={`${cra}-${i}`}
                                cx={x}
                                cy={y}
                                r="3"
                                fill={
                                  cra === "TRANSUNION"
                                    ? "#0ea5e9"
                                    : cra === "EXPERIAN"
                                    ? "#3b82f6"
                                    : "#ef4444"
                                }
                              />
                            );
                          })}
                      </g>
                    );
                  })}
                </svg>

                {/* X-axis labels */}
                <div className="flex justify-between text-xs text-slate-500 mt-2">
                  {filteredChartData.length > 0 && (
                    <>
                      <span>
                        {new Date(filteredChartData[0].date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span>
                        {new Date(
                          filteredChartData[filteredChartData.length - 1].date
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-6 mt-4">
                {cras.map((cra) => {
                  const colors = CRA_COLORS[cra as keyof typeof CRA_COLORS];
                  return (
                    <button
                      key={cra}
                      onClick={() => setSelectedCRA(selectedCRA === cra ? "all" : cra)}
                      className={`flex items-center gap-2 text-sm ${
                        selectedCRA === "all" || selectedCRA === cra
                          ? colors.text
                          : "text-slate-600"
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${colors.bg}`} />
                      {cra}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Scores Table */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-sm">Recent Score Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Date</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Bureau</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Score</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Type</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                {scores.slice(0, 10).map((score, index) => {
                  // Find previous score for same CRA to calculate change
                  const prevScore = scores.find(
                    (s, i) =>
                      i > index &&
                      s.cra === score.cra &&
                      new Date(s.scoreDate) < new Date(score.scoreDate)
                  );
                  const change = prevScore ? score.score - prevScore.score : null;
                  const colors = CRA_COLORS[score.cra as keyof typeof CRA_COLORS];
                  const label = getScoreLabel(score.score);

                  return (
                    <tr key={score.id} className="border-b border-slate-700/50">
                      <td className="py-2 px-3 text-slate-300">
                        {new Date(score.scoreDate).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-3">
                        <Badge className={`${colors.bg} text-white text-xs`}>
                          {score.cra}
                        </Badge>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`font-semibold ${label.color}`}>{score.score}</span>
                      </td>
                      <td className="py-2 px-3 text-slate-400">{score.scoreType}</td>
                      <td className="py-2 px-3">
                        {change !== null ? (
                          <span
                            className={`flex items-center ${
                              change > 0
                                ? "text-green-400"
                                : change < 0
                                ? "text-red-400"
                                : "text-slate-400"
                            }`}
                          >
                            {change > 0 ? (
                              <TrendingUp className="w-4 h-4 mr-1" />
                            ) : change < 0 ? (
                              <TrendingDown className="w-4 h-4 mr-1" />
                            ) : (
                              <Minus className="w-4 h-4 mr-1" />
                            )}
                            {change > 0 ? "+" : ""}
                            {change}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
