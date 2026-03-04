"use client";

import { motion } from "framer-motion";
import { Landmark, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

// =============================================================================
// TYPES
// =============================================================================

interface JurisdictionCardProps {
  courtType: string;
  courtName: string;
  courtAddress?: string | null;
  courtDistrict?: string | null;
  filingState?: string | null;
  filingCounty?: string | null;
  filingZipCode?: string | null;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const COURT_TYPE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  FEDERAL: {
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-500/20",
    label: "Federal Court",
  },
  STATE: {
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-100 dark:bg-purple-500/20",
    label: "State Court",
  },
  SMALL_CLAIMS: {
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-500/20",
    label: "Small Claims",
  },
};

// =============================================================================
// COMPONENT
// =============================================================================

export function JurisdictionCard({
  courtType,
  courtName,
  courtAddress,
  courtDistrict,
  filingState,
  filingCounty,
  filingZipCode,
}: JurisdictionCardProps) {
  const courtCfg = COURT_TYPE_CONFIG[courtType] || COURT_TYPE_CONFIG.STATE;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <Card className="bg-card border-border">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="p-2.5 rounded-xl bg-primary/15 flex-shrink-0">
              <Landmark className="w-5 h-5 text-primary" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-3">
              {/* Header row */}
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-sm font-semibold text-foreground">
                  Jurisdiction & Court
                </h3>
                <Badge
                  className={`${courtCfg.bg} ${courtCfg.color} border-0 text-[10px] px-2 py-0.5`}
                >
                  {courtCfg.label}
                </Badge>
              </div>

              {/* Court name */}
              <p className="text-sm font-medium text-foreground">
                {courtName}
              </p>

              {/* Details grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* District */}
                {courtDistrict && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
                      District
                    </p>
                    <p className="text-xs text-foreground">{courtDistrict}</p>
                  </div>
                )}

                {/* Filing Location */}
                {(filingState || filingCounty) && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
                      Filing Location
                    </p>
                    <p className="text-xs text-foreground">
                      {[filingCounty, filingState].filter(Boolean).join(", ")}
                      {filingZipCode ? ` ${filingZipCode}` : ""}
                    </p>
                  </div>
                )}
              </div>

              {/* Address */}
              {courtAddress && (
                <div className="flex items-start gap-2 bg-background rounded-lg px-3 py-2 border border-border">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">{courtAddress}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default JurisdictionCard;
