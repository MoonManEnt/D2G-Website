"use client";

import { cn } from "@/lib/utils";
import { Edit3 } from "lucide-react";

interface BodySectionProps {
  body: string;
  isEditing: boolean;
  isHovered: boolean;
  editValue: string;
  onStartEdit: () => void;
  onEditChange: (value: string) => void;
  onHover: (hovered: boolean) => void;
}

export function BodySection({
  body,
  isEditing,
  isHovered,
  editValue,
  onStartEdit,
  onEditChange,
  onHover,
}: BodySectionProps) {
  if (isEditing) {
    return (
      <div className="relative">
        <textarea
          value={editValue || body}
          onChange={(e) => onEditChange(e.target.value)}
          className="w-full p-4 bg-background border border-emerald-500/50 rounded-lg text-sm font-serif leading-relaxed resize-y min-h-[180px] focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          autoFocus
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative group cursor-pointer rounded-lg transition-all duration-200 p-3 -m-3",
        isHovered && "ring-2 ring-emerald-500/20 bg-emerald-500/5"
      )}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={onStartEdit}
    >
      {/* Section label on hover */}
      <div className={cn(
        "absolute -top-2 left-2 px-2 py-0.5 bg-muted rounded text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1 transition-opacity",
        isHovered ? "opacity-100" : "opacity-0"
      )}>
        <Edit3 className="w-3 h-3" />
        Body
      </div>

      <div className="text-sm font-serif leading-relaxed text-foreground whitespace-pre-wrap">
        {body}
      </div>
    </div>
  );
}
