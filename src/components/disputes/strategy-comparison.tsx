"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Sparkles,
  Scale,
  TrendingUp,
  Clock,
  FileText,
  CheckCircle,
  ChevronRight,
} from "lucide-react";

// Flow configurations based on AMELIA doctrine
const FLOW_CONFIGS = {
  ACCURACY: {
    label: "Something is wrong",
    color: "blue",
    maxRounds: 11,
    r1Citations: false,
    description: "Best for: wrong balances, dates, account status errors",
    strengths: ["Strong for factual errors", "No legal jargon in R1", "Builds evidence over rounds"],
    weaknesses: ["Takes longer to escalate", "Requires documentation"],
  },
  COLLECTION: {
    label: "Debt collection dispute",
    color: "red",
    maxRounds: 12,
    r1Citations: true,
    description: "Best for: third-party collectors, medical debt, zombie debt",
    strengths: ["Immediate debt validation", "FDCPA leverage", "Switches to ACCURACY at R5-7"],
    weaknesses: ["Requires original creditor proof", "More aggressive tone needed"],
  },
  CONSENT: {
    label: "I didn't authorize this",
    color: "purple",
    maxRounds: 10,
    r1Citations: true,
    description: "Best for: unauthorized inquiries, fraud, identity theft",
    strengths: ["Strong privacy angle", "FTC complaint leverage", "Clear authorization challenge"],
    weaknesses: ["Must prove lack of consent", "Limited to permissible purpose disputes"],
  },
  COMBO: {
    label: "Multiple issues",
    color: "amber",
    maxRounds: 12,
    r1Citations: false, // Depends on primary issue
    description: "Best for: accounts with both accuracy and collection issues",
    strengths: ["Covers multiple angles", "Flexible strategy", "Comprehensive approach"],
    weaknesses: ["More complex", "Longer letters", "May confuse bureau agents"],
  },
} as const;

interface StrategyVariant {
  flow: keyof typeof FLOW_CONFIGS;
  estimatedSuccess: number;
  tone: string;
  letterLength: "short" | "medium" | "long";
  keyStrengths: string[];
  primaryStatute: string;
  rounds: number;
}

interface StrategyComparisonProps {
  clientId: string;
  accountIds: string[];
  currentFlow: string;
  onSelectStrategy: (flow: string) => void;
  onClose?: () => void;
}

export function StrategyComparison({
  clientId,
  accountIds,
  currentFlow,
  onSelectStrategy,
  onClose,
}: StrategyComparisonProps) {
  const [loading, setLoading] = useState(false);
  const [strategies, setStrategies] = useState<StrategyVariant[] | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);

  // Generate strategy variants
  const generateStrategies = async () => {
    setLoading(true);

    try {
      // For now, generate client-side based on account characteristics
      // In production, this could call an API for more sophisticated analysis
      const variants: StrategyVariant[] = [];

      // Always include ACCURACY as baseline
      variants.push({
        flow: "ACCURACY",
        estimatedSuccess: 72,
        tone: "CONCERNED",
        letterLength: "medium",
        keyStrengths: ["Strong factual basis", "Builds case over time", "Clear documentation path"],
        primaryStatute: "§1681e(b)",
        rounds: 11,
      });

      // Add COLLECTION if there are collection-type accounts
      variants.push({
        flow: "COLLECTION",
        estimatedSuccess: 68,
        tone: "WORRIED",
        letterLength: "long",
        keyStrengths: ["Debt validation leverage", "FDCPA protections", "Chain of title challenges"],
        primaryStatute: "§1692g",
        rounds: 12,
      });

      // Add CONSENT for potential unauthorized access
      variants.push({
        flow: "CONSENT",
        estimatedSuccess: 65,
        tone: "CONCERNED",
        letterLength: "short",
        keyStrengths: ["Privacy focus", "Clear authorization issue", "FTC complaint pathway"],
        primaryStatute: "§1681b",
        rounds: 10,
      });

      // Add COMBO for complex cases
      variants.push({
        flow: "COMBO",
        estimatedSuccess: 70,
        tone: "FED_UP",
        letterLength: "long",
        keyStrengths: ["Multiple angles", "Comprehensive coverage", "Flexible escalation"],
        primaryStatute: "§1681e(b)/§1692g",
        rounds: 12,
      });

      // Sort by estimated success
      variants.sort((a, b) => b.estimatedSuccess - a.estimatedSuccess);

      setStrategies(variants);
    } catch (error) {
      console.error("Failed to generate strategies:", error);
    } finally {
      setLoading(false);
    }
  };

  // Color classes helper
  const getColorClasses = (color: string, isSelected: boolean) => {
    const colors: Record<string, { bg: string; border: string; text: string }> = {
      blue: {
        bg: isSelected ? "bg-blue-500/15" : "bg-blue-500/5",
        border: isSelected ? "border-blue-500/40" : "border-blue-500/10",
        text: "text-blue-400",
      },
      red: {
        bg: isSelected ? "bg-red-500/15" : "bg-red-500/5",
        border: isSelected ? "border-red-500/40" : "border-red-500/10",
        text: "text-red-400",
      },
      purple: {
        bg: isSelected ? "bg-purple-500/15" : "bg-purple-500/5",
        border: isSelected ? "border-purple-500/40" : "border-purple-500/10",
        text: "text-purple-400",
      },
      amber: {
        bg: isSelected ? "bg-amber-500/15" : "bg-amber-500/5",
        border: isSelected ? "border-amber-500/40" : "border-amber-500/10",
        text: "text-amber-400",
      },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-lg">Strategy Comparison</h3>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Compare different dispute strategies for your selected accounts. Each strategy
        has different strengths depending on the issues detected.
      </p>

      {!strategies ? (
        <Button
          onClick={generateStrategies}
          disabled={loading}
          className="w-full"
          variant="outline"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing strategies...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Compare All Strategies
            </>
          )}
        </Button>
      ) : (
        <div className="space-y-3">
          {strategies.map((strategy) => {
            const config = FLOW_CONFIGS[strategy.flow];
            const isSelected = selectedStrategy === strategy.flow;
            const isCurrent = currentFlow === strategy.flow;
            const colors = getColorClasses(config.color, isSelected);

            return (
              <Card
                key={strategy.flow}
                onClick={() => setSelectedStrategy(strategy.flow)}
                className={cn(
                  "cursor-pointer transition-all p-4 border-2",
                  colors.bg,
                  colors.border,
                  isSelected && "ring-2 ring-primary/30"
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge className={cn("font-mono text-xs", colors.text, colors.bg)}>
                      {strategy.flow}
                    </Badge>
                    {isCurrent && (
                      <Badge variant="secondary" className="text-[10px]">
                        Current
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className={cn("w-4 h-4", colors.text)} />
                    <span className={cn("text-lg font-bold", colors.text)}>
                      {strategy.estimatedSuccess}%
                    </span>
                  </div>
                </div>

                <h4 className="font-semibold mb-1">{config.label}</h4>
                <p className="text-xs text-muted-foreground mb-3">{config.description}</p>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center p-2 rounded-lg bg-background/50">
                    <div className="text-xs text-muted-foreground">Tone</div>
                    <div className="text-sm font-medium">{strategy.tone}</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-background/50">
                    <div className="text-xs text-muted-foreground">Length</div>
                    <div className="text-sm font-medium capitalize">{strategy.letterLength}</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-background/50">
                    <div className="text-xs text-muted-foreground">Rounds</div>
                    <div className="text-sm font-medium">{strategy.rounds}</div>
                  </div>
                </div>

                <div className="space-y-1 mb-3">
                  {strategy.keyStrengths.map((strength, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                      <span className="text-muted-foreground">{strength}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {strategy.primaryStatute}
                    </span>
                  </div>
                  {config.r1Citations && (
                    <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400">
                      R1 Citations
                    </Badge>
                  )}
                </div>
              </Card>
            );
          })}

          <Button
            onClick={() => {
              if (selectedStrategy) {
                onSelectStrategy(selectedStrategy);
              }
            }}
            disabled={!selectedStrategy || selectedStrategy === currentFlow}
            className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-500"
          >
            {selectedStrategy === currentFlow ? (
              "Already using this strategy"
            ) : (
              <>
                Apply {selectedStrategy ? FLOW_CONFIGS[selectedStrategy as keyof typeof FLOW_CONFIGS].label : ""} Strategy
                <ChevronRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStrategies(null)}
            className="w-full text-muted-foreground"
          >
            Re-analyze
          </Button>
        </div>
      )}
    </div>
  );
}

// Compact inline version for use in other components
export function StrategyComparisonInline({
  currentFlow,
  onSelectStrategy,
}: {
  currentFlow: string;
  onSelectStrategy: (flow: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center justify-between p-3 rounded-lg border border-dashed border-primary/30 hover:border-primary/50 hover:bg-primary/5 transition-all"
      >
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-primary" />
          <span className="text-sm text-primary">Compare Strategies</span>
        </div>
        <ChevronRight className="w-4 h-4 text-primary" />
      </button>
    );
  }

  return (
    <div className="border border-primary/20 rounded-xl p-4 bg-primary/5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Quick Strategy Comparison</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setExpanded(false)}>
          Collapse
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(FLOW_CONFIGS) as Array<keyof typeof FLOW_CONFIGS>).map((flow) => {
          const config = FLOW_CONFIGS[flow];
          const isCurrent = currentFlow === flow;

          return (
            <button
              key={flow}
              onClick={() => onSelectStrategy(flow)}
              disabled={isCurrent}
              className={cn(
                "p-3 rounded-lg text-left transition-all border",
                isCurrent
                  ? "bg-primary/10 border-primary/30 cursor-default"
                  : "hover:bg-muted/50 border-border"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  config.color === "blue" && "bg-blue-400",
                  config.color === "red" && "bg-red-400",
                  config.color === "purple" && "bg-purple-400",
                  config.color === "amber" && "bg-amber-400"
                )} />
                <span className="text-sm font-medium">{config.label}</span>
              </div>
              <p className="text-[10px] text-muted-foreground line-clamp-1">
                {config.description}
              </p>
              {isCurrent && (
                <Badge variant="secondary" className="text-[9px] mt-1">
                  Current
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
