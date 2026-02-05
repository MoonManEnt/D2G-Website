"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, ExternalLink } from "lucide-react";
import { createLogger } from "@/lib/logger";
const log = createLogger("vendor-recommendations-card");

interface VendorRecommendationsCardProps {
  clientId: string;
}

interface Recommendation {
  vendorId: string;
  vendorName: string;
  vendorCategory: string;
  affiliateUrl: string | null;
  ruleId: string;
  ruleName: string;
  priority: number;
  recommendationTitle: string;
  recommendationBody: string;
  recommendationCTA: string | null;
  customAffiliateUrl: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  CREDIT_REPAIR: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  DEBT_MANAGEMENT: "bg-primary/20 text-primary border-primary/30",
  FINANCIAL_COACHING: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  CREDIT_MONITORING: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  CREDIT_BUILDER: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  OTHER: "bg-muted text-muted-foreground border-border",
};

function formatCategory(cat: string): string {
  return cat
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function VendorRecommendationsCard({ clientId }: VendorRecommendationsCardProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecommendations() {
      try {
        const res = await fetch(`/api/clients/${clientId}/vendor-recommendations`);
        if (res.ok) {
          const data = await res.json();
          setRecommendations(data.recommendations || []);
        }
      } catch (error) {
        log.error({ err: error }, "Error fetching vendor recommendations");
      } finally {
        setLoading(false);
      }
    }

    fetchRecommendations();
  }, [clientId]);

  async function handleCTAClick(rec: Recommendation) {
    const url = rec.customAffiliateUrl || rec.affiliateUrl;

    // Track the referral click
    try {
      await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: rec.vendorId,
          clientId,
          triggerType: "PORTAL_VIEW",
        }),
      });
    } catch (error) {
      log.error({ err: error }, "Error tracking referral");
    }

    // Open affiliate URL in new tab
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  if (loading) {
    return null;
  }

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="bg-card backdrop-blur-xl border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-semibold text-foreground">Recommended Services</h3>
        </div>

        <div className="space-y-4">
          {recommendations.map((rec) => {
            const colorClass =
              CATEGORY_COLORS[rec.vendorCategory] || CATEGORY_COLORS.OTHER;
            const url = rec.customAffiliateUrl || rec.affiliateUrl;

            return (
              <div
                key={`${rec.vendorId}-${rec.ruleId}`}
                className="bg-muted border border-input rounded-xl p-4 hover:border-input transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-foreground">{rec.vendorName}</span>
                  <Badge
                    className={`text-[10px] border ${colorClass}`}
                  >
                    {formatCategory(rec.vendorCategory)}
                  </Badge>
                </div>

                <p className="text-sm font-semibold text-foreground mb-1">
                  {rec.recommendationTitle}
                </p>
                <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                  {rec.recommendationBody}
                </p>

                {rec.recommendationCTA && url && (
                  <Button
                    size="sm"
                    onClick={() => handleCTAClick(rec)}
                    className="gap-2"
                  >
                    {rec.recommendationCTA}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                )}

                {rec.recommendationCTA && !url && (
                  <Button size="sm" variant="ghost" disabled className="gap-2">
                    {rec.recommendationCTA}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
