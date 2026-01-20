"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PDFViewer } from "@/components/pdf/pdf-viewer";
import { Loader2, CheckCircle2, Image, Trash2 } from "lucide-react";

interface CapturedEvidence {
  id: string;
  pageNumber: number;
  filePath: string;
  description: string;
}

interface CaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: {
    id: string;
    creditorName: string;
    maskedAccountId: string | null;
    cra: string;
    detectedIssues?: string | null;
  };
  reportId: string;
  pdfUrl: string;
  onEvidenceCaptured?: (evidence: CapturedEvidence[]) => void;
}

export function EvidenceCaptureModal({
  open,
  onOpenChange,
  account,
  reportId,
  pdfUrl,
  onEvidenceCaptured,
}: CaptureModalProps) {
  const [capturedEvidence, setCapturedEvidence] = useState<CapturedEvidence[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse detected issues for highlighting
  const getHighlightPages = (): number[] => {
    // In a real implementation, this would parse the detected issues
    // to find which pages contain the problems
    return [];
  };

  // Handle screenshot capture from PDF viewer
  const handleCapture = async (imageData: string, pageNumber: number) => {
    setUploading(true);
    setError(null);

    try {
      const response = await fetch("/api/evidence/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          reportId,
          imageData,
          pageNumber,
          description: `Page ${pageNumber} evidence for ${account.creditorName}`,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to upload screenshot");
      }

      const data = await response.json();
      setCapturedEvidence((prev) => [...prev, data.evidence]);
    } catch (err) {
      console.error("Error uploading screenshot:", err);
      setError(err instanceof Error ? err.message : "Failed to upload screenshot");
    } finally {
      setUploading(false);
    }
  };

  // Remove captured evidence
  const handleRemoveEvidence = async (evidenceId: string) => {
    // In a real implementation, this would also delete from the server
    setCapturedEvidence((prev) => prev.filter((e) => e.id !== evidenceId));
  };

  // Close and save
  const handleClose = () => {
    if (onEvidenceCaptured && capturedEvidence.length > 0) {
      onEvidenceCaptured(capturedEvidence);
    }
    onOpenChange(false);
  };

  // Parse issues for display
  const issues = account.detectedIssues
    ? (() => {
        try {
          return JSON.parse(account.detectedIssues);
        } catch {
          return [];
        }
      })()
    : [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Capture Evidence</DialogTitle>
          <DialogDescription>
            Navigate to pages containing issues and capture screenshots as evidence.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex gap-4">
          {/* Left side: PDF viewer */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <PDFViewer
              pdfUrl={pdfUrl}
              searchText={account.creditorName}
              onCapture={handleCapture}
              highlightPages={getHighlightPages()}
            />
          </div>

          {/* Right side: Account info and captured evidence */}
          <div className="w-80 flex flex-col gap-4 overflow-y-auto">
            {/* Account details */}
            <Card className="p-4">
              <h3 className="font-semibold mb-2">{account.creditorName}</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Account: {account.maskedAccountId || "N/A"}</p>
                <p>Bureau: {account.cra}</p>
              </div>

              {/* Detected issues */}
              {issues.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Detected Issues:</h4>
                  <div className="space-y-2">
                    {issues.map((issue: { code: string; severity: string; description: string }, idx: number) => (
                      <div
                        key={idx}
                        className="text-xs p-2 rounded bg-destructive/10 border border-destructive/20"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant={
                              issue.severity === "HIGH"
                                ? "destructive"
                                : issue.severity === "MEDIUM"
                                ? "default"
                                : "secondary"
                            }
                            className="text-[10px] px-1.5 py-0"
                          >
                            {issue.severity}
                          </Badge>
                          <span className="font-medium">{issue.code}</span>
                        </div>
                        <p className="text-muted-foreground">{issue.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Error display */}
            {error && (
              <Card className="p-3 bg-destructive/10 border-destructive">
                <p className="text-sm text-destructive">{error}</p>
              </Card>
            )}

            {/* Uploading indicator */}
            {uploading && (
              <Card className="p-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Uploading screenshot...</span>
              </Card>
            )}

            {/* Captured evidence list */}
            <Card className="p-4 flex-1">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Image className="h-4 w-4" />
                Captured Evidence ({capturedEvidence.length})
              </h4>

              {capturedEvidence.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No screenshots captured yet. Navigate to a page with issues and
                  click "Capture Page" to save evidence.
                </p>
              ) : (
                <div className="space-y-2">
                  {capturedEvidence.map((evidence) => (
                    <div
                      key={evidence.id}
                      className="flex items-center justify-between p-2 rounded bg-muted"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Page {evidence.pageNumber}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveEvidence(evidence.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Done button */}
            <Button onClick={handleClose} className="w-full">
              {capturedEvidence.length > 0
                ? `Done (${capturedEvidence.length} captured)`
                : "Close"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
