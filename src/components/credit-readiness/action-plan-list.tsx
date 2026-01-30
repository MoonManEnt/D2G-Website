"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scale,
  CreditCard,
  TrendingUp,
  DollarSign,
  Clock,
  Handshake,
  ChevronDown,
  ExternalLink,
} from "lucide-react";

const PRIORITY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  CRITICAL: { text: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/30" },
  HIGH: { text: "text-orange-400", bg: "bg-orange-500/20", border: "border-orange-500/30" },
  MEDIUM: { text: "text-amber-400", bg: "bg-amber-500/20", border: "border-amber-500/30" },
  LOW: { text: "text-slate-400", bg: "bg-slate-500/20", border: "border-slate-500/30" },
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  DISPUTE: Scale,
  PAY_DOWN: CreditCard,
  BUILD_CREDIT: TrendingUp,
  INCOME: DollarSign,
  WAIT: Clock,
  VENDOR_SERVICE: Handshake,
};

interface ActionPlanStep {
  stepNumber: number;
  priority: string;
  category: string;
  title: string;
  whatToDo: string;
  howToDoIt: string;
  whereToGo: string;
  estimatedImpact: string;
  estimatedTimeline: string;
  vendorId?: string;
  vendorName?: string;
}

interface ActionPlanListProps {
  steps: ActionPlanStep[];
}

export function ActionPlanList({ steps }: ActionPlanListProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const priority = PRIORITY_COLORS[step.priority] || PRIORITY_COLORS.MEDIUM;
        const CategoryIcon = CATEGORY_ICONS[step.category] || Scale;
        const isExpanded = expandedIndex === i;

        const isLink =
          step.whereToGo &&
          (step.whereToGo.startsWith("/") || step.whereToGo.startsWith("http"));
        const isExternal = step.whereToGo?.startsWith("http");

        return (
          <motion.div
            key={step.stepNumber}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`bg-slate-700/30 rounded-xl border ${priority.border} overflow-hidden`}
          >
            {/* Collapsed header */}
            <button
              onClick={() => toggleExpand(i)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-700/20 transition-colors"
            >
              {/* Step number circle */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${priority.bg} ${priority.text}`}
              >
                {step.stepNumber}
              </div>
              {/* Category icon */}
              <CategoryIcon className={`w-4 h-4 flex-shrink-0 ${priority.text}`} />
              {/* Title */}
              <span className="flex-1 text-sm font-medium text-slate-200 truncate">
                {step.title}
              </span>
              {/* Priority badge */}
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${priority.bg} ${priority.text}`}
              >
                {step.priority}
              </span>
              {/* Vendor badge */}
              {step.vendorName && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-400 flex-shrink-0">
                  {step.vendorName}
                </span>
              )}
              {/* Expand chevron */}
              <ChevronDown
                className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform duration-200 ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Expanded details */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50 pt-3">
                    {/* What to do */}
                    <div>
                      <p className="text-xs font-medium text-slate-400 mb-1">What to Do</p>
                      <p className="text-sm text-slate-200">{step.whatToDo}</p>
                    </div>

                    {/* How to do it */}
                    <div>
                      <p className="text-xs font-medium text-slate-400 mb-1">How to Do It</p>
                      <p className="text-sm text-slate-300">{step.howToDoIt}</p>
                    </div>

                    {/* Where to go */}
                    {step.whereToGo && (
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-1">Where to Go</p>
                        {isLink ? (
                          <a
                            href={step.whereToGo}
                            target={isExternal ? "_blank" : undefined}
                            rel={isExternal ? "noopener noreferrer" : undefined}
                            className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            {step.whereToGo}
                            {isExternal && <ExternalLink className="w-3 h-3" />}
                          </a>
                        ) : (
                          <p className="text-sm text-slate-300">{step.whereToGo}</p>
                        )}
                      </div>
                    )}

                    {/* Impact + Timeline row */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="bg-slate-800/50 rounded-lg px-3 py-1.5">
                        <p className="text-xs text-slate-400">Impact</p>
                        <p className="text-sm font-medium text-emerald-400">
                          {step.estimatedImpact}
                        </p>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg px-3 py-1.5">
                        <p className="text-xs text-slate-400">Timeline</p>
                        <p className="text-sm font-medium text-slate-200">
                          {step.estimatedTimeline}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
