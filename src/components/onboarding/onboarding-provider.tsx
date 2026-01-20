"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useSession } from "next-auth/react";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  href: string;
  completed: boolean;
}

interface OnboardingContextType {
  isOnboarding: boolean;
  currentStep: number;
  steps: OnboardingStep[];
  showWelcome: boolean;
  showTooltips: boolean;
  completeStep: (stepId: string) => void;
  skipOnboarding: () => void;
  dismissWelcome: () => void;
  toggleTooltips: (show: boolean) => void;
  progress: number;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

const STORAGE_KEY = "dispute2go_onboarding";

const DEFAULT_STEPS: OnboardingStep[] = [
  {
    id: "add-client",
    title: "Add Your First Client",
    description: "Create a client profile to start managing their credit disputes",
    href: "/clients",
    completed: false,
  },
  {
    id: "upload-report",
    title: "Upload a Credit Report",
    description: "Upload a credit report PDF to automatically extract negative items",
    href: "/reports",
    completed: false,
  },
  {
    id: "review-items",
    title: "Review Negative Items",
    description: "Check the parsed items and select ones to dispute",
    href: "/negative-items",
    completed: false,
  },
  {
    id: "create-dispute",
    title: "Create a Dispute",
    description: "Generate your first dispute letter with our AI-powered system",
    href: "/disputes",
    completed: false,
  },
  {
    id: "capture-evidence",
    title: "Capture Evidence",
    description: "Screenshot key information from reports as supporting evidence",
    href: "/evidence",
    completed: false,
  },
];

interface OnboardingProviderProps {
  children: ReactNode;
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const { data: session } = useSession();
  const [steps, setSteps] = useState<OnboardingStep[]>(DEFAULT_STEPS);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showTooltips, setShowTooltips] = useState(true);
  const [isOnboarding, setIsOnboarding] = useState(true);

  // Load saved state from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          setSteps(data.steps || DEFAULT_STEPS);
          setIsOnboarding(data.isOnboarding ?? true);
          setShowTooltips(data.showTooltips ?? true);
          // Show welcome only for new users
          setShowWelcome(data.showWelcome ?? false);
        } catch {
          // Reset to defaults
        }
      } else {
        // New user - show welcome
        setShowWelcome(true);
      }
    }
  }, []);

  // Save state to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          steps,
          isOnboarding,
          showTooltips,
          showWelcome: false, // Once dismissed, don't show again
        })
      );
    }
  }, [steps, isOnboarding, showTooltips]);

  const currentStep = steps.findIndex((s) => !s.completed);
  const progress = Math.round(
    (steps.filter((s) => s.completed).length / steps.length) * 100
  );

  const completeStep = (stepId: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, completed: true } : s))
    );
  };

  const skipOnboarding = () => {
    setIsOnboarding(false);
    setShowWelcome(false);
  };

  const dismissWelcome = () => {
    setShowWelcome(false);
  };

  const toggleTooltips = (show: boolean) => {
    setShowTooltips(show);
  };

  return (
    <OnboardingContext.Provider
      value={{
        isOnboarding,
        currentStep,
        steps,
        showWelcome,
        showTooltips,
        completeStep,
        skipOnboarding,
        dismissWelcome,
        toggleTooltips,
        progress,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return context;
}
