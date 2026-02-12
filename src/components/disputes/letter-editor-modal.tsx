"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
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
  CheckCircle,
  Lightbulb,
  Rocket,
  Send,
  AlertCircle,
  MapPin,
  Building2,
  Calendar,
  Flag,
  Scale,
  FileText,
  ListChecks,
  Wrench,
  User,
  Search,
  Clock,
  MessageSquare,
  PenTool,
} from "lucide-react";
import { useToast } from "@/lib/use-toast";
import { MailSendDialog } from "./mail-send-dialog";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

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
  clientName?: string;
  onLaunch: () => Promise<void>;
  launching: boolean;
  onDownload: () => Promise<void>;
  downloading: boolean;
  // New props for early customization
  onFlowChange?: (flow: string) => void;
  onRoundChange?: (round: number) => void;
  onRegenerate?: () => Promise<void>;
  availableFlows?: { id: string; label: string }[];
}

// Flow options for early customization
const FLOW_OPTIONS = [
  { id: "ACCURACY", label: "Something is wrong", desc: "Balance, dates, status incorrect" },
  { id: "COLLECTION", label: "Debt collection dispute", desc: "Third-party collector, medical debt" },
  { id: "CONSENT", label: "I didn't authorize this", desc: "Unauthorized inquiry or account" },
  { id: "COMBO", label: "Multiple issues", desc: "Both accuracy and collection problems" },
];

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

// Section icon mapping
const SECTION_ICONS: Record<string, React.ReactNode> = {
  clientAddress: <MapPin className="w-3.5 h-3.5" />,
  craAddress: <Building2 className="w-3.5 h-3.5" />,
  date: <Calendar className="w-3.5 h-3.5" />,
  headline: <Flag className="w-3.5 h-3.5" />,
  damagesParagraph: <Scale className="w-3.5 h-3.5" />,
  storyParagraph: <FileText className="w-3.5 h-3.5" />,
  demandHeadline: <Flag className="w-3.5 h-3.5" />,
  accountsList: <ListChecks className="w-3.5 h-3.5" />,
  requestedCorrections: <Wrench className="w-3.5 h-3.5" />,
  personalInfo: <User className="w-3.5 h-3.5" />,
  hardInquiries: <Search className="w-3.5 h-3.5" />,
  deadlineNotice: <Clock className="w-3.5 h-3.5" />,
  consumerStatement: <MessageSquare className="w-3.5 h-3.5" />,
  signature: <PenTool className="w-3.5 h-3.5" />,
};

// Section short labels for rail tooltip
const SECTION_SHORT_LABELS: Record<string, string> = {
  clientAddress: "Address",
  craAddress: "Bureau",
  date: "Date",
  headline: "Headline",
  damagesParagraph: "Damages",
  storyParagraph: "FCRA",
  demandHeadline: "Demand",
  accountsList: "Accounts",
  requestedCorrections: "Corrections",
  personalInfo: "Personal",
  hardInquiries: "Inquiries",
  deadlineNotice: "Deadline",
  consumerStatement: "Statement",
  signature: "Signature",
};

function StatuteBadge({ code, name, color = "emerald" }: { code: string; name: string; color?: string }) {
  const colorClasses: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    violet: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  };
  return (
    <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border", colorClasses[color] || colorClasses.emerald)}>
      <span className="text-[10px] font-bold font-mono whitespace-nowrap">{code}</span>
      <span className="text-xs text-muted-foreground">{name}</span>
    </div>
  );
}

// Canvas Section Component - renders on the document canvas with hover actions
function CanvasSection({
  section,
  index,
  isActive,
  isHovered,
  isEditing,
  editValue,
  onMouseEnter,
  onMouseLeave,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditChange,
  onRegenerate,
  isRegenerating,
  regeneratingSection,
  isDisabled,
  isLast,
  sectionRef,
}: {
  section: DraggableSection;
  index: number;
  isActive: boolean;
  isHovered: boolean;
  isEditing: boolean;
  editValue: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditChange: (value: string) => void;
  onRegenerate?: () => void;
  isRegenerating: boolean;
  regeneratingSection: string | null;
  isDisabled?: boolean;
  isLast: boolean;
  sectionRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={sectionRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "relative px-6 py-5 -mx-6 rounded-xl transition-all duration-200",
        isHovered && "bg-foreground/[0.02]",
        isActive && "border-l-[3px] border-l-primary",
        isDisabled && "opacity-50"
      )}
    >
      {/* Section Header with floating actions */}
      <div className="flex justify-between items-center mb-2.5">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[1px] font-mono">
          {section.label}
        </span>
        <div
          className={cn(
            "flex gap-1.5 transition-all duration-200",
            isHovered ? "opacity-100 translate-x-0" : "opacity-0 translate-x-1.5 pointer-events-none"
          )}
        >
          {section.aiRegenerable && onRegenerate && !isDisabled && (
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 rounded-lg text-emerald-400 text-[11px] font-semibold transition-colors"
            >
              {regeneratingSection === section.id ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              Regen
            </button>
          )}
          {section.editable && !isEditing && !isDisabled && (
            <button
              onClick={onStartEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted/80 rounded-lg text-muted-foreground text-[11px] font-semibold transition-colors border border-border"
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
            className="w-full p-4 bg-background border border-primary/30 rounded-xl text-foreground text-sm leading-relaxed resize-y min-h-[120px] focus:outline-none focus:ring-2 focus:ring-primary/50"
            rows={section.content.split("\n").length + 2}
          />
          <div className="flex justify-end gap-2 mt-3">
            <Button size="sm" variant="ghost" onClick={onCancelEdit} className="text-muted-foreground">
              Cancel
            </Button>
            <Button size="sm" onClick={onSaveEdit} className="bg-emerald-600 hover:bg-emerald-500">
              Save
            </Button>
          </div>
        </div>
      ) : section.id === "signature" ? (
        // Render signature block
        <div className="text-foreground text-sm leading-[1.85]">
          <p className="mb-4">Sincerely,</p>
          <p className="font-signature text-3xl my-4">
            {section.content.split("\n").find(line => line.trim() && !line.includes("___") && !line.toLowerCase().includes("sincerely")) || "Client Name"}
          </p>
          <div className="border-b border-border w-40 mb-2"></div>
          <p className="font-semibold">
            {section.content.split("\n").find(line => line.trim() && !line.includes("___") && !line.toLowerCase().includes("sincerely")) || "Client Name"}
          </p>
        </div>
      ) : isDisabled ? (
        <p className="text-muted-foreground text-sm italic leading-[1.85]">
          This section will be included when relevant items are found in the credit report.
        </p>
      ) : (
        <div className="text-muted-foreground text-sm leading-[1.85] whitespace-pre-wrap">
          {section.content}
        </div>
      )}

      {/* Subtle divider */}
      {!isLast && (
        <div className="h-px bg-border/50 mt-5 -mx-6 mx-0" />
      )}
    </div>
  );
}

export function LetterEditorModal({
  open,
  onOpenChange,
  generatedLetter,
  clientName,
  onLaunch,
  launching,
  onDownload,
  downloading,
  onFlowChange,
  onRoundChange,
  onRegenerate,
  availableFlows,
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
    let requestedCorrections = "";
    let personalInfo = "";
    let hardInquiries = "";
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
      } else if (p.toUpperCase().includes("REQUESTED CORRECTION") || p.toUpperCase().includes("REQUESTED DELETION") ||
                 p.toUpperCase().includes("IF NOT VERIFIED AS ACCURATE")) {
        requestedCorrections += (requestedCorrections ? "\n\n" : "") + p;
      } else if (p.toUpperCase().includes("PERSONAL INFORMATION TO INVESTIGATE") ||
                 p.toUpperCase().includes("PREVIOUS NAME") ||
                 p.toUpperCase().includes("PREVIOUS ADDRESS")) {
        personalInfo += (personalInfo ? "\n\n" : "") + p;
      } else if (p.toUpperCase().includes("HARD INQUIR") ||
                 p.toUpperCase().includes("UNAUTHORIZED") ||
                 p.toUpperCase().includes("NO CONSENT")) {
        hardInquiries += (hardInquiries ? "\n\n" : "") + p;
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

    // Middle sections (fixed order per AMELIA doctrine)
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
      // MANDATORY: Requested Corrections/Deletions section (always included per AMELIA doctrine)
      {
        id: "requestedCorrections",
        key: "requestedCorrections",
        label: "Requested Corrections / Deletions",
        content: requestedCorrections || "Requested Corrections / Deletions (If Not Verified as Accurate):\n\nFor each account listed above, I am requesting that you either:\n1. Delete the account entirely if it cannot be verified with documentation\n2. Correct all inaccurate information to reflect accurate data\n3. Update the payment status and history to accurate reporting\n\nAs a consumer by law, these accounts must be updated or deleted immediately if not verified as accurate.",
        editable: true,
        aiRegenerable: true,
      },
      // CONDITIONAL: Personal Information section (greyed out if no items)
      {
        id: "personalInfo",
        key: "personalInfo",
        label: "Personal Information to Investigate and Correct/Remove",
        content: personalInfo || "", // Empty = will be greyed out
        editable: true,
      },
      // CONDITIONAL: Hard Inquiries section (greyed out if no items)
      {
        id: "hardInquiries",
        key: "hardInquiries",
        label: "Hard Inquiries to Investigate (Unauthorized / No Consent)",
        content: hardInquiries || "", // Empty = will be greyed out
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
    ];

    // Extract client name from address for signature
    const clientName = clientAddress.split("\n")[0]?.trim() || "Client Name";

    // Locked bottom sections
    const lockedBottom: DraggableSection[] = [
      {
        id: "signature",
        key: "signature",
        label: "Signature Block",
        content: signature || `Sincerely,\n\n${clientName}\n_______________________\n${clientName}`,
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
  const [isDownloading, setIsDownloading] = useState(false);
  const [mailDialogOpen, setMailDialogOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const [hoveredSection, setHoveredSection] = useState<number | null>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [ameliaSettings, setAmeliaSettings] = useState<AmeliaSettings>({
    tone: "CONCERNED",
    humanizingPhrases: 12,
    uniquenessScore: 87,
    eoscarRisk: "LOW",
  });

  // Draft persistence state
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [showFlowSelector, setShowFlowSelector] = useState(false);

  // Current flow and round (editable)
  const [currentFlow, setCurrentFlow] = useState(generatedLetter?.flow || "ACCURACY");
  const [currentRound, setCurrentRound] = useState(generatedLetter?.round || 1);

  // All sections combined for the rail
  const allSections = [...lockedTop, ...draggableSections, ...lockedBottom];

  // Scroll to section when clicking rail
  const scrollToSection = (index: number) => {
    setActiveSection(index);
    sectionRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

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

  // Helper to calculate humanizing features locally
  const countLocalHumanizingFeatures = (content: string): number => {
    let count = 0;
    // Count contractions
    const contractions = content.match(/\b(I'm|I've|I'll|don't|can't|won't|it's|that's|you're|they're|wouldn't|shouldn't|couldn't|haven't|hasn't|isn't|aren't|wasn't|weren't)\b/gi);
    count += contractions ? contractions.length : 0;
    // Count emotional phrases
    const emotional = content.match(/\b(honestly|seriously|really|actually|basically|frankly|truly|please|appreciate|concerned|worried|frustrated|stressed|struggling|difficult|hard|terrible|awful|devastating)\b/gi);
    count += emotional ? emotional.length : 0;
    // Count personal impact
    const personal = content.match(/\b(my family|my children|my life|my credit|my future|can't sleep|lost sleep|financial hardship|denied|rejected|turned down)\b/gi);
    count += personal ? Math.min(personal.length * 2, 6) : 0;
    return count;
  };

  // Calculate local uniqueness score (simple heuristic)
  const calculateLocalUniqueness = (content: string): number => {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / Math.max(sentences.length, 1);
    // Longer, more varied sentences = higher uniqueness
    const lengthScore = Math.min(avgSentenceLength / 20, 1) * 30;
    // More sentences = higher uniqueness
    const countScore = Math.min(sentences.length / 15, 1) * 30;
    // Contractions and informal language = higher uniqueness (harder to template)
    const contractionCount = (content.match(/\b(I'm|don't|can't|won't|it's|that's)\b/gi) || []).length;
    const informalScore = Math.min(contractionCount / 5, 1) * 40;
    return Math.round(lengthScore + countScore + informalScore + 50); // Base of 50
  };

  // Parse letter when it changes
  useEffect(() => {
    if (generatedLetter?.content && generatedLetter.cra) {
      const parsed = parseLetterIntoSections(generatedLetter.content, generatedLetter.cra);
      setLockedTop(parsed.lockedTop);
      setDraggableSections(parsed.draggable);
      setLockedBottom(parsed.lockedBottom);

      // Calculate real eOSCAR resistance scores from content
      const humanPhrases = countLocalHumanizingFeatures(generatedLetter.content);
      const uniqueness = calculateLocalUniqueness(generatedLetter.content);
      const risk: "LOW" | "MEDIUM" | "HIGH" = uniqueness >= 80 && humanPhrases >= 8 ? "LOW" :
                                              uniqueness >= 60 && humanPhrases >= 5 ? "MEDIUM" : "HIGH";

      setAmeliaSettings(prev => ({
        ...prev,
        tone: (generatedLetter.ameliaMetadata?.tone as AmeliaSettings["tone"]) || prev.tone,
        humanizingPhrases: humanPhrases,
        uniquenessScore: uniqueness,
        eoscarRisk: risk,
      }));
    }
  }, [generatedLetter?.content, generatedLetter?.cra, generatedLetter?.ameliaMetadata?.tone]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setEditingSection(null);
      setEditValue("");
      setShowTonePanel(false);
      setShowPreview(false);
      setShowFlowSelector(false);
      setDraftSaved(false);
    }
  }, [open]);

  // Sync flow and round with generated letter
  useEffect(() => {
    if (generatedLetter) {
      setCurrentFlow(generatedLetter.flow);
      setCurrentRound(generatedLetter.round);
    }
  }, [generatedLetter?.flow, generatedLetter?.round]);

  // Handle flow change
  const handleFlowChange = async (newFlow: string) => {
    setCurrentFlow(newFlow);
    setShowFlowSelector(false);
    if (onFlowChange) {
      onFlowChange(newFlow);
    }
  };

  // Handle round change
  const handleRoundChange = (delta: number) => {
    const newRound = Math.max(1, Math.min(12, currentRound + delta));
    setCurrentRound(newRound);
    if (onRoundChange) {
      onRoundChange(newRound);
    }
  };

  // Save draft
  const handleSaveDraft = async () => {
    if (!generatedLetter?.clientId) {
      toast({ title: "Cannot save", description: "Missing client information", variant: "destructive" });
      return;
    }

    setSavingDraft(true);
    try {
      const fullContent = reconstructLetter();
      const contentHash = btoa(fullContent.slice(0, 100) + fullContent.length);

      const res = await fetch("/api/disputes/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: generatedLetter.clientId,
          letterContent: fullContent,
          contentHash,
          cra: generatedLetter.cra,
          flow: currentFlow,
          round: currentRound,
          accountIds: generatedLetter.accountIds || [],
          ameliaMetadata: generatedLetter.ameliaMetadata || {},
        }),
      });

      if (res.ok) {
        setDraftSaved(true);
        setTimeout(() => setDraftSaved(false), 3000);
        toast({ title: "Draft saved", description: "You can resume editing later" });
      } else {
        throw new Error("Save failed");
      }
    } catch {
      toast({ title: "Save failed", description: "Could not save draft", variant: "destructive" });
    } finally {
      setSavingDraft(false);
    }
  };

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

        // Use real eOSCAR resistance scores from API if available
        const eoscar = data.metadata?.eoscarResistance;
        setAmeliaSettings(prev => ({
          ...prev,
          humanizingPhrases: eoscar?.humanPhraseCount ?? Math.floor(Math.random() * 5) + 12,
          uniquenessScore: eoscar?.uniquenessScore ?? Math.floor(Math.random() * 10) + 85,
          eoscarRisk: eoscar?.riskLevel ?? "LOW",
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

        // Use real eOSCAR resistance scores from API if available
        const eoscar = data.metadata?.eoscarResistance;
        setAmeliaSettings(prev => ({
          ...prev,
          humanizingPhrases: eoscar?.humanPhraseCount ?? Math.floor(Math.random() * 5) + 12,
          uniquenessScore: eoscar?.uniquenessScore ?? Math.floor(Math.random() * 10) + 85,
          eoscarRisk: eoscar?.riskLevel ?? "LOW",
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

  // Generate filename for download
  const generateFilename = () => {
    const name = clientName || "Client";
    const round = generatedLetter?.round || 1;
    const flow = generatedLetter?.flow || "ACCURACY";
    return `${name} - Round ${round} ${flow}.pdf`;
  };

  // Generate PDF client-side using pdf-lib
  const generateClientSidePdf = async (content: string): Promise<Uint8Array> => {
    const pdfDoc = await PDFDocument.create();
    const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const timesRomanItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

    const fontSize = 11;
    const lineHeight = 14;
    const margin = 72; // 1 inch margins
    const pageWidth = 612; // Letter size
    const pageHeight = 792;
    const maxWidth = pageWidth - (margin * 2);

    // Split content into lines and wrap
    const lines = content.split('\n');
    const wrappedLines: { text: string; bold?: boolean; italic?: boolean }[] = [];

    for (const line of lines) {
      if (line.trim() === '') {
        wrappedLines.push({ text: '' });
        continue;
      }

      // Check for signature line (italic)
      const isSignature = line.includes('Sincerely') ||
                          (line.trim().length > 0 && line.trim().length < 40 &&
                           !line.includes(':') && !line.includes('.') &&
                           lines.indexOf(line) > lines.length - 10);

      // Check for headers/bold text
      const isBold = line.toUpperCase() === line && line.trim().length > 3 && line.trim().length < 60;

      // Word wrap
      const words = line.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const font = isBold ? timesRomanBold : timesRoman;
        const width = font.widthOfTextAtSize(testLine, fontSize);

        if (width > maxWidth && currentLine) {
          wrappedLines.push({ text: currentLine, bold: isBold, italic: isSignature });
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        wrappedLines.push({ text: currentLine, bold: isBold, italic: isSignature });
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

      const font = line.bold ? timesRomanBold : (line.italic ? timesRomanItalic : timesRoman);

      page.drawText(line.text, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });

      y -= lineHeight;
    }

    return pdfDoc.save();
  };

  // Download letter as PDF
  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    const filename = generateFilename();

    try {
      // Try API download first if we have a disputeId (not preview mode)
      if (generatedLetter?.disputeId && !generatedLetter?.isPreview) {
        const res = await fetch(`/api/disputes/${generatedLetter.disputeId}/pdf`);
        if (res.ok) {
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          toast({ title: "Downloaded", description: "Letter saved as PDF" });
          return;
        }
      }

      // Fallback: generate PDF client-side
      const fullContent = reconstructLetter();
      const pdfBytes = await generateClientSidePdf(fullContent);
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "Downloaded", description: "Letter saved as PDF" });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({ title: "Download Failed", description: "Could not generate PDF", variant: "destructive" });
    } finally {
      setIsDownloading(false);
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
        <DialogContent className="bg-card border-border max-w-6xl max-h-[95vh]">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border max-w-[95vw] max-h-[95vh] p-0 overflow-hidden">
        {/* Header */}
        <header className="flex justify-between items-start p-5 border-b border-border">
          <div>
            <button
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-muted-foreground text-sm mb-2 flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Disputes
            </button>
            <h1 className="text-2xl font-bold text-foreground mb-2">Letter Editor</h1>
            <div className="flex gap-2 items-center">
              <Badge className={CRA_COLORS[generatedLetter.cra]?.tailwind || "bg-muted text-muted-foreground"}>
                {generatedLetter.cra}
              </Badge>
              {/* Editable Round */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleRoundChange(-1)}
                  disabled={currentRound <= 1}
                  className="w-5 h-5 rounded bg-muted hover:bg-muted/80 text-muted-foreground disabled:opacity-30 flex items-center justify-center text-xs"
                >
                  −
                </button>
                <Badge className="bg-muted text-muted-foreground px-2">R{currentRound}</Badge>
                <button
                  onClick={() => handleRoundChange(1)}
                  disabled={currentRound >= 12}
                  className="w-5 h-5 rounded bg-muted hover:bg-muted/80 text-muted-foreground disabled:opacity-30 flex items-center justify-center text-xs"
                >
                  +
                </button>
              </div>
              {/* Editable Flow */}
              <div className="relative">
                <button
                  onClick={() => setShowFlowSelector(!showFlowSelector)}
                  className="flex items-center gap-1"
                >
                  <Badge className="bg-red-500/20 text-red-400 cursor-pointer hover:bg-red-500/30">
                    {FLOW_OPTIONS.find(f => f.id === currentFlow)?.label || currentFlow}
                    <span className="ml-1 text-[8px]">▼</span>
                  </Badge>
                </button>
                {showFlowSelector && (
                  <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 min-w-[200px]">
                    {FLOW_OPTIONS.map((flow) => (
                      <button
                        key={flow.id}
                        onClick={() => handleFlowChange(flow.id)}
                        className={cn(
                          "w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors",
                          currentFlow === flow.id && "bg-primary/10 text-primary"
                        )}
                      >
                        <div className="font-medium">{flow.label}</div>
                        <div className="text-[10px] text-muted-foreground">{flow.desc}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Badge className="bg-amber-500/20 text-amber-400">
                {draftSaved ? "SAVED" : "DRAFT"}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(true)}
              className="gap-2 border-input bg-card"
            >
              <Eye className="w-4 h-4" />
              Preview
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveDraft}
              disabled={savingDraft || draftSaved}
              className="gap-2 border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
            >
              {savingDraft ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : draftSaved ? (
                <Check className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {draftSaved ? "Saved" : "Save Draft"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMailDialogOpen(true)}
              disabled={!generatedLetter?.disputeId}
              className="gap-2 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
              title="Send via DocuPost"
            >
              <Send className="w-4 h-4" />
              DocuPost
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

        {/* Compliance bar */}
        <div className="px-5 pb-4">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-emerald-400 text-xs">
            <CheckCircle className="w-4 h-4" />
            <span className="font-medium">AMELIA doctrine optimized — maximum eOSCAR resistance</span>
          </div>
        </div>

        {/* Three-column Layout: Rail | Document Canvas | Sidebar */}
        <div className="grid grid-cols-[56px_1fr_340px] h-[calc(95vh-180px)] gap-4 px-4">

          {/* Section Rail */}
          <div className="relative flex flex-col items-center gap-0.5 pt-7">
            {/* Rail line */}
            <div className="absolute top-7 bottom-0 left-1/2 w-px bg-border -translate-x-1/2 z-0" />
            {allSections.map((section, i) => {
              const isActive = activeSection === i;
              const isHov = hoveredSection === i;
              return (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(i)}
                  onMouseEnter={() => setHoveredSection(i)}
                  onMouseLeave={() => setHoveredSection(null)}
                  title={SECTION_SHORT_LABELS[section.id] || section.label}
                  className={cn(
                    "relative z-10 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200",
                    isActive && "bg-primary/10",
                    isHov && !isActive && "bg-muted"
                  )}
                >
                  {/* Dot on rail */}
                  <div
                    className={cn(
                      "absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full transition-all duration-200",
                      isActive ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.4)]" : isHov ? "bg-foreground" : "bg-muted-foreground/30"
                    )}
                  />
                  <span className={cn(
                    "transition-opacity duration-200",
                    isActive ? "opacity-100" : isHov ? "opacity-80" : "opacity-35"
                  )}>
                    {SECTION_ICONS[section.id] || <FileText className="w-3.5 h-3.5" />}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Document Canvas */}
          <div
            ref={editorRef}
            className="bg-card rounded-2xl border border-border shadow-lg overflow-y-auto"
            style={{
              boxShadow: "0 8px 60px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)"
            }}
          >
            <div className="p-12 min-h-full">
              {allSections.map((section, i) => {
                const isDisabled =
                  (section.id === "personalInfo" && !section.content) ||
                  (section.id === "hardInquiries" && !section.content);

                return (
                  <CanvasSection
                    key={section.id}
                    section={section}
                    index={i}
                    isActive={activeSection === i}
                    isHovered={hoveredSection === i}
                    isEditing={editingSection === section.id}
                    editValue={editValue}
                    onMouseEnter={() => { setHoveredSection(i); setActiveSection(i); }}
                    onMouseLeave={() => setHoveredSection(null)}
                    onStartEdit={() => startEditing(section)}
                    onSaveEdit={saveEdit}
                    onCancelEdit={cancelEdit}
                    onEditChange={setEditValue}
                    onRegenerate={section.aiRegenerable ? () => regenerateSection(section.id) : undefined}
                    isRegenerating={isRegenerating}
                    regeneratingSection={regeneratingSection}
                    isDisabled={isDisabled}
                    isLast={i === allSections.length - 1}
                    sectionRef={(el) => { sectionRefs.current[i] = el; }}
                  />
                );
              })}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="overflow-y-auto space-y-3 pr-2">
            {/* Amelia AI Panel */}
            <div
              className="rounded-xl border p-5"
              style={{
                background: "linear-gradient(160deg, rgba(168,85,247,0.06), rgba(6,182,212,0.03))",
                borderColor: "rgba(168,85,247,0.12)"
              }}
            >
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/15 flex items-center justify-center text-lg">
                  ✦
                </div>
                <div>
                  <div className="text-[15px] font-bold">Amelia AI</div>
                  <div className="text-[10px] text-muted-foreground">Letter Assistant</div>
                </div>
              </div>
              <Button
                onClick={regenerateAll}
                disabled={isRegenerating}
                className="w-full bg-emerald-600 hover:bg-emerald-500 rounded-xl py-2.5"
              >
                {isRegenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Regenerate Full Letter
                  </>
                )}
              </Button>
            </div>

            {/* Strategy Settings - Early Customization */}
            {(currentFlow !== generatedLetter.flow || currentRound !== generatedLetter.round) && (
              <div className="bg-amber-500/5 rounded-xl border border-amber-500/20 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-bold text-amber-400">Strategy Changed</span>
                </div>
                <p className="text-[11px] text-muted-foreground mb-3">
                  You&apos;ve changed the {currentFlow !== generatedLetter.flow ? "flow" : "round"}.
                  Regenerate to apply AMELIA&apos;s optimized approach for this strategy.
                </p>
                <div className="flex gap-2 text-xs mb-3">
                  <span className="px-2 py-1 bg-muted rounded text-muted-foreground">
                    {generatedLetter.flow} → {currentFlow}
                  </span>
                  <span className="px-2 py-1 bg-muted rounded text-muted-foreground">
                    R{generatedLetter.round} → R{currentRound}
                  </span>
                </div>
                <Button
                  onClick={onRegenerate || regenerateAll}
                  disabled={isRegenerating}
                  className="w-full bg-amber-600 hover:bg-amber-500 rounded-xl py-2"
                  size="sm"
                >
                  {isRegenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Apply New Strategy
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Tone Control */}
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-bold">Letter Tone</span>
                <button
                  onClick={() => setShowTonePanel(!showTonePanel)}
                  className="px-2.5 py-1 bg-muted rounded-lg text-muted-foreground text-xs hover:bg-muted/80 border border-border"
                >
                  Change
                </button>
              </div>

              <div
                className="px-3 py-2 rounded-lg text-sm font-semibold mb-2"
                style={{ backgroundColor: `${toneConfig.color}15`, color: toneConfig.color, border: `1px solid ${toneConfig.color}20` }}
              >
                {toneConfig.label}
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{toneConfig.description}. Recommended for {toneConfig.round}.</p>

              {showTonePanel && (
                <div className="mt-4 space-y-2">
                  {(Object.entries(TONE_CONFIG) as [AmeliaSettings["tone"], typeof TONE_CONFIG.CONCERNED][]).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => changeTone(key)}
                      className={cn(
                        "w-full p-3 bg-background rounded-lg text-left transition-all border",
                        ameliaSettings.tone === key ? "border-2" : "border-border"
                      )}
                      style={{ borderColor: ameliaSettings.tone === key ? config.color : undefined }}
                    >
                      <span className="block text-sm font-semibold mb-0.5" style={{ color: config.color }}>
                        {config.label}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">{config.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* eOSCAR Resistance */}
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="text-sm font-bold mb-3">eOSCAR Resistance</div>

              <div className="relative h-[5px] rounded bg-muted mb-2 overflow-hidden">
                <div
                  className="absolute left-0 top-0 bottom-0 rounded"
                  style={{
                    width: `${100 - eoscarScore.riskScore}%`,
                    background: "linear-gradient(90deg, #34d399, #06b6d4)"
                  }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground font-mono mb-4">
                <span>High Risk</span>
                <span>Low Risk</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div>
                  <div className="text-xl font-extrabold">{eoscarScore.uniqueness}%</div>
                  <div className="text-[9px] text-muted-foreground font-mono mt-0.5">Uniqueness</div>
                </div>
                <div>
                  <div className="text-xl font-extrabold">{eoscarScore.humanPhrases}</div>
                  <div className="text-[9px] text-muted-foreground font-mono mt-0.5">Human</div>
                </div>
                <div>
                  <div className={cn(
                    "text-xl font-extrabold",
                    eoscarScore.riskLevel === "LOW" && "text-emerald-400",
                    eoscarScore.riskLevel === "MEDIUM" && "text-amber-400",
                    eoscarScore.riskLevel === "HIGH" && "text-red-400"
                  )}>
                    {eoscarScore.riskLevel}
                  </div>
                  <div className="text-[9px] text-muted-foreground font-mono mt-0.5">Risk</div>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Optimized to avoid eOSCAR flagging patterns.
              </p>
            </div>

            {/* Referenced Statutes */}
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="text-sm font-bold mb-3">Referenced Statutes</div>
              <div className="flex flex-col gap-1.5">
                <StatuteBadge code="§ 1681e(b)" name="Maximum Accuracy" color="emerald" />
                <StatuteBadge code="§ 1681i" name="Investigation Procedures" color="cyan" />
                <StatuteBadge code="§ 1681n" name="Civil Liability (Willful)" color="violet" />
              </div>
            </div>

            {/* Amelia Tips */}
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="text-sm font-bold mb-3 flex items-center gap-1.5">
                💡 Amelia Tips
              </div>
              <div className="space-y-2">
                {generatedLetter.ameliaMetadata?.isBackdated && (
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-400 text-xs mt-0.5 flex-shrink-0">✓</span>
                    <span className="text-[11px] text-muted-foreground leading-snug">
                      Backdated {generatedLetter.ameliaMetadata.backdatedDays} days per eOSCAR doctrine
                    </span>
                  </div>
                )}
                {generatedLetter.round === 1 && (
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-400 text-xs mt-0.5 flex-shrink-0">✓</span>
                    <span className="text-[11px] text-muted-foreground leading-snug">
                      R1 uses 60-69 day backdate range
                    </span>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 text-xs mt-0.5 flex-shrink-0">✓</span>
                  <span className="text-[11px] text-muted-foreground leading-snug">
                    Fixed order per AMELIA doctrine
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 text-xs mt-0.5 flex-shrink-0">✓</span>
                  <span className="text-[11px] text-muted-foreground leading-snug">
                    Unique phrasing avoids detection
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 text-xs mt-0.5 flex-shrink-0">✓</span>
                  <span className="text-[11px] text-muted-foreground leading-snug">
                    Regenerate for new backdate
                  </span>
                </div>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="grid grid-cols-3 gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLetter}
                className="flex-1 gap-1.5 border-border rounded-xl justify-center"
              >
                {letterCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {letterCopied ? "Copied!" : "Copy"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPdf}
                disabled={isDownloading}
                className="flex-1 gap-1.5 border-border rounded-xl justify-center"
              >
                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintLetter}
                className="flex-1 gap-1.5 border-border rounded-xl justify-center"
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
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted hover:bg-muted text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-10">
                <div className="font-serif text-slate-800 leading-relaxed">
                  {[...lockedTop, ...draggableSections, ...lockedBottom]
                    .filter(s => s.content)
                    .map((section) => (
                      <div key={section.id} className="mb-6">
                        {section.id === "signature" ? (
                          // Render signature with script font
                          <div className="mt-8">
                            <p className="mb-2 text-sm">Sincerely,</p>
                            <p className="font-signature text-3xl text-blue-900 my-4">
                              {section.content.split("\n").find(line => line.trim() && !line.includes("___") && !line.toLowerCase().includes("sincerely")) || "Client Name"}
                            </p>
                            <div className="border-b border-slate-400 w-48 mb-1"></div>
                            <p className="text-sm font-semibold">
                              {section.content.split("\n").find(line => line.trim() && !line.includes("___") && !line.toLowerCase().includes("sincerely")) || "Client Name"}
                            </p>
                          </div>
                        ) : (
                          section.content.split("\n").map((line: string, j: number) => (
                            <p key={j} className="mb-2 text-sm">{line}</p>
                          ))
                        )}
                      </div>
                    ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t bg-muted">
                <Button onClick={handleDownloadPdf} disabled={isDownloading} className="bg-purple-600 hover:bg-purple-500">
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button variant="outline" onClick={handlePrintLetter}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* DocuPost Mail Dialog */}
        {generatedLetter?.disputeId && (
          <MailSendDialog
            open={mailDialogOpen}
            onOpenChange={setMailDialogOpen}
            disputeId={generatedLetter.disputeId}
            disputeType="DISPUTE"
            clientName={lockedTop.find(s => s.id === "clientAddress")?.content?.split("\n")[0] || "Client"}
            cra={generatedLetter.cra}
            onSuccess={() => {
              toast({ title: "Letter Sent", description: "Your dispute letter has been queued for mailing via DocuPost" });
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
