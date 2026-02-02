"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eye, Clock, CheckCircle, AlertTriangle, FileText, Send, Timer, Loader2 } from "lucide-react";
import { FLOW_INFO, ROUND_STRATEGIES, type ClientWithProfile } from "./types";

// Dispute data from API
interface DisputeData {
  id: string;
  clientId?: string;
  client?: { id?: string; firstName: string; lastName: string };
  cra: string;
  flow: string;
  round: number;
  status: string;
  createdAt: string;
  sentDate?: string;  // When the letter was officially sent
  respondedAt?: string;
  letterContent?: string;
  items?: Array<{
    id: string;
    disputeReason?: string;
    accountItem?: {
      id: string;
      creditorName: string;
      maskedAccountId?: string | null;
      balance?: number | null;
    };
  }>;
  itemCount?: number;
}

interface RoundFlowViewProps {
  client: ClientWithProfile;
  currentRound?: number;
  currentFlow?: string;
  disputes?: DisputeData[];
  onViewLetter?: (disputeId: string) => void;
  onTrackResponse?: (disputeId: string) => void;
  onRefresh?: () => void;
}

interface RoundItem {
  round: number | string;
  name: string;
  statute: string;
  status: "completed" | "current" | "upcoming";
  date?: string;
  crossFlow?: boolean;
  dispute?: DisputeData; // Actual dispute data if exists
}

const ACCURACY_ROUNDS: RoundItem[] = [
  { round: 1, name: "Factual Dispute", statute: "§ 1681i", status: "upcoming" },
  { round: 2, name: "15 USC 1681e(b)", statute: "Max Accuracy", status: "upcoming" },
  { round: 3, name: "15 USC 1681i(a)(5)", statute: "30-Day Violation", status: "upcoming" },
  { round: 4, name: "15 USC 1681i(a)(1)(a)", statute: "No Reinvestigation", status: "upcoming" },
  { round: 5, name: "15 USC 1681i(a)(7)", statute: "Procedure Request", status: "upcoming" },
  { round: 6, name: "15 USC 1681i(a)(6)(B)", statute: "MOV Demand", status: "upcoming" },
  { round: 7, name: "15 USC 1681i(c)", statute: "All Accounts", status: "upcoming" },
  { round: 8, name: "15 USC 1681s-2(B)", statute: "Furnisher Duties", status: "upcoming" },
];

const COLLECTION_ROUNDS: RoundItem[] = [
  { round: 1, name: "15 USC 1692g", statute: "No Dunning Letter", status: "upcoming" },
  { round: 2, name: "15 USC 1692g(b)", statute: "Unverified Info", status: "upcoming" },
  { round: 3, name: "Continued Violations", statute: "Escalation", status: "upcoming" },
  { round: 4, name: "Final Warning", statute: "Pre-Litigation", status: "upcoming" },
  { round: "5-7", name: "Accuracy Flow", statute: "Cross-Flow", status: "upcoming", crossFlow: true },
  { round: 8, name: "Escalation", statute: "Combined", status: "upcoming" },
];

const CONSENT_ROUNDS: RoundItem[] = [
  { round: 1, name: "15 USC 1681b(a)(2)", statute: "No Permissible Purpose", status: "upcoming" },
  { round: 2, name: "15 USC 1681a(4)", statute: "Definition Challenge", status: "upcoming" },
  { round: 3, name: "15 USC 1681a(d)(a)(2)(B)", statute: "Final Notice", status: "upcoming" },
];

export function RoundFlowView({
  client,
  currentRound = 1,
  currentFlow = "ACCURACY",
  disputes = [],
  onViewLetter,
  onTrackResponse,
  onRefresh,
}: RoundFlowViewProps) {
  const [selectedFlow, setSelectedFlow] = useState(currentFlow);
  const [selectedCRA, setSelectedCRA] = useState<string>("ALL");

  // Filter disputes by selected CRA
  const filteredDisputes = disputes.filter(d =>
    selectedCRA === "ALL" || d.cra === selectedCRA
  );

  // Group disputes by flow
  const disputesByFlow = filteredDisputes.reduce((acc, d) => {
    if (!acc[d.flow]) acc[d.flow] = [];
    acc[d.flow].push(d);
    return acc;
  }, {} as Record<string, DisputeData[]>);

  // Get disputes for selected flow
  const flowDisputes = disputesByFlow[selectedFlow] || [];

  // Calculate FCRA deadline helper
  const getFCRADeadline = (sentDate?: string) => {
    if (!sentDate) return null;
    const sent = new Date(sentDate);
    const deadline = new Date(sent.getTime() + 30 * 24 * 60 * 60 * 1000);
    return deadline;
  };

  const getDaysRemaining = (sentDate?: string) => {
    const deadline = getFCRADeadline(sentDate);
    if (!deadline) return null;
    return Math.ceil((deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  };

  const getRounds = () => {
    let templateRounds: RoundItem[];
    switch (selectedFlow) {
      case "COLLECTION":
        templateRounds = COLLECTION_ROUNDS;
        break;
      case "CONSENT":
        templateRounds = CONSENT_ROUNDS;
        break;
      default:
        templateRounds = ACCURACY_ROUNDS;
    }

    // Match template rounds with actual dispute data
    return templateRounds.map((r, index) => {
      const roundNum = typeof r.round === "number" ? r.round : index + 1;

      // Find actual dispute for this round
      const dispute = flowDisputes.find(d => d.round === roundNum);

      let status: "completed" | "current" | "upcoming" = "upcoming";
      let date: string | undefined;

      if (dispute) {
        // Real dispute exists - determine status from dispute data
        if (dispute.status === "RESOLVED" || dispute.status === "RESPONDED") {
          status = "completed";
          date = dispute.respondedAt
            ? new Date(dispute.respondedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : dispute.sentDate
              ? new Date(dispute.sentDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : undefined;
        } else if (dispute.status === "SENT") {
          status = "current";
          date = dispute.sentDate
            ? new Date(dispute.sentDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : undefined;
        } else if (dispute.status === "DRAFT") {
          status = "current";
          date = new Date(dispute.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        }
      } else {
        // No dispute exists - check if previous round completed
        const prevDispute = flowDisputes.find(d => d.round === roundNum - 1);
        if (prevDispute && (prevDispute.status === "RESOLVED" || prevDispute.status === "RESPONDED")) {
          // Previous round completed, this could be current
          status = roundNum === currentRound ? "current" : "upcoming";
        }
      }

      return {
        ...r,
        status,
        date,
        dispute,
      };
    });
  };

  const rounds = getRounds();
  const flowInfo = FLOW_INFO[selectedFlow];

  // Find the current active dispute for strategy panel
  const activeDispute = flowDisputes.find(d => d.status === "SENT" || d.status === "DRAFT");
  const activeRound = activeDispute?.round || currentRound;
  const strategy = ROUND_STRATEGIES[Math.min(activeRound, 4)];

  // Calculate FCRA deadline from active dispute
  const fcraDeadline = activeDispute?.sentDate
    ? getFCRADeadline(activeDispute.sentDate)
    : (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d; })();

  // Count disputes by status
  const statusCounts = disputes.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      {/* Main Content */}
      <div>
        {/* Status Summary */}
        {disputes.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
              <span className="block text-2xl font-bold text-amber-400">{statusCounts["DRAFT"] || 0}</span>
              <span className="text-xs text-muted-foreground">Draft</span>
            </div>
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg text-center">
              <span className="block text-2xl font-bold text-primary">{statusCounts["SENT"] || 0}</span>
              <span className="text-xs text-muted-foreground">Sent</span>
            </div>
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg text-center">
              <span className="block text-2xl font-bold text-purple-400">{statusCounts["RESPONDED"] || 0}</span>
              <span className="text-xs text-muted-foreground">Responded</span>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-center">
              <span className="block text-2xl font-bold text-emerald-400">{statusCounts["RESOLVED"] || 0}</span>
              <span className="text-xs text-muted-foreground">Resolved</span>
            </div>
          </div>
        )}

        {/* CRA Filter */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-xs text-muted-foreground font-medium">Bureau:</span>
          <div className="flex gap-2">
            {["ALL", "TRANSUNION", "EXPERIAN", "EQUIFAX"].map((cra) => (
              <button
                key={cra}
                onClick={() => setSelectedCRA(cra)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  selectedCRA === cra
                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                    : "bg-muted text-muted-foreground border border-input hover:border-border"
                )}
              >
                {cra === "ALL" ? "All" : cra.slice(0, 2)}
              </button>
            ))}
          </div>
        </div>

        {/* Flow Selection Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {Object.entries(FLOW_INFO).map(([flow, info]) => {
            const flowCount = (disputesByFlow[flow] || []).length;
            return (
              <button
                key={flow}
                onClick={() => setSelectedFlow(flow)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all text-sm font-medium",
                  selectedFlow === flow
                    ? "border-opacity-50"
                    : "bg-muted border-input text-muted-foreground hover:border-border"
                )}
                style={selectedFlow === flow ? {
                  background: `${info.color}20`,
                  borderColor: info.color,
                  color: info.color,
                } : undefined}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: info.color }}
                />
                {flow}
                {flowCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-white/10 rounded text-[10px]">
                    {flowCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Flow Description */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-1">
            {selectedFlow} Flow
          </h2>
          <p className="text-muted-foreground text-sm mb-2">{flowInfo.description}</p>
          <div className="flex items-center gap-2">
            <Badge
              className="text-xs"
              style={{
                background: `${flowInfo.color}20`,
                color: flowInfo.color
              }}
            >
              {flowInfo.maxRounds} Rounds Available
            </Badge>
            {flowDisputes.length > 0 && (
              <Badge className="text-xs bg-muted text-muted-foreground">
                {flowDisputes.length} Active Disputes
              </Badge>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-0">
          {rounds.map((round, index) => {
            const dispute = round.dispute;
            const daysRemaining = dispute?.sentDate ? getDaysRemaining(dispute.sentDate) : null;
            const isOverdue = daysRemaining !== null && daysRemaining < 0;
            const accountCount = dispute?.items?.length || dispute?.itemCount || 0;

            return (
              <div key={index} className="flex gap-4">
                {/* Connector */}
                <div className="flex flex-col items-center w-10">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-foreground z-10",
                      round.status === "completed" && "bg-emerald-500",
                      round.status === "current" && "shadow-lg",
                      round.status === "upcoming" && "bg-muted"
                    )}
                    style={round.status === "current" ? {
                      background: flowInfo.color,
                      boxShadow: `0 0 20px ${flowInfo.color}50`,
                    } : undefined}
                  >
                    {round.status === "completed" ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      `R${round.round}`
                    )}
                  </div>
                  {index < rounds.length - 1 && (
                    <div
                      className={cn(
                        "w-0.5 flex-1 min-h-[40px]",
                        round.status === "completed" ? "bg-emerald-500" : "bg-muted"
                      )}
                    />
                  )}
                </div>

                {/* Content */}
                <div
                  className={cn(
                    "flex-1 rounded-xl border p-4 mb-4 transition-all",
                    round.status === "current" && "border-opacity-30",
                    round.status === "upcoming" && "bg-card border-border",
                    round.status === "completed" && "bg-card border-border",
                    round.crossFlow && "border-amber-500/30"
                  )}
                  style={round.status === "current" ? {
                    background: `${flowInfo.color}10`,
                    borderColor: `${flowInfo.color}30`,
                  } : round.crossFlow ? {
                    background: "rgba(245, 158, 11, 0.1)",
                  } : undefined}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-medium">
                        Round {round.round}
                      </span>
                      {dispute && (
                        <Badge
                          className={cn(
                            "text-[10px] px-2",
                            dispute.status === "DRAFT" && "bg-amber-500/20 text-amber-400",
                            dispute.status === "SENT" && "bg-primary/20 text-primary",
                            dispute.status === "RESPONDED" && "bg-purple-500/20 text-purple-400",
                            dispute.status === "RESOLVED" && "bg-emerald-500/20 text-emerald-400"
                          )}
                        >
                          {dispute.status}
                        </Badge>
                      )}
                      {round.crossFlow && (
                        <Badge className="text-[10px] px-2 bg-amber-500/30 text-amber-400">
                          CROSS-FLOW
                        </Badge>
                      )}
                    </div>
                    {dispute && (
                      <Badge className="text-[10px] px-2 bg-muted text-muted-foreground">
                        {dispute.cra}
                      </Badge>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-foreground mb-1">
                    {round.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">{round.statute}</p>

                  {/* Dispute Details - Show when dispute exists */}
                  {dispute && (
                    <div className="mt-3 pt-3 border-t border-border">
                      {/* Account List */}
                      {dispute.items && dispute.items.length > 0 && (
                        <div className="mb-3">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
                            Accounts ({accountCount})
                          </span>
                          <div className="space-y-1">
                            {dispute.items.slice(0, 3).map((item, i) => (
                              <div key={i} className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground truncate max-w-[200px]">
                                  {item.accountItem?.creditorName || "Unknown"}
                                </span>
                                {item.accountItem?.balance !== null && item.accountItem?.balance !== undefined && (
                                  <span className="text-red-400 font-mono">
                                    ${Number(item.accountItem.balance).toLocaleString()}
                                  </span>
                                )}
                              </div>
                            ))}
                            {dispute.items.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{dispute.items.length - 3} more accounts
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* FCRA Deadline Tracker */}
                      {dispute.status === "SENT" && daysRemaining !== null && (
                        <div
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-lg text-xs",
                            isOverdue
                              ? "bg-red-500/10 border border-red-500/20"
                              : daysRemaining <= 7
                                ? "bg-amber-500/10 border border-amber-500/20"
                                : "bg-primary/10 border border-primary/20"
                          )}
                        >
                          <Timer className={cn(
                            "w-3.5 h-3.5",
                            isOverdue ? "text-red-400" : daysRemaining <= 7 ? "text-amber-400" : "text-primary"
                          )} />
                          <span className={cn(
                            "font-medium",
                            isOverdue ? "text-red-400" : daysRemaining <= 7 ? "text-amber-400" : "text-primary"
                          )}>
                            {isOverdue
                              ? `${Math.abs(daysRemaining)} days overdue - FCRA violation!`
                              : `${daysRemaining} days remaining`}
                          </span>
                        </div>
                      )}

                      {/* Sent Date */}
                      {round.date && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <Send className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {dispute.status === "DRAFT" ? "Created" : "Sent"}: {round.date}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  {dispute && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 text-xs"
                        onClick={() => onViewLetter?.(dispute.id)}
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        View Letter
                      </Button>
                      {dispute.status === "SENT" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="flex-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-xs"
                          onClick={() => onTrackResponse?.(dispute.id)}
                        >
                          <Clock className="w-3 h-3 mr-1" />
                          Track Response
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Empty state for rounds without disputes */}
                  {!dispute && round.status !== "upcoming" && (
                    <div className="mt-3 text-xs text-muted-foreground italic">
                      No dispute created for this round yet
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state when no disputes */}
        {disputes.length === 0 && (
          <div className="text-center py-12 bg-card rounded-xl border border-border">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No Active Disputes</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Create a dispute from the "Create Dispute" tab to see it tracked here.
              You'll be able to monitor FCRA deadlines and response status.
            </p>
          </div>
        )}
      </div>

      {/* Strategy Panel */}
      <Card className="bg-card border-border p-5 h-fit sticky top-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
          <span>⚔️</span> Current Strategy
        </h3>

        <div className="space-y-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Tone</span>
            <span className="text-sm font-medium text-foreground capitalize">
              {strategy.tone}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Approach</span>
            <span className="text-sm font-medium text-foreground text-right max-w-[200px]">
              {strategy.approach}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Primary Statute</span>
            <Badge className="bg-primary/20 text-primary text-xs">
              {strategy.statute}
            </Badge>
          </div>
        </div>

        {/* Active Dispute Summary */}
        {activeDispute && (
          <div className="mb-4 p-3 rounded-lg bg-muted border border-input">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Active Dispute</span>
              <Badge
                className={cn(
                  "text-[10px]",
                  activeDispute.status === "DRAFT" && "bg-amber-500/20 text-amber-400",
                  activeDispute.status === "SENT" && "bg-primary/20 text-primary"
                )}
              >
                {activeDispute.status}
              </Badge>
            </div>
            <div className="text-sm font-medium text-foreground mb-1">
              {activeDispute.cra} Round {activeDispute.round}
            </div>
            <div className="text-xs text-muted-foreground">
              {activeDispute.itemCount || activeDispute.items?.length || 0} accounts • {activeDispute.flow} flow
            </div>
          </div>
        )}

        {/* Deadline Warning */}
        {fcraDeadline && (
          <div className={cn(
            "flex items-start gap-3 p-3 rounded-lg border",
            activeDispute?.status === "SENT"
              ? "bg-primary/10 border-primary/20"
              : "bg-amber-500/10 border-amber-500/20"
          )}>
            <AlertTriangle className={cn(
              "w-5 h-5 flex-shrink-0 mt-0.5",
              activeDispute?.status === "SENT" ? "text-primary" : "text-amber-400"
            )} />
            <div>
              <strong className="text-sm text-foreground block">
                {activeDispute?.status === "SENT" ? "FCRA 30-Day Deadline" : "Next Deadline"}
              </strong>
              <p className="text-xs text-muted-foreground mt-0.5">
                CRA must respond by {fcraDeadline.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </div>
        )}

        {/* Refresh Button */}
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="w-full mt-4 border-input text-muted-foreground hover:text-foreground"
          >
            <Loader2 className="w-3 h-3 mr-2" />
            Refresh Status
          </Button>
        )}
      </Card>
    </div>
  );
}
