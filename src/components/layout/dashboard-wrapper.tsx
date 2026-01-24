"use client";

import { ReactNode } from "react";
import {
  OnboardingProvider,
  WelcomeModal,
} from "@/components/onboarding";
import { motion, AnimatePresence } from "framer-motion";
import { BrandingProvider } from "@/components/branding";
import { Sidebar } from "@/components/layout/sidebar";
import { BetaFeedback } from "@/components/feedback/beta-feedback";

interface DashboardWrapperProps {
  children: ReactNode;
  user: {
    name: string;
    organizationName: string;
    subscriptionTier: string;
  };
}

export function DashboardWrapper({ children, user }: DashboardWrapperProps) {
  // Use pathname as key to trigger animations on route change
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";

  return (
    <BrandingProvider>
      <OnboardingProvider>
        <div className="flex h-screen bg-slate-900">
          <Sidebar user={user} />
          <main className="flex-1 overflow-auto bg-slate-900 lg:ml-64">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="p-6 h-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
        <WelcomeModal />
        <BetaFeedback />
      </OnboardingProvider>
    </BrandingProvider>
  );
}
