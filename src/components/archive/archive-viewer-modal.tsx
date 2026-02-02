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
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !snapshot ? (
            <div className="text-center py-12 text-muted-foreground">
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
                      <p className="text-sm text-muted-foreground">
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
                <TabsList className="bg-card border-border w-full justify-start">
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
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-sm">Client Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Name</p>
            <p className="text-foreground">{clientProfile.firstName} {clientProfile.lastName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="text-foreground">{clientProfile.email || "N/A"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Phone</p>
            <p className="text-foreground">{clientProfile.phone || "N/A"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Address</p>
            <p className="text-foreground">
              {clientProfile.addressLine1 || "N/A"}
              {clientProfile.city && `, ${clientProfile.city}, ${clientProfile.state} ${clientProfile.zipCode}`}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Stage</p>
            <Badge variant="outline">{clientProfile.stage}</Badge>
          </div>
          <div>
            <p className="text-muted-foreground">Success Rate</p>
            <p className="text-foreground">{clientProfile.successRate?.toFixed(0) || 0}%</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-sm">Record Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-foreground">{metadata.recordCounts.disputes}</p>
              <p className="text-xs text-muted-foreground">Disputes</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{metadata.recordCounts.accounts}</p>
              <p className="text-xs text-muted-foreground">Accounts</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{metadata.recordCounts.communications}</p>
              <p className="text-xs text-muted-foreground">Communications</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{metadata.recordCounts.creditScores}</p>
              <p className="text-xs text-muted-foreground">Score Records</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-sm">Dispute Strategy Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Success Rate</span>
            <span className="text-foreground font-medium">{ameliaContext.disputeStrategySummary.successRate}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Most Effective Flow</span>
            <Badge>{ameliaContext.disputeStrategySummary.mostEffectiveFlow || "N/A"}</Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Most Resistant CRA</span>
            <Badge variant="destructive">{ameliaContext.disputeStrategySummary.mostResistantCRA || "N/A"}</Badge>
          </div>
          {ameliaContext.disputeStrategySummary.outstandingIssues.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-2">Outstanding Issues:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
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
      <div className="text-center py-8 text-muted-foreground">
        No Credit DNA analysis available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-sm flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Credit Profile Classification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Badge className="text-lg px-4 py-2 bg-primary">
              {creditDNA.classification.replace(/_/g, " ")}
            </Badge>
            <span className="text-muted-foreground">Confidence: {creditDNA.confidence}%</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-background rounded-lg">
              <p className="text-3xl font-bold text-emerald-400">{creditDNA.healthScore}</p>
              <p className="text-xs text-muted-foreground">Health Score</p>
            </div>
            <div className="text-center p-4 bg-background rounded-lg">
              <p className="text-3xl font-bold text-primary">{creditDNA.improvementPotential}</p>
              <p className="text-xs text-muted-foreground">Improvement Potential</p>
            </div>
            <div className="text-center p-4 bg-background rounded-lg">
              <p className="text-3xl font-bold text-amber-400">{creditDNA.urgencyScore}</p>
              <p className="text-xs text-muted-foreground">Urgency Score</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-sm">Key Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {(ameliaContext.creditProfileSummary.keyInsights.length > 0
              ? ameliaContext.creditProfileSummary.keyInsights
              : creditDNA.keyInsights
            ).map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <TrendingUp className="w-4 h-4 text-primary mt-0.5 shrink-0" />
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
        <div className="text-center py-8 text-muted-foreground">No disputes found</div>
      ) : (
        disputes.map((dispute) => {
          const responses = disputeResponses.filter((r) =>
            dispute.items.some((item) => item.id === r.disputeItemId)
          );
          const deletedCount = responses.filter((r) => r.outcome === "DELETED").length;

          return (
            <Card key={dispute.id} className="bg-card border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground text-sm flex items-center gap-2">
                    <Scale className="w-4 h-4" />
                    {dispute.cra} - Round {dispute.round}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Badge variant="outline">{dispute.flow}</Badge>
                    <Badge className={
                      dispute.status === "RESOLVED" ? "bg-emerald-600" :
                      dispute.status === "SENT" ? "bg-primary" :
                      "bg-muted"
                    }>
                      {dispute.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground mb-3">
                  Created: {new Date(dispute.createdAt).toLocaleDateString()}
                  {dispute.sentDate && ` | Sent: ${new Date(dispute.sentDate).toLocaleDateString()}`}
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Items ({dispute.items.length}):</p>
                  {dispute.items.map((item) => {
                    const response = responses.find((r) => r.disputeItemId === item.id);
                    return (
                      <div key={item.id} className="flex items-center justify-between text-sm bg-background p-2 rounded">
                        <span className="text-muted-foreground">{item.accountItem.creditorName}</span>
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
                            <Badge variant="outline" className="border-border">
                              Pending
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
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
        <div className="text-center py-8 text-muted-foreground">No communications found</div>
      ) : (
        communications.slice(0, 20).map((comm) => (
          <Card key={comm.id} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <Badge variant="outline">{comm.type}</Badge>
                  <Badge variant="outline" className={
                    comm.direction === "OUTBOUND" ? "border-emerald-500 text-emerald-400" :
                    "border-blue-500 text-primary"
                  }>
                    {comm.direction}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(comm.createdAt).toLocaleDateString()}
                </span>
              </div>
              {comm.subject && (
                <p className="text-sm font-medium text-foreground mt-2">{comm.subject}</p>
              )}
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{comm.content}</p>
            </CardContent>
          </Card>
        ))
      )}
      {communications.length > 20 && (
        <p className="text-center text-sm text-muted-foreground">
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
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-sm">Compliance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-background rounded">
              <p className="text-2xl font-bold text-red-400">
                {ameliaContext.complianceAuditTrail.totalFCRAViolations}
              </p>
              <p className="text-xs text-muted-foreground">FCRA Violations</p>
            </div>
            <div className="p-3 bg-background rounded">
              <p className="text-2xl font-bold text-amber-400">
                {ameliaContext.complianceAuditTrail.pendingDeadlines}
              </p>
              <p className="text-xs text-muted-foreground">Missed Deadlines</p>
            </div>
            <div className="p-3 bg-background rounded">
              <p className="text-2xl font-bold text-orange-400">
                {ameliaContext.complianceAuditTrail.lateResponses}
              </p>
              <p className="text-xs text-muted-foreground">Late Responses</p>
            </div>
          </div>
          {ameliaContext.complianceAuditTrail.violationDetails.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">Violation Details:</p>
              <ul className="space-y-1">
                {ameliaContext.complianceAuditTrail.violationDetails.map((detail, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
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
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-sm">Event Log ({eventLogs.length} events)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {eventLogs.slice(0, 30).map((event) => (
              <div key={event.id} className="flex items-start gap-3 text-sm p-2 bg-background rounded">
                <History className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">{event.eventType}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {event.actorEmail && (
                    <p className="text-xs text-muted-foreground mt-1">By: {event.actorEmail}</p>
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
