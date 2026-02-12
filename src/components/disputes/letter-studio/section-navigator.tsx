"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Document section identifiers
 */
export type DocumentSection =
  | "header"
  | "bureau"
  | "date"
  | "title"
  | "greeting"
  | "story"
  | "body"
  | "accounts"
  | "personal"
  | "closing"
  | "signature";

/**
 * Status of each section
 */
export type SectionStatus = "empty" | "done" | "editing" | "warning";

/**
 * Section information for the navigator
 */
export interface SectionInfo {
  id: DocumentSection;
  label: string;
  status: SectionStatus;
  hasContent: boolean;
}

export interface SectionNavigatorProps {
  sections: SectionInfo[];
  activeSection: DocumentSection | null;
  onNavigate: (section: DocumentSection) => void;
}

/**
 * Section labels for display
 */
export const SECTION_LABELS: Record<DocumentSection, string> = {
  header: "Header",
  bureau: "Bureau",
  date: "Date",
  title: "Title",
  greeting: "Greeting",
  story: "Story",
  body: "Body",
  accounts: "Accounts",
  personal: "Personal",
  closing: "Closing",
  signature: "Signature",
};

/**
 * Sections to show in the navigator (hide auto-filled sections)
 */
const VISIBLE_SECTIONS: DocumentSection[] = [
  "header",
  "title",
  "story",
  "accounts",
  "personal",
  "closing",
];

/**
 * Get styles for section pill based on status
 */
function getStatusStyles(status: SectionStatus, isActive: boolean): string {
  const baseStyles =
    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap";

  if (isActive) {
    return cn(baseStyles, "bg-emerald-500/20 text-emerald-400");
  }

  switch (status) {
    case "done":
      return cn(baseStyles, "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15");
    case "editing":
      return cn(baseStyles, "bg-emerald-500/20 text-emerald-400");
    case "warning":
      return cn(baseStyles, "bg-amber-500/10 text-amber-400 hover:bg-amber-500/15");
    case "empty":
    default:
      return cn(baseStyles, "bg-muted text-muted-foreground hover:bg-muted/80");
  }
}

/**
 * Get styles for status dot indicator
 */
function getStatusDotStyles(status: SectionStatus): string {
  switch (status) {
    case "done":
      return "bg-emerald-400";
    case "editing":
      return "bg-emerald-400 animate-pulse";
    case "warning":
      return "bg-amber-400";
    case "empty":
    default:
      return "bg-muted-foreground/50";
  }
}

/**
 * SectionNavigator - Bottom navigation bar showing letter sections as horizontal pills
 *
 * Displays section status visually and allows quick navigation between sections.
 * Only shows main editable sections (hides auto-filled ones like bureau, date, greeting).
 */
export function SectionNavigator({
  sections,
  activeSection,
  onNavigate,
}: SectionNavigatorProps) {
  // Filter to only show visible sections
  const visibleSections = React.useMemo(() => {
    return sections.filter((section) => VISIBLE_SECTIONS.includes(section.id));
  }, [sections]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border py-3 px-4"
      role="navigation"
      aria-label="Letter sections"
    >
      <div className="flex items-center justify-center gap-2 overflow-x-auto scrollbar-hide">
        {visibleSections.map((section) => {
          const isActive = activeSection === section.id;

          return (
            <button
              key={section.id}
              onClick={() => onNavigate(section.id)}
              className={cn(
                getStatusStyles(section.status, isActive),
                isActive && "ring-2 ring-emerald-500"
              )}
              aria-current={isActive ? "true" : undefined}
              aria-label={`${section.label} section - ${section.status}`}
              title={`${section.label} (${section.status})`}
            >
              <span
                className={cn("w-2 h-2 rounded-full", getStatusDotStyles(section.status))}
                aria-hidden="true"
              />
              {section.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
