"use client";

/**
 * Letter Studio Modal - Full-screen modal wrapper for Letter Studio
 *
 * This wraps the LetterStudio component in a full-screen dialog for
 * seamless integration with existing modals in the app.
 */

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { LetterStudio, GeneratedLetter } from "./letter-studio";

interface LetterStudioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  generatedLetter: GeneratedLetter | null;
  clientName?: string;
  onLaunch: () => Promise<void>;
  launching: boolean;
  onDownload: () => Promise<void>;
  downloading: boolean;
  onFlowChange?: (flow: string) => void;
  onRoundChange?: (round: number) => void;
  onRegenerate?: () => Promise<void>;
  onToneChange?: (tone: string) => void;
  availableFlows?: { id: string; label: string }[];
}

export function LetterStudioModal({
  open,
  onOpenChange,
  generatedLetter,
  clientName,
  onLaunch,
  launching,
  onDownload,
  downloading,
  onFlowChange,
  onRoundChange,
  onRegenerate,
  onToneChange,
  availableFlows,
}: LetterStudioModalProps) {
  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none w-screen h-screen p-0 border-0 rounded-none bg-background [&>button]:hidden">
        <LetterStudio
          generatedLetter={generatedLetter}
          clientName={clientName}
          onLaunch={onLaunch}
          launching={launching}
          onDownload={onDownload}
          downloading={downloading}
          onClose={handleClose}
          onFlowChange={onFlowChange}
          onRoundChange={onRoundChange}
          onRegenerate={onRegenerate}
          onToneChange={onToneChange}
          availableFlows={availableFlows}
        />
      </DialogContent>
    </Dialog>
  );
}
