"use client";

import { AlertCircle, AlertTriangle, Info, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

type WarningLevel = "info" | "warning" | "error" | null;

interface UsageWarningProps {
  label: string;
  current: number;
  limit: number;
  onUpgradeClick?: () => void;
}

function getWarningLevel(current: number, limit: number): WarningLevel {
  if (limit === -1) return null; // Unlimited
  const percentage = (current / limit) * 100;
  if (percentage >= 100) return "error";
  if (percentage >= 80) return "warning";
  if (percentage >= 60) return "info";
  return null;
}

function getWarningConfig(level: WarningLevel) {
  switch (level) {
    case "info":
      return {
        icon: Info,
        bgColor: "bg-blue-500/10",
        borderColor: "border-blue-500/30",
        textColor: "text-blue-400",
        iconColor: "text-blue-400",
        title: "Approaching Limit",
        description: "You have used over 60% of your allocation.",
      };
    case "warning":
      return {
        icon: AlertTriangle,
        bgColor: "bg-amber-500/10",
        borderColor: "border-amber-500/30",
        textColor: "text-amber-400",
        iconColor: "text-amber-400",
        title: "High Usage",
        description: "You have used over 80% of your allocation.",
      };
    case "error":
      return {
        icon: AlertCircle,
        bgColor: "bg-red-500/10",
        borderColor: "border-red-500/30",
        textColor: "text-red-400",
        iconColor: "text-red-400",
        title: "Limit Reached",
        description: "You have reached your limit.",
      };
    default:
      return null;
  }
}

export function UsageWarning({
  label,
  current,
  limit,
  onUpgradeClick,
}: UsageWarningProps) {
  const level = getWarningLevel(current, limit);
  const config = getWarningConfig(level);

  if (!config) return null;

  const Icon = config.icon;
  const percentage = Math.round((current / limit) * 100);

  return (
    <div
      className={`${config.bgColor} border ${config.borderColor} rounded-lg p-4 flex items-start gap-4`}
    >
      <Icon className={`w-5 h-5 ${config.iconColor} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <h4 className={`${config.textColor} font-medium`}>
          {label}: {config.title}
        </h4>
        <p className="text-muted-foreground text-sm mt-1">
          {config.description} ({percentage}% used - {current} of {limit})
        </p>
      </div>
      {level === "error" && onUpgradeClick && (
        <Button
          size="sm"
          onClick={onUpgradeClick}
          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white flex-shrink-0"
        >
          <Zap className="w-4 h-4 mr-1" />
          Upgrade
        </Button>
      )}
    </div>
  );
}

interface UsageItem {
  label: string;
  current: number;
  limit: number;
}

interface UsageWarningListProps {
  usageItems: UsageItem[];
  onUpgradeClick?: () => void;
}

export function UsageWarningList({
  usageItems,
  onUpgradeClick,
}: UsageWarningListProps) {
  // Filter to only items with warnings and sort by severity (error > warning > info)
  const warningsToShow = usageItems
    .map((item) => ({
      ...item,
      level: getWarningLevel(item.current, item.limit),
    }))
    .filter((item) => item.level !== null)
    .sort((a, b) => {
      const order = { error: 0, warning: 1, info: 2 };
      return (
        order[a.level as keyof typeof order] -
        order[b.level as keyof typeof order]
      );
    });

  if (warningsToShow.length === 0) return null;

  return (
    <div className="space-y-3">
      {warningsToShow.map((item) => (
        <UsageWarning
          key={item.label}
          label={item.label}
          current={item.current}
          limit={item.limit}
          onUpgradeClick={onUpgradeClick}
        />
      ))}
    </div>
  );
}

export { getWarningLevel };
