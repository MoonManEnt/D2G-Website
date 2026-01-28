"use client";

import { ReactNode } from "react";
import {
  OnboardingProvider,
  WelcomeModal,
  GuidedTour,
} from "@/components/onboarding";
import { useOnboarding } from "@/components/onboarding";
import { motion, AnimatePresence } from "framer-motion";
import { BrandingProvider } from "@/components/branding";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { BetaFeedback } from "@/components/feedback/beta-feedback";
import { CommandPalette } from "@/components/layout/command-palette";

interface DashboardWrapperProps {
  children: ReactNode;
  user: {
    name: string;
    organizationName: string;
    subscriptionTier: string;
  };
}

function DashboardContent({ children, user }: DashboardWrapperProps) {
  // Use pathname as key to trigger animations on route change
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const { tourActive, completeTour } = useOnboarding();

  return (
    <>
      <div className="flex h-screen bg-slate-900">
        <Sidebar user={user} />
        <main id="main-content" role="main" className="flex-1 overflow-auto bg-slate-900 lg:ml-64">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="p-6 h-full pb-20 lg:pb-6"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
        <MobileNav />
      </div>
      <WelcomeModal />
      <GuidedTour isActive={tourActive} onComplete={completeTour} />
      <CommandPalette />
      <BetaFeedback />
    </>
  );
}

export function DashboardWrapper({ children, user }: DashboardWrapperProps) {
  return (
    <BrandingProvider>
      <OnboardingProvider>
        <DashboardContent user={user}>
          {children}
        </DashboardContent>
      </OnboardingProvider>
    </BrandingProvider>
  );
}
