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

// =============================================================================
// THEME PRESETS - Full holistic themes that change the entire color layout
// =============================================================================

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  colors: {
    primaryColor: string;
    primaryHoverColor: string;
    accentColor: string;
    sidebarBgColor: string;
    sidebarTextColor: string;
    sidebarActiveColor: string;
    successColor: string;
    warningColor: string;
    errorColor: string;
    infoColor: string;
  };
}

export const themePresets: ThemePreset[] = [
  {
    id: "midnight-blue",
    name: "Midnight Blue",
    description: "Default professional look",
    colors: {
      primaryColor: "#3b82f6",
      primaryHoverColor: "#2563eb",
      accentColor: "#8b5cf6",
      sidebarBgColor: "#1e293b",
      sidebarTextColor: "#94a3b8",
      sidebarActiveColor: "#3b82f6",
      successColor: "#22c55e",
      warningColor: "#f59e0b",
      errorColor: "#ef4444",
      infoColor: "#3b82f6",
    },
  },
  {
    id: "ocean-teal",
    name: "Ocean Teal",
    description: "Calm and modern",
    colors: {
      primaryColor: "#14b8a6",
      primaryHoverColor: "#0d9488",
      accentColor: "#06b6d4",
      sidebarBgColor: "#0f2027",
      sidebarTextColor: "#7dd3c0",
      sidebarActiveColor: "#14b8a6",
      successColor: "#34d399",
      warningColor: "#fbbf24",
      errorColor: "#f87171",
      infoColor: "#22d3ee",
    },
  },
  {
    id: "royal-purple",
    name: "Royal Purple",
    description: "Bold and elegant",
    colors: {
      primaryColor: "#8b5cf6",
      primaryHoverColor: "#7c3aed",
      accentColor: "#ec4899",
      sidebarBgColor: "#1a1030",
      sidebarTextColor: "#a78bfa",
      sidebarActiveColor: "#8b5cf6",
      successColor: "#34d399",
      warningColor: "#fbbf24",
      errorColor: "#fb7185",
      infoColor: "#a78bfa",
    },
  },
  {
    id: "forest-green",
    name: "Forest Green",
    description: "Natural and trustworthy",
    colors: {
      primaryColor: "#22c55e",
      primaryHoverColor: "#16a34a",
      accentColor: "#14b8a6",
      sidebarBgColor: "#0a1f13",
      sidebarTextColor: "#86efac",
      sidebarActiveColor: "#22c55e",
      successColor: "#4ade80",
      warningColor: "#fbbf24",
      errorColor: "#f87171",
      infoColor: "#2dd4bf",
    },
  },
  {
    id: "sunset-orange",
    name: "Sunset Orange",
    description: "Warm and energetic",
    colors: {
      primaryColor: "#f97316",
      primaryHoverColor: "#ea580c",
      accentColor: "#eab308",
      sidebarBgColor: "#1c1208",
      sidebarTextColor: "#fdba74",
      sidebarActiveColor: "#f97316",
      successColor: "#22c55e",
      warningColor: "#facc15",
      errorColor: "#ef4444",
      infoColor: "#fb923c",
    },
  },
  {
    id: "rose-crimson",
    name: "Rose Crimson",
    description: "Striking and confident",
    colors: {
      primaryColor: "#e11d48",
      primaryHoverColor: "#be123c",
      accentColor: "#f43f5e",
      sidebarBgColor: "#1a0a10",
      sidebarTextColor: "#fda4af",
      sidebarActiveColor: "#e11d48",
      successColor: "#34d399",
      warningColor: "#fbbf24",
      errorColor: "#fb7185",
      infoColor: "#f472b6",
    },
  },
  {
    id: "cyber-neon",
    name: "Cyber Neon",
    description: "Electric and futuristic",
    colors: {
      primaryColor: "#84cc16",
      primaryHoverColor: "#65a30d",
      accentColor: "#22d3ee",
      sidebarBgColor: "#030712",
      sidebarTextColor: "#a3e635",
      sidebarActiveColor: "#84cc16",
      successColor: "#4ade80",
      warningColor: "#facc15",
      errorColor: "#f87171",
      infoColor: "#67e8f9",
    },
  },
  {
    id: "golden-amber",
    name: "Golden Amber",
    description: "Premium and luxurious",
    colors: {
      primaryColor: "#d97706",
      primaryHoverColor: "#b45309",
      accentColor: "#ca8a04",
      sidebarBgColor: "#1c1505",
      sidebarTextColor: "#fcd34d",
      sidebarActiveColor: "#d97706",
      successColor: "#22c55e",
      warningColor: "#fbbf24",
      errorColor: "#ef4444",
      infoColor: "#fbbf24",
    },
  },
  {
    id: "arctic-ice",
    name: "Arctic Ice",
    description: "Clean and minimal",
    colors: {
      primaryColor: "#0ea5e9",
      primaryHoverColor: "#0284c7",
      accentColor: "#6366f1",
      sidebarBgColor: "#0c1929",
      sidebarTextColor: "#7dd3fc",
      sidebarActiveColor: "#0ea5e9",
      successColor: "#22c55e",
      warningColor: "#f59e0b",
      errorColor: "#ef4444",
      infoColor: "#38bdf8",
    },
  },
  {
    id: "slate-professional",
    name: "Slate Professional",
    description: "Understated and corporate",
    colors: {
      primaryColor: "#64748b",
      primaryHoverColor: "#475569",
      accentColor: "#6366f1",
      sidebarBgColor: "#0f172a",
      sidebarTextColor: "#94a3b8",
      sidebarActiveColor: "#64748b",
      successColor: "#22c55e",
      warningColor: "#f59e0b",
      errorColor: "#ef4444",
      infoColor: "#64748b",
    },
  },
];

// Legacy color presets (kept for backward compat)
export const colorPresets = themePresets.map((t) => ({
  name: t.name,
  primary: t.colors.primaryColor,
  accent: t.colors.accentColor,
}));

// Helper to generate hover color (slightly darker)
export function generateHoverColor(color: string): string {
  // Simple darkening - reduce each RGB component by ~15%
  const hex = color.replace("#", "");
  const r = Math.max(0, Math.floor(parseInt(hex.slice(0, 2), 16) * 0.85));
  const g = Math.max(0, Math.floor(parseInt(hex.slice(2, 4), 16) * 0.85));
  const b = Math.max(0, Math.floor(parseInt(hex.slice(4, 6), 16) * 0.85));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
