"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface OnboardingContextType {
  showWelcome: boolean;
  dismissWelcome: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

const STORAGE_KEY = "dispute2go_welcome_shown";

interface OnboardingProviderProps {
  children: ReactNode;
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const [showWelcome, setShowWelcome] = useState(false);

  // Load saved state from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const welcomeShown = localStorage.getItem(STORAGE_KEY);
      if (!welcomeShown) {
        // New user - show welcome
        setShowWelcome(true);
      }
    }
  }, []);

  const dismissWelcome = () => {
    setShowWelcome(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "true");
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        showWelcome,
        dismissWelcome,
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
