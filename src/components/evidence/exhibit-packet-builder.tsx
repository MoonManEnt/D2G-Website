"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  GripVertical,
  Download,
  Loader2,
  X,
  ChevronUp,
  ChevronDown,
  Trash2,
  Package,
} from "lucide-react";

interface EvidenceItem {
  id: string;
  title: string | null;
  description: string | null;
  evidenceType: string;
  captureSource: string | null;
  renderedFile: { storagePath: string; mimeType: string } | null;
  createdAt: string;
}

interface ExhibitPacketBuilderProps {
  clientId: string;
  open: boolean;
  onClose: () => void;
  selectedEvidence: EvidenceItem[];
  disputeId?: string;
}

function indexToLabel(index: number): string {
  if (index < 26) return String.fromCharCode(65 + index);
  const first = String.fromCharCode(65 + Math.floor(index / 26) - 1);
  const second = String.fromCharCode(65 + (index % 26));
  return first + second;
}

function getImageUrl(storagePath: string): string {
  if (storagePath.startsWith("https://") || storagePath.startsWith("http://")) {
    return storagePath;
  }
  return `/uploads/${storagePath}`;
}

export function ExhibitPacketBuilder({
  clientId,
  open,
  onClose,
  selectedEvidence,
  disputeId,
}: ExhibitPacketBuilderProps) {
  const [items, setItems] = useState<EvidenceItem[]>(selectedEvidence);
  const [title, setTitle] = useState("EXHIBIT PACKET");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Reset when opened with new evidence
  useState(() => {
    setItems(selectedEvidence);
    setPdfUrl(null);
    setError(null);
  });

  const moveItem = useCallback((index: number, direction: "up" | "down") => {
    setItems((prev) => {
      const next = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleGenerate = async () => {
    if (items.length === 0) return;

    setGenerating(true);
    setError(null);
    setPdfUrl(null);

    try {
      const res = await fetch(`/api/clients/${clientId}/evidence/exhibit-packet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evidenceIds: items.map((e) => e.id),
          disputeId,
          title,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to generate packet" }));
        throw new Error(data.error || "Failed to generate packet");
      }

      // Create blob URL for download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate packet");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `${title.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-400" />
            Build Exhibit Packet
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 gap-6 overflow-hidden">
          {/* Left panel: Ordered list */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="mb-3">
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Packet Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-muted/30 border-border"
              />
            </div>

            <div className="text-sm font-medium text-muted-foreground mb-2">
              Exhibits ({items.length})
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No exhibits selected
                </div>
              ) : (
                items.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg border border-border group hover:border-amber-500/30 transition-colors"
                  >
                    <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />

                    {/* Exhibit label badge */}
                    <Badge
                      variant="outline"
                      className="bg-amber-500/10 text-amber-400 border-amber-500/30 font-bold text-xs min-w-[50px] justify-center"
                    >
                      Exhibit {indexToLabel(index)}
                    </Badge>

                    {/* Thumbnail */}
                    <div className="w-10 h-10 rounded bg-muted/30 overflow-hidden flex-shrink-0">
                      {item.renderedFile && item.renderedFile.mimeType.startsWith("image/") ? (
                        <img
                          src={getImageUrl(item.renderedFile.storagePath)}
                          alt={item.title || "Evidence"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Title */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {item.title || `Evidence ${index + 1}`}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {item.evidenceType} &middot; {item.captureSource || "Upload"}
                      </div>
                    </div>

                    {/* Reorder + Delete */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moveItem(index, "up")}
                        disabled={index === 0}
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moveItem(index, "down")}
                        disabled={index === items.length - 1}
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-400 hover:text-red-300"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right panel: Preview / Actions */}
          <div className="w-[280px] flex-shrink-0 flex flex-col">
            <div className="bg-muted/20 rounded-lg border border-border p-4 flex-1 flex flex-col">
              <h4 className="text-sm font-semibold mb-3">Preview</h4>

              {/* Mini cover page preview */}
              <div className="bg-white rounded-lg p-4 mb-4 flex-1 min-h-[200px] text-black">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-800 mb-2 border-b pb-1">
                  {title}
                </div>
                <div className="text-[8px] text-gray-500 mb-3">
                  {new Date().toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
                <div className="text-[8px] font-semibold text-gray-700 mb-1">Index of Exhibits</div>
                <div className="space-y-0.5">
                  {items.map((item, i) => (
                    <div key={item.id} className="text-[7px] text-gray-600 truncate">
                      Exhibit {indexToLabel(i)}: {item.title || `Evidence ${i + 1}`}
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Total exhibits:</span>
                  <span className="font-medium">{items.length}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Pages (est.):</span>
                  <span className="font-medium">{items.length + 1}</span>
                </div>
              </div>

              {error && (
                <div className="text-xs text-red-400 bg-red-500/10 rounded p-2 mb-3">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2">
                {pdfUrl ? (
                  <>
                    <Button className="w-full" onClick={handleDownload}>
                      <Download className="w-4 h-4 mr-2" />
                      Download PDF
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setPdfUrl(null);
                        setError(null);
                      }}
                    >
                      Regenerate
                    </Button>
                  </>
                ) : (
                  <Button
                    className="w-full bg-amber-600 hover:bg-amber-700"
                    onClick={handleGenerate}
                    disabled={generating || items.length === 0}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4 mr-2" />
                        Generate Packet
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
