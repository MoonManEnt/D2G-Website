"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";

interface TourStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string; // CSS selector for the element to highlight
  position: "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "dashboard",
    title: "Your Command Center",
    description: "The dashboard shows your action queue, recent responses, approaching deadlines, and key stats at a glance.",
    targetSelector: "[data-tour='dashboard']",
    position: "bottom",
  },
  {
    id: "clients",
    title: "Client Management",
    description: "Add and manage your clients here. Upload credit reports, track disputes, and monitor progress for each client.",
    targetSelector: "[data-tour='clients']",
    position: "right",
  },
  {
    id: "disputes",
    title: "Dispute Center",
    description: "Create, review, and send dispute letters powered by AMELIA - our AI letter generation engine that creates unique, eOSCAR-resistant letters.",
    targetSelector: "[data-tour='disputes']",
    position: "right",
  },
  {
    id: "evidence",
    title: "Evidence Library",
    description: "Capture screenshots of credit report errors, annotate them, and attach as evidence to strengthen your dispute letters.",
    targetSelector: "[data-tour='evidence']",
    position: "right",
  },
  {
    id: "responses",
    title: "Response Tracking",
    description: "Track CRA responses, log outcomes (deleted, verified, updated), and let the system recommend next steps automatically.",
    targetSelector: "[data-tour='responses']",
    position: "right",
  },
  {
    id: "sentry",
    title: "Sentry Intelligence",
    description: "Advanced dispute intelligence with e-OSCAR code analysis, success predictions, and A/B testing for optimal strategies.",
    targetSelector: "[data-tour='sentry']",
    position: "right",
  },
  {
    id: "analytics",
    title: "Analytics & Insights",
    description: "Track your success rates by CRA, flow type, and over time. See which strategies work best for your business.",
    targetSelector: "[data-tour='analytics']",
    position: "right",
  },
];

interface GuidedTourProps {
  onComplete: () => void;
  isActive: boolean;
}

export function GuidedTour({ onComplete, isActive }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const step = TOUR_STEPS[currentStep];

  const updateTargetRect = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.targetSelector);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [step]);

  useEffect(() => {
    if (!isActive) return;
    updateTargetRect();
    const timer = setTimeout(updateTargetRect, 300);
    window.addEventListener("resize", updateTargetRect);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateTargetRect);
    };
  }, [isActive, currentStep, updateTargetRect]);

  if (!isActive || !step) return null;

  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;

  const getTooltipPosition = () => {
    if (!targetRect) return { top: "50%", left: "50%" };

    const padding = 16;
    switch (step.position) {
      case "bottom":
        return { top: `${targetRect.bottom + padding}px`, left: `${targetRect.left}px` };
      case "top":
        return { top: `${targetRect.top - padding}px`, left: `${targetRect.left}px`, transform: "translateY(-100%)" };
      case "right":
        return { top: `${targetRect.top}px`, left: `${targetRect.right + padding}px` };
      case "left":
        return { top: `${targetRect.top}px`, left: `${targetRect.left - padding}px`, transform: "translateX(-100%)" };
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999]" aria-live="polite" role="dialog" aria-label="Guided tour">
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/60" onClick={onComplete} />

        {/* Spotlight */}
        {targetRect && (
          <div
            className="absolute border-2 border-purple-400 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] z-[10000] pointer-events-none"
            style={{
              top: targetRect.top - 4,
              left: targetRect.left - 4,
              width: targetRect.width + 8,
              height: targetRect.height + 8,
            }}
          />
        )}

        {/* Tooltip */}
        <motion.div
          key={step.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="absolute z-[10001] w-80 bg-background border border-purple-500/30 rounded-xl shadow-2xl p-5"
          style={getTooltipPosition()}
        >
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-purple-400 font-medium">
                Step {currentStep + 1} of {TOUR_STEPS.length}
              </span>
            </div>
            <button
              onClick={onComplete}
              className="text-muted-foreground hover:text-foreground p-1 rounded"
              aria-label="Close tour"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <h3 className="text-foreground font-semibold text-lg mb-2">{step.title}</h3>
          <p className="text-muted-foreground text-sm leading-relaxed mb-4">{step.description}</p>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mb-4">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentStep ? "w-6 bg-purple-400" : i < currentStep ? "w-1.5 bg-purple-400/60" : "w-1.5 bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={onComplete}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip tour
            </button>
            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  onClick={() => setCurrentStep(s => s - 1)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground bg-card rounded-lg transition-colors"
                  aria-label="Previous step"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
              )}
              <button
                onClick={() => isLast ? onComplete() : setCurrentStep(s => s + 1)}
                className="flex items-center gap-1 px-4 py-1.5 text-sm text-foreground bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors font-medium"
                aria-label={isLast ? "Finish tour" : "Next step"}
              >
                {isLast ? "Get Started!" : "Next"}
                {!isLast && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
