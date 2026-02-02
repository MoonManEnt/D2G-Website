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

// Convert hex color to HSL string (without "hsl()" wrapper, just "H S% L%")
function hexToHSL(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "0 0% 0%";

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Get relative luminance to determine if text should be light or dark
function getLuminance(hex: string): number {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return 0;

  const [r, g, b] = [result[1], result[2], result[3]].map((c) => {
    const val = parseInt(c, 16) / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Auto-compute foreground color (light or dark) based on background luminance
function getContrastForeground(bgHex: string): string {
  const lum = getLuminance(bgHex);
  // If bg is dark, use light foreground; if light, use dark foreground
  return lum > 0.35 ? "222.2 47.4% 11.2%" : "210 40% 98%";
}

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

  // Apply CSS variables for branding colors + bridge to shadcn variables
  useEffect(() => {
    const root = document.documentElement;

    // Set brand-specific CSS variables (legacy)
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

    // Bridge brand colors → shadcn CSS variables so bg-primary, text-primary, etc. work
    const primaryHSL = hexToHSL(branding.primaryColor);
    const accentHSL = hexToHSL(branding.accentColor);
    const destructiveHSL = hexToHSL(branding.errorColor);

    root.style.setProperty("--primary", primaryHSL);
    root.style.setProperty("--primary-foreground", getContrastForeground(branding.primaryColor));
    root.style.setProperty("--accent", accentHSL);
    root.style.setProperty("--accent-foreground", getContrastForeground(branding.accentColor));
    root.style.setProperty("--destructive", destructiveHSL);
    root.style.setProperty("--destructive-foreground", getContrastForeground(branding.errorColor));
    root.style.setProperty("--ring", primaryHSL);

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
