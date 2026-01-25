"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eye, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { FLOW_INFO, ROUND_STRATEGIES, type ClientWithProfile } from "./types";

interface RoundFlowViewProps {
  client: ClientWithProfile;
  currentRound?: number;
  currentFlow?: string;
  onViewLetter?: (round: number) => void;
  onTrackResponse?: (round: number) => void;
}

interface RoundItem {
  round: number | string;
  name: string;
  statute: string;
  status: "completed" | "current" | "upcoming";
  date?: string;
  crossFlow?: boolean;
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
  onViewLetter,
  onTrackResponse,
}: RoundFlowViewProps) {
  const [selectedFlow, setSelectedFlow] = useState(currentFlow);

  const getRounds = () => {
    let rounds: RoundItem[];
    switch (selectedFlow) {
      case "COLLECTION":
        rounds = COLLECTION_ROUNDS;
        break;
      case "CONSENT":
        rounds = CONSENT_ROUNDS;
        break;
      default:
        rounds = ACCURACY_ROUNDS;
    }

    // Update status based on current round
    return rounds.map((r, index) => {
      const roundNum = typeof r.round === "number" ? r.round : index + 1;
      let status: "completed" | "current" | "upcoming" = "upcoming";
      if (roundNum < currentRound) status = "completed";
      else if (roundNum === currentRound) status = "current";

      return {
        ...r,
        status,
        date: status === "current" ? new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : undefined,
      };
    });
  };

  const rounds = getRounds();
  const flowInfo = FLOW_INFO[selectedFlow];
  const strategy = ROUND_STRATEGIES[Math.min(currentRound, 4)];

  // Calculate FCRA deadline (30 days from today for current round)
  const fcraDeadline = new Date();
  fcraDeadline.setDate(fcraDeadline.getDate() + 30);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      {/* Main Content */}
      <div>
        {/* Flow Selection Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {Object.entries(FLOW_INFO).map(([flow, info]) => (
            <button
              key={flow}
              onClick={() => setSelectedFlow(flow)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all text-sm font-medium",
                selectedFlow === flow
                  ? "border-opacity-50"
                  : "bg-slate-700/30 border-slate-600/50 text-slate-400 hover:border-slate-500/50"
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
            </button>
          ))}
        </div>

        {/* Flow Description */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-1">
            {selectedFlow} Flow
          </h2>
          <p className="text-slate-400 text-sm mb-2">{flowInfo.description}</p>
          <Badge
            className="text-xs"
            style={{
              background: `${flowInfo.color}20`,
              color: flowInfo.color
            }}
          >
            {flowInfo.maxRounds} Rounds Available
          </Badge>
        </div>

        {/* Timeline */}
        <div className="space-y-0">
          {rounds.map((round, index) => (
            <div key={index} className="flex gap-4">
              {/* Connector */}
              <div className="flex flex-col items-center w-10">
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white z-10",
                    round.status === "completed" && "bg-emerald-500",
                    round.status === "current" && "shadow-lg",
                    round.status === "upcoming" && "bg-slate-700"
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
                      round.status === "completed" ? "bg-emerald-500" : "bg-slate-700"
                    )}
                  />
                )}
              </div>

              {/* Content */}
              <div
                className={cn(
                  "flex-1 rounded-xl border p-4 mb-4 transition-all",
                  round.status === "current" && "border-opacity-30",
                  round.status === "upcoming" && "bg-slate-800/60 border-slate-700/50",
                  round.status === "completed" && "bg-slate-800/40 border-slate-700/30 opacity-60",
                  round.crossFlow && "border-amber-500/30"
                )}
                style={round.status === "current" ? {
                  background: `${flowInfo.color}10`,
                  borderColor: `${flowInfo.color}30`,
                } : round.crossFlow ? {
                  background: "rgba(245, 158, 11, 0.1)",
                } : undefined}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-slate-500 font-medium">
                    Round {round.round}
                  </span>
                  {round.status === "current" && (
                    <Badge className="text-[10px] px-2 bg-purple-500/30 text-purple-400">
                      CURRENT
                    </Badge>
                  )}
                  {round.crossFlow && (
                    <Badge className="text-[10px] px-2 bg-amber-500/30 text-amber-400">
                      CROSS-FLOW
                    </Badge>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">
                  {round.name}
                </h3>
                <p className="text-xs text-slate-500">{round.statute}</p>
                {round.date && (
                  <span
                    className="block text-xs mt-2"
                    style={{ color: flowInfo.color }}
                  >
                    {round.date}
                  </span>
                )}
                {round.status === "current" && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 text-xs"
                      onClick={() => onViewLetter?.(typeof round.round === "number" ? round.round : 1)}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      View Letter
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-xs"
                      onClick={() => onTrackResponse?.(typeof round.round === "number" ? round.round : 1)}
                    >
                      <Clock className="w-3 h-3 mr-1" />
                      Track Response
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Strategy Panel */}
      <Card className="bg-slate-800/60 border-slate-700/50 p-5 h-fit sticky top-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-4">
          <span>⚔️</span> Current Strategy
        </h3>

        <div className="space-y-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">Tone</span>
            <span className="text-sm font-medium text-white capitalize">
              {strategy.tone}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">Approach</span>
            <span className="text-sm font-medium text-white text-right max-w-[200px]">
              {strategy.approach}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">Primary Statute</span>
            <Badge className="bg-blue-500/20 text-blue-400 text-xs">
              {strategy.statute}
            </Badge>
          </div>
        </div>

        {/* Deadline Warning */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-sm text-white block">FCRA 30-Day Deadline</strong>
            <p className="text-xs text-slate-400 mt-0.5">
              CRA must respond by {fcraDeadline.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
