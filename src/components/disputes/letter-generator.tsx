"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/lib/use-toast";
import {
  Copy,
  Printer,
  Download,
  FileText,
  CheckCircle,
  Sparkles,
  RefreshCw,
  Loader2,
  Edit3,
  Save,
  X,
} from "lucide-react";
import { createLogger } from "@/lib/logger";

const log = createLogger("letter-generator");

interface DisputedAccount {
  creditorName: string;
  accountNumber: string;
  balance?: number;
  status?: string;
}

interface LetterGeneratorProps {
  clientName: string;
  bureau: "TransUnion" | "Experian" | "Equifax";
  round: number;
  disputedAccounts: DisputedAccount[];
  disputeId?: string;
  initialLetterContent?: string;
  onSave?: (content: string) => void;
  onGenerate?: (letterType: string) => void;
  onBack?: () => void;
}

export function LetterGenerator({
  clientName,
  bureau,
  round,
  disputedAccounts,
  disputeId,
  initialLetterContent,
  onSave,
  onGenerate,
  onBack,
}: LetterGeneratorProps) {
  const { toast } = useToast();
  const [letterContent, setLetterContent] = useState(initialLetterContent || "");
  const [editedContent, setEditedContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Bureau addresses
  const bureauAddresses: Record<string, { name: string; address: string }> = {
    TransUnion: { name: "TransUnion Consumer Relations", address: "P.O. Box 2000\nChester, PA 19016" },
    Experian: { name: "Experian Consumer Relations", address: "P.O. Box 4500\nAllen, TX 75013" },
    Equifax: { name: "Equifax Information Services", address: "P.O. Box 740256\nAtlanta, GA 30374" },
  };

  const bureauInfo = bureauAddresses[bureau];

  // Fetch letter content from API
  const fetchLetterData = useCallback(async () => {
    if (!disputeId) return;

    try {
      const letterRes = await fetch(`/api/disputes/${disputeId}/amelia`);
      if (letterRes.ok) {
        const data = await letterRes.json();
        if (data.hasLetter && data.letterContent) {
          setLetterContent(data.letterContent);
        } else if (!letterContent) {
          handleGenerateLetter();
        }
      }
    } catch (error) {
      log.error({ err: error }, "Failed to fetch letter data");
    }
  }, [disputeId]);

  // Initial load
  useEffect(() => {
    if (disputeId) {
      fetchLetterData();
    } else if (!letterContent && disputedAccounts.length > 0) {
      const account = disputedAccounts[0];
      const sampleContent = generateSampleLetterContent(account, bureauInfo, clientName);
      setLetterContent(sampleContent);
    }
  }, [disputeId]);

  // Generate letter using AMELIA API
  const handleGenerateLetter = async () => {
    if (!disputeId) {
      toast({ title: "Error", description: "No dispute ID provided", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch(`/api/disputes/${disputeId}/amelia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate: true }),
      });

      if (res.ok) {
        const data = await res.json();
        setLetterContent(data.letterContent);
        toast({ title: "Letter Generated", description: "Your dispute letter has been created." });
        onGenerate?.("human_first");
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error.message || "Failed to generate letter", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate letter", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  // Save edited content
  const handleSaveEdit = async () => {
    if (!disputeId) {
      setLetterContent(editedContent);
      setIsEditing(false);
      onSave?.(editedContent);
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/disputes/${disputeId}/amelia/suggestions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ letterContent: editedContent }),
      });

      if (res.ok) {
        setLetterContent(editedContent);
        setIsEditing(false);
        toast({ title: "Letter Saved", description: "Your changes have been saved." });
        onSave?.(editedContent);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save changes", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Copy to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(letterContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied", description: "Letter copied to clipboard." });
  };

  // Print
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Dispute Letter - ${clientName}</title>
            <style>
              body { font-family: 'Times New Roman', serif; padding: 40px; max-width: 800px; margin: 0 auto; }
              pre { white-space: pre-wrap; font-family: inherit; }
            </style>
          </head>
          <body><pre>${letterContent}</pre></body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Download
  const handleDownload = async () => {
    if (disputeId) {
      try {
        const res = await fetch(`/api/disputes/${disputeId}/download?format=docx`);
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `dispute-letter-${bureau.toLowerCase()}-round${round}.docx`;
          a.click();
          URL.revokeObjectURL(url);
          return;
        }
      } catch {
        // Fall back to text download
      }
    }

    const blob = new Blob([letterContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dispute-letter-${bureau.toLowerCase()}-round${round}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-foreground">
              ← Back
            </Button>
          )}
          <h1 className="text-lg font-semibold text-foreground">
            Dispute Letter
          </h1>
          <Badge variant="outline" className="border-border text-muted-foreground">
            {clientName}
          </Badge>
          <Badge variant="outline" className="border-border text-muted-foreground">
            {bureau}
          </Badge>
          <Badge variant="outline" className="border-border text-muted-foreground">
            Round {round}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} className="border-border text-muted-foreground">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveEdit} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateLetter}
                disabled={isGenerating}
                className="border-border text-muted-foreground"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Regenerate
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setEditedContent(letterContent); setIsEditing(true); }}
                className="border-border text-muted-foreground"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className={`border-border ${copied ? "bg-emerald-600 border-emerald-600 text-white" : "text-muted-foreground"}`}
              >
                {copied ? <CheckCircle className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} className="border-border text-muted-foreground">
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button size="sm" onClick={handleDownload} className="bg-primary hover:bg-primary/90">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Letter Content - Full Width */}
      <div className="flex-1 overflow-y-auto p-6 bg-background">
        <div className="max-w-4xl mx-auto">
          {isEditing ? (
            /* Edit Mode */
            <div className="bg-card rounded-xl border border-border p-4">
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="min-h-[700px] bg-background border-border text-foreground font-mono text-sm resize-none"
                placeholder="Edit your dispute letter..."
              />
              <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                <span>{editedContent.split(/\s+/).filter(Boolean).length} words</span>
                <span>{editedContent.length} characters</span>
              </div>
            </div>
          ) : letterContent ? (
            /* Preview Mode - Clean Letter View */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white text-slate-900 rounded-lg shadow-xl p-10 min-h-[700px]"
            >
              <div className="whitespace-pre-wrap font-serif text-base leading-relaxed">
                {letterContent}
              </div>
              <div className="mt-8 pt-4 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                <span>{letterContent.split(/\s+/).filter(Boolean).length} words</span>
                <span>Generated for {clientName}</span>
              </div>
            </motion.div>
          ) : (
            /* Empty State */
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Letter Content</h3>
              <p className="text-muted-foreground mb-6">
                Generate a dispute letter to get started.
              </p>
              <Button onClick={handleGenerateLetter} disabled={isGenerating} size="lg">
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate Letter
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper function to generate sample letter content
function generateSampleLetterContent(
  account: DisputedAccount,
  bureauInfo: { name: string; address: string },
  clientName: string
): string {
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return `${today}

${bureauInfo.name}
${bureauInfo.address}

Re: Dispute of Inaccurate Information

To Whom It May Concern:

I am writing to dispute inaccurate information that appears on my credit report.

DISPUTED ACCOUNT
${account.creditorName}
Account #: ${account.accountNumber}
${account.balance ? `Reported Balance: $${account.balance.toLocaleString()}` : ""}

I am exercising my rights under the Fair Credit Reporting Act to request that you investigate this matter. The information being reported is inaccurate.

Please conduct a thorough investigation and provide me with the results within 30 days as required by law.

Sincerely,

${clientName}`;
}
