"use client";

// ============================================================================
// DISPUTE2GO - Mail Approval Panel
// Letter preview with Sentry scores and delivery options
// ============================================================================

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { useMutation } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/lib/use-toast";
import {
  Mail,
  Printer,
  Download,
  Shield,
  ShieldCheck,
  ShieldAlert,
  CheckCircle,
  Loader2,
  Eye,
  FileText,
  Send,
  AlertTriangle,
} from "lucide-react";
import { LetterPrintView } from "./letter-print-view";

// ============================================================================
// Types
// ============================================================================

interface SentryAnalysisScores {
  ocrSafetyScore: number;
  citationCount: number;
  citationAccuracy: number;
  successProbability: number;
  warnings?: string[];
}

interface MailApprovalPanelProps {
  disputeId: string;
  letterContent: string;
  sentryAnalysis?: SentryAnalysisScores;
  onMailSent: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function MailApprovalPanel({
  disputeId,
  letterContent,
  sentryAnalysis,
  onMailSent,
}: MailApprovalPanelProps) {
  const { toast } = useToast();
  const [previewMode, setPreviewMode] = useState<"formatted" | "raw">(
    "formatted"
  );
  const printRef = useRef<HTMLDivElement>(null);

  // DocuPost mail mutation
  const { mutate: sendMail, loading: sending } = useMutation<
    { success: boolean; trackingId?: string },
    { disputeId: string }
  >(
    async (variables) => {
      const res = await fetch(`/api/disputes/${variables.disputeId}/mail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disputeId: variables.disputeId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to send" }));
        throw new Error(err.message || "Failed to send via DocuPost");
      }
      return res.json();
    },
    {
      onSuccess: (data) => {
        toast({
          title: "Mail Sent",
          description: data.trackingId
            ? `Sent via DocuPost. Tracking: ${data.trackingId}`
            : "Letter queued for delivery via DocuPost.",
        });
        onMailSent();
      },
      onError: () => {
        toast({
          title: "Send Failed",
          description:
            "Failed to send via DocuPost. Please try again or use an alternative delivery method.",
          variant: "destructive",
        });
      },
    }
  );

  const handleDocuPost = () => {
    sendMail({ disputeId });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    try {
      const blob = new Blob([letterContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `dispute-letter-${disputeId}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Downloaded",
        description: "Letter file downloaded successfully.",
      });
    } catch {
      toast({
        title: "Download Failed",
        description: "Failed to download the letter. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-amber-500";
    return "bg-red-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-amber-400";
    return "text-red-400";
  };

  return (
    <div className="space-y-4">
      {/* Sentry Scores */}
      {sentryAnalysis && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Sentry Quality Scores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {/* OCR Safety */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  {sentryAnalysis.ocrSafetyScore >= 80 ? (
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="w-3 h-3 text-amber-400" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    OCR Safety
                  </span>
                </div>
                <Progress
                  value={sentryAnalysis.ocrSafetyScore}
                  className="h-1.5"
                  indicatorClassName={getScoreColor(
                    sentryAnalysis.ocrSafetyScore
                  )}
                />
                <span
                  className={cn(
                    "text-xs font-semibold",
                    getScoreLabel(sentryAnalysis.ocrSafetyScore)
                  )}
                >
                  {sentryAnalysis.ocrSafetyScore}%
                </span>
              </div>

              {/* Citations */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3 h-3 text-blue-400" />
                  <span className="text-xs text-muted-foreground">
                    Citations
                  </span>
                </div>
                <Progress
                  value={sentryAnalysis.citationAccuracy}
                  className="h-1.5"
                  indicatorClassName={getScoreColor(
                    sentryAnalysis.citationAccuracy
                  )}
                />
                <span className="text-xs text-foreground">
                  {sentryAnalysis.citationCount} citations
                  <span
                    className={cn(
                      "ml-1 font-semibold",
                      getScoreLabel(sentryAnalysis.citationAccuracy)
                    )}
                  >
                    ({sentryAnalysis.citationAccuracy}% accurate)
                  </span>
                </span>
              </div>

              {/* Success Probability */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-3 h-3 text-purple-400" />
                  <span className="text-xs text-muted-foreground">
                    Success Probability
                  </span>
                </div>
                <Progress
                  value={sentryAnalysis.successProbability}
                  className="h-1.5"
                  indicatorClassName={getScoreColor(
                    sentryAnalysis.successProbability
                  )}
                />
                <span
                  className={cn(
                    "text-xs font-semibold",
                    getScoreLabel(sentryAnalysis.successProbability)
                  )}
                >
                  {sentryAnalysis.successProbability}%
                </span>
              </div>
            </div>

            {/* Warnings */}
            {sentryAnalysis.warnings && sentryAnalysis.warnings.length > 0 && (
              <div className="mt-4 space-y-1.5">
                {sentryAnalysis.warnings.map((warning, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-2 bg-amber-500/10 rounded-lg border border-amber-500/30"
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-400">{warning}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Letter Preview */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Letter Preview
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant={previewMode === "formatted" ? "default" : "ghost"}
                size="sm"
                className="text-xs h-7"
                onClick={() => setPreviewMode("formatted")}
              >
                Formatted
              </Button>
              <Button
                variant={previewMode === "raw" ? "default" : "ghost"}
                size="sm"
                className="text-xs h-7"
                onClick={() => setPreviewMode("raw")}
              >
                Raw
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "max-h-[400px] overflow-y-auto rounded-lg border border-input p-4",
              previewMode === "formatted"
                ? "bg-white text-black dark:bg-gray-50 dark:text-gray-900"
                : "bg-muted font-mono text-xs"
            )}
          >
            {previewMode === "formatted" ? (
              <div
                className="prose prose-sm max-w-none"
                style={{ whiteSpace: "pre-wrap", fontFamily: "serif" }}
              >
                {letterContent}
              </div>
            ) : (
              <pre className="whitespace-pre-wrap text-muted-foreground">
                {letterContent}
              </pre>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delivery Options */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-foreground flex items-center gap-2">
            <Send className="w-4 h-4" />
            Delivery Options
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* DocuPost */}
            <button
              onClick={handleDocuPost}
              disabled={sending}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
                "bg-primary/5 border-primary/30 hover:bg-primary/10",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {sending ? (
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              ) : (
                <Mail className="w-6 h-6 text-primary" />
              )}
              <span className="text-sm font-medium text-foreground">
                DocuPost
              </span>
              <span className="text-[10px] text-muted-foreground text-center">
                Send via certified mail
              </span>
              <Badge className="bg-primary/20 text-primary text-[10px]">
                Recommended
              </Badge>
            </button>

            {/* Local Printer */}
            <button
              onClick={handlePrint}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
                "bg-muted border-input hover:border-border hover:bg-muted/80"
              )}
            >
              <Printer className="w-6 h-6 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                Local Printer
              </span>
              <span className="text-[10px] text-muted-foreground text-center">
                Print and mail yourself
              </span>
            </button>

            {/* Download PDF */}
            <button
              onClick={handleDownloadPDF}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
                "bg-muted border-input hover:border-border hover:bg-muted/80"
              )}
            >
              <Download className="w-6 h-6 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                Download
              </span>
              <span className="text-[10px] text-muted-foreground text-center">
                Download as file
              </span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Hidden Print View */}
      <div ref={printRef}>
        <LetterPrintView
          content={letterContent}
          clientName=""
          date={new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        />
      </div>
    </div>
  );
}

export default MailApprovalPanel;
