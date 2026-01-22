"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "./onboarding-provider";
import {
  Shield,
  FileText,
  Scale,
  CheckCircle2,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export function WelcomeModal() {
  const { showWelcome, dismissWelcome, skipOnboarding } = useOnboarding();

  const features = [
    {
      icon: FileText,
      title: "Smart Report Parsing",
      description: "Upload credit reports and we'll automatically extract negative items",
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/20",
    },
    {
      icon: Scale,
      title: "AI Dispute Generation",
      description: "Generate professional dispute letters with legally-backed arguments",
      color: "text-purple-400",
      bgColor: "bg-purple-500/20",
    },
    {
      icon: CheckCircle2,
      title: "Track Progress",
      description: "Monitor dispute status and track resolution outcomes",
      color: "text-blue-400",
      bgColor: "bg-blue-500/20",
    },
  ];

  return (
    <AnimatePresence>
      {showWelcome && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={dismissWelcome}
          />

          {/* Modal */}
          <motion.div
            className="relative bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/50 ring-1 ring-white/10 max-w-2xl w-full overflow-hidden"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.6, bounce: 0.3 }}
          >
            {/* Header with gradient */}
            <div className="relative bg-gradient-to-br from-brand-600 to-purple-600 p-8 text-center overflow-hidden">
              {/* Animated background shapes */}
              <motion.div
                className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"
                animate={{
                  x: [0, 50, 0],
                  y: [0, 30, 0],
                }}
                transition={{ duration: 5, repeat: Infinity }}
              />
              <motion.div
                className="absolute bottom-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl"
                animate={{
                  x: [0, -30, 0],
                  y: [0, -20, 0],
                }}
                transition={{ duration: 4, repeat: Infinity }}
              />

              {/* Logo */}
              <motion.div
                className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur mb-4"
                initial={{ rotate: -10 }}
                animate={{ rotate: 0 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Shield className="w-8 h-8 text-white" />
              </motion.div>

              <motion.h1
                className="text-3xl font-bold text-white mb-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                Welcome to Dispute2Go!
              </motion.h1>

              <motion.p
                className="text-white/80 text-lg"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                Your credit dispute operating system
              </motion.p>
            </div>

            {/* Content */}
            <div className="p-8">
              <motion.p
                className="text-slate-400 text-center mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                Let's get you set up with everything you need to manage credit disputes effectively.
              </motion.p>

              {/* Features */}
              <div className="space-y-4 mb-8">
                {features.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                  >
                    <div className={`p-2 rounded-lg ${feature.bgColor}`}>
                      <feature.icon className={`w-5 h-5 ${feature.color}`} />
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{feature.title}</h3>
                      <p className="text-sm text-slate-400">{feature.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Actions */}
              <motion.div
                className="flex flex-col sm:flex-row gap-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
              >
                <Button
                  onClick={dismissWelcome}
                  size="lg"
                  className="flex-1 bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 shadow-lg shadow-brand-500/25 transition-all hover:scale-[1.02]"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={skipOnboarding}
                  className="text-slate-400"
                >
                  I know my way around
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
