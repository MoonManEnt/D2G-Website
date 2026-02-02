"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "./onboarding-provider";
import { Shield, ArrowRight, Quote } from "lucide-react";

export function WelcomeModal() {
  const { showWelcome, dismissWelcome } = useOnboarding();

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
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            className="relative bg-background border border-border rounded-2xl shadow-2xl shadow-black/50 ring-1 ring-white/10 max-w-xl w-full overflow-hidden"
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
                <Shield className="w-8 h-8 text-foreground" />
              </motion.div>

              <motion.h1
                className="text-3xl font-bold text-foreground mb-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                Welcome to Dispute2Go
              </motion.h1>
            </div>

            {/* Content */}
            <div className="p-8">
              <motion.div
                className="space-y-4 mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <p className="text-muted-foreground text-base leading-relaxed">
                  The credit dispute operating system built for professionals. Import any IdentityIQ report and watch it transform into a complete, actionable dispute workflow—automatically sequenced by FCRA statute, legally compliant, and ready to send.
                </p>
                <p className="text-muted-foreground text-base leading-relaxed">
                  No more manual letter drafting. No more guessing which violations to cite. Just powerful, precise disputes that get results.
                </p>
                <p className="text-muted-foreground text-base font-medium mt-6">
                  Good luck out there.
                </p>
              </motion.div>

              {/* Quote */}
              <motion.div
                className="bg-card border border-border rounded-xl p-4 mb-8"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <div className="flex items-start gap-3">
                  <Quote className="w-5 h-5 text-brand-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-muted-foreground italic">
                      "Willing is not enough; we must do."
                    </p>
                    <p className="text-muted-foreground text-sm mt-1">— Robert F. Smith</p>
                  </div>
                </div>
              </motion.div>

              {/* Action */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Button
                  onClick={dismissWelcome}
                  size="lg"
                  className="w-full bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 shadow-lg shadow-brand-500/25 transition-all hover:scale-[1.02]"
                >
                  Let's Get to Work
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
