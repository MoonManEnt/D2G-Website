"use client";

import { cn } from "@/lib/utils";
import { Edit3 } from "lucide-react";

interface HeaderSectionProps {
  clientName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  ssnLast4: string;
  dob: string;
  isEditing: boolean;
  isHovered: boolean;
  editValue: string;
  onStartEdit: () => void;
  onEditChange: (value: string) => void;
  onHover: (hovered: boolean) => void;
}

export function HeaderSection({
  clientName,
  addressLine1,
  addressLine2,
  city,
  state,
  zipCode,
  ssnLast4,
  dob,
  isEditing,
  isHovered,
  editValue,
  onStartEdit,
  onEditChange,
  onHover,
}: HeaderSectionProps) {
  const content = [
    clientName,
    addressLine1,
    addressLine2,
    `${city}, ${state} ${zipCode}`,
    `SSN: XXX-XX-${ssnLast4}`,
    `DOB: ${dob}`,
  ].filter(Boolean).join("\n");

  if (isEditing) {
    return (
      <div className="relative">
        <textarea
          value={editValue || content}
          onChange={(e) => onEditChange(e.target.value)}
          className="w-full p-3 bg-background border border-emerald-500/50 rounded-lg text-sm font-sans leading-relaxed resize-y min-h-[140px] focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
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
        Header
      </div>

      <div className="text-sm font-sans text-foreground leading-relaxed whitespace-pre-line">
        {content}
      </div>
    </div>
  );
}
