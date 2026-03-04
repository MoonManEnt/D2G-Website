"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Clock,
  Search,
  Gavel,
  AlertTriangle,
  Calendar,
  Check,
  Minus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

// =============================================================================
// TYPES
// =============================================================================

interface Deadline {
  id: string;
  title: string;
  description?: string | null;
  deadlineType: string;
  dueDate: string;
  status: string;
}

interface DeadlineTrackerProps {
  deadlines: Deadline[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TYPE_ICONS: Record<string, React.ElementType> = {
  FILING: FileText,
  RESPONSE: Clock,
  DISCOVERY: Search,
  HEARING: Gavel,
  SOL_EXPIRY: AlertTriangle,
  CUSTOM: Calendar,
};

const TYPE_LABELS: Record<string, string> = {
  FILING: "Filing Deadline",
  RESPONSE: "Response Deadline",
  DISCOVERY: "Discovery Deadline",
  HEARING: "Hearing Date",
  SOL_EXPIRY: "Statute of Limitations",
  CUSTOM: "Custom Deadline",
};

// =============================================================================
// HELPERS
// =============================================================================

type UrgencyLevel = "OVERDUE" | "DUE_SOON" | "UPCOMING" | "COMPLETED" | "WAIVED";

function getUrgency(deadline: Deadline): UrgencyLevel {
  if (deadline.status === "COMPLETED") return "COMPLETED";
  if (deadline.status === "WAIVED") return "WAIVED";

  const now = new Date();
  const due = new Date(deadline.dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "OVERDUE";
  if (diffDays <= 7) return "DUE_SOON";
  return "UPCOMING";
}

function getDaysInfo(dueDate: string): { days: number; label: string } {
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { days: Math.abs(diffDays), label: `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? "s" : ""} overdue` };
  }
  if (diffDays === 0) {
    return { days: 0, label: "Due today" };
  }
  return { days: diffDays, label: `${diffDays} day${diffDays !== 1 ? "s" : ""} remaining` };
}

const URGENCY_CONFIG: Record<
  UrgencyLevel,
  { color: string; bg: string; border: string; iconColor: string; lineColor: string }
> = {
  OVERDUE: {
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    iconColor: "text-red-600 dark:text-red-400",
    lineColor: "bg-red-500/40",
  },
  DUE_SOON: {
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    iconColor: "text-amber-600 dark:text-amber-400",
    lineColor: "bg-amber-500/40",
  },
  UPCOMING: {
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    iconColor: "text-blue-600 dark:text-blue-400",
    lineColor: "bg-blue-500/40",
  },
  COMPLETED: {
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    lineColor: "bg-emerald-500/40",
  },
  WAIVED: {
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    iconColor: "text-slate-600 dark:text-slate-400",
    lineColor: "bg-slate-500/40",
  },
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

export function DeadlineTracker({ deadlines }: DeadlineTrackerProps) {
  const sortedDeadlines = useMemo(() => {
    return [...deadlines].sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );
  }, [deadlines]);

  if (sortedDeadlines.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No deadlines have been set for this case.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground">
        Deadlines & Important Dates ({sortedDeadlines.length})
      </h3>

      <div className="relative">
        {sortedDeadlines.map((deadline, idx) => {
          const urgency = getUrgency(deadline);
          const urgencyCfg = URGENCY_CONFIG[urgency];
          const TypeIcon = TYPE_ICONS[deadline.deadlineType] || Calendar;
          const isLast = idx === sortedDeadlines.length - 1;
          const daysInfo = getDaysInfo(deadline.dueDate);
          const isCompleted = urgency === "COMPLETED";
          const isWaived = urgency === "WAIVED";

          return (
            <motion.div
              key={deadline.id}
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.06 * idx }}
              className="relative flex gap-4 pb-6 last:pb-0"
            >
              {/* Vertical connector line */}
              {!isLast && (
                <div
                  className={`absolute left-[15px] top-[34px] bottom-0 w-[2px] ${urgencyCfg.lineColor}`}
                />
              )}

              {/* Icon node */}
              <div className="relative z-10 flex-shrink-0">
                <div
                  className={`w-8 h-8 rounded-full ${urgencyCfg.bg} border ${urgencyCfg.border} flex items-center justify-center`}
                >
                  {isCompleted ? (
                    <Check className={`w-3.5 h-3.5 ${urgencyCfg.iconColor}`} />
                  ) : isWaived ? (
                    <Minus className={`w-3.5 h-3.5 ${urgencyCfg.iconColor}`} />
                  ) : (
                    <TypeIcon className={`w-3.5 h-3.5 ${urgencyCfg.iconColor}`} />
                  )}
                </div>
              </div>

              {/* Content */}
              <Card
                className={`flex-1 ${urgencyCfg.border} ${
                  isCompleted || isWaived ? "opacity-70" : ""
                }`}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4
                          className={`text-xs font-semibold ${
                            isCompleted
                              ? "line-through text-muted-foreground"
                              : isWaived
                              ? "line-through text-slate-600 dark:text-slate-400"
                              : "text-foreground"
                          }`}
                        >
                          {deadline.title}
                        </h4>

                        <Badge
                          className={`${urgencyCfg.bg} ${urgencyCfg.color} border-0 text-[9px] px-1.5 py-0`}
                        >
                          {TYPE_LABELS[deadline.deadlineType] || deadline.deadlineType}
                        </Badge>
                      </div>

                      {deadline.description && (
                        <p className="text-[10px] text-muted-foreground mb-1.5 leading-relaxed">
                          {deadline.description}
                        </p>
                      )}

                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(deadline.dueDate)}
                        </span>
                      </div>
                    </div>

                    {/* Days indicator */}
                    {!isCompleted && !isWaived && (
                      <div
                        className={`flex-shrink-0 text-right rounded-lg px-2.5 py-1.5 ${urgencyCfg.bg}`}
                      >
                        <p className={`text-lg font-bold ${urgencyCfg.color} leading-none`}>
                          {daysInfo.days}
                        </p>
                        <p className={`text-[9px] ${urgencyCfg.color} mt-0.5`}>
                          {urgency === "OVERDUE" ? "days late" : "days left"}
                        </p>
                      </div>
                    )}

                    {isCompleted && (
                      <Badge className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-0 text-[9px]">
                        Done
                      </Badge>
                    )}

                    {isWaived && (
                      <Badge className="bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400 border-0 text-[9px]">
                        Waived
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default DeadlineTracker;
