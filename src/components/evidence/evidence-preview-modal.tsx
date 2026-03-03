"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { formatRelativeTime, formatDate } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ZoomIn,
  ZoomOut,
  Download,
  Trash2,
  Pencil,
  X,
  FileText,
  ImageIcon,
  Calendar,
  Link2,
  Layers,
  AlertTriangle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EvidenceDetail {
  id: string;
  evidenceType: string;
  title: string;
  description: string | null;
  captureSource: "UPLOAD" | "PDF_CROP" | "ANNOTATION";
  sourcePageNum: number | null;
  cropRegion: string | null;
  annotations: string | null;
  createdAt: string;
  updatedAt: string;
  renderedFile: {
    id: string;
    storagePath: string;
    filename: string;
    mimeType: string;
  } | null;
  sourceFile: {
    id: string;
    storagePath: string;
    filename: string;
    mimeType: string;
  } | null;
  dispute: {
    id: string;
    cra: string;
    round: number;
    status: string;
  } | null;
  accountItem: {
    id: string;
    creditorName: string;
    maskedAccountId: string;
  } | null;
}

interface EvidencePreviewModalProps {
  evidenceId: string | null;
  clientId: string;
  onClose: () => void;
  onUpdate: () => void;
  onAnnotate?: (evidenceId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getImageUrl(renderedFile: EvidenceDetail["renderedFile"]): string | null {
  if (!renderedFile) return null;
  const path = renderedFile.storagePath;
  if (path.startsWith("https://") || path.startsWith("http://")) {
    return path;
  }
  return `/uploads/${path}`;
}

function isImageMime(mimeType: string | undefined): boolean {
  if (!mimeType) return false;
  return mimeType.startsWith("image/");
}

function getSourceLabel(source: string): string {
  switch (source) {
    case "UPLOAD":
      return "Uploaded";
    case "PDF_CROP":
      return "PDF Capture";
    case "ANNOTATION":
      return "Annotated";
    default:
      return source;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EvidencePreviewModal({
  evidenceId,
  clientId,
  onClose,
  onUpdate,
  onAnnotate,
}: EvidencePreviewModalProps) {
  const [evidence, setEvidence] = useState<EvidenceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [scale, setScale] = useState(1);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch single evidence when evidenceId changes
  useEffect(() => {
    if (!evidenceId) {
      setEvidence(null);
      setScale(1);
      setConfirmDelete(false);
      return;
    }

    let cancelled = false;

    async function fetchDetail() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/clients/${clientId}/evidence/${evidenceId}`
        );
        if (!res.ok) throw new Error("Failed to fetch evidence");
        const json = await res.json();
        if (!cancelled) {
          setEvidence(json.evidence);
          setEditTitle(json.evidence.title || "");
          setEditDescription(json.evidence.description || "");
        }
      } catch {
        if (!cancelled) {
          setEvidence(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchDetail();
    return () => {
      cancelled = true;
    };
  }, [evidenceId, clientId]);

  // Zoom controls
  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.25, 3));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  }, []);

  // Save title on blur
  const handleTitleBlur = useCallback(async () => {
    if (!evidence || editTitle === evidence.title) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/evidence/${evidence.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: editTitle }),
        }
      );
      if (res.ok) {
        const json = await res.json();
        setEvidence((prev) =>
          prev ? { ...prev, title: json.evidence.title } : prev
        );
        onUpdate();
      }
    } catch {
      // Revert on error
      setEditTitle(evidence.title);
    } finally {
      setSaving(false);
    }
  }, [evidence, editTitle, clientId, onUpdate]);

  // Save description on blur
  const handleDescriptionBlur = useCallback(async () => {
    if (!evidence || editDescription === (evidence.description || "")) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/evidence/${evidence.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: editDescription }),
        }
      );
      if (res.ok) {
        const json = await res.json();
        setEvidence((prev) =>
          prev
            ? { ...prev, description: json.evidence.description }
            : prev
        );
        onUpdate();
      }
    } catch {
      setEditDescription(evidence.description || "");
    } finally {
      setSaving(false);
    }
  }, [evidence, editDescription, clientId, onUpdate]);

  // Delete
  const handleDelete = useCallback(async () => {
    if (!evidence) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/evidence/${evidence.id}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        onUpdate();
        onClose();
      }
    } catch {
      // noop
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }, [evidence, clientId, onUpdate, onClose]);

  // Download
  const handleDownload = useCallback(() => {
    if (!evidence?.renderedFile) return;
    const url = getImageUrl(evidence.renderedFile);
    if (!url) return;

    const link = document.createElement("a");
    link.href = url;
    link.download = evidence.renderedFile.filename || evidence.title;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [evidence]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!evidenceId) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "+" || e.key === "=") {
        zoomIn();
      } else if (e.key === "-") {
        zoomOut();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [evidenceId, onClose, zoomIn, zoomOut]);

  const imageUrl = evidence ? getImageUrl(evidence.renderedFile) : null;
  const isImage = isImageMime(evidence?.renderedFile?.mimeType);

  return (
    <Dialog open={!!evidenceId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 gap-0 overflow-hidden">
        <div className="flex h-full">
          {/* Left panel: Image preview */}
          <div className="flex-1 flex flex-col bg-muted/30 min-w-0">
            {/* Zoom toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/50">
              <DialogHeader className="p-0 space-y-0">
                <DialogTitle className="text-sm font-medium truncate">
                  {loading ? (
                    <Skeleton className="h-4 w-32 inline-block" />
                  ) : (
                    evidence?.title || "Preview"
                  )}
                </DialogTitle>
              </DialogHeader>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={zoomOut}
                  disabled={scale <= 0.5}
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={zoomIn}
                  disabled={scale >= 3}
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Image area */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-4">
              {loading ? (
                <Skeleton className="w-96 h-72 rounded-lg" />
              ) : imageUrl && isImage ? (
                <img
                  src={imageUrl}
                  alt={evidence?.title || "Evidence preview"}
                  className="max-w-full max-h-full object-contain transition-transform duration-200 rounded shadow-md"
                  style={{ transform: `scale(${scale})`, transformOrigin: "center" }}
                  draggable={false}
                />
              ) : imageUrl ? (
                <div className="flex flex-col items-center gap-3">
                  <FileText className="w-16 h-16 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    {evidence?.renderedFile?.filename || "Document"}
                  </p>
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <Download className="w-4 h-4 mr-1.5" />
                    Download to view
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No preview available</p>
                </div>
              )}
            </div>
          </div>

          {/* Right panel: Details sidebar */}
          <div className="w-[300px] border-l border-border bg-background flex flex-col overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : evidence ? (
              <div className="p-4 space-y-5 flex-1">
                {/* Editable title */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Pencil className="w-3 h-3" />
                    Title
                  </Label>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={handleTitleBlur}
                    placeholder="Evidence title"
                    className="text-sm"
                    disabled={saving}
                  />
                </div>

                {/* Editable description */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Pencil className="w-3 h-3" />
                    Description
                  </Label>
                  <Textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    onBlur={handleDescriptionBlur}
                    placeholder="Add a description..."
                    className="text-sm min-h-[80px] resize-none"
                    disabled={saving}
                  />
                </div>

                {/* Linked dispute */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Link2 className="w-3 h-3" />
                    Linked Dispute
                  </Label>
                  {evidence.dispute ? (
                    <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                      <Badge
                        variant={
                          evidence.dispute.cra.toLowerCase() === "experian"
                            ? "experian"
                            : evidence.dispute.cra.toLowerCase() === "equifax"
                            ? "equifax"
                            : evidence.dispute.cra.toLowerCase() === "transunion"
                            ? "transunion"
                            : "secondary"
                        }
                        className="text-[10px]"
                      >
                        {evidence.dispute.cra}
                      </Badge>
                      <span className="text-xs text-foreground">
                        Round {evidence.dispute.round}
                      </span>
                      <Badge variant="outline" className="text-[10px] ml-auto">
                        {evidence.dispute.status}
                      </Badge>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic p-2 bg-muted rounded-md">
                      Not linked to a dispute
                    </p>
                  )}
                </div>

                {/* Account Item */}
                {evidence.accountItem && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      Account
                    </Label>
                    <div className="p-2 bg-muted rounded-md">
                      <p className="text-xs text-foreground font-medium">
                        {evidence.accountItem.creditorName}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {evidence.accountItem.maskedAccountId}
                      </p>
                    </div>
                  </div>
                )}

                {/* Capture metadata */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <Label className="text-xs text-muted-foreground">Details</Label>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Source</span>
                      <Badge
                        variant={
                          evidence.captureSource === "UPLOAD"
                            ? "approved"
                            : "success"
                        }
                        className="text-[10px]"
                      >
                        {getSourceLabel(evidence.captureSource)}
                      </Badge>
                    </div>

                    {evidence.sourcePageNum && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Page</span>
                        <span className="text-foreground">
                          {evidence.sourcePageNum}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Created
                      </span>
                      <span
                        className="text-foreground"
                        title={formatDate(evidence.createdAt)}
                      >
                        {formatRelativeTime(evidence.createdAt)}
                      </span>
                    </div>

                    {evidence.renderedFile && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Type</span>
                        <span className="text-foreground">
                          {evidence.renderedFile.mimeType}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={handleDownload}
                    disabled={!evidence.renderedFile}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>

                  {onAnnotate && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => onAnnotate(evidence.id)}
                    >
                      <Pencil className="w-4 h-4 mr-2" />
                      Annotate
                    </Button>
                  )}

                  {confirmDelete ? (
                    <div className="flex flex-col gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                      <div className="flex items-center gap-2 text-xs text-destructive">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Delete this evidence permanently?
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex-1"
                          onClick={handleDelete}
                          disabled={deleting}
                        >
                          {deleting ? "Deleting..." : "Delete"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setConfirmDelete(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">
                  Evidence not found
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
