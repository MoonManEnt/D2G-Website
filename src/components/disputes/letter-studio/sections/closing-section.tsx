"use client";

import { cn } from "@/lib/utils";
import { Edit3, Sparkles } from "lucide-react";

interface ClosingSectionProps {
  closing: string;
  signature: string;
  clientName: string;
  isEditingClosing: boolean;
  isEditingSignature: boolean;
  isHoveredClosing: boolean;
  isHoveredSignature: boolean;
  editValueClosing: string;
  editValueSignature: string;
  onStartEditClosing: () => void;
  onStartEditSignature: () => void;
  onEditChangeClosing: (value: string) => void;
  onEditChangeSignature: (value: string) => void;
  onHoverClosing: (hovered: boolean) => void;
  onHoverSignature: (hovered: boolean) => void;
  onRegenerate?: () => void;
}

export function ClosingSection({
  closing,
  signature,
  clientName,
  isEditingClosing,
  isEditingSignature,
  isHoveredClosing,
  isHoveredSignature,
  editValueClosing,
  editValueSignature,
  onStartEditClosing,
  onStartEditSignature,
  onEditChangeClosing,
  onEditChangeSignature,
  onHoverClosing,
  onHoverSignature,
  onRegenerate,
}: ClosingSectionProps) {
  return (
    <div className="space-y-6">
      {/* Closing paragraph */}
      {isEditingClosing ? (
        <div className="relative">
          <textarea
            value={editValueClosing || closing}
            onChange={(e) => onEditChangeClosing(e.target.value)}
            className="w-full p-4 bg-background border border-emerald-500/50 rounded-lg text-sm font-serif leading-relaxed resize-y min-h-[120px] focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            autoFocus
          />
        </div>
      ) : (
        <div
          className={cn(
            "relative group cursor-pointer rounded-lg transition-all duration-200 p-3 -m-3",
            isHoveredClosing && "ring-2 ring-emerald-500/20 bg-emerald-500/5"
          )}
          onMouseEnter={() => onHoverClosing(true)}
          onMouseLeave={() => onHoverClosing(false)}
          onClick={onStartEditClosing}
        >
          {/* Section label on hover */}
          <div className={cn(
            "absolute -top-2 left-2 px-2 py-0.5 bg-muted rounded text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1 transition-opacity",
            isHoveredClosing ? "opacity-100" : "opacity-0"
          )}>
            <Edit3 className="w-3 h-3" />
            Closing
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
            {closing}
          </p>
        </div>
      )}

      {/* Signature block */}
      {isEditingSignature ? (
        <div className="relative">
          <textarea
            value={editValueSignature || signature}
            onChange={(e) => onEditChangeSignature(e.target.value)}
            className="w-full p-4 bg-background border border-emerald-500/50 rounded-lg text-sm font-sans leading-relaxed resize-y min-h-[100px] focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            autoFocus
          />
        </div>
      ) : (
        <div
          className={cn(
            "relative group cursor-pointer rounded-lg transition-all duration-200 p-3 -m-3",
            isHoveredSignature && "ring-2 ring-emerald-500/20 bg-emerald-500/5"
          )}
          onMouseEnter={() => onHoverSignature(true)}
          onMouseLeave={() => onHoverSignature(false)}
          onClick={onStartEditSignature}
        >
          {/* Section label on hover */}
          <div className={cn(
            "absolute -top-2 left-2 px-2 py-0.5 bg-muted rounded text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1 transition-opacity",
            isHoveredSignature ? "opacity-100" : "opacity-0"
          )}>
            <Edit3 className="w-3 h-3" />
            Signature
          </div>

          <div className="text-foreground">
            <p className="text-sm font-serif mb-4">Sincerely,</p>
            <p className="font-signature text-2xl my-4 italic">{clientName}</p>
            <div className="border-b border-border w-48 mb-2"></div>
            <p className="text-sm font-semibold">{clientName}</p>
          </div>
        </div>
      )}
    </div>
  );
}
