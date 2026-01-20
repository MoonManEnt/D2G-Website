// White-labeling branding configuration types

export interface BrandingSettings {
  // Logo
  logoUrl?: string;
  logoText?: string; // Fallback text if no logo
  faviconUrl?: string;

  // Colors
  primaryColor: string; // Main brand color (buttons, links, accents)
  primaryHoverColor: string;
  accentColor: string; // Secondary accent color

  // UI Theme
  sidebarBgColor: string;
  sidebarTextColor: string;
  sidebarActiveColor: string;

  // Semantic Colors
  successColor: string;
  warningColor: string;
  errorColor: string;
  infoColor: string;

  // Company info for letters/documents
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;

  // Email customization
  emailHeaderColor?: string;
  emailFooterText?: string;

  // Custom CSS (advanced)
  customCss?: string;
}

export const defaultBranding: BrandingSettings = {
  primaryColor: "#3b82f6", // Blue-500
  primaryHoverColor: "#2563eb", // Blue-600
  accentColor: "#8b5cf6", // Violet-500
  sidebarBgColor: "#1e293b", // Slate-800
  sidebarTextColor: "#94a3b8", // Slate-400
  sidebarActiveColor: "#3b82f6", // Blue-500
  successColor: "#22c55e", // Green-500
  warningColor: "#f59e0b", // Amber-500
  errorColor: "#ef4444", // Red-500
  infoColor: "#3b82f6", // Blue-500
  logoText: "Dispute2Go",
  companyName: "",
  companyAddress: "",
  companyPhone: "",
  companyEmail: "",
  companyWebsite: "",
  emailHeaderColor: "#3b82f6",
  emailFooterText: "",
  customCss: "",
};

// Color presets for quick selection
export const colorPresets = [
  { name: "Ocean Blue", primary: "#3b82f6", accent: "#06b6d4" },
  { name: "Forest Green", primary: "#22c55e", accent: "#14b8a6" },
  { name: "Royal Purple", primary: "#8b5cf6", accent: "#ec4899" },
  { name: "Sunset Orange", primary: "#f97316", accent: "#eab308" },
  { name: "Rose Red", primary: "#e11d48", accent: "#f43f5e" },
  { name: "Slate Gray", primary: "#64748b", accent: "#475569" },
];

// Helper to generate hover color (slightly darker)
export function generateHoverColor(color: string): string {
  // Simple darkening - reduce each RGB component by ~15%
  const hex = color.replace("#", "");
  const r = Math.max(0, Math.floor(parseInt(hex.slice(0, 2), 16) * 0.85));
  const g = Math.max(0, Math.floor(parseInt(hex.slice(2, 4), 16) * 0.85));
  const b = Math.max(0, Math.floor(parseInt(hex.slice(4, 6), 16) * 0.85));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
