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
  availableFlows?: { id: string; label: string }[];
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
  availableFlows = DEFAULT_FLOWS,
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
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  const documentRef = useRef<HTMLDivElement>(null);

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

  const handleSectionHover = useCallback((section: DocumentSection | null) => {
    setHoveredSection(section);
  }, []);

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
            onRegenerate={async () => {
              if (onRegenerate) await onRegenerate();
            }}
            onToneChange={handleToneChange}
            onRegenerateFullLetter={async () => {
              if (onRegenerate) await onRegenerate();
            }}
            onCopyToClipboard={() => {
              navigator.clipboard.writeText(generatedLetter.content);
            }}
            onDownloadPDF={onDownload}
            onPrint={() => window.print()}
            onSendMail={() => {
              // TODO: Integrate with DocuPost
            }}
            isRegenerating={false}
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
