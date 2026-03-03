"use client";

// ============================================================================
// DISPUTE2GO - Goal Tracker
// Goal creation form with progress tracking and ETA display
// ============================================================================

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useApiQuery, useMutation } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/lib/use-toast";
import {
  Target,
  Plus,
  Loader2,
  TrendingUp,
  Calendar,
  CheckCircle,
  Home,
  Car,
  CreditCard,
  Star,
  Pencil,
  Trophy,
  X,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

type GoalType = "MORTGAGE" | "AUTO" | "CREDIT_CARD" | "BEST_RATES" | "CUSTOM";

interface Goal {
  id: string;
  type: GoalType;
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
  createdAt: string;
}

interface GoalsResponse {
  goals: Goal[];
}

interface GoalTrackerProps {
  clientId: string;
}

// ============================================================================
// Constants
// ============================================================================

const GOAL_TYPE_CONFIG: Record<
  GoalType,
  { icon: typeof Target; label: string; defaultTarget: number; color: string }
> = {
  MORTGAGE: {
    icon: Home,
    label: "Mortgage Ready",
    defaultTarget: 680,
    color: "text-blue-400",
  },
  AUTO: {
    icon: Car,
    label: "Auto Loan Ready",
    defaultTarget: 650,
    color: "text-emerald-400",
  },
  CREDIT_CARD: {
    icon: CreditCard,
    label: "Credit Card Approval",
    defaultTarget: 670,
    color: "text-purple-400",
  },
  BEST_RATES: {
    icon: Star,
    label: "Best Rates",
    defaultTarget: 740,
    color: "text-amber-400",
  },
  CUSTOM: {
    icon: Pencil,
    label: "Custom Goal",
    defaultTarget: 700,
    color: "text-pink-400",
  },
};

// ============================================================================
// Component
// ============================================================================

export function GoalTracker({ clientId }: GoalTrackerProps) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState<GoalType>("MORTGAGE");
  const [targetScore, setTargetScore] = useState(680);

  // Fetch goals
  const {
    data: goalsData,
    loading,
    refetch,
  } = useApiQuery<GoalsResponse>(
    async () => {
      const res = await fetch(
        `/api/sentry/goals?clientId=${encodeURIComponent(clientId)}`
      );
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ message: "Failed to load" }));
        throw new Error(err.message || "Failed to load goals");
      }
      return res.json();
    },
    [clientId]
  );

  // Create goal mutation
  const { mutate: createGoal, loading: creating } = useMutation<
    Goal,
    { clientId: string; type: GoalType; targetScore: number }
  >(
    async (variables) => {
      const res = await fetch("/api/sentry/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(variables),
      });
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ message: "Failed to create" }));
        throw new Error(err.message || "Failed to create goal");
      }
      return res.json();
    },
    {
      onSuccess: () => {
        toast({
          title: "Goal Created",
          description: "Your credit goal has been set. Sentry will track progress.",
        });
        setShowForm(false);
        refetch();
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to create goal. Please try again.",
          variant: "destructive",
        });
      },
    }
  );

  // Update target score when type changes
  useEffect(() => {
    setTargetScore(GOAL_TYPE_CONFIG[selectedType].defaultTarget);
  }, [selectedType]);

  const handleCreateGoal = () => {
    createGoal({ clientId, type: selectedType, targetScore });
  };

  const goals = goalsData?.goals || [];

  const getProgressPercentage = (goal: Goal) => {
    const range = goal.targetScore - goal.startingScore;
    if (range <= 0) return 100;
    const progress = goal.currentScore - goal.startingScore;
    return Math.min(100, Math.max(0, (progress / range) * 100));
  };

  const safeFormatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "Unknown";
      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
    } catch {
      return "Unknown";
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          Credit Goals
        </h3>
        {!showForm && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1"
            onClick={() => setShowForm(true)}
          >
            <Plus className="w-3 h-3" />
            Add Goal
          </Button>
        )}
      </div>

      {/* Goal Creation Form */}
      {showForm && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-foreground">
                New Credit Goal
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setShowForm(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Goal Type Selection */}
              <div className="space-y-2">
                <Label className="text-xs">Goal Type</Label>
                <Select
                  value={selectedType}
                  onValueChange={(val) => setSelectedType(val as GoalType)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GOAL_TYPE_CONFIG).map(([key, config]) => {
                      const Icon = config.icon;
                      return (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <Icon className={cn("w-4 h-4", config.color)} />
                            <span>{config.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Target Score */}
              <div className="space-y-2">
                <Label className="text-xs">Target Score</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={300}
                    max={850}
                    value={targetScore}
                    onChange={(e) =>
                      setTargetScore(
                        Math.min(850, Math.max(300, parseInt(e.target.value) || 300))
                      )
                    }
                    className="h-9 w-24 text-sm"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>300</span>
                      <span>850</span>
                    </div>
                    <input
                      type="range"
                      min={300}
                      max={850}
                      value={targetScore}
                      onChange={(e) => setTargetScore(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Create Button */}
              <Button
                onClick={handleCreateGoal}
                disabled={creating}
                className="w-full gap-2"
                size="sm"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Target className="w-4 h-4" />
                )}
                Set Goal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <Card className="bg-card border-border">
          <CardContent className="py-6">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">
                Loading goals...
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goals List */}
      {!loading &&
        goals.map((goal) => {
          const config = GOAL_TYPE_CONFIG[goal.type] || GOAL_TYPE_CONFIG.CUSTOM;
          const Icon = config.icon;
          const progress = getProgressPercentage(goal);
          const isComplete = goal.currentScore >= goal.targetScore;

          return (
            <Card key={goal.id} className="bg-card border-border">
              <CardContent className="pt-4 pb-4">
                <div className="space-y-3">
                  {/* Goal Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          isComplete
                            ? "bg-emerald-500/15"
                            : "bg-primary/10"
                        )}
                      >
                        {isComplete ? (
                          <Trophy className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Icon className={cn("w-4 h-4", config.color)} />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {goal.label || config.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Target: {goal.targetScore}
                        </p>
                      </div>
                    </div>
                    {isComplete ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                        <CheckCircle className="w-3 h-3 mr-0.5" />
                        Achieved
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        In Progress
                      </Badge>
                    )}
                  </div>

                  {/* Progress Bar with Milestones */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {goal.startingScore}
                      </span>
                      <span className="font-semibold text-foreground">
                        {goal.currentScore}
                      </span>
                      <span className="text-muted-foreground">
                        {goal.targetScore}
                      </span>
                    </div>
                    <div className="relative">
                      <Progress
                        value={progress}
                        className="h-2"
                        indicatorClassName={cn(
                          isComplete ? "bg-emerald-500" : "bg-primary"
                        )}
                      />
                      {/* Milestone Markers */}
                      {goal.milestones.map((milestone, i) => {
                        const milestonePos =
                          ((milestone.score - goal.startingScore) /
                            (goal.targetScore - goal.startingScore)) *
                          100;
                        if (milestonePos < 0 || milestonePos > 100) return null;
                        return (
                          <div
                            key={i}
                            className="absolute top-1/2 -translate-y-1/2"
                            style={{ left: `${milestonePos}%` }}
                            title={`${milestone.label}: ${milestone.score}`}
                          >
                            <div
                              className={cn(
                                "w-2.5 h-2.5 rounded-full border-2 border-background",
                                milestone.reached
                                  ? "bg-emerald-500"
                                  : "bg-muted-foreground"
                              )}
                            />
                          </div>
                        );
                      })}
                    </div>
                    {/* Milestone Labels */}
                    <div className="flex flex-wrap gap-1.5">
                      {goal.milestones.map((milestone, i) => (
                        <Badge
                          key={i}
                          variant={milestone.reached ? "default" : "outline"}
                          className={cn(
                            "text-[9px] px-1.5 py-0",
                            milestone.reached
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : "text-muted-foreground"
                          )}
                        >
                          {milestone.reached && (
                            <CheckCircle className="w-2 h-2 mr-0.5" />
                          )}
                          {milestone.label}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* ETA */}
                  {!isComplete && goal.eta && (
                    <div className="flex items-center gap-2 p-2 bg-muted rounded-lg border border-input">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Estimated completion:{" "}
                        <span className="font-medium text-foreground">
                          {safeFormatDate(goal.eta)}
                        </span>
                      </span>
                      <TrendingUp className="w-3 h-3 text-emerald-400 ml-auto" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

      {/* Empty State */}
      {!loading && goals.length === 0 && !showForm && (
        <Card className="bg-card border-border">
          <CardContent className="py-8">
            <div className="text-center space-y-3">
              <Target className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                No credit goals set yet.
              </p>
              <p className="text-xs text-muted-foreground">
                Create a goal to track progress toward mortgage readiness, auto
                loan approval, or a custom target.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => setShowForm(true)}
              >
                <Plus className="w-3 h-3" />
                Create First Goal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default GoalTracker;
