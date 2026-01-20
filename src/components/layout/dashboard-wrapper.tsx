"use client";

import { ReactNode } from "react";
import {
  OnboardingProvider,
  WelcomeModal,
  OnboardingChecklist,
  OnboardingComplete,
} from "@/components/onboarding";
import { BrandingProvider } from "@/components/branding";
import { Sidebar } from "@/components/layout/sidebar";

interface DashboardWrapperProps {
  children: ReactNode;
  user: {
    name: string;
    organizationName: string;
    subscriptionTier: string;
  };
}

export function DashboardWrapper({ children, user }: DashboardWrapperProps) {
  return (
    <BrandingProvider>
      <OnboardingProvider>
        <div className="flex h-screen bg-slate-900">
          <Sidebar user={user} />
          <main className="flex-1 overflow-auto">
            <div className="p-6">
              {children}
            </div>
          </main>
        </div>
        <WelcomeModal />
        <OnboardingChecklist />
        <OnboardingComplete />
      </OnboardingProvider>
    </BrandingProvider>
  );
}
