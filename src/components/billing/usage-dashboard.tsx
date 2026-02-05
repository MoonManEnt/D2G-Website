"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp } from "lucide-react";

interface UsageData {
  clients: { current: number; limit: number };
  disputes: { current: number; limit: number };
  letters: { current: number; limit: number };
  reports: { current: number; limit: number };
  storage: { current: number; limit: number; formatted: { current: string; limit: string } };
  teamSeats: { current: number; limit: number };
}

interface UsageDashboardProps {
  onUpgradeClick?: () => void;
}

function UsageBar({ label, current, limit, formatted }: {
  label: string;
  current: number;
  limit: number;
  formatted?: { current: string; limit: string };
}) {
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : Math.min((current / limit) * 100, 100);
  const color =
    percentage >= 80 ? "bg-red-500" : percentage >= 60 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-medium">
          {formatted
            ? `${formatted.current} / ${formatted.limit}`
            : isUnlimited
            ? `${current} / Unlimited`
            : `${current} / ${limit}`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${isUnlimited ? 0 : percentage}%` }}
        />
      </div>
    </div>
  );
}

export function UsageDashboard({ onUpgradeClick }: UsageDashboardProps) {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsage() {
      try {
        const res = await fetch("/api/billing/usage");
        if (res.ok) {
          const data = await res.json();
          setUsage(data);
        }
      } catch {
        // Silently fail - usage display is non-critical
      } finally {
        setLoading(false);
      }
    }
    fetchUsage();
  }, []);

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!usage) return null;

  const hasHighUsage = [
    usage.clients,
    usage.disputes,
    usage.letters,
    usage.reports,
  ].some(
    (u) => u.limit !== -1 && u.current / u.limit >= 0.8
  );

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-foreground flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Usage This Month
        </CardTitle>
        {hasHighUsage && onUpgradeClick && (
          <Button
            size="sm"
            onClick={onUpgradeClick}
            className="bg-gradient-to-r from-amber-500 to-orange-500 text-white"
          >
            Upgrade for More
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <UsageBar
          label="Active Clients"
          current={usage.clients.current}
          limit={usage.clients.limit}
        />
        <UsageBar
          label="Disputes"
          current={usage.disputes.current}
          limit={usage.disputes.limit}
        />
        <UsageBar
          label="Letters"
          current={usage.letters.current}
          limit={usage.letters.limit}
        />
        <UsageBar
          label="Reports"
          current={usage.reports.current}
          limit={usage.reports.limit}
        />
        <UsageBar
          label="Storage"
          current={usage.storage.current}
          limit={usage.storage.limit}
          formatted={usage.storage.formatted}
        />
        <UsageBar
          label="Team Seats"
          current={usage.teamSeats.current}
          limit={usage.teamSeats.limit}
        />
      </CardContent>
    </Card>
  );
}
