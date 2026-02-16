"use client";

import React, { useRef, useEffect, useCallback, useMemo } from "react";
import { Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Document sections that can be edited
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
 * CRA Address constants
 */
const CRA_ADDRESSES: Record<string, string> = {
  TRANSUNION: "TransUnion Consumer Solutions\nP.O. Box 2000\nChester, PA 19016",
  EXPERIAN: "Experian\nP.O. Box 4500\nAllen, TX 75013",
  EQUIFAX: "Equifax Information Services LLC\nP.O. Box 740256\nAtlanta, GA 30374",
};

/**
 * Section display labels
 */
const SECTION_LABELS: Record<DocumentSection, string> = {
  header: "Header",
  bureau: "Bureau Address",
  date: "Date",
  title: "Subject Line",
  greeting: "Greeting",
  story: "Personal Story",
  body: "Main Argument",
  accounts: "Disputed Accounts",
  personal: "Personal Items",
  closing: "Closing",
  signature: "Signature",
};

interface LetterDocumentProps {
  letterContent: string;
  cra: string;
  clientName: string;
  editingSection: DocumentSection | null;
  sectionEdits: Map<DocumentSection, string>;
  onSectionClick: (section: DocumentSection) => void;
  onSectionEdit: (section: DocumentSection, content: string) => void;
  onSectionSave: () => void;
  onSectionCancel: () => void;
  hoveredSection: DocumentSection | null;
  onHoverSection: (section: DocumentSection | null) => void;
  letterDate?: string;
  isBackdated?: boolean;
  backdatedDays?: number;
}

interface ParsedSections {
  header: string;
  bureau: string;
  date: string;
  title: string;
  greeting: string;
  story: string;
  body: string;
  accounts: string;
  personal: string;
  closing: string;
  signature: string;
}

/**
 * Parse letter content into sections
 */
function parseLetterContent(
  content: string,
  cra: string,
  clientName: string,
  letterDate?: string
): ParsedSections {
  const lines = content.split("\n");
  const sections: ParsedSections = {
    header: "",
    bureau: "",
    date: "",
    title: "",
    greeting: "",
    story: "",
    body: "",
    accounts: "",
    personal: "",
    closing: "",
    signature: "",
  };

  // Try to find natural sections in the content
  let currentSection: keyof ParsedSections = "header";
  let headerEnded = false;
  let foundGreeting = false;
  let foundAccounts = false;
  let foundPersonal = false;
  let foundClosing = false;
  let storyParagraphCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    const lowerLine = trimmedLine.toLowerCase();

    // Check for DOB line to end header
    if (!headerEnded && (lowerLine.includes("dob:") || lowerLine.includes("date of birth"))) {
      sections.header += line + "\n";
      headerEnded = true;
      currentSection = "bureau";
      continue;
    }

    // Check for header info (name, address, SSN, DOB)
    if (!headerEnded) {
      sections.header += line + "\n";
      continue;
    }

    // Check for CRA address block (after header)
    if (
      currentSection === "bureau" &&
      (lowerLine.includes("transunion") ||
        lowerLine.includes("experian") ||
        lowerLine.includes("equifax") ||
        lowerLine.includes("p.o. box") ||
        lowerLine.includes("po box") ||
        /^\d{5}(-\d{4})?$/.test(trimmedLine) ||
        /^[A-Z][a-z]+,\s*[A-Z]{2}\s+\d{5}/.test(trimmedLine))
    ) {
      sections.bureau += line + "\n";
      continue;
    }

    // Check for date line (month day, year format)
    if (
      currentSection === "bureau" &&
      /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}$/i.test(
        trimmedLine
      )
    ) {
      sections.date = trimmedLine;
      currentSection = "title";
      continue;
    }

    // Check for title (RE: or **RE: or similar centered bold line)
    if (
      currentSection === "title" &&
      (lowerLine.startsWith("re:") ||
        lowerLine.startsWith("**re:") ||
        lowerLine.includes("subject:") ||
        (trimmedLine.startsWith("**") && trimmedLine.endsWith("**")))
    ) {
      sections.title = trimmedLine;
      currentSection = "greeting";
      continue;
    }

    // Check for greeting
    if (currentSection === "greeting" && lowerLine.startsWith("dear")) {
      sections.greeting = trimmedLine;
      foundGreeting = true;
      currentSection = "story";
      continue;
    }

    // If we haven't found proper transitions, try to detect them
    if (currentSection === "title" && !sections.title && trimmedLine) {
      // If we're past the bureau and haven't found a title, this might be it
      if (
        trimmedLine.length < 80 &&
        (trimmedLine.toUpperCase() === trimmedLine || trimmedLine.includes("RE:"))
      ) {
        sections.title = trimmedLine;
        currentSection = "greeting";
        continue;
      }
    }

    // Story section - first paragraph(s) after greeting
    if (currentSection === "story" && foundGreeting) {
      // Story is usually 1-2 paragraphs
      if (trimmedLine === "") {
        if (sections.story.trim()) {
          storyParagraphCount++;
          if (storyParagraphCount >= 1) {
            currentSection = "body";
          }
        }
        sections.story += line + "\n";
        continue;
      }
      sections.story += line + "\n";
      continue;
    }

    // Check for accounts section (bullet points with account numbers)
    if (
      !foundAccounts &&
      (lowerLine.startsWith("•") ||
        lowerLine.startsWith("-") ||
        lowerLine.startsWith("*") ||
        lowerLine.includes("account:") ||
        lowerLine.includes("account #") ||
        /^\d+\.\s+/.test(trimmedLine)) &&
      (lowerLine.includes("account") ||
        lowerLine.includes("balance") ||
        /\*{2,}\d+/.test(trimmedLine))
    ) {
      foundAccounts = true;
      currentSection = "accounts";
      sections.accounts += line + "\n";
      continue;
    }

    // Continue accounts section if we're in it and still seeing bullet points
    if (
      currentSection === "accounts" &&
      foundAccounts &&
      (trimmedLine === "" ||
        lowerLine.startsWith("•") ||
        lowerLine.startsWith("-") ||
        lowerLine.startsWith("*") ||
        lowerLine.includes("account") ||
        lowerLine.includes("balance") ||
        /^\s+/.test(line))
    ) {
      sections.accounts += line + "\n";
      continue;
    }

    // Check for personal section (previous addresses, names, inquiries)
    if (
      !foundPersonal &&
      (lowerLine.includes("previous address") ||
        lowerLine.includes("previous name") ||
        lowerLine.includes("inquiry") ||
        lowerLine.includes("inquiries") ||
        lowerLine.includes("also check") ||
        lowerLine.includes("also verify") ||
        lowerLine.includes("also please"))
    ) {
      foundPersonal = true;
      currentSection = "personal";
      sections.personal += line + "\n";
      continue;
    }

    // Continue personal section
    if (currentSection === "personal" && foundPersonal) {
      // Check if we've moved to closing
      if (
        lowerLine.includes("sincerely") ||
        lowerLine.includes("thank you for") ||
        lowerLine.includes("point blank") ||
        lowerLine.includes("i expect") ||
        lowerLine.includes("please respond") ||
        lowerLine.includes("i look forward")
      ) {
        foundClosing = true;
        currentSection = "closing";
        sections.closing += line + "\n";
        continue;
      }
      sections.personal += line + "\n";
      continue;
    }

    // Check for closing/signature
    if (
      !foundClosing &&
      (lowerLine.includes("sincerely") ||
        lowerLine.includes("thank you") ||
        lowerLine.includes("regards") ||
        lowerLine.includes("respectfully") ||
        lowerLine === "best," ||
        lowerLine.startsWith("best,"))
    ) {
      foundClosing = true;
      currentSection = "signature";
      sections.signature += line + "\n";
      continue;
    }

    // Check for closing paragraph (natural ending before signature)
    if (
      !foundClosing &&
      currentSection !== "signature" &&
      (lowerLine.includes("point blank") ||
        lowerLine.includes("i expect") ||
        lowerLine.includes("please respond within") ||
        lowerLine.includes("i look forward") ||
        lowerLine.includes("timely manner") ||
        lowerLine.includes("30 day") ||
        lowerLine.includes("federal law"))
    ) {
      currentSection = "closing";
      sections.closing += line + "\n";
      continue;
    }

    // Continue closing
    if (currentSection === "closing") {
      if (lowerLine.includes("sincerely") || lowerLine.includes("regards")) {
        currentSection = "signature";
        sections.signature += line + "\n";
        continue;
      }
      sections.closing += line + "\n";
      continue;
    }

    // Signature section
    if (currentSection === "signature") {
      sections.signature += line + "\n";
      continue;
    }

    // Body section (default for paragraphs between story and accounts/personal/closing)
    if (currentSection === "body" || (foundGreeting && !foundAccounts && !foundPersonal && !foundClosing)) {
      currentSection = "body";
      sections.body += line + "\n";
      continue;
    }
  }

  // Trim all sections
  for (const key of Object.keys(sections) as (keyof ParsedSections)[]) {
    sections[key] = sections[key].trim();
  }

  // Clean up: Remove any duplicate bureau addresses, greetings, timestamps that might be in wrong sections
  // This handles malformed content where metadata gets appended at the end
  const craNames = ["transunion", "experian", "equifax"];

  // Helper to clean a section of duplicate/metadata content
  const cleanSectionContent = (sectionContent: string, sectionKey: string): string => {
    if (!sectionContent) return sectionContent;

    // Don't clean header or bureau sections - they should have this content
    if (sectionKey === "header" || sectionKey === "bureau" || sectionKey === "date" || sectionKey === "greeting") {
      return sectionContent;
    }

    const lines = sectionContent.split("\n");
    const cleanedLines = lines.filter(line => {
      const lower = line.toLowerCase().trim();
      const trimmed = line.trim();

      // Remove bureau addresses (except in bureau section)
      if (craNames.some(cra => lower.includes(cra) && !lower.includes("account"))) return false;
      // Remove P.O. Box lines
      if (lower.includes("p.o. box") || lower.includes("po box")) return false;
      // Remove city/state/zip lines (likely bureau address)
      if (/^[a-z]+,\s*[a-z]{2}\s+\d{5}/i.test(lower)) return false;
      // Remove ISO timestamps
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(trimmed)) return false;
      // Remove "Dear X" greetings (except in greeting section)
      if (lower.startsWith("dear ") && sectionKey !== "greeting") return false;
      // Remove duplicate "Sincerely," in non-signature sections
      if (lower === "sincerely," && sectionKey !== "signature") return false;
      // Remove raw "Best," lines if they appear after signature
      if (lower === "best," && sectionKey === "closing") return false;
      // Remove "Backdated X days" text
      if (lower.includes("backdated") && lower.includes("days")) return false;

      return true;
    });

    return cleanedLines.join("\n").trim();
  };

  // Clean all sections that might have duplicate content
  sections.body = cleanSectionContent(sections.body, "body");
  sections.accounts = cleanSectionContent(sections.accounts, "accounts");
  sections.personal = cleanSectionContent(sections.personal, "personal");
  sections.closing = cleanSectionContent(sections.closing, "closing");
  sections.signature = cleanSectionContent(sections.signature, "signature");

  // If we have very empty sections, try to fill them with defaults
  if (!sections.bureau && cra) {
    const craKey = cra.toUpperCase();
    sections.bureau = CRA_ADDRESSES[craKey] || `${cra}\n[Address not found]`;
  }

  if (!sections.date && letterDate) {
    // Format the date properly - handle ISO strings
    try {
      const dateObj = new Date(letterDate);
      if (!isNaN(dateObj.getTime())) {
        sections.date = dateObj.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
      } else {
        sections.date = letterDate; // Use as-is if not a valid date
      }
    } catch {
      sections.date = letterDate;
    }
  } else if (!sections.date) {
    sections.date = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  if (!sections.greeting && cra) {
    sections.greeting = `Dear ${cra},`;
  }

  if (!sections.signature && clientName) {
    sections.signature = `Sincerely,\n\n________________________\n${clientName}`;
  }

  return sections;
}

/**
 * Editable Section Component
 */
interface EditableSectionProps {
  section: DocumentSection;
  content: string;
  isEditing: boolean;
  isHovered: boolean;
  editValue: string;
  onEdit: (content: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onClick: () => void;
  onHover: (hovered: boolean) => void;
  className?: string;
  textareaClassName?: string;
  children?: React.ReactNode;
}

function EditableSection({
  section,
  content,
  isEditing,
  isHovered,
  editValue,
  onEdit,
  onSave,
  onCancel,
  onClick,
  onHover,
  className,
  textareaClassName,
  children,
}: EditableSectionProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus and auto-resize textarea
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing]);

  // Auto-resize on content change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onEdit(e.target.value);
      e.target.style.height = "auto";
      e.target.style.height = `${e.target.scrollHeight}px`;
    },
    [onEdit]
  );

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        onCancel();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        onSave();
      }
    },
    [onCancel, onSave]
  );

  if (isEditing) {
    return (
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full resize-none bg-transparent border-0 focus:outline-none focus:ring-0",
            "ring-2 ring-emerald-500 rounded-md p-2 -m-2",
            textareaClassName
          )}
          style={{ minHeight: "1.5em" }}
        />
        <div className="flex items-center gap-2 mt-3">
          <Button
            size="sm"
            onClick={onSave}
            className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
            className="h-7 px-2"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Cancel
          </Button>
          <span className="text-xs text-muted-foreground ml-2">
            Press Cmd+Enter to save, Esc to cancel
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative cursor-pointer rounded-md transition-all duration-150",
        isHovered && "ring-2 ring-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20",
        className
      )}
      onClick={onClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      {/* Section label on hover */}
      {isHovered && (
        <div className="absolute -top-5 left-0 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <Pencil className="h-3 w-3" />
          <span>{SECTION_LABELS[section]}</span>
        </div>
      )}
      {children || (
        <div className="whitespace-pre-wrap">{content}</div>
      )}
    </div>
  );
}

/**
 * LetterDocument Component
 *
 * WYSIWYG document view that renders the letter like actual printed paper.
 * Users can click any section to edit it.
 */
export function LetterDocument({
  letterContent,
  cra,
  clientName,
  editingSection,
  sectionEdits,
  onSectionClick,
  onSectionEdit,
  onSectionSave,
  onSectionCancel,
  hoveredSection,
  onHoverSection,
  letterDate,
  isBackdated,
  backdatedDays,
}: LetterDocumentProps) {
  // Parse the letter content into sections
  const parsedSections = useMemo(
    () => parseLetterContent(letterContent, cra, clientName, letterDate),
    [letterContent, cra, clientName, letterDate]
  );

  // Get the current content for a section (edited or original)
  const getSectionContent = useCallback(
    (section: DocumentSection): string => {
      return sectionEdits.get(section) ?? parsedSections[section];
    },
    [sectionEdits, parsedSections]
  );

  // Get edit value (what's being typed)
  const getEditValue = useCallback(
    (section: DocumentSection): string => {
      return sectionEdits.get(section) ?? parsedSections[section];
    },
    [sectionEdits, parsedSections]
  );

  // Render a section with the editable wrapper
  const renderSection = useCallback(
    (
      section: DocumentSection,
      className?: string,
      textareaClassName?: string,
      customContent?: React.ReactNode
    ) => {
      const content = getSectionContent(section);
      const isEditing = editingSection === section;
      const isHovered = hoveredSection === section;

      return (
        <EditableSection
          section={section}
          content={content}
          isEditing={isEditing}
          isHovered={isHovered}
          editValue={getEditValue(section)}
          onEdit={(newContent) => onSectionEdit(section, newContent)}
          onSave={onSectionSave}
          onCancel={onSectionCancel}
          onClick={() => onSectionClick(section)}
          onHover={(hovered) => onHoverSection(hovered ? section : null)}
          className={className}
          textareaClassName={textareaClassName}
        >
          {customContent}
        </EditableSection>
      );
    },
    [
      editingSection,
      hoveredSection,
      getSectionContent,
      getEditValue,
      onSectionClick,
      onSectionEdit,
      onSectionSave,
      onSectionCancel,
      onHoverSection,
    ]
  );

  // Extract client name from signature for display
  // Handle {{script}}...{{/script}} markers for script font
  const extractSignatureName = useCallback(() => {
    const signatureContent = getSectionContent("signature");

    // Check for script font markers
    const scriptMatch = signatureContent.match(/\{\{script\}\}(.+?)\{\{\/script\}\}/);
    if (scriptMatch) {
      return scriptMatch[1].trim();
    }

    const lines = signatureContent.split("\n").filter((l) => l.trim());
    // Find the name line (not "Sincerely"/"Best" and not underscores)
    const nameLine = lines.find(
      (line) =>
        !line.toLowerCase().includes("sincerely") &&
        !line.toLowerCase().includes("best,") &&
        !line.includes("____") &&
        !line.toLowerCase().includes("regards") &&
        // Skip {{script}} markers
        !line.includes("{{script}}") &&
        !line.includes("{{/script}}") &&
        line.trim().length > 0
    );
    return nameLine?.trim().replace(/\{\{script\}\}|\{\{\/script\}\}/g, "") || clientName;
  }, [getSectionContent, clientName]);

  return (
    <div className="flex justify-center p-8">
      {/* Paper document */}
      <div
        className={cn(
          "w-full max-w-4xl bg-white dark:bg-slate-900",
          "shadow-xl rounded-lg",
          "p-12",
          "min-h-[11in]"
        )}
      >
        {/* Header Section - Client Info */}
        <div className="mb-8 pt-2">
          {renderSection(
            "header",
            "p-2 -m-2",
            "text-sm font-sans",
            editingSection !== "header" && (
              <div className="text-sm font-sans whitespace-pre-wrap">
                {getSectionContent("header")}
              </div>
            )
          )}
        </div>

        {/* Bureau Address */}
        <div className="mb-6">
          {renderSection(
            "bureau",
            "p-2 -m-2",
            "text-sm font-sans",
            editingSection !== "bureau" && (
              <div className="text-sm font-sans whitespace-pre-wrap">
                {getSectionContent("bureau")}
              </div>
            )
          )}
        </div>

        {/* Date */}
        <div className="mb-8">
          {renderSection(
            "date",
            "p-2 -m-2 inline-block",
            "text-sm font-sans",
            editingSection !== "date" && (
              <div className="text-sm font-sans flex items-center gap-2">
                <span>{getSectionContent("date")}</span>
                {isBackdated && backdatedDays && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                    Backdated {backdatedDays} days
                  </span>
                )}
              </div>
            )
          )}
        </div>

        {/* Title / Subject Line - CENTERED */}
        <div className="mb-6 w-full">
          {renderSection(
            "title",
            "p-2 -m-2 w-full",
            "text-base font-bold text-center uppercase w-full",
            editingSection !== "title" && (
              <div className="text-base font-bold text-center uppercase w-full">
                {getSectionContent("title").replace(/\*\*/g, "")}
              </div>
            )
          )}
        </div>

        {/* Greeting */}
        <div className="mb-4">
          {renderSection(
            "greeting",
            "p-2 -m-2",
            "text-sm font-serif",
            editingSection !== "greeting" && (
              <div className="text-sm font-serif">{getSectionContent("greeting")}</div>
            )
          )}
        </div>

        {/* Story - Personal narrative */}
        {getSectionContent("story") && (
          <div className="mb-4">
            {renderSection(
              "story",
              "p-2 -m-2",
              "text-sm font-serif leading-relaxed",
              editingSection !== "story" && (
                <div className="text-sm font-serif leading-relaxed whitespace-pre-wrap">
                  {getSectionContent("story")}
                </div>
              )
            )}
          </div>
        )}

        {/* Body - Main arguments */}
        {getSectionContent("body") && (
          <div className="mb-4">
            {renderSection(
              "body",
              "p-2 -m-2",
              "text-sm font-serif leading-relaxed",
              editingSection !== "body" && (
                <div className="text-sm font-serif leading-relaxed whitespace-pre-wrap">
                  {/* Render markdown-style formatting */}
                  {getSectionContent("body").split("\n").map((line, idx) => {
                    const hasBold = line.includes("**");
                    if (hasBold) {
                      const parts = line.split(/(\*\*[^*]+\*\*)/g);
                      return (
                        <div key={idx}>
                          {parts.map((part, partIdx) => {
                            if (part.startsWith("**") && part.endsWith("**")) {
                              return <strong key={partIdx}>{part.slice(2, -2)}</strong>;
                            }
                            return <span key={partIdx}>{part}</span>;
                          })}
                        </div>
                      );
                    }
                    return <div key={idx}>{line || "\u00A0"}</div>;
                  })}
                </div>
              )
            )}
          </div>
        )}

        {/* Accounts - Disputed items */}
        {getSectionContent("accounts") && (
          <div className="mb-4">
            {renderSection(
              "accounts",
              "p-2 -m-2",
              "text-sm font-serif leading-relaxed",
              editingSection !== "accounts" && (
                <div className="text-sm font-serif leading-relaxed whitespace-pre-wrap">
                  {/* Render markdown-style formatting */}
                  {getSectionContent("accounts").split("\n").map((line, idx) => {
                    // Handle bold text marked with **
                    const hasBold = line.includes("**");
                    if (hasBold) {
                      // Parse and render bold segments
                      const parts = line.split(/(\*\*[^*]+\*\*)/g);
                      return (
                        <div key={idx}>
                          {parts.map((part, partIdx) => {
                            if (part.startsWith("**") && part.endsWith("**")) {
                              return <strong key={partIdx}>{part.slice(2, -2)}</strong>;
                            }
                            return <span key={partIdx}>{part}</span>;
                          })}
                        </div>
                      );
                    }
                    return <div key={idx}>{line || "\u00A0"}</div>;
                  })}
                </div>
              )
            )}
          </div>
        )}

        {/* Personal Items - Previous addresses, names, inquiries */}
        {getSectionContent("personal") && (
          <div className="mb-4">
            {renderSection(
              "personal",
              "p-2 -m-2",
              "text-sm font-serif leading-relaxed",
              editingSection !== "personal" && (
                <div className="text-sm font-serif leading-relaxed whitespace-pre-wrap">
                  {/* Render markdown-style formatting */}
                  {getSectionContent("personal").split("\n").map((line, idx) => {
                    const hasBold = line.includes("**");
                    if (hasBold) {
                      const parts = line.split(/(\*\*[^*]+\*\*)/g);
                      return (
                        <div key={idx}>
                          {parts.map((part, partIdx) => {
                            if (part.startsWith("**") && part.endsWith("**")) {
                              return <strong key={partIdx}>{part.slice(2, -2)}</strong>;
                            }
                            return <span key={partIdx}>{part}</span>;
                          })}
                        </div>
                      );
                    }
                    return <div key={idx}>{line || "\u00A0"}</div>;
                  })}
                </div>
              )
            )}
          </div>
        )}

        {/* Closing paragraph */}
        {getSectionContent("closing") && (
          <div className="mb-6">
            {renderSection(
              "closing",
              "p-2 -m-2",
              "text-sm font-serif leading-relaxed",
              editingSection !== "closing" && (
                <div className="text-sm font-serif leading-relaxed whitespace-pre-wrap">
                  {/* Render markdown-style formatting */}
                  {getSectionContent("closing").split("\n").map((line, idx) => {
                    const hasBold = line.includes("**");
                    if (hasBold) {
                      const parts = line.split(/(\*\*[^*]+\*\*)/g);
                      return (
                        <div key={idx}>
                          {parts.map((part, partIdx) => {
                            if (part.startsWith("**") && part.endsWith("**")) {
                              return <strong key={partIdx}>{part.slice(2, -2)}</strong>;
                            }
                            return <span key={partIdx}>{part}</span>;
                          })}
                        </div>
                      );
                    }
                    return <div key={idx}>{line || "\u00A0"}</div>;
                  })}
                </div>
              )
            )}
          </div>
        )}

        {/* Signature Block */}
        <div className="mt-8">
          {renderSection(
            "signature",
            "p-2 -m-2",
            "text-sm font-serif",
            editingSection !== "signature" && (
              <div className="text-sm font-serif">
                <p className="mb-4">
                  {getSectionContent("signature").toLowerCase().includes("best") ? "Best," : "Sincerely,"}
                </p>
                <p className="font-signature text-2xl text-slate-800 dark:text-slate-200 my-4">
                  {extractSignatureName()}
                </p>
                <div className="border-b border-slate-400 dark:border-slate-600 w-48 mb-1"></div>
                <p className="text-sm">{extractSignatureName()}</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default LetterDocument;
