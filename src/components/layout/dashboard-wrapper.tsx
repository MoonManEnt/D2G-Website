"use client";

import { ReactNode, useState, useEffect } from "react";
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
import { CommandPalette } from "@/components/layout/command-palette";
import Link from "next/link";

interface DashboardWrapperProps {
  children: ReactNode;
  user: {
    name: string;
    organizationName: string;
    subscriptionTier: string;
    subscriptionStatus?: string;
    trialEndsAt?: string | null;
  };
}

function TrialBanner({ tierName, trialEndsAt }: { tierName: string; trialEndsAt: string }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const key = `trial-banner-dismissed-${trialEndsAt}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(key)) {
      setDismissed(true);
    }
  }, [trialEndsAt]);

  if (dismissed) return null;

  const daysRemaining = Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  const displayTier = tierName.charAt(0) + tierName.slice(1).toLowerCase();

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`trial-banner-dismissed-${trialEndsAt}`, "1");
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-blue-500/20 px-4 py-2.5 flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs font-medium">
          Trial
        </span>
        <span className="text-muted-foreground">
          {displayTier} Plan — <strong className="text-foreground">{daysRemaining} day{daysRemaining !== 1 ? "s" : ""}</strong> remaining
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/billing" className="text-blue-400 hover:text-blue-300 text-xs font-medium">
          View billing
        </Link>
        <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground text-xs" aria-label="Dismiss">
          &times;
        </button>
      </div>
    </div>
  );
}

function DashboardContent({ children, user }: DashboardWrapperProps) {
  // Use pathname as key to trigger animations on route change
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const { tourActive, completeTour } = useOnboarding();

  return (
    <>
      <div className="flex h-screen bg-background">
        <Sidebar user={user} />
        <main id="main-content" role="main" className="flex-1 overflow-auto bg-background">
          {user.subscriptionStatus === "TRIALING" && user.trialEndsAt && (
            <TrialBanner tierName={user.subscriptionTier} trialEndsAt={user.trialEndsAt} />
          )}
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
