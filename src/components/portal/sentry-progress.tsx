"use client";

// ============================================================================
// DISPUTE2GO - Sentry Progress (Client Portal)
// Simplified progress view for client-facing portal dashboard
// No technical details (no e-OSCAR codes, no statutes)
// ============================================================================

import { cn } from "@/lib/utils";
import { useApiQuery } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield,
  Target,
  Trophy,
  TrendingUp,
  Calendar,
  CheckCircle,
  Star,
  Sparkles,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ============================================================================
// Types
// ============================================================================

interface Goal {
  id: string;
  type: string;
  label: string;
  targetScore: number;
  currentScore: number;
  startingScore: number;
  eta?: string;
  milestones: Array<{
    score: number;
    label: string;
    reached: boolean;
  }>;
}

interface GoalsResponse {
  goals: Goal[];
}

interface ActivityEvent {
  id: string;
  type: string;
  timestamp: string;
  summary: string;
}

interface ActivityResponse {
  events: ActivityEvent[];
  total: number;
}

interface SentryProgressProps {
  clientId: string;
}

// ============================================================================
// Component
// ============================================================================

export function SentryProgress({ clientId }: SentryProgressProps) {
  // Fetch goals
  const { data: goalsData, loading: goalsLoading } =
    useApiQuery<GoalsResponse>(
      async () => {
        const res = await fetch(
          `/api/sentry/goals?clientId=${encodeURIComponent(clientId)}`
        );
        if (!res.ok) throw new Error("Failed to load goals");
        return res.json();
      },
      [clientId]
    );

  // Fetch recent activity (wins only for the portal)
  const { data: activityData, loading: activityLoading } =
    useApiQuery<ActivityResponse>(
      async () => {
        const params = new URLSearchParams({
          clientId,
          limit: "5",
          offset: "0",
        });
        const res = await fetch(`/api/sentry/activity?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load activity");
        return res.json();
      },
      [clientId]
    );

  const goals = goalsData?.goals || [];
  const recentEvents = activityData?.events || [];

  // Filter to positive events (milestones, score changes) for "Recent Wins"
  const recentWins = recentEvents.filter(
    (e) => e.type === "goal_milestone" || e.type === "score_change"
  );

  const safeFormatRelative = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "recently";
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return "recently";
    }
  };

  const safeFormatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "TBD";
      return date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    } catch {
      return "TBD";
    }
  };

  const isLoading = goalsLoading || activityLoading;

  // Loading state
  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-foreground flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Your Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Primary goal (most recent or first)
  const primaryGoal = goals[0];

  return (
    <div className="space-y-4">
      {/* Goal Progress Card */}
      {primaryGoal && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-foreground flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                {primaryGoal.label || "Your Credit Goal"}
              </CardTitle>
              {primaryGoal.currentScore >= primaryGoal.targetScore ? (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  <Trophy className="w-3 h-3 mr-1" />
                  Goal Reached!
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  In Progress
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Score Display */}
              <div className="text-center py-4">
                <p className="text-4xl font-bold text-foreground">
                  {primaryGoal.currentScore}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your current score
                </p>
                <div className="flex items-center justify-center gap-4 mt-2 text-xs">
                  <span className="text-muted-foreground">
                    Started at{" "}
                    <span className="font-medium text-foreground">
                      {primaryGoal.startingScore}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    Goal:{" "}
                    <span className="font-medium text-primary">
                      {primaryGoal.targetScore}
                    </span>
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{primaryGoal.startingScore}</span>
                  <span>{primaryGoal.targetScore}</span>
                </div>
                <Progress
                  value={Math.min(
                    100,
                    Math.max(
                      0,
                      ((primaryGoal.currentScore - primaryGoal.startingScore) /
                        (primaryGoal.targetScore - primaryGoal.startingScore)) *
                        100
                    )
                  )}
                  className="h-3"
                  indicatorClassName={cn(
                    primaryGoal.currentScore >= primaryGoal.targetScore
                      ? "bg-emerald-500"
                      : "bg-primary"
                  )}
                />

                {/* Points gained */}
                <div className="flex items-center justify-center gap-1.5">
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                  <span className="text-xs font-medium text-emerald-400">
                    +{Math.max(0, primaryGoal.currentScore - primaryGoal.startingScore)} points gained
                  </span>
                </div>
              </div>

              {/* Milestones as friendly checkmarks */}
              {primaryGoal.milestones.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Milestones
                  </p>
                  <div className="space-y-1.5">
                    {primaryGoal.milestones.map((milestone, i) => (
                      <div
                        key={i}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg",
                          milestone.reached
                            ? "bg-emerald-500/10"
                            : "bg-muted"
                        )}
                      >
                        {milestone.reached ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-muted-foreground flex-shrink-0" />
                        )}
                        <span
                          className={cn(
                            "text-xs",
                            milestone.reached
                              ? "text-foreground font-medium"
                              : "text-muted-foreground"
                          )}
                        >
                          {milestone.label}
                        </span>
                        {milestone.reached && (
                          <Star className="w-3 h-3 text-amber-400 ml-auto" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ETA */}
              {primaryGoal.eta &&
                primaryGoal.currentScore < primaryGoal.targetScore && (
                  <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Estimated goal completion
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {safeFormatDate(primaryGoal.eta)}
                      </p>
                    </div>
                  </div>
                )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Wins */}
      {recentWins.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Recent Wins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentWins.map((win) => (
                <div
                  key={win.id}
                  className="flex items-start gap-3 p-2 rounded-lg bg-emerald-500/5"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-snug">
                      {win.summary}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {safeFormatRelative(win.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estimated Timeline */}
      {goals.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Your Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {goals.map((goal) => {
                const isComplete = goal.currentScore >= goal.targetScore;
                return (
                  <div
                    key={goal.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted"
                  >
                    <div className="flex items-center gap-2">
                      {isComplete ? (
                        <Trophy className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Target className="w-4 h-4 text-primary" />
                      )}
                      <span className="text-xs font-medium text-foreground">
                        {goal.label || "Credit Goal"}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "text-xs",
                        isComplete
                          ? "text-emerald-400 font-medium"
                          : "text-muted-foreground"
                      )}
                    >
                      {isComplete
                        ? "Completed!"
                        : goal.eta
                        ? safeFormatDate(goal.eta)
                        : "In progress"}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {goals.length === 0 && (
        <Card className="bg-card border-border">
          <CardContent className="py-8">
            <div className="text-center space-y-3">
              <Shield className="w-10 h-10 text-primary/50 mx-auto" />
              <p className="text-sm font-medium text-foreground">
                Your Credit Journey
              </p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Your credit repair specialist is working on your account.
                Progress updates and milestones will appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SentryProgress;
