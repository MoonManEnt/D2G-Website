"use client";

import * as React from "react";
import { useState } from "react";
import {
  Sparkles,
  RefreshCw,
  Copy,
  Download,
  Printer,
  Mail,
  ChevronDown,
  Check,
  AlertTriangle,
  Pencil,
  BarChart3,
  Zap,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// DocumentSection type - will be imported from ./letter-studio when available
export type DocumentSection =
  | "header"
  | "title"
  | "story"
  | "body"
  | "accounts"
  | "personal"
  | "closing";

// Tone options for letter regeneration
const TONES = [
  { id: "CONCERNED", label: "Concerned", desc: "Polite, establishing facts" },
  { id: "WORRIED", label: "Worried", desc: "More assertive, genuine concern" },
  { id: "FED_UP", label: "Fed Up", desc: "Frustrated, demanding action" },
  { id: "WARNING", label: "Warning", desc: "Mentioning legal consequences" },
  { id: "PISSED", label: "Pissed", desc: "Final warning before action" },
] as const;

// Kitchen Table test indicators
interface KTIndicator {
  id: string;
  label: string;
  check: boolean;
  warning?: string;
}

const getKTIndicators = (round: number): KTIndicator[] => [
  { id: "colloquial", label: "Colloquial language", check: true },
  { id: "readingLevel", label: "6th-9th grade reading level", check: true },
  { id: "noCorporate", label: "No corporate speak", check: true },
  {
    id: "noStatutes",
    label: "No statute citations (R1)",
    check: round === 1,
  },
  {
    id: "lifeDetail",
    label: "Specific life details",
    check: true,
    warning: "Consider adding more",
  },
];

// Section display names
const SECTION_NAMES: Record<DocumentSection, string> = {
  header: "Header",
  title: "Title",
  story: "Story",
  body: "Body",
  accounts: "Accounts",
  personal: "Personal Info",
  closing: "Closing",
};

// Round-specific Amelia tips
const getAmeliaTips = (round: number): string[] => {
  if (round === 1) {
    return [
      "R1 letters establish your story - no legal threats",
      "Keep language at 6th-9th grade reading level",
      "Regenerate for new unique content if needed",
      "Focus on establishing factual inaccuracies",
    ];
  }
  if (round <= 3) {
    return [
      "Build on your established story from R1",
      "You can now mention consumer rights",
      "Keep documentation references clear",
      "Maintain consistent narrative tone",
    ];
  }
  return [
    "Escalation language is appropriate at this stage",
    "Reference prior correspondence clearly",
    "Consider mentioning regulatory options",
    "Maintain professional but firm tone",
  ];
};

interface AmeliaPanelProps {
  editingSection: DocumentSection | null;
  letterContent: string;
  cra: string;
  round: number;
  flow: string;
  tone: string;
  onRegenerate: (section?: DocumentSection) => void;
  onToneChange: (tone: string) => void;
  onRegenerateFullLetter: () => void;
  onCopyToClipboard: () => void;
  onDownloadPDF: () => void;
  onPrint: () => void;
  onSendMail: () => void;
  isRegenerating?: boolean;
  kitchenTableScore?: number;
  eoscarRisk?: "LOW" | "MEDIUM" | "HIGH";
  uniquenessScore?: number;
  humanScore?: number;
}

// Collapsible Section Component
interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = true,
  className,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold text-sm">{title}</span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <CardContent className="pt-0 pb-4">{children}</CardContent>
      </div>
    </Card>
  );
}

// Progress bar with color based on value/risk
interface ScoreProgressProps {
  value: number;
  risk?: "LOW" | "MEDIUM" | "HIGH";
  showLabel?: boolean;
  label?: string;
  className?: string;
}

function ScoreProgress({
  value,
  risk,
  showLabel = true,
  label,
  className,
}: ScoreProgressProps) {
  // Determine color based on risk or value
  let indicatorColor = "bg-emerald-500";
  let labelColor = "text-emerald-600 dark:text-emerald-400";

  if (risk) {
    switch (risk) {
      case "HIGH":
        indicatorColor = "bg-red-500";
        labelColor = "text-red-600 dark:text-red-400";
        break;
      case "MEDIUM":
        indicatorColor = "bg-amber-500";
        labelColor = "text-amber-600 dark:text-amber-400";
        break;
      case "LOW":
        indicatorColor = "bg-emerald-500";
        labelColor = "text-emerald-600 dark:text-emerald-400";
        break;
    }
  } else if (value < 40) {
    indicatorColor = "bg-red-500";
    labelColor = "text-red-600 dark:text-red-400";
  } else if (value < 80) {
    indicatorColor = "bg-amber-500";
    labelColor = "text-amber-600 dark:text-amber-400";
  }

  return (
    <div className={cn("space-y-1", className)}>
      {showLabel && label && (
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className={cn("font-medium", labelColor)}>{value}%</span>
        </div>
      )}
      <Progress
        value={value}
        className="h-2"
        indicatorClassName={indicatorColor}
      />
    </div>
  );
}

export function AmeliaPanel({
  editingSection,
  letterContent,
  cra,
  round,
  flow,
  tone,
  onRegenerate,
  onToneChange,
  onRegenerateFullLetter,
  onCopyToClipboard,
  onDownloadPDF,
  onPrint,
  onSendMail,
  isRegenerating = false,
  kitchenTableScore = 92,
  eoscarRisk = "LOW",
  uniquenessScore = 98,
  humanScore = 94,
}: AmeliaPanelProps) {
  const ktIndicators = getKTIndicators(round);
  const ameliaTips = getAmeliaTips(round);

  // Calculate eOSCAR risk progress value
  const eoscarProgressValue =
    eoscarRisk === "LOW" ? 90 : eoscarRisk === "MEDIUM" ? 60 : 25;

  // Kitchen Table pass/fail
  const ktPassing = kitchenTableScore >= 85;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-muted/30 dark:bg-muted/10">
      {/* Panel Header */}
      <div className="flex items-center gap-2 p-4 border-b bg-background">
        <Sparkles className="h-5 w-5 text-primary" />
        <span className="font-semibold">Amelia AI</span>
        <Badge variant="secondary" className="ml-auto text-xs">
          R{round} {flow}
        </Badge>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Section A: Section Editor (shown when editing) */}
        {editingSection && (
          <CollapsibleSection
            title={`Editing: ${SECTION_NAMES[editingSection]} Section`}
            icon={<Pencil className="h-4 w-4 text-primary" />}
            defaultOpen={true}
          >
            <div className="space-y-4">
              {/* Regenerate Section Button */}
              <Button
                onClick={() => onRegenerate(editingSection)}
                disabled={isRegenerating}
                className="w-full"
                variant="outline"
              >
                <RefreshCw
                  className={cn("h-4 w-4 mr-2", isRegenerating && "animate-spin")}
                />
                {isRegenerating ? "Regenerating..." : "Regenerate Section"}
              </Button>

              {/* Tone Selector (only for story section) */}
              {editingSection === "story" && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Tone
                  </label>
                  <div className="grid gap-2">
                    {TONES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onToneChange(t.id)}
                        className={cn(
                          "flex flex-col items-start p-2 rounded-md border text-left transition-colors",
                          tone === t.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                        )}
                      >
                        <span className="text-sm font-medium">{t.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {t.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Kitchen Table Score for Section */}
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Kitchen Table Score</span>
                  <Badge
                    variant={ktPassing ? "success" : "warning"}
                    className="text-xs"
                  >
                    {ktPassing ? "PASSING" : "NEEDS WORK"}
                  </Badge>
                </div>
                <ScoreProgress value={kitchenTableScore} />

                {/* KT Indicators */}
                <div className="space-y-2">
                  {ktIndicators.map((indicator) => (
                    <div
                      key={indicator.id}
                      className="flex items-start gap-2 text-xs"
                    >
                      {indicator.check ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                      )}
                      <span
                        className={cn(
                          indicator.check
                            ? "text-muted-foreground"
                            : "text-amber-600 dark:text-amber-400"
                        )}
                      >
                        {indicator.label}
                        {indicator.warning && !indicator.check && (
                          <span className="block text-amber-500">
                            {indicator.warning}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* Section B: Letter Health (shown when not editing) */}
        {!editingSection && (
          <CollapsibleSection
            title="Letter Health"
            icon={<BarChart3 className="h-4 w-4 text-primary" />}
            defaultOpen={true}
          >
            <div className="space-y-4">
              {/* eOSCAR Risk */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">eOSCAR Risk</span>
                  <Badge
                    variant={
                      eoscarRisk === "LOW"
                        ? "success"
                        : eoscarRisk === "MEDIUM"
                        ? "warning"
                        : "error"
                    }
                    className="text-xs"
                  >
                    {eoscarRisk}
                  </Badge>
                </div>
                <ScoreProgress value={eoscarProgressValue} risk={eoscarRisk} />
              </div>

              {/* Score Grid */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-muted/50 rounded-md">
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {uniquenessScore}%
                  </div>
                  <div className="text-xs text-muted-foreground">Uniqueness</div>
                </div>
                <div className="p-2 bg-muted/50 rounded-md">
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {humanScore}
                  </div>
                  <div className="text-xs text-muted-foreground">Human Score</div>
                </div>
                <div className="p-2 bg-muted/50 rounded-md">
                  <div
                    className={cn(
                      "text-lg font-bold",
                      ktPassing
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {ktPassing ? "PASS" : "WARN"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Kitchen Table
                  </div>
                </div>
              </div>

              {/* Health Checklist */}
              <div className="space-y-2 pt-2 border-t">
                <HealthCheckItem
                  checked={round === 1}
                  label="No statute citations (R1)"
                />
                <HealthCheckItem checked={true} label="Backdated 65 days" />
                <HealthCheckItem checked={true} label="DOB included" />
                <HealthCheckItem checked={true} label="Unique title generated" />
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* Section C: Quick Actions */}
        <CollapsibleSection
          title="Quick Actions"
          icon={<Zap className="h-4 w-4 text-primary" />}
          defaultOpen={true}
        >
          <div className="space-y-2">
            <Button
              onClick={onRegenerateFullLetter}
              disabled={isRegenerating}
              variant="outline"
              className="w-full justify-start"
            >
              <RefreshCw
                className={cn("h-4 w-4 mr-2", isRegenerating && "animate-spin")}
              />
              Regenerate Full Letter
            </Button>
            <Button
              onClick={onCopyToClipboard}
              variant="outline"
              className="w-full justify-start"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy to Clipboard
            </Button>
            <Button
              onClick={onDownloadPDF}
              variant="outline"
              className="w-full justify-start"
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button
              onClick={onPrint}
              variant="outline"
              className="w-full justify-start"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button
              onClick={onSendMail}
              variant="default"
              className="w-full justify-start"
            >
              <Mail className="h-4 w-4 mr-2" />
              Send via DocuPost
            </Button>
          </div>
        </CollapsibleSection>

        {/* Section D: Amelia Tips (collapsed by default) */}
        <CollapsibleSection
          title="Amelia Tips"
          icon={<Lightbulb className="h-4 w-4 text-amber-500" />}
          defaultOpen={false}
        >
          <ul className="space-y-2 text-sm text-muted-foreground">
            {ameliaTips.map((tip, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      </div>
    </div>
  );
}

// Health check item component
interface HealthCheckItemProps {
  checked: boolean;
  label: string;
}

function HealthCheckItem({ checked, label }: HealthCheckItemProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {checked ? (
        <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
      )}
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

export default AmeliaPanel;
