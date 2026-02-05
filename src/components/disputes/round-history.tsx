"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  ArrowRight,
  Loader2,
  Calendar,
  Target,
  TrendingUp,
  Zap,
  History,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createLogger } from "@/lib/logger";
const log = createLogger("round-history");

interface RoundHistoryItem {
  round: number;
  flow: string;
  cra: string;
  letterSentDate: string | null;
  responseReceivedDate: string | null;
  overallOutcome: string | null;
  itemsDisputed: number;
  itemsDeleted: number;
  itemsVerified: number;
  itemsUpdated?: number;
  itemsNoResponse?: number;
  itemsStalled?: number;
}

interface RoundHistoryProps {
  disputeId: string;
  clientId?: string;
  currentRound: number;
  currentCra: string;
  onViewLetter?: (round: number) => void;
}

export function RoundHistory({
  disputeId,
  clientId,
  currentRound,
  currentCra,
  onViewLetter,
}: RoundHistoryProps) {
  const [history, setHistory] = useState<RoundHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function fetchHistory() {
      try {
        setLoading(true);
        const res = await fetch(`/api/disputes/${disputeId}/responses`);
        if (res.ok) {
          const data = await res.json();
          setHistory(data.roundHistory || []);
        }
      } catch (error) {
        log.error({ err: error }, "Failed to fetch round history");
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [disputeId]);

  const toggleRound = (round: number) => {
    setExpandedRounds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(round)) {
        newSet.delete(round);
      } else {
        newSet.add(round);
      }
      return newSet;
    });
  };

  const getOutcomeIcon = (outcome: string | null) => {
    switch (outcome) {
      case "CELEBRATE":
      case "ITEMS_DELETED":
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case "VERIFIED":
      case "ESCALATE_SAME_CRA":
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case "NO_RESPONSE":
        return <Clock className="w-5 h-5 text-purple-400" />;
      case "STALL_LETTER":
        return <XCircle className="w-5 h-5 text-orange-400" />;
      default:
        return <FileText className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getOutcomeLabel = (outcome: string | null) => {
    switch (outcome) {
      case "CELEBRATE":
        return "All Deleted";
      case "ITEMS_DELETED":
        return "Items Deleted";
      case "ESCALATE_SAME_CRA":
        return "Escalation Needed";
      case "TRY_DIFFERENT_CRA":
        return "Switch Bureau";
      case "ESCALATE_CFPB":
        return "CFPB Complaint";
      case "VERIFIED":
        return "Verified";
      case "NO_RESPONSE":
        return "No Response";
      case "STALL_LETTER":
        return "Stall Letter";
      default:
        return outcome || "Pending";
    }
  };

  const getOutcomeBadgeStyle = (outcome: string | null) => {
    switch (outcome) {
      case "CELEBRATE":
      case "ITEMS_DELETED":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "ESCALATE_SAME_CRA":
      case "VERIFIED":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "TRY_DIFFERENT_CRA":
        return "bg-primary/20 text-primary border-primary/30";
      case "ESCALATE_CFPB":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "NO_RESPONSE":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "STALL_LETTER":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getCRABadge = (cra: string) => {
    const colors: Record<string, string> = {
      TRANSUNION: "bg-sky-600/20 text-sky-400 border-sky-600/30",
      EXPERIAN: "bg-primary/20 text-primary border-blue-600/30",
      EQUIFAX: "bg-red-600/20 text-red-400 border-red-600/30",
    };
    return colors[cra] || "bg-muted text-muted-foreground border-border";
  };

  const calculateSuccessRate = (item: RoundHistoryItem) => {
    if (item.itemsDisputed === 0) return 0;
    return Math.round((item.itemsDeleted / item.itemsDisputed) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <History className="w-8 h-8 mx-auto mb-2" />
        <p className="text-sm">No round history yet</p>
        <p className="text-xs text-muted-foreground">
          Round history will appear after responses are recorded
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <History className="w-4 h-4 text-brand-400" />
          Round History
        </h3>
        <Badge variant="outline" className="text-xs">
          {history.length} Round{history.length !== 1 ? "s" : ""} Completed
        </Badge>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Connecting line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-muted" />

        <div className="space-y-4">
          {history.map((item, index) => {
            const isExpanded = expandedRounds.has(item.round);
            const successRate = calculateSuccessRate(item);
            const isLatest = index === history.length - 1;

            return (
              <div key={item.round} className="relative pl-10">
                {/* Timeline dot */}
                <div
                  className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center ${
                    isLatest
                      ? "bg-brand-500/30 ring-2 ring-brand-400"
                      : "bg-muted"
                  }`}
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      item.itemsDeleted > 0
                        ? "bg-green-400"
                        : item.overallOutcome === "NO_RESPONSE"
                        ? "bg-red-400"
                        : "bg-slate-400"
                    }`}
                  />
                </div>

                <Card
                  className={`bg-card border-border overflow-hidden ${
                    isLatest ? "ring-1 ring-brand-500/30" : ""
                  }`}
                >
                  <CardContent className="p-0">
                    {/* Header - Always visible */}
                    <button
                      onClick={() => toggleRound(item.round)}
                      className="w-full p-4 flex items-center justify-between hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-foreground">
                            R{item.round}
                          </span>
                          <Badge className={getCRABadge(item.cra)}>
                            {item.cra}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {item.flow}
                          </Badge>
                        </div>

                        <ArrowRight className="w-4 h-4 text-muted-foreground" />

                        <div className="flex items-center gap-2">
                          {getOutcomeIcon(item.overallOutcome)}
                          <Badge
                            className={getOutcomeBadgeStyle(item.overallOutcome)}
                          >
                            {getOutcomeLabel(item.overallOutcome)}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Quick stats */}
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-green-400 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            {item.itemsDeleted}
                          </span>
                          <span className="text-amber-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {item.itemsVerified}
                          </span>
                          <span className="text-muted-foreground">
                            of {item.itemsDisputed}
                          </span>
                        </div>

                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {/* Expanded details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 border-t border-border pt-4 space-y-4">
                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <div>
                                  <p className="text-muted-foreground text-xs">
                                    Letter Sent
                                  </p>
                                  <p className="text-foreground">
                                    {item.letterSentDate
                                      ? new Date(
                                          item.letterSentDate
                                        ).toLocaleDateString()
                                      : "—"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <div>
                                  <p className="text-muted-foreground text-xs">
                                    Response Received
                                  </p>
                                  <p className="text-foreground">
                                    {item.responseReceivedDate
                                      ? new Date(
                                          item.responseReceivedDate
                                        ).toLocaleDateString()
                                      : "—"}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Outcome breakdown */}
                            <div className="grid grid-cols-3 gap-3">
                              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                                <p className="text-2xl font-bold text-green-400">
                                  {item.itemsDeleted}
                                </p>
                                <p className="text-xs text-muted-foreground">Deleted</p>
                              </div>
                              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
                                <p className="text-2xl font-bold text-amber-400">
                                  {item.itemsVerified}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Verified
                                </p>
                              </div>
                              <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg text-center">
                                <p className="text-2xl font-bold text-primary">
                                  {item.itemsUpdated || 0}
                                </p>
                                <p className="text-xs text-muted-foreground">Updated</p>
                              </div>
                            </div>

                            {/* Success rate */}
                            <div className="flex items-center gap-3">
                              <div className="flex-1">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="text-muted-foreground">
                                    Success Rate
                                  </span>
                                  <span
                                    className={
                                      successRate >= 50
                                        ? "text-green-400"
                                        : successRate >= 25
                                        ? "text-amber-400"
                                        : "text-red-400"
                                    }
                                  >
                                    {successRate}%
                                  </span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all ${
                                      successRate >= 50
                                        ? "bg-green-500"
                                        : successRate >= 25
                                        ? "bg-amber-500"
                                        : "bg-red-500"
                                    }`}
                                    style={{ width: `${successRate}%` }}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Additional stats if available */}
                            {(item.itemsNoResponse ||
                              item.itemsStalled ||
                              0) > 0 && (
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                {item.itemsNoResponse && item.itemsNoResponse > 0 && (
                                  <span className="flex items-center gap-1 text-red-400">
                                    <Clock className="w-3 h-3" />
                                    {item.itemsNoResponse} No Response
                                  </span>
                                )}
                                {item.itemsStalled && item.itemsStalled > 0 && (
                                  <span className="flex items-center gap-1 text-orange-400">
                                    <AlertTriangle className="w-3 h-3" />
                                    {item.itemsStalled} Stalled
                                  </span>
                                )}
                              </div>
                            )}

                            {/* View letter button */}
                            {onViewLetter && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onViewLetter(item.round)}
                                className="w-full border-input text-muted-foreground hover:bg-muted"
                              >
                                <FileText className="w-4 h-4 mr-2" />
                                View Round {item.round} Letter
                              </Button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </div>
            );
          })}

          {/* Current round indicator */}
          <div className="relative pl-10">
            <div className="absolute left-2 w-5 h-5 rounded-full bg-brand-500/30 ring-2 ring-brand-400 animate-pulse flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-brand-400" />
            </div>
            <div className="p-3 bg-brand-500/10 border border-brand-500/30 rounded-lg">
              <p className="text-sm text-brand-400 font-medium">
                Round {currentRound} - In Progress
              </p>
              <p className="text-xs text-muted-foreground">
                {currentCra} • Awaiting completion
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
        <div className="text-center">
          <p className="text-lg font-bold text-green-400">
            {history.reduce((sum, h) => sum + h.itemsDeleted, 0)}
          </p>
          <p className="text-xs text-muted-foreground">Total Deleted</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-amber-400">
            {history.reduce((sum, h) => sum + h.itemsVerified, 0)}
          </p>
          <p className="text-xs text-muted-foreground">Total Verified</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">
            {history.length > 0
              ? Math.round(
                  (history.reduce((sum, h) => sum + h.itemsDeleted, 0) /
                    history.reduce((sum, h) => sum + h.itemsDisputed, 0)) *
                    100
                )
              : 0}
            %
          </p>
          <p className="text-xs text-muted-foreground">Overall Success</p>
        </div>
      </div>
    </div>
  );
}
