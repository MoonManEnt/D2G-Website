"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useOnboarding } from "./onboarding-provider";
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  X,
  ExternalLink,
  Rocket,
} from "lucide-react";

export function OnboardingChecklist() {
  const {
    isOnboarding,
    steps,
    progress,
    skipOnboarding,
    currentStep,
  } = useOnboarding();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Don't show if onboarding is complete or skipped
  if (!isOnboarding || progress === 100) {
    return null;
  }

  return (
    <motion.div
      className="fixed bottom-4 right-4 z-50 w-80"
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div
          className="p-4 bg-gradient-to-r from-brand-600/20 to-purple-600/20 border-b border-slate-700 cursor-pointer"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                className="p-2 rounded-lg bg-brand-500/20"
                animate={{ rotate: isCollapsed ? 0 : 360 }}
                transition={{ duration: 0.5 }}
              >
                <Rocket className="w-4 h-4 text-brand-400" />
              </motion.div>
              <div>
                <h3 className="font-medium text-white text-sm">Getting Started</h3>
                <p className="text-xs text-slate-400">
                  {steps.filter((s) => s.completed).length} of {steps.length} completed
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  skipOnboarding();
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <X className="w-4 h-4" />
              </motion.button>
              {isCollapsed ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <Progress value={progress} className="h-1.5" />
          </div>
        </div>

        {/* Steps */}
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="p-3 space-y-1 max-h-64 overflow-y-auto">
                {steps.map((step, index) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link href={step.href}>
                      <div
                        className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
                          step.completed
                            ? "bg-emerald-500/10"
                            : index === currentStep
                            ? "bg-brand-500/10 border border-brand-500/30"
                            : "hover:bg-slate-700/50"
                        }`}
                      >
                        <div className="mt-0.5">
                          {step.completed ? (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 500 }}
                            >
                              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            </motion.div>
                          ) : index === currentStep ? (
                            <motion.div
                              animate={{ scale: [1, 1.1, 1] }}
                              transition={{ duration: 1, repeat: Infinity }}
                            >
                              <Circle className="w-5 h-5 text-brand-400" />
                            </motion.div>
                          ) : (
                            <Circle className="w-5 h-5 text-slate-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-medium ${
                              step.completed
                                ? "text-emerald-400 line-through"
                                : "text-white"
                            }`}
                          >
                            {step.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {step.description}
                          </p>
                        </div>
                        {index === currentStep && !step.completed && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                          >
                            <ExternalLink className="w-4 h-4 text-brand-400" />
                          </motion.div>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-slate-700">
                <p className="text-xs text-slate-500 text-center">
                  Complete all steps to master Dispute2Go
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Celebration animation when all steps are complete
export function OnboardingComplete() {
  const { progress, isOnboarding } = useOnboarding();
  const [dismissed, setDismissed] = useState(false);

  if (progress !== 100 || !isOnboarding || dismissed) {
    return null;
  }

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => setDismissed(true)}
      />

      <motion.div
        className="relative bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-8 text-center max-w-md"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", duration: 0.5 }}
      >
        {/* Confetti effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                background: ["#10B981", "#8B5CF6", "#F59E0B", "#3B82F6"][i % 4],
                left: `${Math.random() * 100}%`,
                top: -10,
              }}
              animate={{
                y: [0, 400],
                x: [0, (Math.random() - 0.5) * 100],
                rotate: [0, 360],
                opacity: [1, 0],
              }}
              transition={{
                duration: 2,
                delay: i * 0.1,
                ease: "easeOut",
              }}
            />
          ))}
        </div>

        <motion.div
          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 mb-6"
          initial={{ rotate: -180, scale: 0 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
        >
          <Sparkles className="w-10 h-10 text-white" />
        </motion.div>

        <motion.h2
          className="text-2xl font-bold text-white mb-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          You're All Set!
        </motion.h2>

        <motion.p
          className="text-slate-400 mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          You've completed the onboarding checklist. You're ready to start managing credit disputes like a pro!
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Button
            onClick={() => setDismissed(true)}
            className="bg-gradient-to-r from-emerald-500 to-emerald-600"
          >
            Let's Go!
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
