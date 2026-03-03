"use client";

// ============================================================================
// DISPUTE2GO - Sentry Activity Feed
// Scrollable feed of Sentry actions and events
// ============================================================================

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useApiQuery } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield,
  Search,
  TrendingUp,
  Target,
  Heart,
  ArrowUpRight,
  Loader2,
  Activity,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ============================================================================
// Types
// ============================================================================

type SentryEventType =
  | "analysis"
  | "auto_escalation"
  | "goal_milestone"
  | "score_change"
  | "heartbeat";

interface SentryEvent {
  id: string;
  type: SentryEventType;
  timestamp: string;
  summary: string;
  details?: string;
  metadata?: Record<string, any>;
}

interface ActivityResponse {
  events: SentryEvent[];
  hasMore: boolean;
  total: number;
}

interface SentryActivityFeedProps {
  clientId?: string;
  limit?: number;
}

// ============================================================================
// Event Icon & Color Mapping
// ============================================================================

const EVENT_CONFIG: Record<
  SentryEventType,
  { icon: typeof Shield; color: string; bgColor: string; label: string }
> = {
  analysis: {
    icon: Search,
    color: "text-blue-400",
    bgColor: "bg-blue-500/15",
    label: "Analysis",
  },
  auto_escalation: {
    icon: ArrowUpRight,
    color: "text-amber-400",
    bgColor: "bg-amber-500/15",
    label: "Escalation",
  },
  goal_milestone: {
    icon: Target,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/15",
    label: "Milestone",
  },
  score_change: {
    icon: TrendingUp,
    color: "text-purple-400",
    bgColor: "bg-purple-500/15",
    label: "Score Change",
  },
  heartbeat: {
    icon: Heart,
    color: "text-pink-400",
    bgColor: "bg-pink-500/15",
    label: "Heartbeat",
  },
};

// ============================================================================
// Component
// ============================================================================

export function SentryActivityFeed({
  clientId,
  limit = 20,
}: SentryActivityFeedProps) {
  const [page, setPage] = useState(0);
  const [allEvents, setAllEvents] = useState<SentryEvent[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  const { data, loading, error } = useApiQuery<ActivityResponse>(
    async () => {
      const params = new URLSearchParams();
      if (clientId) params.set("clientId", clientId);
      params.set("limit", String(limit));
      params.set("offset", "0");

      const res = await fetch(`/api/sentry/activity?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to load" }));
        throw new Error(err.message || "Failed to load activity feed");
      }
      return res.json();
    },
    [clientId, limit]
  );

  // Combine initial data with paginated data
  const events = allEvents.length > 0 ? allEvents : data?.events || [];
  const hasMore = allEvents.length > 0 ? allEvents.length < (data?.total || 0) : data?.hasMore || false;

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const nextOffset = events.length;
      const params = new URLSearchParams();
      if (clientId) params.set("clientId", clientId);
      params.set("limit", String(limit));
      params.set("offset", String(nextOffset));

      const res = await fetch(`/api/sentry/activity?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load more");
      const result: ActivityResponse = await res.json();

      setAllEvents([...events, ...result.events]);
      setPage((prev) => prev + 1);
    } catch {
      // Silently fail - user can retry
    } finally {
      setLoadingMore(false);
    }
  };

  const safeFormatRelative = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "Unknown";
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return "Unknown";
    }
  };

  // Loading state
  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Sentry Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-6">
          <div className="text-center space-y-2">
            <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto" />
            <p className="text-xs text-muted-foreground">
              Failed to load activity feed
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (events.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Sentry Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No activity yet. Sentry events will appear here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Sentry Activity
          </CardTitle>
          <Badge variant="secondary" className="text-[10px]">
            {data?.total || events.length} events
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Scrollable Event List */}
        <div className="max-h-[400px] overflow-y-auto space-y-1 pr-1 -mr-1">
          {events.map((event) => {
            const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.analysis;
            const Icon = config.icon;

            return (
              <div
                key={event.id}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition"
              >
                {/* Event Icon */}
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    config.bgColor
                  )}
                >
                  <Icon className={cn("w-4 h-4", config.color)} />
                </div>

                {/* Event Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground leading-snug">
                    {event.summary}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">
                      {safeFormatRelative(event.timestamp)}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] px-1 py-0 border-transparent",
                        config.bgColor,
                        config.color
                      )}
                    >
                      {config.label}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Load More */}
        {hasMore && (
          <div className="pt-3 border-t border-input mt-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <ChevronDown className="w-3 h-3 mr-1" />
              )}
              Load more
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SentryActivityFeed;
