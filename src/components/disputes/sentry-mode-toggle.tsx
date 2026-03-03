"use client";

// ============================================================================
// DISPUTE2GO - Sentry Mode Toggle
// Pill/switch toggle for enabling/disabling Sentry Mode on a client
// ============================================================================

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useMutation } from "@/hooks/use-api";
import { FeatureGate } from "@/components/feature-gate";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/lib/use-toast";
import { Shield, Loader2 } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface SentryModeToggleProps {
  clientId: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

interface ToggleResponse {
  enabled: boolean;
  message: string;
}

// ============================================================================
// Component
// ============================================================================

export function SentryModeToggle({
  clientId,
  enabled,
  onToggle,
}: SentryModeToggleProps) {
  const { toast } = useToast();
  const [showTooltip, setShowTooltip] = useState(false);

  const { mutate: toggleSentry, loading } = useMutation<
    ToggleResponse,
    { clientId: string; enabled: boolean }
  >(
    async (variables) => {
      const res = await fetch("/api/sentry/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(variables),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Toggle failed" }));
        throw new Error(err.message || "Failed to toggle Sentry Mode");
      }
      return res.json();
    },
    {
      onSuccess: (data) => {
        onToggle(data.enabled);
        toast({
          title: data.enabled ? "Sentry Mode Activated" : "Sentry Mode Deactivated",
          description: data.enabled
            ? "Sentry will monitor accounts and auto-optimize disputes."
            : "Sentry Mode has been turned off for this client.",
        });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to toggle Sentry Mode. Please try again.",
          variant: "destructive",
        });
      },
    }
  );

  const handleToggle = () => {
    if (loading) return;
    toggleSentry({ clientId, enabled: !enabled });
  };

  return (
    <FeatureGate
      requiredTier="PROFESSIONAL"
      featureName="Sentry Mode"
      featureDescription="Automated dispute monitoring, analysis, and optimization powered by AI."
      inline
    >
      <div
        className="relative inline-flex"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Toggle Pill */}
        <button
          onClick={handleToggle}
          disabled={loading}
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300",
            "text-xs font-semibold uppercase tracking-wider",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-70",
            enabled
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25"
              : "bg-muted border-input text-muted-foreground hover:border-border"
          )}
        >
          {/* Pulsing green dot when active */}
          {enabled && !loading && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          )}

          {loading && <Loader2 className="w-3 h-3 animate-spin" />}

          {!enabled && !loading && (
            <Shield className="w-3 h-3" />
          )}

          <span>Sentry Mode</span>

          {/* On/Off indicator */}
          <Badge
            variant="outline"
            className={cn(
              "text-[9px] px-1.5 py-0 h-4 border",
              enabled
                ? "border-emerald-500/40 text-emerald-400"
                : "border-input text-muted-foreground"
            )}
          >
            {enabled ? "ON" : "OFF"}
          </Badge>
        </button>

        {/* Tooltip */}
        {showTooltip && (
          <div
            className={cn(
              "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50",
              "px-3 py-2 rounded-lg border border-border bg-popover text-popover-foreground shadow-md",
              "text-xs w-64 text-center"
            )}
          >
            <p className="font-medium mb-1">Sentry Mode</p>
            <p className="text-muted-foreground">
              Automatically monitors accounts, analyzes credit reports, and
              optimizes dispute strategy. Sentry runs continuous analysis to
              maximize success probability for each dispute round.
            </p>
            <div
              className="absolute top-full left-1/2 -translate-x-1/2 -mt-px"
            >
              <div className="w-2 h-2 rotate-45 bg-popover border-r border-b border-border" />
            </div>
          </div>
        )}
      </div>
    </FeatureGate>
  );
}

export default SentryModeToggle;
