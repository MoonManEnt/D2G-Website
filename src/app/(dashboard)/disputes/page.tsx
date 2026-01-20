"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Scale,
  Plus,
  FileText,
  Send,
  CheckCircle,
  Clock,
  Loader2,
  Eye,
  Printer,
  Calendar,
  Edit3,
  Download,
  AlertTriangle,
  Copy,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/lib/use-toast";
import { LetterEditor } from "@/components/disputes/letter-editor";
import { WorkflowTracker } from "@/components/disputes/workflow-tracker";
import { type DisputeFlow, type ResponseOutcome, FLOW_DESCRIPTIONS } from "@/lib/dispute-rounds";

interface DisputeItem {
  id: string;
  disputeReason: string | null;
  outcome: string | null;
  accountItem: {
    id: string;
    creditorName: string;
    maskedAccountId: string | null;
    balance: number | null;
  };
}

interface Dispute {
  id: string;
  cra: string;
  flow: string;
  round: number;
  status: string;
  createdAt: string;
  approvedAt: string | null;
  sentAt: string | null;
  respondedAt: string | null;
  resolvedAt: string | null;
  responseNotes: string | null;
  responseOutcome: string | null;
  client: {
    id: string;
    firstName: string;
    lastName: string;
  };
  items: DisputeItem[];
  _count: {
    items: number;
    documents: number;
  };
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
}

interface NegativeAccount {
  id: string;
  creditorName: string;
  maskedAccountId: string | null;
  cra: string;
  balance: number | null;
  issueCount: number;
  suggestedFlow: string | null;
  client: { id: string };
}

export default function DisputesPage() {
  const { toast } = useToast();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [negativeAccounts, setNegativeAccounts] = useState<NegativeAccount[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedCRA, setSelectedCRA] = useState<string>("");
  const [selectedFlow, setSelectedFlow] = useState<string>("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [responseNotes, setResponseNotes] = useState("");
  const [responseOutcome, setResponseOutcome] = useState("");

  // Letter editor state
  const [letterEditorOpen, setLetterEditorOpen] = useState(false);
  const [letterContent, setLetterContent] = useState("");
  const [currentDocument, setCurrentDocument] = useState<{ id: string; title: string } | null>(null);

  // CFPB modal state
  const [cfpbDialogOpen, setCfpbDialogOpen] = useState(false);
  const [cfpbContent, setCfpbContent] = useState<{ complaint: Record<string, string>; copyText: string; metadata: Record<string, unknown> } | null>(null);
  const [cfpbLoading, setCfpbLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchDisputes = useCallback(async () => {
    try {
      const res = await fetch("/api/disputes");
      if (res.ok) {
        const data = await res.json();
        setDisputes(data);
      }
    } catch (error) {
      console.error("Failed to fetch disputes:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDisputes();
    fetch("/api/clients").then((r) => { if (r.ok) r.json().then(setClients); });
    fetch("/api/accounts/negative").then((r) => { if (r.ok) r.json().then((d) => setNegativeAccounts(d.accounts || [])); });
  }, [fetchDisputes]);

  const handleCreateDispute = async () => {
    if (!selectedClient || !selectedCRA || !selectedFlow || selectedAccounts.length === 0) {
      toast({ title: "Missing Information", description: "Please fill all fields", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: selectedClient, cra: selectedCRA, flow: selectedFlow, accountIds: selectedAccounts }),
      });

      if (res.ok) {
        const data = await res.json();
        toast({ title: "Dispute Created", description: `${data.dispute.cra} dispute letter generated` });
        setCreateDialogOpen(false);
        setSelectedClient(""); setSelectedCRA(""); setSelectedFlow(""); setSelectedAccounts([]);
        fetchDisputes();
      } else {
        const error = await res.json();
        toast({ title: "Failed", description: error.error, variant: "destructive" });
      }
    } catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setCreating(false); }
  };

  const handleUpdateStatus = async (disputeId: string, newStatus: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/disputes/${disputeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, responseNotes, responseOutcome }),
      });
      if (res.ok) {
        toast({ title: "Updated" });
        fetchDisputes();
      }
    } catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setUpdating(false); }
  };

  const handleViewLetter = async (disputeId: string) => {
    try {
      // Fetch dispute details with documents
      const res = await fetch(`/api/disputes/${disputeId}`);
      if (res.ok) {
        const dispute = await res.json();
        // Find the dispute letter document
        const letterDoc = dispute.documents?.find((d: { documentType: string }) => d.documentType === "DISPUTE_LETTER");
        if (letterDoc) {
          // Fetch full document content
          const docRes = await fetch(`/api/documents/${letterDoc.id}`);
          if (docRes.ok) {
            const doc = await docRes.json();
            setLetterContent(doc.content || "");
            setCurrentDocument({ id: doc.id, title: doc.title });
            setLetterEditorOpen(true);
          }
        } else {
          toast({ title: "No Letter Found", description: "This dispute does not have a generated letter.", variant: "destructive" });
        }
      }
    } catch {
      toast({ title: "Error", description: "Failed to load letter", variant: "destructive" });
    }
  };

  const handleSaveLetter = async (content: string) => {
    if (!currentDocument) return;
    const res = await fetch(`/api/documents/${currentDocument.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error("Failed to save");
    setLetterContent(content);
  };

  const handleDownloadDocx = async (disputeId: string) => {
    try {
      toast({ title: "Generating...", description: "Preparing your document" });
      const res = await fetch(`/api/disputes/${disputeId}/docx`);
      if (!res.ok) {
        throw new Error("Failed to generate document");
      }
      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition");
      const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || "dispute_letter.docx";

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({ title: "Downloaded", description: filename });
    } catch {
      toast({ title: "Error", description: "Failed to download document", variant: "destructive" });
    }
  };

  const handleViewCFPB = async (disputeId: string) => {
    setCfpbLoading(true);
    setCfpbDialogOpen(true);
    try {
      const res = await fetch(`/api/disputes/${disputeId}/cfpb`);
      if (!res.ok) {
        throw new Error("Failed to generate CFPB complaint");
      }
      const data = await res.json();
      setCfpbContent(data);
    } catch {
      toast({ title: "Error", description: "Failed to generate CFPB complaint", variant: "destructive" });
      setCfpbDialogOpen(false);
    } finally {
      setCfpbLoading(false);
    }
  };

  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "Copied!", description: "CFPB complaint copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Error", description: "Failed to copy to clipboard", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    const cfg: Record<string, string> = {
      DRAFT: "bg-slate-500/20 text-slate-400",
      APPROVED: "bg-brand-info/20 text-brand-info",
      SENT: "bg-brand-warning/20 text-brand-warning",
      RESPONDED: "bg-brand-accent/20 text-brand-accent",
      RESOLVED: "bg-brand-success/20 text-brand-success",
    };
    return <Badge className={cfg[status] || cfg.DRAFT}>{status}</Badge>;
  };

  const getCRABadge = (cra: string) => {
    const c: Record<string, string> = { TRANSUNION: "bg-sky-600/20 text-sky-400", EXPERIAN: "bg-blue-600/20 text-blue-400", EQUIFAX: "bg-red-600/20 text-red-400" };
    return <Badge className={c[cra] || ""}>{cra}</Badge>;
  };

  const filteredAccounts = negativeAccounts.filter((a) => (!selectedClient || a.client?.id === selectedClient) && (!selectedCRA || a.cra === selectedCRA));

  const draftDisputes = disputes.filter((d) => d.status === "DRAFT");
  const activeDisputes = disputes.filter((d) => ["APPROVED", "SENT", "RESPONDED"].includes(d.status));
  const resolvedDisputes = disputes.filter((d) => d.status === "RESOLVED");

  return (
    <div className="space-y-6 lg:ml-64 pt-16 lg:pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Disputes</h1>
          <p className="text-slate-400 mt-1">Manage credit report dispute letters</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Dispute
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-white">{disputes.length}</p>
            <p className="text-xs text-slate-400">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-brand-warning">{draftDisputes.length}</p>
            <p className="text-xs text-slate-400">Drafts</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-brand-info">{activeDisputes.length}</p>
            <p className="text-xs text-slate-400">In Progress</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-brand-success">{resolvedDisputes.length}</p>
            <p className="text-xs text-slate-400">Resolved</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-slate-800 border-slate-700">
          <TabsTrigger value="all">All ({disputes.length})</TabsTrigger>
          <TabsTrigger value="draft">Drafts ({draftDisputes.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({activeDisputes.length})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({resolvedDisputes.length})</TabsTrigger>
        </TabsList>

        {["all", "draft", "active", "resolved"].map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4">
            {loading ? (
              <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" /></div>
            ) : (tab === "all" ? disputes : tab === "draft" ? draftDisputes : tab === "active" ? activeDisputes : resolvedDisputes).length === 0 ? (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="py-12 text-center">
                  <Scale className="w-12 h-12 mx-auto text-slate-600" />
                  <p className="text-slate-400 mt-4">No disputes</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {(tab === "all" ? disputes : tab === "draft" ? draftDisputes : tab === "active" ? activeDisputes : resolvedDisputes).map((dispute) => (
                  <Card key={dispute.id} className="bg-slate-800/50 border-slate-700 hover:border-slate-600">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded bg-purple-500/20 flex items-center justify-center">
                            <Scale className="w-5 h-5 text-purple-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-white">{dispute.client.firstName} {dispute.client.lastName}</p>
                              {getCRABadge(dispute.cra)}
                              <Badge variant="outline">R{dispute.round}</Badge>
                            </div>
                            <p className="text-sm text-slate-400">{dispute._count.items} items • {dispute.flow} • {new Date(dispute.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {getStatusBadge(dispute.status)}
                          <Button size="sm" variant="outline" onClick={() => { setSelectedDispute(dispute); setDetailDialogOpen(true); }}>
                            <Eye className="w-4 h-4 mr-1" />View
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Create New Dispute</DialogTitle>
            <DialogDescription className="text-slate-400">Generate a dispute letter</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Client</label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white"><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Credit Bureau</label>
              <Select value={selectedCRA} onValueChange={setSelectedCRA}>
                <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white"><SelectValue placeholder="Select bureau" /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="TRANSUNION">TransUnion</SelectItem>
                  <SelectItem value="EXPERIAN">Experian</SelectItem>
                  <SelectItem value="EQUIFAX">Equifax</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Dispute Type</label>
              <Select value={selectedFlow} onValueChange={setSelectedFlow}>
                <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="ACCURACY">Accuracy - Challenge inaccurate info</SelectItem>
                  <SelectItem value="COLLECTION">Collection - Debt validation</SelectItem>
                  <SelectItem value="CONSENT">Consent - Unauthorized access</SelectItem>
                  <SelectItem value="COMBO">Combo - Multiple issue types</SelectItem>
                </SelectContent>
              </Select>
              {selectedFlow && (
                <p className="text-xs text-slate-400 mt-1">
                  {FLOW_DESCRIPTIONS[selectedFlow as DisputeFlow]?.description}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Accounts ({selectedAccounts.length})</label>
              <div className="max-h-48 overflow-y-auto space-y-2 p-2 bg-slate-700/30 rounded border border-slate-600">
                {filteredAccounts.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">Select client and bureau first</p>
                ) : filteredAccounts.map((a) => (
                  <label key={a.id} className="flex items-center gap-3 p-2 rounded hover:bg-slate-700/50 cursor-pointer">
                    <input type="checkbox" checked={selectedAccounts.includes(a.id)} onChange={(e) => setSelectedAccounts(e.target.checked ? [...selectedAccounts, a.id] : selectedAccounts.filter((id) => id !== a.id))} className="rounded" />
                    <div className="flex-1">
                      <p className="text-sm text-white">{a.creditorName}</p>
                      <p className="text-xs text-slate-400">{a.issueCount} issues</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateDispute} disabled={creating}>
                {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Scale className="w-4 h-4 mr-2" />}
                Generate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedDispute && (
            <>
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-2">
                  <Scale className="w-5 h-5" />{selectedDispute.cra} Dispute - Round {selectedDispute.round}
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  {selectedDispute.client.firstName} {selectedDispute.client.lastName} • {selectedDispute.flow}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                  <div className="flex items-center gap-4">
                    {getStatusBadge(selectedDispute.status)}
                    {getCRABadge(selectedDispute.cra)}
                    <Badge variant="outline">{selectedDispute._count.items} Items</Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => handleViewLetter(selectedDispute.id)} className="bg-emerald-600/20 border-emerald-600/50 text-emerald-400 hover:bg-emerald-600/30">
                      <Edit3 className="w-4 h-4 mr-1" />View/Edit Letter
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDownloadDocx(selectedDispute.id)} className="border-slate-600 text-slate-300 hover:bg-slate-700">
                      <Download className="w-4 h-4 mr-1" />Download DOCX
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleViewCFPB(selectedDispute.id)} className="bg-amber-600/20 border-amber-600/50 text-amber-400 hover:bg-amber-600/30">
                      <AlertTriangle className="w-4 h-4 mr-1" />CFPB Complaint
                    </Button>
                    {selectedDispute.status === "DRAFT" && <Button size="sm" onClick={() => handleUpdateStatus(selectedDispute.id, "APPROVED")} disabled={updating}><CheckCircle className="w-4 h-4 mr-1" />Approve</Button>}
                    {selectedDispute.status === "APPROVED" && <Button size="sm" onClick={() => handleUpdateStatus(selectedDispute.id, "SENT")} disabled={updating}><Send className="w-4 h-4 mr-1" />Mark Sent</Button>}
                    {selectedDispute.status === "SENT" && <Button size="sm" onClick={() => handleUpdateStatus(selectedDispute.id, "RESPONDED")} disabled={updating}><Clock className="w-4 h-4 mr-1" />Response</Button>}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-xs">
                  {[
                    { label: "Created", date: selectedDispute.createdAt },
                    { label: "Sent", date: selectedDispute.sentAt },
                    { label: "Response", date: selectedDispute.respondedAt },
                    { label: "Resolved", date: selectedDispute.resolvedAt },
                  ].map((t) => (
                    <div key={t.label} className="text-center p-2 rounded bg-slate-700/30">
                      <Calendar className="w-4 h-4 mx-auto mb-1 text-slate-400" />
                      <p className="text-slate-400">{t.label}</p>
                      <p className="text-white">{t.date ? new Date(t.date).toLocaleDateString() : "—"}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <h3 className="text-sm font-medium text-white mb-2">Disputed Accounts</h3>
                  <div className="space-y-2">
                    {selectedDispute.items.map((item) => (
                      <div key={item.id} className="p-3 bg-slate-700/30 rounded border border-slate-600">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-white">{item.accountItem.creditorName}</p>
                            <p className="text-xs text-slate-400">{item.accountItem.maskedAccountId || "N/A"}</p>
                          </div>
                          <p className="text-sm text-white">{item.accountItem.balance ? `$${item.accountItem.balance.toLocaleString()}` : "N/A"}</p>
                        </div>
                        {item.disputeReason && <p className="text-xs text-slate-300 mt-2">{item.disputeReason}</p>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Workflow Tracker - Always show */}
                <WorkflowTracker
                  currentRound={selectedDispute.round}
                  currentStatus={selectedDispute.status}
                  flow={selectedDispute.flow as DisputeFlow}
                  responseOutcome={(responseOutcome || selectedDispute.responseOutcome) as ResponseOutcome | undefined}
                  sentDate={selectedDispute.sentAt || undefined}
                  onCreateNextRound={async () => {
                    // Create next round dispute
                    try {
                      const accountIds = selectedDispute.items.map((item) => item.accountItem.id);
                      const res = await fetch("/api/disputes", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          clientId: selectedDispute.client.id,
                          cra: selectedDispute.cra,
                          flow: selectedDispute.flow,
                          accountIds,
                        }),
                      });
                      if (res.ok) {
                        const data = await res.json();
                        toast({ title: "Next Round Created", description: `Round ${data.dispute.round} dispute letter generated` });
                        setDetailDialogOpen(false);
                        fetchDisputes();
                      } else {
                        const error = await res.json();
                        toast({ title: "Failed", description: error.error, variant: "destructive" });
                      }
                    } catch {
                      toast({ title: "Error", description: "Failed to create next round", variant: "destructive" });
                    }
                  }}
                />

                {/* Response Section - Show for SENT, RESPONDED, RESOLVED */}
                {["SENT", "RESPONDED", "RESOLVED"].includes(selectedDispute.status) && (
                  <div className="space-y-3 p-4 bg-slate-700/20 rounded-lg border border-slate-600">
                    <h3 className="text-sm font-medium text-white flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      CRA Response
                    </h3>
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400">Response Outcome</label>
                      <Select value={responseOutcome || selectedDispute.responseOutcome || ""} onValueChange={setResponseOutcome}>
                        <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                          <SelectValue placeholder="Select outcome..." />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="ITEMS_DELETED">Items Deleted - Success!</SelectItem>
                          <SelectItem value="ITEMS_UPDATED">Items Updated/Modified</SelectItem>
                          <SelectItem value="VERIFIED">Verified as Accurate</SelectItem>
                          <SelectItem value="NO_RESPONSE">No Response (30+ days)</SelectItem>
                          <SelectItem value="PARTIAL">Partial Resolution</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400">Response Notes</label>
                      <Textarea
                        placeholder="Document the CRA's response details..."
                        value={responseNotes || selectedDispute.responseNotes || ""}
                        onChange={(e) => setResponseNotes(e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white min-h-[80px]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(selectedDispute.id, selectedDispute.status)}
                        disabled={updating}
                      >
                        Save Notes
                      </Button>
                      {selectedDispute.status !== "RESOLVED" && (
                        <Button
                          size="sm"
                          onClick={() => handleUpdateStatus(selectedDispute.id, "RESOLVED")}
                          disabled={updating}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Mark Resolved
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Letter Editor */}
      {currentDocument && selectedDispute && (
        <LetterEditor
          open={letterEditorOpen}
          onOpenChange={setLetterEditorOpen}
          letterContent={letterContent}
          documentId={currentDocument.id}
          documentTitle={currentDocument.title}
          disputeId={selectedDispute.id}
          cra={selectedDispute.cra}
          onSave={handleSaveLetter}
        />
      )}

      {/* CFPB Complaint Dialog */}
      <Dialog open={cfpbDialogOpen} onOpenChange={setCfpbDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              CFPB Complaint Generator
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              File a complaint with the Consumer Financial Protection Bureau
            </DialogDescription>
          </DialogHeader>

          {cfpbLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
              <p className="text-slate-400 mt-4">Generating complaint...</p>
            </div>
          ) : cfpbContent ? (
            <div className="space-y-4 pt-4">
              {/* Metadata */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-700/30 rounded-lg text-center">
                  <p className="text-xs text-slate-400">CRA</p>
                  <p className="text-white font-medium">{String(cfpbContent.metadata.cra)}</p>
                </div>
                <div className="p-3 bg-slate-700/30 rounded-lg text-center">
                  <p className="text-xs text-slate-400">Round</p>
                  <p className="text-white font-medium">{String(cfpbContent.metadata.round)}</p>
                </div>
                <div className="p-3 bg-slate-700/30 rounded-lg text-center">
                  <p className="text-xs text-slate-400">Accounts</p>
                  <p className="text-white font-medium">{String(cfpbContent.metadata.accountCount)}</p>
                </div>
              </div>

              {/* Complaint Fields */}
              <div className="space-y-3">
                {Object.entries(cfpbContent.complaint).map(([key, value]) => (
                  <div key={key} className="p-3 bg-slate-700/30 rounded-lg border border-slate-600">
                    <p className="text-xs text-slate-400 uppercase mb-1">{key.replace(/_/g, " ")}</p>
                    <p className="text-sm text-white whitespace-pre-wrap">{value}</p>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                <a
                  href="https://www.consumerfinance.gov/complaint/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open CFPB Complaint Portal
                </a>
                <Button
                  onClick={() => handleCopyToClipboard(cfpbContent.copyText)}
                  className={copied ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy All to Clipboard
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-slate-500 text-center">
                Copy the complaint text and paste it into the CFPB online complaint form
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
