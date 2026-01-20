"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { useSession } from "next-auth/react";
import { BrandingSettings, defaultBranding } from "@/types/branding";

interface BrandingContextType {
  branding: BrandingSettings;
  isLoading: boolean;
  updateBranding: (updates: Partial<BrandingSettings>) => Promise<void>;
  resetBranding: () => Promise<void>;
  refetchBranding: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

interface BrandingProviderProps {
  children: ReactNode;
  initialBranding?: BrandingSettings;
}

export function BrandingProvider({ children, initialBranding }: BrandingProviderProps) {
  const { data: session } = useSession();
  const [branding, setBranding] = useState<BrandingSettings>(
    initialBranding || defaultBranding
  );
  const [isLoading, setIsLoading] = useState(!initialBranding);

  const fetchBranding = useCallback(async () => {
    if (!session?.user?.organizationId) return;

    try {
      const response = await fetch("/api/organization/branding");
      if (response.ok) {
        const data = await response.json();
        setBranding({ ...defaultBranding, ...data.branding });
      }
    } catch (error) {
      console.error("Failed to fetch branding:", error);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.organizationId]);

  useEffect(() => {
    if (!initialBranding) {
      fetchBranding();
    }
  }, [fetchBranding, initialBranding]);

  // Apply CSS variables for branding colors
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--brand-primary", branding.primaryColor);
    root.style.setProperty("--brand-primary-hover", branding.primaryHoverColor);
    root.style.setProperty("--brand-accent", branding.accentColor);
    root.style.setProperty("--brand-sidebar-bg", branding.sidebarBgColor);
    root.style.setProperty("--brand-sidebar-text", branding.sidebarTextColor);
    root.style.setProperty("--brand-sidebar-active", branding.sidebarActiveColor);
    root.style.setProperty("--brand-success", branding.successColor);
    root.style.setProperty("--brand-warning", branding.warningColor);
    root.style.setProperty("--brand-error", branding.errorColor);
    root.style.setProperty("--brand-info", branding.infoColor);

    // Apply custom CSS if provided
    let styleEl = document.getElementById("custom-branding-css");
    if (branding.customCss) {
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "custom-branding-css";
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = branding.customCss;
    } else if (styleEl) {
      styleEl.remove();
    }

    return () => {
      // Cleanup custom CSS on unmount
      const el = document.getElementById("custom-branding-css");
      if (el) el.remove();
    };
  }, [branding]);

  const updateBranding = async (updates: Partial<BrandingSettings>) => {
    const newBranding = { ...branding, ...updates };
    setBranding(newBranding);

    try {
      const response = await fetch("/api/organization/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        // Revert on failure
        setBranding(branding);
        throw new Error("Failed to save branding");
      }
    } catch (error) {
      setBranding(branding);
      throw error;
    }
  };

  const resetBranding = async () => {
    try {
      const response = await fetch("/api/organization/branding", {
        method: "DELETE",
      });

      if (response.ok) {
        setBranding(defaultBranding);
      } else {
        throw new Error("Failed to reset branding");
      }
    } catch (error) {
      throw error;
    }
  };

  const refetchBranding = async () => {
    setIsLoading(true);
    await fetchBranding();
  };

  return (
    <BrandingContext.Provider
      value={{
        branding,
        isLoading,
        updateBranding,
        resetBranding,
        refetchBranding,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error("useBranding must be used within a BrandingProvider");
  }
  return context;
}

// Optional hook that doesn't throw if not in provider (for gradual adoption)
export function useBrandingOptional() {
  return useContext(BrandingContext);
}
