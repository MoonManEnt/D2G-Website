"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Trash2,
  PackagePlus,
  ImageIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EvidenceItem {
  id: string;
  evidenceType: string;
  title: string;
  description: string | null;
  captureSource: "UPLOAD" | "PDF_CROP" | "ANNOTATION";
  sourcePageNum: number | null;
  createdAt: string;
  updatedAt: string;
  renderedFile: {
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
}

interface EvidenceGalleryProps {
  evidence: EvidenceItem[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isImageMime(mimeType: string | undefined): boolean {
  if (!mimeType) return false;
  return mimeType.startsWith("image/");
}

function getThumbnailUrl(renderedFile: EvidenceItem["renderedFile"]): string | null {
  if (!renderedFile) return null;
  const path = renderedFile.storagePath;
  if (path.startsWith("https://") || path.startsWith("http://")) {
    return path;
  }
  // Local storage: served from /uploads/
  return `/uploads/${path}`;
}

function getSourceLabel(source: EvidenceItem["captureSource"]): string {
  switch (source) {
    case "UPLOAD":
      return "Upload";
    case "PDF_CROP":
      return "Capture";
    case "ANNOTATION":
      return "Annotation";
    default:
      return source;
  }
}

function getSourceBadgeVariant(
  source: EvidenceItem["captureSource"]
): "approved" | "success" | "secondary" {
  switch (source) {
    case "UPLOAD":
      return "approved"; // blue
    case "PDF_CROP":
    case "ANNOTATION":
      return "success"; // green
    default:
      return "secondary";
  }
}

// CRA badge variant mapping
function getCraBadgeVariant(
  cra: string
): "experian" | "equifax" | "transunion" | "secondary" {
  const key = cra.toLowerCase();
  if (key === "experian") return "experian";
  if (key === "equifax") return "equifax";
  if (key === "transunion") return "transunion";
  return "secondary";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EvidenceGallery({
  evidence,
  onSelect,
  onDelete,
  selectedIds,
  onSelectionChange,
}: EvidenceGalleryProps) {
  const toggleSelection = useCallback(
    (id: string) => {
      if (selectedIds.includes(id)) {
        onSelectionChange(selectedIds.filter((sid) => sid !== id));
      } else {
        onSelectionChange([...selectedIds, id]);
      }
    },
    [selectedIds, onSelectionChange]
  );

  const handleBulkDelete = useCallback(async () => {
    for (const id of selectedIds) {
      await onDelete(id);
    }
    onSelectionChange([]);
  }, [selectedIds, onDelete, onSelectionChange]);

  return (
    <div className="relative">
      {/* Gallery Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
        {evidence.map((item) => {
          const thumbnailUrl = getThumbnailUrl(item.renderedFile);
          const isImage = isImageMime(item.renderedFile?.mimeType);
          const isSelected = selectedIds.includes(item.id);

          return (
            <Card
              key={item.id}
              className={cn(
                "group relative cursor-pointer overflow-hidden transition-all duration-200",
                "hover:ring-2 hover:ring-primary/50",
                isSelected && "ring-2 ring-primary"
              )}
              onClick={() => onSelect(item.id)}
            >
              {/* Checkbox overlay */}
              <div
                className={cn(
                  "absolute top-2 left-2 z-10 transition-opacity",
                  isSelected || selectedIds.length > 0
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelection(item.id);
                }}
              >
                <Checkbox
                  checked={isSelected}
                  className="h-5 w-5 bg-background/80 backdrop-blur-sm border-2"
                />
              </div>

              {/* Thumbnail */}
              <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                {thumbnailUrl && isImage ? (
                  <img
                    src={thumbnailUrl}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {item.renderedFile?.mimeType?.includes("pdf") ? (
                      <FileText className="w-10 h-10 text-muted-foreground/50" />
                    ) : (
                      <ImageIcon className="w-10 h-10 text-muted-foreground/50" />
                    )}
                  </div>
                )}

                {/* Source badge overlaid on image */}
                <div className="absolute bottom-2 right-2">
                  <Badge
                    variant={getSourceBadgeVariant(item.captureSource)}
                    className="text-[10px] shadow-sm"
                  >
                    {getSourceLabel(item.captureSource)}
                  </Badge>
                </div>
              </div>

              {/* Card Info */}
              <div className="p-3 space-y-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatRelativeTime(item.createdAt)}
                </p>

                {/* Linked dispute badge */}
                {item.dispute && (
                  <Badge
                    variant={getCraBadgeVariant(item.dispute.cra)}
                    className="text-[10px] mt-1"
                  >
                    {item.dispute.cra} R{item.dispute.round}
                  </Badge>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Floating action bar for multi-select */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 bg-card border border-border rounded-xl shadow-lg px-5 py-3">
            <span className="text-sm font-medium text-foreground whitespace-nowrap">
              {selectedIds.length} selected
            </span>

            <div className="h-5 w-px bg-border" />

            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                // Exhibit packet generation would be handled by parent
                // For now, create packet from selected evidence
                const form = document.createElement("form");
                form.method = "POST";
                form.action = `/api/clients/${evidence[0]?.id ? "" : ""}evidence/exhibit-packet`;
                document.body.appendChild(form);
                // Instead, use fetch in a real implementation
              }}
            >
              <PackagePlus className="w-4 h-4 mr-1.5" />
              Create Packet
            </Button>

            <Button
              size="sm"
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleBulkDelete();
              }}
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
