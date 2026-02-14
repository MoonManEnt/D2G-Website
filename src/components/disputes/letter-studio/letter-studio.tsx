"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  ChevronDown,
  Save,
  Rocket,
  Loader2,
  Check,
} from "lucide-react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { useToast } from "@/lib/use-toast";
import { LetterDocument } from "./letter-document";
import { AmeliaPanel, type DocumentSection as AmeliaPanelDocumentSection } from "./amelia-panel";
import { SectionNavigator, type SectionInfo } from "./section-navigator";

// ============================================================================
// Types
// ============================================================================

export type DocumentSection =
  | "header" // Client name, address, SSN, DOB
  | "bureau" // CRA address
  | "date" // Letter date (backdated)
  | "title" // Centered, bold title
  | "greeting" // "Dear {Bureau},"
  | "story" // Opening narrative (Kitchen Table)
  | "body" // Main argument paragraphs
  | "accounts" // Account list with issues
  | "personal" // Old names, addresses, inquiries
  | "closing" // Natural closing paragraph
  | "signature"; // Sincerely + signature

export type SectionStatus = "empty" | "done" | "editing" | "warning";

export interface GeneratedLetter {
  disputeId?: string;
  isPreview?: boolean;
  clientId?: string;
  accountIds?: string[];
  contentHash?: string;
  documentId?: string;
  documentTitle?: string;
  content: string;
  cra: string;
  flow: string;
  round: number;
  status?: string;
  ameliaMetadata?: {
    letterDate: string;
    isBackdated: boolean;
    backdatedDays: number;
    tone: string;
    effectiveFlow: string;
    statute: string;
    includesScreenshots?: boolean;
    personalInfoDisputed: {
      previousNames: number;
      previousAddresses: number;
      hardInquiries: number;
    };
    ameliaVersion?: string;
  };
}

export interface LetterStudioProps {
  generatedLetter: GeneratedLetter | null;
  clientName?: string;
  onLaunch: () => Promise<void>;
  launching: boolean;
  onDownload: () => Promise<void>;
  downloading: boolean;
  onClose: () => void;
  onFlowChange?: (flow: string) => void;
  onRoundChange?: (round: number) => void;
  onRegenerate?: () => Promise<void>;
  onToneChange?: (tone: string) => void;
  onFormatChange?: (format: string) => void;
  availableFlows?: { id: string; label: string }[];
  initialFormat?: string;
}

// ============================================================================
// Constants
// ============================================================================

const CRA_COLORS: Record<string, string> = {
  TRANSUNION: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  EXPERIAN: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  EQUIFAX: "bg-red-500/20 text-red-400 border-red-500/30",
};

const TONE_OPTIONS = [
  { id: "CONCERNED", label: "Concerned", round: "R1" },
  { id: "WORRIED", label: "Worried", round: "R2" },
  { id: "FED_UP", label: "Fed Up", round: "R3" },
  { id: "WARNING", label: "Warning", round: "R4" },
  { id: "PISSED", label: "Pissed", round: "R5+" },
];

const FORMAT_OPTIONS = [
  {
    id: "STRUCTURED",
    label: "Structured",
    description: "Bold headers, detailed explanations (Recommended)",
    recommended: true,
  },
  {
    id: "CONVERSATIONAL",
    label: "Conversational",
    description: "Casual headers, combined sections",
    recommended: false,
  },
];

const DEFAULT_FLOWS = [
  { id: "ACCURACY", label: "Accuracy" },
  { id: "COLLECTION", label: "Collection" },
  { id: "CONSENT", label: "Consent" },
  { id: "COMBO", label: "Combo" },
];

// Section labels for building SectionInfo
const SECTION_LABELS: Record<DocumentSection, string> = {
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

// Helper function to build section infos for navigator
function buildSectionInfos(
  letterContent: string,
  editingSection: DocumentSection | null,
  sectionEdits: Map<DocumentSection, string>
): SectionInfo[] {
  const sections: DocumentSection[] = [
    "header",
    "title",
    "story",
    "accounts",
    "personal",
    "closing",
  ];

  return sections.map((id) => {
    const hasContent = letterContent.length > 0;
    let status: SectionStatus = hasContent ? "done" : "empty";
    if (editingSection === id) {
      status = "editing";
    } else if (sectionEdits.has(id)) {
      status = "done";
    }

    return {
      id,
      label: SECTION_LABELS[id],
      status,
      hasContent,
    };
  });
}

// ============================================================================
// Component
// ============================================================================

export function LetterStudio({
  generatedLetter,
  clientName,
  onLaunch,
  launching,
  onDownload,
  downloading,
  onClose,
  onFlowChange,
  onRoundChange,
  onRegenerate,
  onToneChange,
  onFormatChange,
  availableFlows = DEFAULT_FLOWS,
  initialFormat = "STRUCTURED",
}: LetterStudioProps) {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [editingSection, setEditingSection] = useState<DocumentSection | null>(
    null
  );
  const [sectionEdits, setSectionEdits] = useState<Map<DocumentSection, string>>(
    new Map()
  );
  const [isDirty, setIsDirty] = useState(false);
  const [hoveredSection, setHoveredSection] = useState<DocumentSection | null>(
    null
  );
  const [selectedTone, setSelectedTone] = useState(
    generatedLetter?.ameliaMetadata?.tone || "CONCERNED"
  );
  const [selectedFormat, setSelectedFormat] = useState(initialFormat);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  const documentRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // ---------------------------------------------------------------------------
  // Derived State
  // ---------------------------------------------------------------------------
  const cra = generatedLetter?.cra || "TRANSUNION";
  const round = generatedLetter?.round || 1;
  const flow = generatedLetter?.flow || "ACCURACY";
  const craColorClass = CRA_COLORS[cra] || CRA_COLORS.TRANSUNION;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSectionEdit = useCallback(
    (section: DocumentSection, content: string) => {
      setSectionEdits((prev) => {
        const next = new Map(prev);
        next.set(section, content);
        return next;
      });
      setIsDirty(true);
    },
    []
  );

  const handleStartEditing = useCallback((section: DocumentSection) => {
    setEditingSection(section);
  }, []);

  const handleStopEditing = useCallback(() => {
    setEditingSection(null);
  }, []);

  const handleSaveDraft = useCallback(async () => {
    setSavingDraft(true);
    try {
      // Simulate save - in production this would call an API
      await new Promise((resolve) => setTimeout(resolve, 500));
      setDraftSaved(true);
      setIsDirty(false);
      setTimeout(() => setDraftSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save draft:", error);
    } finally {
      setSavingDraft(false);
    }
  }, []);

  const handleToneChange = useCallback(
    (tone: string) => {
      setSelectedTone(tone);
      onToneChange?.(tone);
    },
    [onToneChange]
  );

  const handleFormatChange = useCallback(
    (format: string) => {
      setSelectedFormat(format);
      onFormatChange?.(format);
      // Show toast indicating regeneration may be needed
      toast({
        title: "Format Changed",
        description: `Switched to ${format === "STRUCTURED" ? "Structured" : "Conversational"} format. Regenerate to apply.`,
      });
    },
    [onFormatChange, toast]
  );

  const handleSectionHover = useCallback((section: DocumentSection | null) => {
    setHoveredSection(section);
  }, []);

  // ---------------------------------------------------------------------------
  // PDF Generation
  // ---------------------------------------------------------------------------

  const generatePdf = useCallback(async (content: string): Promise<Uint8Array> => {
    const pdfDoc = await PDFDocument.create();
    const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const timesRomanItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

    const fontSize = 11;
    const lineHeight = 14;
    const margin = 72; // 1 inch margins
    const pageWidth = 612; // Letter size
    const pageHeight = 792;
    const maxWidth = pageWidth - margin * 2;

    // Split content into lines and wrap
    const lines = content.split("\n");
    const wrappedLines: { text: string; bold?: boolean; italic?: boolean; centered?: boolean }[] = [];

    for (const line of lines) {
      if (line.trim() === "") {
        wrappedLines.push({ text: "" });
        continue;
      }

      // Check for title line (centered, bold - usually has ** markers or RE:)
      const isTitle = line.includes("**") || (line.toUpperCase().includes("RE:") && line.length < 80);
      const cleanLine = line.replace(/\*\*/g, "").trim();

      // Check for signature area
      const isSignature =
        cleanLine.toLowerCase().includes("sincerely") ||
        (cleanLine.trim().length > 0 &&
          cleanLine.trim().length < 40 &&
          !cleanLine.includes(":") &&
          !cleanLine.includes(".") &&
          lines.indexOf(line) > lines.length - 10);

      // Check for headers/bold text (ALL CAPS)
      const isBold = isTitle || (cleanLine.toUpperCase() === cleanLine && cleanLine.trim().length > 3 && cleanLine.trim().length < 60);

      // Word wrap
      const words = cleanLine.split(" ");
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const font = isBold ? timesRomanBold : timesRoman;
        const width = font.widthOfTextAtSize(testLine, fontSize);

        if (width > maxWidth && currentLine) {
          wrappedLines.push({ text: currentLine, bold: isBold, italic: isSignature, centered: isTitle });
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        wrappedLines.push({ text: currentLine, bold: isBold, italic: isSignature, centered: isTitle });
      }
    }

    // Create pages and draw text
    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    for (const line of wrappedLines) {
      if (y < margin + lineHeight) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }

      const font = line.bold ? timesRomanBold : line.italic ? timesRomanItalic : timesRoman;

      // Calculate x position (centered or left-aligned)
      let x = margin;
      if (line.centered && line.text) {
        const textWidth = font.widthOfTextAtSize(line.text, fontSize);
        x = (pageWidth - textWidth) / 2;
      }

      page.drawText(line.text, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });

      y -= lineHeight;
    }

    return pdfDoc.save();
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    if (!generatedLetter) return;

    setIsDownloadingPdf(true);
    try {
      const pdfBytes = await generatePdf(generatedLetter.content);
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      // Generate filename
      const clientSlug = clientName?.replace(/\s+/g, "_") || "client";
      const filename = `${clientSlug}_${cra}_R${round}_${flow}.pdf`;

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "PDF Downloaded",
        description: `Saved as ${filename}`,
      });
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      toast({
        title: "Download Failed",
        description: "Could not generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [generatedLetter, generatePdf, clientName, cra, round, flow, toast]);

  const handlePrint = useCallback(() => {
    if (!generatedLetter) return;

    // Create a clean print window with just the letter content
    const printWindow = window.open("", "_blank", "width=800,height=1000");
    if (!printWindow) {
      toast({
        title: "Print Blocked",
        description: "Please allow popups to print the letter.",
        variant: "destructive",
      });
      return;
    }

    // Format the content for printing - convert ** to bold
    const formattedContent = generatedLetter.content
      .split("\n")
      .map((line) => {
        // Handle title lines with **
        if (line.includes("**")) {
          const cleanLine = line.replace(/\*\*/g, "").trim();
          return `<p style="text-align: center; font-weight: bold; text-transform: uppercase; margin: 20px 0;">${cleanLine}</p>`;
        }
        // Empty lines become paragraph breaks
        if (line.trim() === "") {
          return "<br/>";
        }
        return `<p style="margin: 0 0 8px 0; line-height: 1.6;">${line}</p>`;
      })
      .join("\n");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Dispute Letter - ${clientName || "Client"}</title>
        <style>
          @media print {
            @page {
              margin: 1in;
              size: letter;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
          body {
            font-family: "Times New Roman", Times, serif;
            font-size: 11pt;
            line-height: 1.5;
            color: #000;
            background: #fff;
            max-width: 6.5in;
            margin: 0 auto;
            padding: 0.5in;
          }
          p {
            margin: 0 0 8px 0;
          }
        </style>
      </head>
      <body>
        ${formattedContent}
      </body>
      </html>
    `);

    printWindow.document.close();

    // Wait for content to load then print
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };

    toast({
      title: "Print Ready",
      description: "Print dialog opened in new window.",
    });
  }, [generatedLetter, clientName, toast]);

  const handleCopyToClipboard = useCallback(async () => {
    if (!generatedLetter) return;

    try {
      // Clean up the content - remove ** markers for clipboard
      const cleanContent = generatedLetter.content.replace(/\*\*/g, "");
      await navigator.clipboard.writeText(cleanContent);
      toast({
        title: "Copied to Clipboard",
        description: "Letter content copied successfully.",
      });
    } catch (error) {
      console.error("Failed to copy:", error);
      toast({
        title: "Copy Failed",
        description: "Could not copy to clipboard.",
        variant: "destructive",
      });
    }
  }, [generatedLetter, toast]);

  const handleRegenerateFull = useCallback(async () => {
    if (!onRegenerate) return;

    setIsRegenerating(true);
    try {
      await onRegenerate();
      toast({
        title: "Letter Regenerated",
        description: "A new unique letter has been generated.",
      });
    } catch (error) {
      console.error("Failed to regenerate:", error);
      toast({
        title: "Regeneration Failed",
        description: "Could not regenerate letter. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  }, [onRegenerate, toast]);

  // ---------------------------------------------------------------------------
  // Keyboard Shortcuts
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S / Cmd+S: Save draft
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveDraft();
      }

      // Escape: Cancel editing current section
      if (e.key === "Escape" && editingSection) {
        e.preventDefault();
        handleStopEditing();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingSection, handleSaveDraft, handleStopEditing]);

  // ---------------------------------------------------------------------------
  // Sync tone from generated letter
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (generatedLetter?.ameliaMetadata?.tone) {
      setSelectedTone(generatedLetter.ameliaMetadata.tone);
    }
  }, [generatedLetter?.ameliaMetadata?.tone]);

  // ---------------------------------------------------------------------------
  // Loading State
  // ---------------------------------------------------------------------------

  if (!generatedLetter) {
    return (
      <div className="flex flex-col h-screen bg-background items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-muted-foreground text-sm">
          Loading letter...
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* ===================================================================
          Header Bar
      ==================================================================== */}
      <header className="flex-shrink-0 h-16 border-b border-border bg-card px-4 flex items-center justify-between">
        {/* Left side: Back button + Title + Badges */}
        <div className="flex items-center gap-4">
          {/* Back Button */}
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-semibold text-foreground">Letter Studio</span>
          </button>

          {/* Divider */}
          <div className="h-6 w-px bg-border" />

          {/* CRA Badge */}
          <Badge className={cn("border", craColorClass)}>{cra}</Badge>

          {/* Round Badge */}
          <Badge variant="secondary" className="font-mono">
            R{round}
          </Badge>

          {/* Flow Badge */}
          <Badge variant="outline" className="text-muted-foreground">
            {flow}
          </Badge>

          {/* Draft Status */}
          {isDirty && (
            <span className="flex items-center gap-1 text-amber-500 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Draft
            </span>
          )}
        </div>

        {/* Right side: Client name + Actions */}
        <div className="flex items-center gap-3">
          {/* Client Name */}
          {clientName && (
            <span className="text-sm text-muted-foreground">{clientName}</span>
          )}

          {/* Format Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                {FORMAT_OPTIONS.find((f) => f.id === selectedFormat)?.label ||
                  "Format"}
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {FORMAT_OPTIONS.map((format) => (
                <DropdownMenuItem
                  key={format.id}
                  onClick={() => handleFormatChange(format.id)}
                  className={cn(
                    "flex flex-col items-start py-2",
                    selectedFormat === format.id && "bg-accent"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{format.label}</span>
                    {format.recommended && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">
                        Recommended
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground mt-0.5">
                    {format.description}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Tone Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                {TONE_OPTIONS.find((t) => t.id === selectedTone)?.label ||
                  "Tone"}
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {TONE_OPTIONS.map((tone) => (
                <DropdownMenuItem
                  key={tone.id}
                  onClick={() => handleToneChange(tone.id)}
                  className={cn(
                    selectedTone === tone.id && "bg-accent"
                  )}
                >
                  <span className="flex-1">{tone.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {tone.round}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Save Draft Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={savingDraft || !isDirty}
            className="gap-2"
          >
            {savingDraft ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : draftSaved ? (
              <Check className="w-4 h-4 text-emerald-500" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {draftSaved ? "Saved" : "Save Draft"}
          </Button>

          {/* Launch Round Button */}
          <Button
            size="sm"
            onClick={onLaunch}
            disabled={launching}
            className="gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400"
          >
            {launching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Rocket className="w-4 h-4" />
            )}
            Launch Round {round}
          </Button>
        </div>
      </header>

      {/* ===================================================================
          Main Content Area
      ==================================================================== */}
      <div className="flex-1 overflow-hidden flex">
        {/* Document Area (65%) */}
        <div
          ref={documentRef}
          className="flex-[0.65] overflow-auto p-8 bg-muted/30"
        >
          <LetterDocument
            letterContent={generatedLetter.content}
            cra={cra}
            clientName={clientName || ""}
            editingSection={editingSection}
            sectionEdits={sectionEdits}
            onSectionClick={handleStartEditing}
            onSectionEdit={handleSectionEdit}
            onSectionSave={handleStopEditing}
            onSectionCancel={handleStopEditing}
            hoveredSection={hoveredSection}
            onHoverSection={handleSectionHover}
            letterDate={generatedLetter.ameliaMetadata?.letterDate}
            isBackdated={generatedLetter.ameliaMetadata?.isBackdated}
            backdatedDays={generatedLetter.ameliaMetadata?.backdatedDays}
          />
        </div>

        {/* Amelia Panel (35%) */}
        <div className="flex-[0.35] border-l border-border overflow-auto">
          <AmeliaPanel
            editingSection={editingSection as AmeliaPanelDocumentSection | null}
            letterContent={generatedLetter.content}
            cra={cra}
            round={round}
            flow={flow}
            tone={selectedTone}
            onRegenerate={handleRegenerateFull}
            onToneChange={handleToneChange}
            onRegenerateFullLetter={handleRegenerateFull}
            onCopyToClipboard={handleCopyToClipboard}
            onDownloadPDF={handleDownloadPdf}
            onPrint={handlePrint}
            onSendMail={() => {
              // TODO: Integrate with DocuPost
              toast({
                title: "Coming Soon",
                description: "DocuPost integration will be available soon.",
              });
            }}
            isRegenerating={isRegenerating}
            kitchenTableScore={92}
            eoscarRisk="LOW"
            uniquenessScore={98}
            humanScore={94}
          />
        </div>
      </div>

      {/* ===================================================================
          Section Navigator
      ==================================================================== */}
      <SectionNavigator
        sections={buildSectionInfos(generatedLetter.content, editingSection, sectionEdits)}
        activeSection={editingSection}
        onNavigate={handleStartEditing}
      />
    </div>
  );
}
