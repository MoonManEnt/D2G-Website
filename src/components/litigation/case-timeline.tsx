"use client";

import { motion } from "framer-motion";
import {
  FileText,
  Building2,
  Shield,
  Briefcase,
  Gavel,
  Check,
  Circle,
  ArrowRight,
} from "lucide-react";

interface CaseTimelineProps {
  escalationPlan: {
    currentStage: string;
    recommendedNextStage: string;
    steps: Array<{
      stage: string;
      title: string;
      description: string;
      isCompleted: boolean;
      isCurrent: boolean;
      isRecommended: boolean;
      actions: string[];
    }>;
  };
}

const stageIcons: Record<string, React.ElementType> = {
  DISPUTE_LETTER: FileText,
  DIRECT_FURNISHER: Building2,
  CFPB_COMPLAINT: Shield,
  ATTORNEY_CONSULTATION: Briefcase,
  LITIGATION: Gavel,
};

export function CaseTimeline({ escalationPlan }: CaseTimelineProps) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">
        Escalation Path
      </h3>

      <div className="relative">
        {escalationPlan.steps.map((step, idx) => {
          const StageIcon = stageIcons[step.stage] || Circle;
          const isLast = idx === escalationPlan.steps.length - 1;

          // Determine step visual state
          const isCompleted = step.isCompleted;
          const isCurrent = step.isCurrent;
          const isRecommended = step.isRecommended;
          const isFuture = !isCompleted && !isCurrent && !isRecommended;

          return (
            <motion.div
              key={step.stage}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 * idx }}
              className="relative flex gap-4 pb-8 last:pb-0"
            >
              {/* Vertical line connector */}
              {!isLast && (
                <div className="absolute left-[19px] top-[40px] bottom-0 w-[2px]">
                  {isCompleted ? (
                    <div className="w-full h-full bg-emerald-500/60" />
                  ) : isCurrent ? (
                    <div className="w-full h-full bg-gradient-to-b from-blue-500/60 to-muted/30" />
                  ) : isRecommended ? (
                    <div
                      className="w-full h-full border-l-2 border-dashed border-amber-500/40"
                      style={{ marginLeft: "-1px" }}
                    />
                  ) : (
                    <div className="w-full h-full bg-muted" />
                  )}
                </div>
              )}

              {/* Step icon */}
              <div className="relative z-10 flex-shrink-0">
                {isCompleted ? (
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center">
                    <Check className="w-4 h-4 text-emerald-400" />
                  </div>
                ) : isCurrent ? (
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
                ) : isRecommended ? (
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 border-2 border-dashed border-amber-500/40 flex items-center justify-center">
                    <StageIcon className="w-4 h-4 text-amber-400" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-card border-2 border-border flex items-center justify-center">
                    <StageIcon className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Step content */}
              <div
                className={`flex-1 rounded-lg p-4 transition-all ${
                  isCurrent
                    ? "bg-primary/10 border border-primary/30"
                    : isRecommended
                    ? "bg-amber-500/5 border border-dashed border-amber-500/25"
                    : isCompleted
                    ? "bg-card border border-emerald-500/15"
                    : "bg-card border border-border"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <h4
                    className={`text-sm font-semibold ${
                      isCurrent
                        ? "text-blue-300"
                        : isCompleted
                        ? "text-emerald-300"
                        : isRecommended
                        ? "text-amber-300"
                        : "text-muted-foreground"
                    }`}
                  >
                    {step.title}
                  </h4>

                  {isCurrent && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">
                      CURRENT
                    </span>
                  )}
                  {isRecommended && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold flex items-center gap-1">
                      <ArrowRight className="w-3 h-3" />
                      RECOMMENDED
                    </span>
                  )}
                  {isCompleted && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold">
                      COMPLETED
                    </span>
                  )}
                </div>

                <p
                  className={`text-xs mb-3 ${
                    isFuture ? "text-muted-foreground" : "text-muted-foreground"
                  }`}
                >
                  {step.description}
                </p>

                {/* Actions list */}
                {step.actions.length > 0 && (
                  <div className="space-y-1.5">
                    <p
                      className={`text-[10px] font-semibold uppercase tracking-wider ${
                        isFuture ? "text-muted-foreground" : "text-muted-foreground"
                      }`}
                    >
                      Actions
                    </p>
                    <ul className="space-y-1">
                      {step.actions.map((action, actionIdx) => (
                        <li
                          key={actionIdx}
                          className={`text-xs flex items-start gap-2 ${
                            isCompleted
                              ? "text-emerald-400/70"
                              : isCurrent
                              ? "text-blue-300/80"
                              : isRecommended
                              ? "text-amber-300/70"
                              : "text-muted-foreground"
                          }`}
                        >
                          <span className="mt-1 flex-shrink-0">
                            {isCompleted ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <Circle className="w-3 h-3" />
                            )}
                          </span>
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default CaseTimeline;
