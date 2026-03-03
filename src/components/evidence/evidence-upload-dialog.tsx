"use client";

import { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileText,
  ImageIcon,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DisputeOption {
  id: string;
  cra: string;
  round: number;
}

interface EvidenceUploadDialogProps {
  clientId: string;
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
  disputes?: DisputeOption[];
}

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

const ACCEPT_STRING = ".jpg,.jpeg,.png,.webp,.gif,.pdf";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageType(type: string): boolean {
  return type.startsWith("image/");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EvidenceUploadDialog({
  clientId,
  open,
  onClose,
  onUploaded,
  disputes = [],
}: EvidenceUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [disputeId, setDisputeId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens/closes
  const resetState = useCallback(() => {
    setFile(null);
    setPreview(null);
    setLabel("");
    setDescription("");
    setDisputeId("");
    setProgress(0);
    setError(null);
    setDragActive(false);
    setUploading(false);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetState();
        onClose();
      }
    },
    [onClose, resetState]
  );

  // File selection handler
  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      setError(null);

      // Validate type
      if (!ACCEPTED_TYPES.includes(selectedFile.type)) {
        setError(
          "Unsupported file type. Please upload a JPEG, PNG, WebP, GIF, or PDF."
        );
        return;
      }

      // Validate size
      if (selectedFile.size > MAX_FILE_SIZE) {
        setError(`File is too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}.`);
        return;
      }

      setFile(selectedFile);

      // Generate preview for images
      if (isImageType(selectedFile.type)) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreview(e.target?.result as string);
        };
        reader.readAsDataURL(selectedFile);
      } else {
        setPreview(null);
      }
    },
    []
  );

  // Drag & drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFileSelect(droppedFile);
      }
    },
    [handleFileSelect]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        handleFileSelect(selectedFile);
      }
    },
    [handleFileSelect]
  );

  // Remove selected file
  const handleRemoveFile = useCallback(() => {
    setFile(null);
    setPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // Upload flow
  const handleUpload = useCallback(async () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Step 1: Upload file to /api/upload/local
      setProgress(10);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "evidence");

      const uploadRes = await fetch("/api/upload/local", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const uploadErr = await uploadRes.json().catch(() => ({}));
        throw new Error(uploadErr.error || "File upload failed");
      }

      setProgress(60);
      const uploadData = await uploadRes.json();

      // Step 2: Create evidence record
      const evidencePayload = {
        fileUrl: uploadData.url || uploadData.key,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        storagePath: uploadData.key,
        captureSource: "UPLOAD",
        label: label || undefined,
        description: description || undefined,
        disputeId: disputeId || undefined,
      };

      setProgress(80);

      const evidenceRes = await fetch(
        `/api/clients/${clientId}/evidence`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(evidencePayload),
        }
      );

      if (!evidenceRes.ok) {
        const evidenceErr = await evidenceRes.json().catch(() => ({}));
        throw new Error(evidenceErr.error || "Failed to create evidence record");
      }

      setProgress(100);

      // Brief delay so user sees 100%, then close
      setTimeout(() => {
        resetState();
        onUploaded();
      }, 400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      setUploading(false);
      setProgress(0);
    }
  }, [file, label, description, disputeId, clientId, onUploaded, resetState]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Evidence</DialogTitle>
          <DialogDescription>
            Upload images or PDFs as evidence for dispute letters.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Drag & drop zone / File preview */}
          {!file ? (
            <div
              className={cn(
                "relative border-2 border-dashed rounded-lg p-8 transition-colors",
                "flex flex-col items-center justify-center gap-3 cursor-pointer",
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="rounded-full bg-muted p-3">
                <Upload className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  Drop file here or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  JPEG, PNG, WebP, GIF, or PDF (max {formatFileSize(MAX_FILE_SIZE)})
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_STRING}
                className="hidden"
                onChange={handleInputChange}
              />
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              {/* File preview */}
              <div className="relative bg-muted">
                {preview ? (
                  <div className="relative aspect-video flex items-center justify-center overflow-hidden">
                    <img
                      src={preview}
                      alt="Upload preview"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="aspect-video flex flex-col items-center justify-center gap-2">
                    <FileText className="w-12 h-12 text-muted-foreground/50" />
                    <p className="text-xs text-muted-foreground">{file.name}</p>
                  </div>
                )}

                {/* Remove button */}
                {!uploading && (
                  <button
                    className="absolute top-2 right-2 p-1 rounded-full bg-background/80 hover:bg-background border border-border shadow-sm transition-colors"
                    onClick={handleRemoveFile}
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* File info */}
              <div className="px-3 py-2 flex items-center gap-2 border-t border-border bg-background">
                {isImageType(file.type) ? (
                  <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                <span className="text-xs text-foreground truncate flex-1">
                  {file.name}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatFileSize(file.size)}
                </span>
              </div>
            </div>
          )}

          {/* Upload progress */}
          {uploading && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  {progress < 100 ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      Complete
                    </>
                  )}
                </span>
                <span>{progress}%</span>
              </div>
            </div>
          )}

          {/* Form fields */}
          {file && !uploading && (
            <div className="space-y-3">
              {/* Label */}
              <div className="space-y-1.5">
                <Label htmlFor="evidence-label" className="text-xs">
                  Label
                  <span className="text-muted-foreground ml-1">(optional)</span>
                </Label>
                <Input
                  id="evidence-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g., Bank Statement - January 2025"
                  className="text-sm"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="evidence-description" className="text-xs">
                  Description
                  <span className="text-muted-foreground ml-1">(optional)</span>
                </Label>
                <Textarea
                  id="evidence-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this evidence shows..."
                  className="text-sm min-h-[60px] resize-none"
                  rows={2}
                />
              </div>

              {/* Link to dispute */}
              {disputes.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="evidence-dispute" className="text-xs">
                    Link to Dispute
                    <span className="text-muted-foreground ml-1">(optional)</span>
                  </Label>
                  <Select value={disputeId} onValueChange={setDisputeId}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Select a dispute..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No dispute</SelectItem>
                      {disputes.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.cra} - Round {d.round}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {!uploading && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
          )}
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
