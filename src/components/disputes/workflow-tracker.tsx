"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Circle,
  ArrowRight,
  AlertTriangle,
  FileText,
  Send,
  Clock,
  Scale,
  Gavel,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import {
  getRoundStrategy,
  getNextStepRecommendation,
  FLOW_DESCRIPTIONS,
  type DisputeFlow,
  type ResponseOutcome,
} from "@/lib/dispute-rounds";

interface WorkflowTrackerProps {
  currentRound: number;
  currentStatus: string;
  flow: DisputeFlow;
  responseOutcome?: ResponseOutcome;
  sentDate?: string;
  respondedDate?: string;
  onCreateNextRound?: () => void;
}

export function WorkflowTracker({
  currentRound,
  currentStatus,
  flow,
  responseOutcome,
  sentDate,
  onCreateNextRound,
}: WorkflowTrackerProps) {
  const strategy = getRoundStrategy(currentRound);
  const recommendation = responseOutcome
    ? getNextStepRecommendation(currentRound, flow, responseOutcome)
    : null;

  // Calculate days waiting if sent
  const daysWaiting = sentDate
    ? Math.floor((Date.now() - new Date(sentDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const rounds = [
    { num: 1, name: "Initial Dispute", icon: FileText },
    { num: 2, name: "MOV Demand", icon: MessageSquare },
    { num: 3, name: "Violation Notice", icon: AlertTriangle },
    { num: 4, name: "Final Demand", icon: Gavel },
  ];

  const getStepStatus = (roundNum: number) => {
    if (roundNum < currentRound) return "completed";
    if (roundNum === currentRound) return "current";
    return "upcoming";
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "critical":
        return "bg-brand-error/20 text-brand-error border-brand-error/30";
      case "high":
        return "bg-brand-warning/20 text-brand-warning border-brand-warning/30";
      case "medium":
        return "bg-brand-info/20 text-brand-info border-brand-info/30";
      default:
        return "bg-brand-success/20 text-brand-success border-brand-success/30";
    }
  };

  return (
    <div className="space-y-4">
      {/* Visual Timeline */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Scale className="w-4 h-4" />
            Dispute Journey - Round {currentRound}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {FLOW_DESCRIPTIONS[flow]?.name || flow} Flow
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Timeline */}
          <div className="flex items-center justify-between mb-6">
            {rounds.map((round, idx) => {
              const status = getStepStatus(round.num);
              const Icon = round.icon;
              return (
                <div key={round.num} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        status === "completed"
                          ? "bg-brand-success/20 border-2 border-brand-success"
                          : status === "current"
                          ? "bg-primary/20 border-2 border-primary animate-pulse"
                          : "bg-slate-700/50 border-2 border-slate-600"
                      }`}
                    >
                      {status === "completed" ? (
                        <CheckCircle className="w-5 h-5 text-brand-success" />
                      ) : (
                        <Icon
                          className={`w-5 h-5 ${
                            status === "current" ? "text-primary" : "text-slate-500"
                          }`}
                        />
                      )}
                    </div>
                    <span
                      className={`text-xs mt-1 ${
                        status === "current"
                          ? "text-primary font-medium"
                          : status === "completed"
                          ? "text-brand-success"
                          : "text-slate-500"
                      }`}
                    >
                      R{round.num}
                    </span>
                    <span
                      className={`text-xs ${
                        status === "current" ? "text-white" : "text-slate-500"
                      }`}
                    >
                      {round.name}
                    </span>
                  </div>
                  {idx < rounds.length - 1 && (
                    <div
                      className={`w-12 h-0.5 mx-2 ${
                        getStepStatus(round.num + 1) === "upcoming"
                          ? "bg-slate-600"
                          : "bg-brand-success"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Current Round Strategy */}
          <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-white">{strategy.name}</h4>
              <Badge
                variant="outline"
                className={
                  strategy.tone === "litigation"
                    ? "bg-brand-error/20 text-brand-error border-brand-error/30"
                    : strategy.tone === "aggressive"
                    ? "bg-brand-warning/20 text-brand-warning border-brand-warning/30"
                    : strategy.tone === "assertive"
                    ? "bg-brand-info/20 text-brand-info border-brand-info/30"
                    : "bg-brand-success/20 text-brand-success border-brand-success/30"
                }
              >
                {strategy.tone}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mb-3">{strategy.approach}</p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-slate-500 mb-1">Key Points:</p>
                <ul className="space-y-0.5">
                  {strategy.keyPoints.slice(0, 2).map((point, i) => (
                    <li key={i} className="text-slate-300 flex items-start gap-1">
                      <span className="text-primary">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Legal Focus:</p>
                <ul className="space-y-0.5">
                  {strategy.legalEmphasis.slice(0, 2).map((law, i) => (
                    <li key={i} className="text-slate-300 flex items-start gap-1">
                      <span className="text-brand-warning">§</span>
                      <span className="truncate">{law.split(" - ")[0]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Status Indicator */}
          {currentStatus === "SENT" && daysWaiting > 0 && (
            <div className="mt-3 p-2 bg-brand-warning/10 rounded border border-brand-warning/30">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-warning" />
                <span className="text-sm text-brand-warning">
                  Waiting for response: {daysWaiting} days
                  {daysWaiting >= 30 && (
                    <span className="ml-2 text-brand-error font-medium">
                      (FCRA 30-day deadline exceeded!)
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Next Step Recommendation */}
      {recommendation && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <ArrowRight className="w-4 h-4" />
                Recommended Next Step
              </CardTitle>
              <Badge variant="outline" className={getUrgencyColor(recommendation.urgency)}>
                {recommendation.urgency.toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <h4 className="text-white font-medium mb-2">{recommendation.action}</h4>
            <p className="text-sm text-slate-400 mb-4">{recommendation.description}</p>

            <div className="space-y-2 mb-4">
              <p className="text-xs text-slate-500 uppercase">Action Items:</p>
              {recommendation.additionalSteps.map((step, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-sm text-slate-300"
                >
                  <Circle className="w-3 h-3 mt-1 text-slate-500" />
                  <span>{step}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {recommendation.suggestedRound && recommendation.suggestedRound > currentRound && (
                <Button
                  size="sm"
                  onClick={onCreateNextRound}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Send className="w-4 h-4 mr-1" />
                  Create Round {recommendation.suggestedRound}
                </Button>
              )}
              {recommendation.urgency === "critical" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                  onClick={() =>
                    window.open("https://www.consumerfinance.gov/complaint/", "_blank")
                  }
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  File CFPB Complaint
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Flow Guide */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-sm">Dispute Flow Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(FLOW_DESCRIPTIONS).map(([key, desc]) => (
              <div
                key={key}
                className={`p-2 rounded border ${
                  key === flow
                    ? "bg-primary/10 border-primary/50"
                    : "bg-slate-700/30 border-slate-600"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-sm font-medium ${
                      key === flow ? "text-primary" : "text-white"
                    }`}
                  >
                    {desc.name}
                  </span>
                  {key === flow && (
                    <Badge className="bg-primary/20 text-primary text-xs">Current</Badge>
                  )}
                </div>
                <p className="text-xs text-slate-400">{desc.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
