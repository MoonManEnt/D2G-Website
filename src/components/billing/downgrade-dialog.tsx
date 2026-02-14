"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  XCircle,
  Loader2,
  ArrowDown,
  CheckCircle2,
} from "lucide-react";

interface DowngradeBlocker {
  resource: string;
  current: number;
  limit: number;
}

interface ValidateDowngradeResponse {
  canDowngrade: boolean;
  blockers: DowngradeBlocker[];
  warnings: string[];
  targetTier: string;
  currentTier: string;
}

interface DowngradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetTier: "FREE" | "STARTER" | "PROFESSIONAL";
  currentTier: string;
  interval: "monthly" | "yearly";
  onConfirm: () => Promise<void>;
}

const TIER_DISPLAY_NAMES: Record<string, string> = {
  FREE: "Free",
  STARTER: "Starter",
  PROFESSIONAL: "Professional",
  ENTERPRISE: "Enterprise",
};

export function DowngradeDialog({
  open,
  onOpenChange,
  targetTier,
  currentTier,
  interval,
  onConfirm,
}: DowngradeDialogProps) {
  const [validationResult, setValidationResult] =
    useState<ValidateDowngradeResponse | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateDowngrade = useCallback(async () => {
    setIsValidating(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/validate-downgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTier }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to validate downgrade");
      }

      const data: ValidateDowngradeResponse = await response.json();
      setValidationResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setIsValidating(false);
    }
  }, [targetTier]);

  useEffect(() => {
    if (open) {
      setIsConfirmed(false);
      setValidationResult(null);
      setError(null);
      validateDowngrade();
    }
  }, [open, validateDowngrade]);

  const handleConfirm = async () => {
    if (!validationResult?.canDowngrade || !isConfirmed) return;

    setIsConfirming(true);
    setError(null);

    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process downgrade");
    } finally {
      setIsConfirming(false);
    }
  };

  const canProceed = validationResult?.canDowngrade && isConfirmed && !isConfirming;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDown className="h-5 w-5 text-amber-500" />
            Downgrade to {TIER_DISPLAY_NAMES[targetTier]}
          </DialogTitle>
          <DialogDescription>
            You are about to downgrade from {TIER_DISPLAY_NAMES[currentTier]} to{" "}
            {TIER_DISPLAY_NAMES[targetTier]} ({interval}).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isValidating && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">
                Validating downgrade...
              </span>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <div className="flex items-start gap-2">
                <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Error</p>
                  <p className="text-sm text-destructive/80">{error}</p>
                </div>
              </div>
            </div>
          )}

          {validationResult && !isValidating && (
            <>
              {/* Blockers - Prevent downgrade */}
              {validationResult.blockers.length > 0 && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                  <div className="flex items-start gap-2 mb-3">
                    <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-destructive">
                        Cannot Downgrade
                      </p>
                      <p className="text-sm text-destructive/80">
                        You exceed the limits for {TIER_DISPLAY_NAMES[targetTier]}:
                      </p>
                    </div>
                  </div>
                  <ul className="space-y-2 ml-7">
                    {validationResult.blockers.map((blocker, index) => (
                      <li
                        key={index}
                        className="text-sm flex items-center justify-between"
                      >
                        <span className="text-destructive/80">
                          {blocker.resource}
                        </span>
                        <Badge variant="destructive" className="ml-2">
                          {blocker.current} / {blocker.limit} limit
                        </Badge>
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-muted-foreground mt-3 ml-7">
                    Please reduce your usage before downgrading.
                  </p>
                </div>
              )}

              {/* Warnings - Features that will be lost */}
              {validationResult.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
                  <div className="flex items-start gap-2 mb-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-500">
                        What You Will Lose
                      </p>
                    </div>
                  </div>
                  <ul className="space-y-1.5 ml-7">
                    {validationResult.warnings.map((warning, index) => (
                      <li
                        key={index}
                        className="text-sm text-amber-500/80 flex items-start gap-2"
                      >
                        <span className="block w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0 mt-1.5" />
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Success - Can downgrade */}
              {validationResult.canDowngrade && validationResult.blockers.length === 0 && (
                <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-emerald-500">
                        Downgrade Available
                      </p>
                      <p className="text-sm text-emerald-500/80">
                        Your current usage is within the{" "}
                        {TIER_DISPLAY_NAMES[targetTier]} tier limits.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Confirmation checkbox */}
              {validationResult.canDowngrade && (
                <div className="flex items-start gap-3 pt-2">
                  <Checkbox
                    id="confirm-downgrade"
                    checked={isConfirmed}
                    onCheckedChange={(checked) =>
                      setIsConfirmed(checked === true)
                    }
                    disabled={isConfirming}
                  />
                  <label
                    htmlFor="confirm-downgrade"
                    className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
                  >
                    I understand that by downgrading I will lose access to the
                    features listed above and my plan will change at the end of
                    my current billing period.
                  </label>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isConfirming}
          >
            Cancel
          </Button>
          {validationResult?.canDowngrade && (
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={!canProceed}
            >
              {isConfirming ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowDown className="h-4 w-4 mr-2" />
                  Confirm Downgrade
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
