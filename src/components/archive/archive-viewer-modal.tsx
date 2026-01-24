"use client";

import { useState, useEffect } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogBody,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Archive,
  User,
  Brain,
  Scale,
  MessageSquare,
  FileText,
  History,
  Bot,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { ComprehensiveArchiveSnapshot } from "@/lib/archive/types";

interface ArchiveViewerModalProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
}

export function ArchiveViewerModal({
  open,
  onClose,
  clientId,
  clientName,
}: ArchiveViewerModalProps) {
  const [snapshot, setSnapshot] = useState<ComprehensiveArchiveSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && clientId) {
      setLoading(true);
      fetch(`/api/clients/archived/${clientId}`)
        .then((res) => res.json())
        .then((data) => {
          setSnapshot(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [open, clientId]);

  if (!open) return null;

  return (
    <ResponsiveDialog open={open} onOpenChange={onClose}>
      <ResponsiveDialogContent size="xl" className="max-h-[90vh]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Archive className="w-5 h-5" />
            Archive: {clientName}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : !snapshot ? (
            <div className="text-center py-12 text-slate-400">
              Failed to load archive data
            </div>
          ) : (
            <div className="space-y-4">
              {/* AMELIA Recommendation Banner */}
              <Card className="bg-purple-900/30 border-purple-700">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Bot className="w-6 h-6 text-purple-400 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-purple-300 mb-1">
                        AMELIA Recommendation
                      </h4>
                      <p className="text-sm text-slate-300">
                        {snapshot.ameliaContext.personalizedMessage}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge className="bg-purple-600">
                          {snapshot.ameliaContext.recommendedAction.replace(/_/g, " ")}
                        </Badge>
                        {snapshot.ameliaContext.lastActiveFlow && (
                          <Badge variant="outline" className="border-purple-500 text-purple-300">
                            Last Flow: {snapshot.ameliaContext.lastActiveFlow}
                          </Badge>
                        )}
                        {snapshot.ameliaContext.lastActiveRound > 0 && (
                          <Badge variant="outline" className="border-purple-500 text-purple-300">
                            Round {snapshot.ameliaContext.lastActiveRound}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tabs */}
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="bg-slate-800 border-slate-700 w-full justify-start">
                  <TabsTrigger value="overview">
                    <User className="w-4 h-4 mr-2" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="creditdna">
                    <Brain className="w-4 h-4 mr-2" />
                    Credit DNA
                  </TabsTrigger>
                  <TabsTrigger value="disputes">
                    <Scale className="w-4 h-4 mr-2" />
                    Disputes
                  </TabsTrigger>
                  <TabsTrigger value="communications">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Communications
                  </TabsTrigger>
                  <TabsTrigger value="audit">
                    <History className="w-4 h-4 mr-2" />
                    Audit Trail
                  </TabsTrigger>
                </TabsList>

                <div className="h-[400px] mt-4 overflow-y-auto">
                  <TabsContent value="overview" className="mt-0">
                    <OverviewTab snapshot={snapshot} />
                  </TabsContent>
                  <TabsContent value="creditdna" className="mt-0">
                    <CreditDNATab snapshot={snapshot} />
                  </TabsContent>
                  <TabsContent value="disputes" className="mt-0">
                    <DisputesTab snapshot={snapshot} />
                  </TabsContent>
                  <TabsContent value="communications" className="mt-0">
                    <CommunicationsTab snapshot={snapshot} />
                  </TabsContent>
                  <TabsContent value="audit" className="mt-0">
                    <AuditTab snapshot={snapshot} />
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          )}
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function OverviewTab({ snapshot }: { snapshot: ComprehensiveArchiveSnapshot }) {
  const { clientProfile, metadata, ameliaContext } = snapshot;

  return (
    <div className="space-y-4">
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-sm">Client Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-400">Name</p>
            <p className="text-white">{clientProfile.firstName} {clientProfile.lastName}</p>
          </div>
          <div>
            <p className="text-slate-400">Email</p>
            <p className="text-white">{clientProfile.email || "N/A"}</p>
          </div>
          <div>
            <p className="text-slate-400">Phone</p>
            <p className="text-white">{clientProfile.phone || "N/A"}</p>
          </div>
          <div>
            <p className="text-slate-400">Address</p>
            <p className="text-white">
              {clientProfile.addressLine1 || "N/A"}
              {clientProfile.city && `, ${clientProfile.city}, ${clientProfile.state} ${clientProfile.zipCode}`}
            </p>
          </div>
          <div>
            <p className="text-slate-400">Stage</p>
            <Badge variant="outline">{clientProfile.stage}</Badge>
          </div>
          <div>
            <p className="text-slate-400">Success Rate</p>
            <p className="text-white">{clientProfile.successRate?.toFixed(0) || 0}%</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-sm">Record Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-white">{metadata.recordCounts.disputes}</p>
              <p className="text-xs text-slate-400">Disputes</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{metadata.recordCounts.accounts}</p>
              <p className="text-xs text-slate-400">Accounts</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{metadata.recordCounts.communications}</p>
              <p className="text-xs text-slate-400">Communications</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{metadata.recordCounts.creditScores}</p>
              <p className="text-xs text-slate-400">Score Records</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-sm">Dispute Strategy Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Success Rate</span>
            <span className="text-white font-medium">{ameliaContext.disputeStrategySummary.successRate}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Most Effective Flow</span>
            <Badge>{ameliaContext.disputeStrategySummary.mostEffectiveFlow || "N/A"}</Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Most Resistant CRA</span>
            <Badge variant="destructive">{ameliaContext.disputeStrategySummary.mostResistantCRA || "N/A"}</Badge>
          </div>
          {ameliaContext.disputeStrategySummary.outstandingIssues.length > 0 && (
            <div>
              <p className="text-slate-400 mb-2">Outstanding Issues:</p>
              <ul className="text-sm text-slate-300 space-y-1">
                {ameliaContext.disputeStrategySummary.outstandingIssues.map((issue, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CreditDNATab({ snapshot }: { snapshot: ComprehensiveArchiveSnapshot }) {
  const { creditDNA, ameliaContext } = snapshot;

  if (!creditDNA) {
    return (
      <div className="text-center py-8 text-slate-400">
        No Credit DNA analysis available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Credit Profile Classification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Badge className="text-lg px-4 py-2 bg-blue-600">
              {creditDNA.classification.replace(/_/g, " ")}
            </Badge>
            <span className="text-slate-400">Confidence: {creditDNA.confidence}%</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-slate-900/50 rounded-lg">
              <p className="text-3xl font-bold text-emerald-400">{creditDNA.healthScore}</p>
              <p className="text-xs text-slate-400">Health Score</p>
            </div>
            <div className="text-center p-4 bg-slate-900/50 rounded-lg">
              <p className="text-3xl font-bold text-blue-400">{creditDNA.improvementPotential}</p>
              <p className="text-xs text-slate-400">Improvement Potential</p>
            </div>
            <div className="text-center p-4 bg-slate-900/50 rounded-lg">
              <p className="text-3xl font-bold text-amber-400">{creditDNA.urgencyScore}</p>
              <p className="text-xs text-slate-400">Urgency Score</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-sm">Key Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {(ameliaContext.creditProfileSummary.keyInsights.length > 0
              ? ameliaContext.creditProfileSummary.keyInsights
              : creditDNA.keyInsights
            ).map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <TrendingUp className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                {insight}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function DisputesTab({ snapshot }: { snapshot: ComprehensiveArchiveSnapshot }) {
  const { disputes, disputeResponses } = snapshot;

  return (
    <div className="space-y-4">
      {disputes.length === 0 ? (
        <div className="text-center py-8 text-slate-400">No disputes found</div>
      ) : (
        disputes.map((dispute) => {
          const responses = disputeResponses.filter((r) =>
            dispute.items.some((item) => item.id === r.disputeItemId)
          );
          const deletedCount = responses.filter((r) => r.outcome === "DELETED").length;

          return (
            <Card key={dispute.id} className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Scale className="w-4 h-4" />
                    {dispute.cra} - Round {dispute.round}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Badge variant="outline">{dispute.flow}</Badge>
                    <Badge className={
                      dispute.status === "RESOLVED" ? "bg-emerald-600" :
                      dispute.status === "SENT" ? "bg-blue-600" :
                      "bg-slate-600"
                    }>
                      {dispute.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-slate-400 mb-3">
                  Created: {new Date(dispute.createdAt).toLocaleDateString()}
                  {dispute.sentDate && ` | Sent: ${new Date(dispute.sentDate).toLocaleDateString()}`}
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-slate-400">Items ({dispute.items.length}):</p>
                  {dispute.items.map((item) => {
                    const response = responses.find((r) => r.disputeItemId === item.id);
                    return (
                      <div key={item.id} className="flex items-center justify-between text-sm bg-slate-900/50 p-2 rounded">
                        <span className="text-slate-300">{item.accountItem.creditorName}</span>
                        <div className="flex items-center gap-2">
                          {response ? (
                            response.outcome === "DELETED" ? (
                              <Badge className="bg-emerald-600">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Deleted
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-amber-500 text-amber-400">
                                {response.outcome}
                              </Badge>
                            )
                          ) : (
                            <Badge variant="outline" className="border-slate-500">
                              Pending
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 text-xs text-slate-400">
                  Results: {deletedCount}/{dispute.items.length} items deleted
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

function CommunicationsTab({ snapshot }: { snapshot: ComprehensiveArchiveSnapshot }) {
  const { communications } = snapshot;

  return (
    <div className="space-y-3">
      {communications.length === 0 ? (
        <div className="text-center py-8 text-slate-400">No communications found</div>
      ) : (
        communications.slice(0, 20).map((comm) => (
          <Card key={comm.id} className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-400" />
                  <Badge variant="outline">{comm.type}</Badge>
                  <Badge variant="outline" className={
                    comm.direction === "OUTBOUND" ? "border-emerald-500 text-emerald-400" :
                    "border-blue-500 text-blue-400"
                  }>
                    {comm.direction}
                  </Badge>
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(comm.createdAt).toLocaleDateString()}
                </span>
              </div>
              {comm.subject && (
                <p className="text-sm font-medium text-white mt-2">{comm.subject}</p>
              )}
              <p className="text-sm text-slate-300 mt-1 line-clamp-2">{comm.content}</p>
            </CardContent>
          </Card>
        ))
      )}
      {communications.length > 20 && (
        <p className="text-center text-sm text-slate-400">
          Showing 20 of {communications.length} communications
        </p>
      )}
    </div>
  );
}

function AuditTab({ snapshot }: { snapshot: ComprehensiveArchiveSnapshot }) {
  const { eventLogs, ameliaContext } = snapshot;

  return (
    <div className="space-y-4">
      {/* Compliance Summary */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-sm">Compliance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-slate-900/50 rounded">
              <p className="text-2xl font-bold text-red-400">
                {ameliaContext.complianceAuditTrail.totalFCRAViolations}
              </p>
              <p className="text-xs text-slate-400">FCRA Violations</p>
            </div>
            <div className="p-3 bg-slate-900/50 rounded">
              <p className="text-2xl font-bold text-amber-400">
                {ameliaContext.complianceAuditTrail.pendingDeadlines}
              </p>
              <p className="text-xs text-slate-400">Missed Deadlines</p>
            </div>
            <div className="p-3 bg-slate-900/50 rounded">
              <p className="text-2xl font-bold text-orange-400">
                {ameliaContext.complianceAuditTrail.lateResponses}
              </p>
              <p className="text-xs text-slate-400">Late Responses</p>
            </div>
          </div>
          {ameliaContext.complianceAuditTrail.violationDetails.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-slate-400 mb-2">Violation Details:</p>
              <ul className="space-y-1">
                {ameliaContext.complianceAuditTrail.violationDetails.map((detail, i) => (
                  <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    {detail}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Log */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-sm">Event Log ({eventLogs.length} events)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {eventLogs.slice(0, 30).map((event) => (
              <div key={event.id} className="flex items-start gap-3 text-sm p-2 bg-slate-900/50 rounded">
                <History className="w-4 h-4 text-slate-400 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">{event.eventType}</Badge>
                    <span className="text-xs text-slate-400">
                      {new Date(event.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {event.actorEmail && (
                    <p className="text-xs text-slate-400 mt-1">By: {event.actorEmail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
