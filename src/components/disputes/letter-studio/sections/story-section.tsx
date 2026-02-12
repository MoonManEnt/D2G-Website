"use client";

import { cn } from "@/lib/utils";
import { Edit3, Sparkles } from "lucide-react";

interface StorySectionProps {
  story: string;
  isEditing: boolean;
  isHovered: boolean;
  editValue: string;
  onStartEdit: () => void;
  onEditChange: (value: string) => void;
  onHover: (hovered: boolean) => void;
  onRegenerate?: () => void;
  kitchenTableScore?: number;
}

export function StorySection({
  story,
  isEditing,
  isHovered,
  editValue,
  onStartEdit,
  onEditChange,
  onHover,
  onRegenerate,
  kitchenTableScore = 92,
}: StorySectionProps) {
  if (isEditing) {
    return (
      <div className="relative">
        <textarea
          value={editValue || story}
          onChange={(e) => onEditChange(e.target.value)}
          className="w-full p-4 bg-background border border-emerald-500/50 rounded-lg text-sm font-serif leading-relaxed resize-y min-h-[200px] focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          autoFocus
        />
        {/* Kitchen Table Score indicator */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2 px-2 py-1 bg-emerald-500/10 rounded text-xs text-emerald-400">
          <Sparkles className="w-3 h-3" />
          KT: {kitchenTableScore}%
        </div>
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
        Story
        {onRegenerate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRegenerate();
            }}
            className="ml-2 flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/20 hover:bg-emerald-500/30 rounded text-emerald-400 transition-colors"
          >
            <Sparkles className="w-2.5 h-2.5" />
            Regen
          </button>
        )}
      </div>

      <p className="text-sm font-serif leading-relaxed text-foreground whitespace-pre-wrap">
        {story}
      </p>
    </div>
  );
}
