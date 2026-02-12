"use client";

import { cn } from "@/lib/utils";
import { Edit3, User } from "lucide-react";

interface PersonalSectionProps {
  personal: string;
  isEditing: boolean;
  isHovered: boolean;
  editValue: string;
  onStartEdit: () => void;
  onEditChange: (value: string) => void;
  onHover: (hovered: boolean) => void;
  isEmpty?: boolean;
}

export function PersonalSection({
  personal,
  isEditing,
  isHovered,
  editValue,
  onStartEdit,
  onEditChange,
  onHover,
  isEmpty = false,
}: PersonalSectionProps) {
  // Don't render if empty and not editing
  if (isEmpty && !isEditing) {
    return null;
  }

  if (isEditing) {
    return (
      <div className="relative">
        <textarea
          value={editValue || personal}
          onChange={(e) => onEditChange(e.target.value)}
          className="w-full p-4 bg-background border border-emerald-500/50 rounded-lg text-sm font-serif leading-relaxed resize-y min-h-[150px] focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          autoFocus
          placeholder="Previous names, addresses, and hard inquiries to dispute..."
        />
      </div>
    );
  }

  // Parse personal info into sections
  const lines = personal.split("\n").filter((l) => l.trim());

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
        <User className="w-3 h-3" />
        Personal Info
      </div>

      <div className="text-sm font-serif leading-relaxed text-foreground space-y-1">
        {lines.map((line, i) => {
          const isBullet = line.trim().startsWith("-") || line.trim().startsWith("*");
          const isHeader = line.includes(":") && !line.trim().startsWith("-");

          return (
            <div
              key={i}
              className={cn(
                "whitespace-pre-wrap",
                isBullet && "pl-4",
                isHeader && "font-medium mt-2 first:mt-0"
              )}
            >
              {line}
            </div>
          );
        })}
      </div>
    </div>
  );
}
