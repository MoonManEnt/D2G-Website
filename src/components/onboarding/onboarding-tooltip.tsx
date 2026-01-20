"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ReactNode, useState } from "react";
import { useOnboarding } from "./onboarding-provider";
import { HelpCircle, X, Lightbulb } from "lucide-react";

interface OnboardingTooltipProps {
  children: ReactNode;
  content: string;
  title?: string;
  position?: "top" | "bottom" | "left" | "right";
  showIcon?: boolean;
  stepId?: string;
}

export function OnboardingTooltip({
  children,
  content,
  title,
  position = "top",
  showIcon = true,
  stepId,
}: OnboardingTooltipProps) {
  const { showTooltips, isOnboarding, steps } = useOnboarding();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Check if this tooltip should show based on current step
  const currentStepIndex = steps.findIndex((s) => !s.completed);
  const thisStepIndex = stepId ? steps.findIndex((s) => s.id === stepId) : -1;
  const isCurrentStep = thisStepIndex === currentStepIndex;

  // Don't show if tooltips are disabled, onboarding is complete, or user dismissed
  if (!showTooltips || !isOnboarding || isDismissed) {
    return <>{children}</>;
  }

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowClasses = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-slate-700 border-x-transparent border-b-transparent",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-slate-700 border-x-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-l-slate-700 border-y-transparent border-r-transparent",
    right: "right-full top-1/2 -translate-y-1/2 border-r-slate-700 border-y-transparent border-l-transparent",
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}

      {/* Icon indicator for onboarding tooltips */}
      {showIcon && isCurrentStep && (
        <motion.div
          className="absolute -top-1 -right-1 z-10"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500 }}
        >
          <motion.div
            className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <Lightbulb className="w-3 h-3 text-white" />
          </motion.div>
        </motion.div>
      )}

      {/* Tooltip */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            className={`absolute z-50 ${positionClasses[position]}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
          >
            <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-3 max-w-xs">
              <div className="flex items-start gap-2">
                <div className="p-1 rounded bg-brand-500/20 shrink-0">
                  <HelpCircle className="w-4 h-4 text-brand-400" />
                </div>
                <div className="flex-1 min-w-0">
                  {title && (
                    <p className="text-sm font-medium text-white mb-1">{title}</p>
                  )}
                  <p className="text-xs text-slate-400">{content}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDismissed(true);
                  }}
                  className="p-0.5 rounded hover:bg-slate-700 text-slate-500 hover:text-white shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Arrow */}
            <div
              className={`absolute border-4 ${arrowClasses[position]}`}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Spotlight component for highlighting specific elements
interface SpotlightProps {
  children: ReactNode;
  active: boolean;
  message?: string;
}

export function Spotlight({ children, active, message }: SpotlightProps) {
  if (!active) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* Spotlight ring */}
      <motion.div
        className="absolute -inset-2 rounded-lg border-2 border-brand-500 pointer-events-none z-10"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className="absolute inset-0 rounded-lg bg-brand-500/10"
          animate={{ opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.div>

      {/* Pulsing dot */}
      <motion.div
        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand-500 z-20 pointer-events-none"
        animate={{ scale: [1, 1.3, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <span className="absolute inset-0 rounded-full bg-brand-500 animate-ping" />
      </motion.div>

      {children}

      {/* Message tooltip */}
      {message && (
        <motion.div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-3 z-30 pointer-events-none"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="bg-slate-800 border border-brand-500/30 rounded-lg shadow-xl px-3 py-2 whitespace-nowrap">
            <p className="text-sm text-white">{message}</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
