"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface OnboardingContextType {
  showWelcome: boolean;
  dismissWelcome: () => void;
  tourActive: boolean;
  completeTour: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

const STORAGE_KEY = "dispute2go_welcome_shown";
const TOUR_STORAGE_KEY = "dispute2go_tour_completed";

interface OnboardingProviderProps {
  children: ReactNode;
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const [showWelcome, setShowWelcome] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [tourCompleted, setTourCompleted] = useState(false);

  // Load saved state from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const welcomeShown = localStorage.getItem(STORAGE_KEY);
      const tourDone = localStorage.getItem(TOUR_STORAGE_KEY);

      if (tourDone) {
        setTourCompleted(true);
      }

      // Skip welcome modal if user came through checkout (they see /welcome page instead)
      const fromCheckout = localStorage.getItem("dispute2go_checkout_completed");

      if (!welcomeShown && !fromCheckout) {
        // New user who hasn't been through checkout — show welcome modal
        setShowWelcome(true);
      }
    }
  }, []);

  const dismissWelcome = () => {
    setShowWelcome(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "true");
    }
    // After welcome modal is dismissed, start the guided tour if not completed
    if (!tourCompleted) {
      // Small delay to let the welcome modal animate out
      setTimeout(() => {
        setTourActive(true);
      }, 500);
    }
  };

  const completeTour = () => {
    setTourActive(false);
    setTourCompleted(true);
    if (typeof window !== "undefined") {
      localStorage.setItem(TOUR_STORAGE_KEY, "true");
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        showWelcome,
        dismissWelcome,
        tourActive,
        completeTour,
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
