"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Shield,
  Building2,
  Briefcase,
  Gavel,
  Scale,
  Search,
  Handshake,
  Check,
  Circle,
  SkipForward,
  FileOutput,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// =============================================================================
// TYPES
// =============================================================================

interface WorkflowAction {
  id: string;
  stage: string;
  actionType: string;
  status: string;
  sortOrder: number;
  targetEntityName?: string | null;
  deliveryMethod?: string | null;
  documentType?: string | null;
  targetDefendantId?: string | null;
  document?: {
    id: string;
    title: string;
    approvalStatus: string;
  } | null;
  targetDefendant?: {
    id: string;
    entityName: string;
  } | null;
}

interface LitigationWorkflowProps {
  actions: WorkflowAction[];
  currentStage: string;
  onGenerateDocument: (
    actionId: string,
    documentType: string,
    targetDefendantId?: string
  ) => void;
  onUpdateAction: (actionId: string, status: string) => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STAGE_ICONS: Record<string, React.ElementType> = {
  PRE_LITIGATION: FileText,
  DEMAND_LETTER: FileText,
  COMPLAINT_FILING: Shield,
  SERVICE_OF_PROCESS: Building2,
  DISCOVERY: Search,
  MEDIATION: Handshake,
  PRE_TRIAL: Briefcase,
  TRIAL: Gavel,
  SETTLEMENT: Scale,
  POST_TRIAL: Gavel,
  APPEAL: Scale,
};

const STAGE_LABELS: Record<string, string> = {
  PRE_LITIGATION: "Pre-Litigation",
  DEMAND_LETTER: "Demand Letter",
  COMPLAINT_FILING: "Complaint Filing",
  SERVICE_OF_PROCESS: "Service of Process",
  DISCOVERY: "Discovery",
  MEDIATION: "Mediation",
  PRE_TRIAL: "Pre-Trial",
  TRIAL: "Trial",
  SETTLEMENT: "Settlement",
  POST_TRIAL: "Post-Trial",
  APPEAL: "Appeal",
};

const STATUS_CONFIG: Record<
  string,
  { color: string; bg: string; border: string; label: string }
> = {
  PENDING: {
    color: "text-muted-foreground",
    bg: "bg-muted",
    border: "border-border",
    label: "Pending",
  },
  IN_PROGRESS: {
    color: "text-blue-400",
    bg: "bg-blue-500/20",
    border: "border-blue-500/30",
    label: "In Progress",
  },
  COMPLETED: {
    color: "text-emerald-400",
    bg: "bg-emerald-500/20",
    border: "border-emerald-500/30",
    label: "Completed",
  },
  SKIPPED: {
    color: "text-slate-400",
    bg: "bg-slate-500/20",
    border: "border-slate-500/30",
    label: "Skipped",
  },
};

// =============================================================================
// HELPERS
// =============================================================================

function groupActionsByStage(
  actions: WorkflowAction[]
): Map<string, WorkflowAction[]> {
  const grouped = new Map<string, WorkflowAction[]>();
  const sorted = [...actions].sort((a, b) => a.sortOrder - b.sortOrder);

  for (const action of sorted) {
    const existing = grouped.get(action.stage) || [];
    existing.push(action);
    grouped.set(action.stage, existing);
  }

  return grouped;
}

function getStageStatus(actions: WorkflowAction[]): string {
  if (actions.every((a) => a.status === "COMPLETED" || a.status === "SKIPPED"))
    return "COMPLETED";
  if (actions.some((a) => a.status === "IN_PROGRESS")) return "IN_PROGRESS";
  if (actions.some((a) => a.status === "COMPLETED")) return "IN_PROGRESS";
  return "PENDING";
}

// =============================================================================
// COMPONENT
// =============================================================================

export function LitigationWorkflow({
  actions,
  currentStage,
  onGenerateDocument,
  onUpdateAction,
}: LitigationWorkflowProps) {
  const [expandedStages, setExpandedStages] = useState<Set<string>>(
    new Set([currentStage])
  );

  const groupedActions = groupActionsByStage(actions);
  const stages = Array.from(groupedActions.keys());

  const toggleStage = (stage: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) {
        next.delete(stage);
      } else {
        next.add(stage);
      }
      return next;
    });
  };

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">
        Litigation Workflow
      </h3>

      <div className="relative">
        {stages.map((stage, stageIdx) => {
          const stageActions = groupedActions.get(stage) || [];
          const stageStatus = getStageStatus(stageActions);
          const StageIcon = STAGE_ICONS[stage] || Circle;
          const statusCfg = STATUS_CONFIG[stageStatus] || STATUS_CONFIG.PENDING;
          const isLast = stageIdx === stages.length - 1;
          const isExpanded = expandedStages.has(stage);
          const isCurrent = stage === currentStage;

          return (
            <motion.div
              key={stage}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.08 * stageIdx }}
              className="relative flex gap-4 pb-6 last:pb-0"
            >
              {/* Vertical connector line */}
              {!isLast && (
                <div className="absolute left-[19px] top-[40px] bottom-0 w-[2px]">
                  {stageStatus === "COMPLETED" ? (
                    <div className="w-full h-full bg-emerald-500/60" />
                  ) : stageStatus === "IN_PROGRESS" ? (
                    <div className="w-full h-full bg-gradient-to-b from-blue-500/60 to-muted/30" />
                  ) : (
                    <div className="w-full h-full bg-muted" />
                  )}
                </div>
              )}

              {/* Stage icon */}
              <div className="relative z-10 flex-shrink-0">
                {stageStatus === "COMPLETED" ? (
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center">
                    <Check className="w-4 h-4 text-emerald-400" />
                  </div>
                ) : stageStatus === "IN_PROGRESS" ? (
                  <motion.div
                    animate={{
                      boxShadow: [
                        "0 0 0 0 rgba(59, 130, 246, 0.4)",
                        "0 0 0 8px rgba(59, 130, 246, 0)",
                        "0 0 0 0 rgba(59, 130, 246, 0)",
                      ],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="w-10 h-10 rounded-full bg-primary/20 border-2 border-blue-500/60 flex items-center justify-center"
                  >
                    <StageIcon className="w-4 h-4 text-primary" />
                  </motion.div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-card border-2 border-border flex items-center justify-center">
                    <StageIcon className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Stage content */}
              <div className="flex-1">
                {/* Stage header (clickable) */}
                <button
                  onClick={() => toggleStage(stage)}
                  className={`w-full text-left rounded-lg p-4 transition-all ${
                    isCurrent
                      ? "bg-primary/10 border border-primary/30"
                      : stageStatus === "COMPLETED"
                      ? "bg-card border border-emerald-500/15"
                      : "bg-card border border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4
                        className={`text-sm font-semibold ${
                          stageStatus === "COMPLETED"
                            ? "text-emerald-300"
                            : stageStatus === "IN_PROGRESS"
                            ? "text-blue-300"
                            : "text-muted-foreground"
                        }`}
                      >
                        {STAGE_LABELS[stage] || stage}
                      </h4>

                      {isCurrent && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">
                          CURRENT
                        </span>
                      )}

                      <Badge
                        className={`${statusCfg.bg} ${statusCfg.color} border-0 text-[10px] px-2 py-0.5`}
                      >
                        {statusCfg.label}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        {stageActions.filter((a) => a.status === "COMPLETED").length}/
                        {stageActions.length}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Actions list (expanded) */}
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    transition={{ duration: 0.3 }}
                    className="mt-2 space-y-2"
                  >
                    {stageActions.map((action) => {
                      const actionStatusCfg =
                        STATUS_CONFIG[action.status] || STATUS_CONFIG.PENDING;
                      const isSkipped = action.status === "SKIPPED";
                      const canGenerate =
                        (action.status === "PENDING" ||
                          action.status === "IN_PROGRESS") &&
                        action.documentType;

                      return (
                        <div
                          key={action.id}
                          className={`rounded-lg bg-background border ${actionStatusCfg.border} p-3 ${
                            isSkipped ? "opacity-60" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                              {/* Status indicator */}
                              <div className="mt-0.5 flex-shrink-0">
                                {action.status === "COMPLETED" ? (
                                  <Check className="w-4 h-4 text-emerald-400" />
                                ) : action.status === "IN_PROGRESS" ? (
                                  <motion.div
                                    animate={{ opacity: [1, 0.5, 1] }}
                                    transition={{
                                      duration: 1.5,
                                      repeat: Infinity,
                                    }}
                                  >
                                    <Circle className="w-4 h-4 text-blue-400 fill-blue-400" />
                                  </motion.div>
                                ) : action.status === "SKIPPED" ? (
                                  <SkipForward className="w-4 h-4 text-slate-400" />
                                ) : (
                                  <Circle className="w-4 h-4 text-muted-foreground" />
                                )}
                              </div>

                              {/* Action details */}
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-xs font-medium ${
                                    isSkipped
                                      ? "line-through text-slate-400"
                                      : "text-foreground"
                                  }`}
                                >
                                  {action.actionType.replace(/_/g, " ")}
                                </p>

                                {action.targetEntityName && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    Target: {action.targetEntityName}
                                  </p>
                                )}

                                {action.deliveryMethod && (
                                  <p className="text-[10px] text-muted-foreground">
                                    Via: {action.deliveryMethod.replace(/_/g, " ")}
                                  </p>
                                )}

                                {action.document && (
                                  <div className="mt-1 flex items-center gap-1.5">
                                    <FileOutput className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-[10px] text-muted-foreground">
                                      {action.document.title}
                                    </span>
                                    <Badge
                                      className={`text-[9px] px-1.5 py-0 border-0 ${
                                        action.document.approvalStatus === "APPROVED"
                                          ? "bg-emerald-500/20 text-emerald-400"
                                          : action.document.approvalStatus ===
                                            "PENDING_REVIEW"
                                          ? "bg-amber-500/20 text-amber-400"
                                          : "bg-slate-500/20 text-slate-400"
                                      }`}
                                    >
                                      {action.document.approvalStatus}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Action buttons */}
                            {action.status !== "COMPLETED" &&
                              action.status !== "SKIPPED" && (
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {canGenerate && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-[10px] px-2 gap-1"
                                      onClick={() =>
                                        onGenerateDocument(
                                          action.id,
                                          action.documentType!,
                                          action.targetDefendantId || undefined
                                        )
                                      }
                                    >
                                      <FileText className="w-3 h-3" />
                                      Generate
                                    </Button>
                                  )}

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[10px] px-2 gap-1 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                                    onClick={() =>
                                      onUpdateAction(action.id, "COMPLETED")
                                    }
                                  >
                                    <Check className="w-3 h-3" />
                                    Complete
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-[10px] px-2 gap-1 text-slate-400 hover:text-slate-300"
                                    onClick={() =>
                                      onUpdateAction(action.id, "SKIPPED")
                                    }
                                  >
                                    <SkipForward className="w-3 h-3" />
                                    Skip
                                  </Button>
                                </div>
                              )}
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default LitigationWorkflow;
