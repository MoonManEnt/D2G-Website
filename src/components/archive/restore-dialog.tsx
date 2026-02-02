"use client";

import { useState } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Loader2, Bot, ArrowRight } from "lucide-react";

interface RestoreDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  clientName: string;
  ameliaRecommendation: string;
}

export function RestoreDialog({
  open,
  onClose,
  onConfirm,
  clientName,
  ameliaRecommendation,
}: RestoreDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  const getRecommendationMessage = () => {
    switch (ameliaRecommendation) {
      case "CONTINUE_EXISTING":
        return "AMELIA recommends continuing with existing disputes that are still in progress.";
      case "REVIEW_OUTCOMES":
        return "AMELIA recommends reviewing previous dispute outcomes and planning next steps.";
      default:
        return "AMELIA recommends starting fresh with a new credit analysis.";
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onClose}>
      <ResponsiveDialogContent size="sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-emerald-400" />
            Restore Client
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            This will restore <strong>{clientName}</strong> to active status.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody className="space-y-4">
          <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Bot className="w-5 h-5 text-purple-400 mt-0.5" />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-purple-300">AMELIA Recommendation</span>
                  <Badge className="bg-purple-600 text-xs">
                    {ameliaRecommendation.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{getRecommendationMessage()}</p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <h4 className="text-sm font-medium text-foreground mb-2">What happens when you restore:</h4>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-emerald-400" />
                Client becomes active and visible in client list
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-emerald-400" />
                All dispute history and records are preserved
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-emerald-400" />
                AMELIA will have full context for recommendations
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-emerald-400" />
                Archive snapshot remains for compliance reference
              </li>
            </ul>
          </div>
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="border-input"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Restoring...
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4 mr-2" />
                Restore Client
              </>
            )}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
