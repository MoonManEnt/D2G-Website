"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  TrendingUp,
  Clock,
  Lightbulb,
  RefreshCw,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

interface Recommendation {
  type: "ACTION_NEEDED" | "MILESTONE" | "WARNING" | "OPPORTUNITY";
  priority: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  description: string;
  clientId: string;
  clientName: string;
  disputeId?: string;
  actionUrl: string;
  scoreImpact?: number;
}

const typeConfig: Record<
  string,
  {
    icon: typeof AlertCircle;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  ACTION_NEEDED: {
    icon: AlertCircle,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
  },
  MILESTONE: {
    icon: TrendingUp,
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
  },
  WARNING: {
    icon: Clock,
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/20",
  },
  OPPORTUNITY: {
    icon: Lightbulb,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
  },
};

export function AmeliaRecommendations() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRecommendations = useCallback(async () => {
    try {
      const res = await fetch("/api/amelia/recommendations");
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || []);
      }
    } catch (error) {
      console.error("Failed to fetch recommendations:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/amelia/recommendations", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || []);
      }
    } catch (error) {
      console.error("Failed to refresh recommendations:", error);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-5 w-5 bg-muted rounded animate-pulse" />
          <div className="h-5 w-40 bg-muted rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 bg-muted/50 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">
            Amelia&apos;s Recommendations
          </h3>
          {recommendations.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
              {recommendations.length}
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
          title="Refresh recommendations"
        >
          <RefreshCw
            className={`h-4 w-4 text-muted-foreground ${refreshing ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {recommendations.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No recommendations right now.</p>
          <p className="text-xs mt-1">
            Amelia will surface insights as clients progress.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {recommendations.slice(0, 5).map((rec, index) => {
              const config = typeConfig[rec.type] || typeConfig.OPPORTUNITY;
              const Icon = config.icon;

              return (
                <motion.div
                  key={`${rec.clientId}-${rec.type}-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link
                    href={rec.actionUrl}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${config.borderColor} ${config.bgColor} hover:brightness-110 transition-all group`}
                  >
                    <div className={`mt-0.5 ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {rec.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {rec.description}
                      </p>
                    </div>
                    {rec.scoreImpact && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-500/20 text-green-400 rounded shrink-0">
                        +{rec.scoreImpact} pts
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0" />
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {recommendations.length > 5 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              +{recommendations.length - 5} more recommendations
            </p>
          )}
        </div>
      )}
    </div>
  );
}
