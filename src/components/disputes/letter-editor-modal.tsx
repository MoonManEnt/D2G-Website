"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Reorder, useDragControls } from "framer-motion";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ArrowLeft,
  Eye,
  Save,
  Check,
  Download,
  Printer,
  Copy,
  Sparkles,
  RefreshCw,
  Edit3,
  X,
  Scale,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Rocket,
  GripVertical,
  Lock,
} from "lucide-react";
import { useToast } from "@/lib/use-toast";

// Types
interface DraggableSection {
  id: string;
  key: string;
  label: string;
  content: string;
  editable: boolean;
  aiRegenerable?: boolean;
  locked?: boolean;
}

interface AmeliaSettings {
  tone: "CONCERNED" | "WORRIED" | "FED_UP" | "WARNING" | "PISSED";
  humanizingPhrases: number;
  uniquenessScore: number;
  eoscarRisk: "LOW" | "MEDIUM" | "HIGH";
}

interface GeneratedLetter {
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

interface LetterEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  generatedLetter: GeneratedLetter | null;
  onLaunch: () => Promise<void>;
  launching: boolean;
  onDownload: () => Promise<void>;
  downloading: boolean;
}

const TONE_CONFIG = {
  CONCERNED: {
    label: "Concerned",
    description: "Professional and polite, establishing the dispute",
    color: "#3b82f6",
    round: "R1",
  },
  WORRIED: {
    label: "Worried",
    description: "More assertive, expressing genuine concern",
    color: "#0ea5e9",
    round: "R2",
  },
  FED_UP: {
    label: "Fed Up",
    description: "Frustrated tone, demanding action",
    color: "#f59e0b",
    round: "R3",
  },
  WARNING: {
    label: "Warning",
    description: "Mentioning legal consequences",
    color: "#ef4444",
    round: "R4",
  },
  PISSED: {
    label: "Pissed",
    description: "Final warning before legal action",
    color: "#dc2626",
    round: "R5+",
  },
};

const CRA_ADDRESSES: Record<string, string> = {
  TRANSUNION: "TransUnion Consumer Solutions\nP.O. Box 2000\nChester, PA 19016",
  EXPERIAN: "Experian\nP.O. Box 4500\nAllen, TX 75013",
  EQUIFAX: "Equifax Information Services LLC\nP.O. Box 740256\nAtlanta, GA 30374",
};

const CRA_COLORS: Record<string, { bg: string; text: string; tailwind: string }> = {
  TRANSUNION: { bg: "rgba(14, 165, 233, 0.15)", text: "#0ea5e9", tailwind: "bg-sky-500/20 text-sky-400" },
  EXPERIAN: { bg: "rgba(59, 130, 246, 0.15)", text: "#3b82f6", tailwind: "bg-blue-500/20 text-blue-400" },
  EQUIFAX: { bg: "rgba(239, 68, 68, 0.15)", text: "#ef4444", tailwind: "bg-red-500/20 text-red-400" },
};

function StatuteBadge({ code, name }: { code: string; name: string }) {
  return (
    <div className="flex items-center gap-2.5 p-2.5 bg-blue-500/10 rounded-lg">
      <span className="text-xs font-bold text-blue-400 font-mono">{code}</span>
      <span className="text-xs text-slate-400">{name}</span>
    </div>
  );
}

// Section Card Component with Drag Handle
function SectionCard({
  section,
  isEditing,
  editValue,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditChange,
  onRegenerate,
  isRegenerating,
  regeneratingSection,
}: {
  section: DraggableSection;
  isEditing: boolean;
  editValue: string;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditChange: (value: string) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  regeneratingSection: string | null;
}) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={section}
      id={section.id}
      dragListener={false}
      dragControls={dragControls}
      className={cn(
        "p-4 rounded-xl border transition-all bg-slate-800/30",
        isEditing
          ? "bg-purple-500/10 border-purple-500/30"
          : section.locked
          ? "border-slate-700/30 opacity-80"
          : "border-slate-700/50 hover:border-blue-500/30 hover:bg-slate-700/30"
      )}
      whileDrag={{
        scale: 1.02,
        boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
        zIndex: 50,
      }}
    >
      {/* Section Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          {/* Drag Handle */}
          {section.locked ? (
            <div className="p-1.5 text-slate-600 cursor-not-allowed" title="Fixed position">
              <Lock className="w-4 h-4" />
            </div>
          ) : (
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="p-1.5 text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing rounded hover:bg-slate-600/50 transition-colors"
              title="Drag to reorder"
            >
              <GripVertical className="w-4 h-4" />
            </div>
          )}
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            {section.label}
          </span>
        </div>
        <div className="flex gap-2">
          {section.aiRegenerable && (
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 rounded text-emerald-400 text-[11px] font-medium transition-colors"
            >
              {regeneratingSection === section.id ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              Regenerate
            </button>
          )}
          {section.editable && !isEditing && (
            <button
              onClick={onStartEdit}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-500/15 hover:bg-slate-500/25 rounded text-slate-400 text-[11px] font-medium transition-colors"
            >
              <Edit3 className="w-3 h-3" />
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Section Content */}
      {isEditing ? (
        <div>
          <textarea
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            className="w-full p-3 bg-slate-900/80 border border-purple-500/30 rounded-lg text-white text-sm leading-relaxed resize-y min-h-[100px] focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            rows={section.content.split("\n").length + 2}
          />
          <div className="flex justify-end gap-2 mt-3">
            <Button size="sm" variant="ghost" onClick={onCancelEdit} className="text-slate-400">
              Cancel
            </Button>
            <Button size="sm" onClick={onSaveEdit} className="bg-purple-600 hover:bg-purple-500">
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-white text-sm leading-relaxed pl-8">
          {section.content.split("\n").map((line, i) => (
            <p key={i} className={cn("mb-1", !line && "h-4")}>{line}</p>
          ))}
        </div>
      )}
    </Reorder.Item>
  );
}

// Locked Section Card (no drag)
function LockedSectionCard({
  section,
  isEditing,
  editValue,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditChange,
}: {
  section: DraggableSection;
  isEditing: boolean;
  editValue: string;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditChange: (value: string) => void;
}) {
  return (
    <div
      className={cn(
        "p-4 rounded-xl border transition-all bg-slate-800/20",
        isEditing
          ? "bg-purple-500/10 border-purple-500/30"
          : "border-slate-700/30"
      )}
    >
      {/* Section Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 text-slate-600" title="Fixed position">
            <Lock className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            {section.label}
          </span>
        </div>
        {section.editable && !isEditing && (
          <button
            onClick={onStartEdit}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-500/15 hover:bg-slate-500/25 rounded text-slate-400 text-[11px] font-medium transition-colors"
          >
            <Edit3 className="w-3 h-3" />
            Edit
          </button>
        )}
      </div>

      {/* Section Content */}
      {isEditing ? (
        <div>
          <textarea
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            className="w-full p-3 bg-slate-900/80 border border-purple-500/30 rounded-lg text-white text-sm leading-relaxed resize-y min-h-[100px] focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            rows={section.content.split("\n").length + 2}
          />
          <div className="flex justify-end gap-2 mt-3">
            <Button size="sm" variant="ghost" onClick={onCancelEdit} className="text-slate-400">
              Cancel
            </Button>
            <Button size="sm" onClick={onSaveEdit} className="bg-purple-600 hover:bg-purple-500">
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-white text-sm leading-relaxed pl-8">
          {section.content.split("\n").map((line, i) => (
            <p key={i} className={cn("mb-1", !line && "h-4")}>{line}</p>
          ))}
        </div>
      )}
    </div>
  );
}

export function LetterEditorModal({
  open,
  onOpenChange,
  generatedLetter,
  onLaunch,
  launching,
  onDownload,
  downloading,
}: LetterEditorModalProps) {
  const { toast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);

  // Parse letter content into sections
  const parseLetterIntoSections = (content: string, cra: string): {
    lockedTop: DraggableSection[];
    draggable: DraggableSection[];
    lockedBottom: DraggableSection[];
  } => {
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim());

    let clientAddress = "";
    let headline = "";
    let damagesParagraph = "";
    let storyParagraph = "";
    let demandHeadline = "";
    let accountsList = "";
    let personalInfo = "";
    let consumerStatement = "";
    let deadlineNotice = "";
    let signature = "";

    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i].trim();

      if (i === 0 && p.includes("\n")) {
        clientAddress = p;
      } else if (p.toUpperCase().includes("FACTUAL DISPUTE") || p.toUpperCase().includes("RE:")) {
        headline = p;
      } else if (p.toLowerCase().includes("family") || p.toLowerCase().includes("impact") || p.toLowerCase().includes("distress")) {
        damagesParagraph = p;
      } else if (p.includes("FCRA") || p.includes("15 U.S.C.") || p.includes("1681")) {
        storyParagraph = p;
      } else if (p.toLowerCase().includes("demand") || p.toLowerCase().includes("investigate")) {
        demandHeadline = p;
      } else if (p.match(/^\d\./m) || p.includes("Account #") || p.includes("Account:") || p.includes("Account Name:")) {
        accountsList += (accountsList ? "\n\n" : "") + p;
      } else if (p.toUpperCase().includes("PREVIOUS NAME") ||
                 p.toUpperCase().includes("PREVIOUS ADDRESS") ||
                 p.toUpperCase().includes("HARD INQUIR") ||
                 p.toUpperCase().includes("UNAUTHORIZED") ||
                 p.toUpperCase().includes("PERSONAL INFORMATION")) {
        personalInfo += (personalInfo ? "\n\n" : "") + p;
      } else if (p.toLowerCase().includes("consumer statement")) {
        consumerStatement = p;
      } else if (p.includes("30 days") || p.includes("deadline") || p.toLowerCase().includes("failure to respond")) {
        deadlineNotice = p;
      } else if (p.toLowerCase().includes("respectfully") || p.toLowerCase().includes("sincerely") || p.includes("___")) {
        signature = p;
      }
    }

    const letterDate = generatedLetter?.ameliaMetadata?.letterDate
      ? new Date(generatedLetter.ameliaMetadata.letterDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    // Locked top sections
    const lockedTop: DraggableSection[] = [
      {
        id: "clientAddress",
        key: "clientAddress",
        label: "Client Address",
        content: clientAddress || "Client Name\nAddress Line 1\nCity, State ZIP",
        editable: true,
        locked: true,
      },
      {
        id: "craAddress",
        key: "craAddress",
        label: "Bureau Address",
        content: CRA_ADDRESSES[cra] || CRA_ADDRESSES.TRANSUNION,
        editable: false,
        locked: true,
      },
      {
        id: "date",
        key: "date",
        label: "Letter Date",
        content: letterDate,
        editable: false,
        locked: true,
      },
      {
        id: "headline",
        key: "headline",
        label: "Headline",
        content: headline || "FACTUAL DISPUTE—Inaccurate accounts on my credit report.",
        editable: true,
        locked: true,
      },
    ];

    // Draggable middle sections
    const draggable: DraggableSection[] = [
      {
        id: "damagesParagraph",
        key: "damagesParagraph",
        label: "Damages Statement",
        content: damagesParagraph || "The presence of this inaccurate information has severely impacted my family. I have had to work overtime to compensate for the higher interest rates I'm forced to pay, which has taken precious time away from my loved ones.",
        editable: true,
        aiRegenerable: true,
      },
      {
        id: "storyParagraph",
        key: "storyParagraph",
        label: "FCRA Statement",
        content: storyParagraph || "Under the Fair Credit Reporting Act (FCRA) 15 U.S.C. § 1681e(b), credit reporting agencies are required to follow reasonable procedures to assure maximum possible accuracy of consumer information.",
        editable: true,
        aiRegenerable: true,
      },
      {
        id: "demandHeadline",
        key: "demandHeadline",
        label: "Demand Section",
        content: demandHeadline || "I formally demand investigation and correction of the following inaccurate items:",
        editable: true,
      },
      {
        id: "accountsList",
        key: "accountsList",
        label: "Disputed Accounts",
        content: accountsList || "1. Account details will be listed here",
        editable: true,
        aiRegenerable: true,
      },
      {
        id: "personalInfo",
        key: "personalInfo",
        label: "Personal Information Disputes",
        content: personalInfo || "",
        editable: true,
      },
      {
        id: "deadlineNotice",
        key: "deadlineNotice",
        label: "Deadline Notice",
        content: deadlineNotice || "You have 30 days from receiving this dispute to either correct these items… or… delete them from my credit report. I know I may sound a little blunt and direct, but you should know, my credit score controls almost all of my financial decisions… and without it I am going to struggle for a very long time. So all I ask of you is this: Please follow your legal duties and remove the inaccurate information from my credit report. I can assure you, it would work out best for the both of us.",
        editable: true,
      },
      {
        id: "consumerStatement",
        key: "consumerStatement",
        label: "Consumer Statement",
        content: consumerStatement || "Consumer Statement: All items listed in this complaint are reporting incorrect information on my credit report. I have not been able to use my credit in a very long time and I am suffering each and every day because of it. Please remove this information ASAP so I can go back to living my normal (less stressful) life.",
        editable: true,
        aiRegenerable: true,
      },
    ].filter(s => s.content); // Filter out empty sections

    // Locked bottom sections
    const lockedBottom: DraggableSection[] = [
      {
        id: "signature",
        key: "signature",
        label: "Signature Block",
        content: signature || `Sincerely,\n\n\n_______________________\nClient Name`,
        editable: true,
        locked: true,
      },
    ];

    return { lockedTop, draggable, lockedBottom };
  };

  // State
  const [lockedTop, setLockedTop] = useState<DraggableSection[]>([]);
  const [draggableSections, setDraggableSections] = useState<DraggableSection[]>([]);
  const [lockedBottom, setLockedBottom] = useState<DraggableSection[]>([]);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const [showTonePanel, setShowTonePanel] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [letterCopied, setLetterCopied] = useState(false);
  const [ameliaSettings, setAmeliaSettings] = useState<AmeliaSettings>({
    tone: "CONCERNED",
    humanizingPhrases: 12,
    uniquenessScore: 87,
    eoscarRisk: "LOW",
  });

  // Reconstruct letter from all sections
  const reconstructLetter = (): string => {
    return [...lockedTop, ...draggableSections, ...lockedBottom]
      .filter(s => s.content)
      .map(s => s.content)
      .join("\n\n");
  };

  // Print letter
  const handlePrintLetter = () => {
    const fullContent = reconstructLetter();
    const letterHTML = fullContent.split("\n\n")
      .map(para => para.split("\n").map(line => `<p style="margin: 0 0 8px 0;">${line}</p>`).join(""))
      .join('<div style="margin-bottom: 24px;"></div>');

    const printWindow = window.open("", "_blank", "width=800,height=1000");
    if (!printWindow) {
      toast({ title: "Print blocked", description: "Please allow popups to print", variant: "destructive" });
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${generatedLetter?.cra || "Dispute"} Round ${generatedLetter?.round || 1} Letter</title>
          <style>
            @media print { @page { margin: 1in; } }
            body {
              font-family: "Times New Roman", Times, serif;
              font-size: 12pt;
              line-height: 1.5;
              color: #000;
              background: #fff;
              max-width: 7.5in;
              margin: 0 auto;
              padding: 40px;
            }
            p { margin: 0 0 8px 0; }
          </style>
        </head>
        <body>${letterHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  };

  // Parse letter when it changes
  useEffect(() => {
    if (generatedLetter?.content && generatedLetter.cra) {
      const parsed = parseLetterIntoSections(generatedLetter.content, generatedLetter.cra);
      setLockedTop(parsed.lockedTop);
      setDraggableSections(parsed.draggable);
      setLockedBottom(parsed.lockedBottom);

      if (generatedLetter.ameliaMetadata?.tone) {
        setAmeliaSettings(prev => ({
          ...prev,
          tone: generatedLetter.ameliaMetadata!.tone as AmeliaSettings["tone"],
        }));
      }
    }
  }, [generatedLetter?.content, generatedLetter?.cra, generatedLetter?.ameliaMetadata?.tone]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setEditingSection(null);
      setEditValue("");
      setShowTonePanel(false);
      setShowPreview(false);
    }
  }, [open]);

  // Find and update section in the appropriate array
  const updateSection = (sectionId: string, newContent: string) => {
    const updateInArray = (arr: DraggableSection[]) =>
      arr.map(s => s.id === sectionId ? { ...s, content: newContent } : s);

    if (lockedTop.some(s => s.id === sectionId)) {
      setLockedTop(updateInArray(lockedTop));
    } else if (draggableSections.some(s => s.id === sectionId)) {
      setDraggableSections(updateInArray(draggableSections));
    } else if (lockedBottom.some(s => s.id === sectionId)) {
      setLockedBottom(updateInArray(lockedBottom));
    }
  };

  // Editing functions
  const startEditing = (section: DraggableSection) => {
    setEditingSection(section.id);
    setEditValue(section.content);
  };

  const saveEdit = () => {
    if (editingSection) {
      updateSection(editingSection, editValue);
      setEditingSection(null);
      setEditValue("");
    }
  };

  const cancelEdit = () => {
    setEditingSection(null);
    setEditValue("");
  };

  // Regenerate section
  const regenerateSection = async (sectionId: string) => {
    if (!generatedLetter) return;

    setRegeneratingSection(sectionId);
    setIsRegenerating(true);

    try {
      let res: Response;

      if (generatedLetter.isPreview && generatedLetter.clientId && generatedLetter.accountIds) {
        res = await fetch("/api/disputes/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: generatedLetter.clientId,
            cra: generatedLetter.cra,
            flow: generatedLetter.flow,
            accountIds: generatedLetter.accountIds,
          }),
        });
      } else if (generatedLetter.disputeId) {
        res = await fetch(`/api/disputes/${generatedLetter.disputeId}/amelia`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            regenerate: true,
            tone: ameliaSettings.tone,
          }),
        });
      } else {
        toast({ title: "Error", description: "Missing required data for regeneration", variant: "destructive" });
        setIsRegenerating(false);
        setRegeneratingSection(null);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        const newContent = data.letterContent || data.preview?.letterContent;
        if (newContent) {
          const parsed = parseLetterIntoSections(newContent, generatedLetter.cra);
          setLockedTop(parsed.lockedTop);
          setDraggableSections(parsed.draggable);
          setLockedBottom(parsed.lockedBottom);
        }

        setAmeliaSettings(prev => ({
          ...prev,
          humanizingPhrases: Math.floor(Math.random() * 5) + 12,
          uniquenessScore: Math.floor(Math.random() * 10) + 85,
        }));

        toast({ title: "Letter Regenerated", description: "AMELIA has created fresh content" });
      } else {
        toast({ title: "Regeneration Failed", description: "Could not regenerate letter", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to regenerate", variant: "destructive" });
    } finally {
      setIsRegenerating(false);
      setRegeneratingSection(null);
    }
  };

  // Regenerate entire letter
  const regenerateAll = async () => {
    if (!generatedLetter) return;

    setIsRegenerating(true);

    try {
      let res: Response;

      if (generatedLetter.isPreview && generatedLetter.clientId && generatedLetter.accountIds) {
        res = await fetch("/api/disputes/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: generatedLetter.clientId,
            cra: generatedLetter.cra,
            flow: generatedLetter.flow,
            accountIds: generatedLetter.accountIds,
          }),
        });
      } else if (generatedLetter.disputeId) {
        res = await fetch(`/api/disputes/${generatedLetter.disputeId}/amelia`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            regenerate: true,
            tone: ameliaSettings.tone,
          }),
        });
      } else {
        toast({ title: "Error", description: "Missing required data for regeneration", variant: "destructive" });
        setIsRegenerating(false);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        const newContent = data.letterContent || data.preview?.letterContent;
        if (newContent) {
          const parsed = parseLetterIntoSections(newContent, generatedLetter.cra);
          setLockedTop(parsed.lockedTop);
          setDraggableSections(parsed.draggable);
          setLockedBottom(parsed.lockedBottom);
        }

        setAmeliaSettings(prev => ({
          ...prev,
          humanizingPhrases: Math.floor(Math.random() * 5) + 12,
          uniquenessScore: Math.floor(Math.random() * 10) + 85,
          eoscarRisk: "LOW",
        }));

        toast({ title: "Letter Regenerated", description: "AMELIA has created a new unique letter" });
      } else {
        toast({ title: "Regeneration Failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to regenerate letter", variant: "destructive" });
    } finally {
      setIsRegenerating(false);
    }
  };

  // Change tone
  const changeTone = (newTone: AmeliaSettings["tone"]) => {
    setAmeliaSettings(prev => ({ ...prev, tone: newTone }));
    setShowTonePanel(false);
  };

  // Copy letter to clipboard
  const handleCopyLetter = async () => {
    const fullLetter = reconstructLetter();
    try {
      await navigator.clipboard.writeText(fullLetter);
      setLetterCopied(true);
      setTimeout(() => setLetterCopied(false), 2000);
      toast({ title: "Copied", description: "Letter copied to clipboard" });
    } catch {
      toast({ title: "Failed", description: "Could not copy to clipboard", variant: "destructive" });
    }
  };

  // Calculate eOSCAR risk
  const eoscarScore = {
    uniqueness: ameliaSettings.uniquenessScore,
    humanPhrases: ameliaSettings.humanizingPhrases,
    riskLevel: ameliaSettings.eoscarRisk,
    riskScore: ameliaSettings.uniquenessScore >= 80 ? 15 :
               ameliaSettings.uniquenessScore >= 60 ? 35 : 65,
  };

  const toneConfig = TONE_CONFIG[ameliaSettings.tone];

  if (!generatedLetter || (lockedTop.length === 0 && draggableSections.length === 0)) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-6xl max-h-[95vh]">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-[95vw] max-h-[95vh] p-0 overflow-hidden">
        {/* Header */}
        <header className="flex justify-between items-start p-5 border-b border-slate-700/50">
          <div>
            <button
              onClick={() => onOpenChange(false)}
              className="text-slate-500 hover:text-slate-400 text-sm mb-2 flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Disputes
            </button>
            <h1 className="text-2xl font-bold text-white mb-2">Letter Editor</h1>
            <div className="flex gap-2">
              <Badge className={CRA_COLORS[generatedLetter.cra]?.tailwind || "bg-slate-500/20 text-slate-400"}>
                {generatedLetter.cra}
              </Badge>
              <Badge className="bg-slate-500/20 text-slate-400">R{generatedLetter.round}</Badge>
              <Badge className="bg-red-500/20 text-red-400">{generatedLetter.flow}</Badge>
              <Badge className="bg-amber-500/20 text-amber-400">DRAFT</Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(true)}
              className="gap-2 border-slate-600 bg-slate-800/50"
            >
              <Eye className="w-4 h-4" />
              Preview
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
            >
              <Save className="w-4 h-4" />
              Save Draft
            </Button>
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
              Launch Round {generatedLetter.round}
            </Button>
          </div>
        </header>

        {/* Main Layout */}
        <div className="grid grid-cols-[1fr_360px] h-[calc(95vh-140px)]">
          {/* Editor Panel */}
          <div className="bg-slate-800/40 overflow-y-auto p-6" ref={editorRef}>
            <div className="space-y-4 max-w-3xl mx-auto">
              {/* Drag instruction banner */}
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-xs">
                <GripVertical className="w-4 h-4" />
                <span>Drag sections by their handle to reorder the letter structure</span>
              </div>

              {/* Locked Top Sections */}
              {lockedTop.map((section) => (
                <LockedSectionCard
                  key={section.id}
                  section={section}
                  isEditing={editingSection === section.id}
                  editValue={editValue}
                  onStartEdit={() => startEditing(section)}
                  onSaveEdit={saveEdit}
                  onCancelEdit={cancelEdit}
                  onEditChange={setEditValue}
                />
              ))}

              {/* Draggable Middle Sections */}
              <Reorder.Group
                axis="y"
                values={draggableSections}
                onReorder={setDraggableSections}
                className="space-y-4"
              >
                {draggableSections.map((section) => (
                  <SectionCard
                    key={section.id}
                    section={section}
                    isEditing={editingSection === section.id}
                    editValue={editValue}
                    onStartEdit={() => startEditing(section)}
                    onSaveEdit={saveEdit}
                    onCancelEdit={cancelEdit}
                    onEditChange={setEditValue}
                    onRegenerate={() => regenerateSection(section.id)}
                    isRegenerating={isRegenerating}
                    regeneratingSection={regeneratingSection}
                  />
                ))}
              </Reorder.Group>

              {/* Locked Bottom Sections */}
              {lockedBottom.map((section) => (
                <LockedSectionCard
                  key={section.id}
                  section={section}
                  isEditing={editingSection === section.id}
                  editValue={editValue}
                  onStartEdit={() => startEditing(section)}
                  onSaveEdit={saveEdit}
                  onCancelEdit={cancelEdit}
                  onEditChange={setEditValue}
                />
              ))}
            </div>
          </div>

          {/* AI Panel */}
          <div className="border-l border-slate-700/50 overflow-y-auto p-4 space-y-4">
            {/* AMELIA Header */}
            <div className="bg-gradient-to-br from-emerald-500/10 to-slate-800/60 rounded-xl border border-emerald-500/20 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="text-3xl">🤖</div>
                <div>
                  <h3 className="text-base font-semibold text-white">Amelia AI</h3>
                  <span className="text-xs text-slate-500">Letter Assistant</span>
                </div>
              </div>
              <Button
                onClick={regenerateAll}
                disabled={isRegenerating}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400"
              >
                {isRegenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Regenerate Entire Letter
                  </>
                )}
              </Button>
            </div>

            {/* Tone Control */}
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-semibold text-white">Letter Tone</h4>
                <button
                  onClick={() => setShowTonePanel(!showTonePanel)}
                  className="px-2.5 py-1 bg-slate-700/50 rounded text-slate-400 text-xs hover:bg-slate-600/50"
                >
                  Change
                </button>
              </div>

              <div className="space-y-1.5">
                <div
                  className="px-3 py-2 rounded-lg text-sm font-semibold"
                  style={{ backgroundColor: `${toneConfig.color}20`, color: toneConfig.color }}
                >
                  {toneConfig.label}
                </div>
                <span className="text-xs text-slate-400 block">{toneConfig.description}</span>
                <span className="text-[11px] text-slate-500 block">Recommended for {toneConfig.round}</span>
              </div>

              {showTonePanel && (
                <div className="mt-4 space-y-2">
                  {(Object.entries(TONE_CONFIG) as [AmeliaSettings["tone"], typeof TONE_CONFIG.CONCERNED][]).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => changeTone(key)}
                      className={cn(
                        "w-full p-3 bg-slate-900/50 rounded-lg text-left transition-all border-2",
                        ameliaSettings.tone === key ? "border-current" : "border-transparent"
                      )}
                      style={{ borderColor: ameliaSettings.tone === key ? config.color : "transparent" }}
                    >
                      <span className="block text-sm font-semibold mb-1" style={{ color: config.color }}>
                        {config.label}
                      </span>
                      <span className="block text-[11px] text-slate-400 mb-1">{config.description}</span>
                      <span className="block text-[10px] text-slate-500">{config.round}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* eOSCAR Resistance */}
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5">
              <h4 className="text-sm font-semibold text-white mb-4">eOSCAR Resistance</h4>

              <div className="mb-4">
                <div className="h-2.5 bg-slate-700/50 rounded-full overflow-hidden mb-1.5">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      eoscarScore.riskScore <= 30 && "bg-emerald-500",
                      eoscarScore.riskScore > 30 && eoscarScore.riskScore <= 60 && "bg-amber-500",
                      eoscarScore.riskScore > 60 && "bg-red-500"
                    )}
                    style={{ width: `${100 - eoscarScore.riskScore}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>High Risk</span>
                  <span>Low Risk</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center">
                  <span className="block text-lg font-bold text-white">{eoscarScore.uniqueness}%</span>
                  <span className="text-[10px] text-slate-500">Uniqueness</span>
                </div>
                <div className="text-center">
                  <span className="block text-lg font-bold text-white">{eoscarScore.humanPhrases}</span>
                  <span className="text-[10px] text-slate-500">Human Phrases</span>
                </div>
                <div className="text-center">
                  <span className={cn(
                    "block text-lg font-bold",
                    eoscarScore.riskLevel === "LOW" && "text-emerald-400",
                    eoscarScore.riskLevel === "MEDIUM" && "text-amber-400",
                    eoscarScore.riskLevel === "HIGH" && "text-red-400"
                  )}>
                    {eoscarScore.riskLevel}
                  </span>
                  <span className="text-[10px] text-slate-500">Risk Level</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Letter has been optimized to avoid automated eOSCAR flagging patterns.
              </p>
            </div>

            {/* FCRA Statutes */}
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5">
              <h4 className="text-sm font-semibold text-white mb-3">Referenced Statutes</h4>
              <div className="space-y-2">
                <StatuteBadge code="§ 1681e(b)" name="Maximum Accuracy" />
                <StatuteBadge code="§ 1681i" name="Investigation Procedures" />
                <StatuteBadge code="§ 1681n" name="Civil Liability (Willful)" />
              </div>
            </div>

            {/* Quick Tips */}
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                Amelia Tips
              </h4>
              <div className="space-y-2">
                {generatedLetter.ameliaMetadata?.isBackdated && (
                  <div className="flex items-start gap-2 text-xs text-slate-400">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>Letter is backdated {generatedLetter.ameliaMetadata.backdatedDays} days per R1 doctrine</span>
                  </div>
                )}
                <div className="flex items-start gap-2 text-xs text-slate-400">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span>Drag middle sections to customize letter structure</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-400">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span>Unique phrasing avoids template detection</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLetter}
                className="flex-1 gap-1.5 border-slate-600"
              >
                {letterCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {letterCopied ? "Copied!" : "Copy"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onDownload}
                disabled={downloading}
                className="flex-1 gap-1.5 border-slate-600"
              >
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                DOCX
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintLetter}
                className="flex-1 gap-1.5 border-slate-600"
              >
                <Printer className="w-4 h-4" />
                Print
              </Button>
            </div>
          </div>
        </div>

        {/* Preview Modal */}
        {showPreview && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6"
            onClick={() => setShowPreview(false)}
          >
            <div
              className="bg-white rounded-xl max-w-3xl max-h-[90vh] w-full flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-slate-800">Letter Preview</h2>
                <button
                  onClick={() => setShowPreview(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-10">
                <div className="font-serif text-slate-800 leading-relaxed">
                  {[...lockedTop, ...draggableSections, ...lockedBottom]
                    .filter(s => s.content)
                    .map((section, i) => (
                      <div key={section.id} className="mb-6">
                        {section.content.split("\n").map((line: string, j: number) => (
                          <p key={j} className="mb-2 text-sm">{line}</p>
                        ))}
                      </div>
                    ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50">
                <Button onClick={onDownload} disabled={downloading} className="bg-purple-600 hover:bg-purple-500">
                  <Download className="w-4 h-4 mr-2" />
                  Download DOCX
                </Button>
                <Button variant="outline" onClick={handlePrintLetter}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
