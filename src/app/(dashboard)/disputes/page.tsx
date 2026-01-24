"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { CreateDisputeWizard } from "@/components/disputes/create-dispute-wizard";
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
  Dna,
  Sparkles,
  ArrowRight,
  Info,
  ChevronDown,
  Target,
  Zap,
} from "lucide-react";
import { useToast } from "@/lib/use-toast";
import { LetterEditor } from "@/components/disputes/letter-editor";
import { LetterGenerator } from "@/components/disputes/letter-generator";
import { CFPBGenerator } from "@/components/disputes/cfpb-generator";
import { WorkflowTracker } from "@/components/disputes/workflow-tracker";
import { RoundHistory } from "@/components/disputes/round-history";
import { type DisputeFlow, type ResponseOutcome, FLOW_DESCRIPTIONS } from "@/lib/dispute-rounds";
import {
  getDNAClassificationLabel,
  getDNAClassificationDescription,
  type CreditDNAProfile,
  type DNAClassification,
} from "@/lib/credit-dna";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

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

  // New full-screen generator states
  const [showLetterGenerator, setShowLetterGenerator] = useState(false);
  const [showCFPBGenerator, setShowCFPBGenerator] = useState(false);
  const [generatorDispute, setGeneratorDispute] = useState<Dispute | null>(null);

  // DNA integration state
  const [clientDNA, setClientDNA] = useState<CreditDNAProfile | null>(null);
  const [dnaLoading, setDnaLoading] = useState(false);

  // Enhanced response recording state
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [responseData, setResponseData] = useState({
    outcome: "",
    responseDate: new Date().toISOString().split("T")[0],
    responseMethod: "MAIL",
    stallTactic: "",
    stallDetails: "",
    updateType: "",
    previousValue: "",
    newValue: "",
    verificationMethod: "",
    furnisherResponse: "",
    notes: "",
  });
  const [recordingResponse, setRecordingResponse] = useState(false);

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

  // Fetch DNA when client is selected
  useEffect(() => {
    if (selectedClient) {
      setDnaLoading(true);
      fetch(`/api/clients/${selectedClient}/dna`)
        .then((r) => {
          if (r.ok) return r.json();
          return null;
        })
        .then((data) => {
          if (data?.hasDNA) {
            setClientDNA(data.dna);
            // Auto-suggest flow based on DNA
            if (!selectedFlow && data.dna?.disputeReadiness?.recommendedFlow) {
              setSelectedFlow(data.dna.disputeReadiness.recommendedFlow);
            }
          } else {
            setClientDNA(null);
          }
        })
        .catch(() => setClientDNA(null))
        .finally(() => setDnaLoading(false));
    } else {
      setClientDNA(null);
    }
  }, [selectedClient, selectedFlow]);

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
    // Find the dispute and open the new Letter Generator
    const dispute = disputes.find(d => d.id === disputeId);
    if (dispute) {
      setGeneratorDispute(dispute);
      setShowLetterGenerator(true);
      setDetailDialogOpen(false);
    }
  };

  const handleViewLetterLegacy = async (disputeId: string) => {
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
    // Find the dispute and open the new CFPB Generator
    const dispute = disputes.find(d => d.id === disputeId);
    if (dispute) {
      setGeneratorDispute(dispute);
      setShowCFPBGenerator(true);
      setDetailDialogOpen(false);
    }
  };

  const handleViewCFPBLegacy = async (disputeId: string) => {
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

  // Record detailed response for each dispute item
  const handleRecordResponse = async () => {
    if (!selectedDispute || !responseData.outcome) {
      toast({ title: "Missing Information", description: "Please select an outcome", variant: "destructive" });
      return;
    }

    setRecordingResponse(true);
    try {
      // Record response for each item in the dispute
      for (const item of selectedDispute.items) {
        const res = await fetch(`/api/disputes/${selectedDispute.id}/responses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            disputeItemId: item.id,
            outcome: responseData.outcome,
            responseDate: responseData.responseDate,
            responseMethod: responseData.responseMethod,
            stallTactic: responseData.stallTactic || undefined,
            stallDetails: responseData.stallDetails || undefined,
            updateType: responseData.updateType || undefined,
            previousValue: responseData.previousValue || undefined,
            newValue: responseData.newValue || undefined,
            verificationMethod: responseData.verificationMethod || undefined,
            furnisherResponse: responseData.furnisherResponse || undefined,
            notes: responseData.notes || undefined,
          }),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to record response");
        }
      }

      toast({ title: "Response Recorded", description: "CRA response has been saved" });
      setResponseDialogOpen(false);
      setResponseData({
        outcome: "",
        responseDate: new Date().toISOString().split("T")[0],
        responseMethod: "MAIL",
        stallTactic: "",
        stallDetails: "",
        updateType: "",
        previousValue: "",
        newValue: "",
        verificationMethod: "",
        furnisherResponse: "",
        notes: "",
      });
      fetchDisputes();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to record response",
        variant: "destructive",
      });
    } finally {
      setRecordingResponse(false);
    }
  };

  // Generate next round using Intelligence Engine
  const handleGenerateNextRound = async () => {
    if (!selectedDispute) return;

    try {
      const res = await fetch(`/api/disputes/${selectedDispute.id}/next-round`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.allResolved) {
          toast({ title: "All Items Resolved!", description: data.message });
        } else {
          toast({
            title: "Next Round Created",
            description: `Round ${data.newDispute.round} dispute generated with ${data.letterMetadata.tone} tone`,
          });
        }
        setDetailDialogOpen(false);
        fetchDisputes();
      } else {
        const error = await res.json();
        toast({ title: "Failed", description: error.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to generate next round", variant: "destructive" });
    }
  };

  // Helper to get DNA color classes
  const getDNAColors = (classification: DNAClassification) => {
    const colors: Record<DNAClassification, { bg: string; text: string; border: string }> = {
      THIN_FILE_REBUILDER: { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/50" },
      THICK_FILE_DEROG: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/50" },
      CLEAN_THIN: { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/50" },
      COLLECTION_HEAVY: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/50" },
      LATE_PAYMENT_PATTERN: { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/50" },
      MIXED_FILE: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/50" },
      INQUIRY_DAMAGED: { bg: "bg-purple-500/20", text: "text-purple-400", border: "border-purple-500/50" },
      CHARGE_OFF_HEAVY: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/50" },
      IDENTITY_ISSUES: { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/50" },
      HIGH_UTILIZATION: { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/50" },
      RECOVERING: { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/50" },
      NEAR_PRIME: { bg: "bg-teal-500/20", text: "text-teal-400", border: "border-teal-500/50" },
    };
    return colors[classification];
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

  const getFCRADeadlineBadge = (dispute: Dispute) => {
    if (dispute.status !== "SENT" || !dispute.sentAt) return null;

    const sentDate = new Date(dispute.sentAt);
    const deadlineDate = new Date(sentDate);
    deadlineDate.setDate(deadlineDate.getDate() + 30);
    const now = new Date();
    const daysRemaining = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">
          <AlertTriangle className="w-3 h-3 mr-1" />
          {Math.abs(daysRemaining)}d Overdue
        </Badge>
      );
    } else if (daysRemaining <= 5) {
      return (
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
          <Clock className="w-3 h-3 mr-1" />
          {daysRemaining}d Left
        </Badge>
      );
    } else if (daysRemaining <= 10) {
      return (
        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
          <Clock className="w-3 h-3 mr-1" />
          {daysRemaining}d Left
        </Badge>
      );
    }
    return null;
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
                          {getFCRADeadlineBadge(dispute)}
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

      {/* Create Dispute Wizard */}
      <CreateDisputeWizard
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        clients={clients}
        onSuccess={fetchDisputes}
      />

      {/* Detail Dialog */}
      <ResponsiveDialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <ResponsiveDialogContent size="lg">
          {selectedDispute && (
            <>
              <ResponsiveDialogHeader>
                <ResponsiveDialogTitle className="flex items-center gap-2">
                  <Scale className="w-5 h-5" />{selectedDispute.cra} Dispute - Round {selectedDispute.round}
                </ResponsiveDialogTitle>
                <ResponsiveDialogDescription>
                  {selectedDispute.client.firstName} {selectedDispute.client.lastName} • {selectedDispute.flow}
                </ResponsiveDialogDescription>
              </ResponsiveDialogHeader>
              <ResponsiveDialogBody className="space-y-4">
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

                {/* Round History - Show for rounds > 1 or after first round completed */}
                {(selectedDispute.round > 1 || ["RESPONDED", "RESOLVED", "ESCALATED"].includes(selectedDispute.status)) && (
                  <div className="p-4 bg-slate-700/20 rounded-lg border border-slate-600">
                    <RoundHistory
                      disputeId={selectedDispute.id}
                      clientId={selectedDispute.client.id}
                      currentRound={selectedDispute.round}
                      currentCra={selectedDispute.cra}
                    />
                  </div>
                )}

                {/* Response Section - Show for SENT, RESPONDED, RESOLVED */}
                {["SENT", "RESPONDED", "RESOLVED"].includes(selectedDispute.status) && (
                  <div className="space-y-3 p-4 bg-slate-700/20 rounded-lg border border-slate-600">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-white flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        CRA Response
                      </h3>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setResponseDialogOpen(true)}
                        className="bg-blue-600/20 border-blue-600/50 text-blue-400 hover:bg-blue-600/30"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Record Detailed Response
                      </Button>
                    </div>

                    {/* Quick Response Section */}
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400">Quick Response Outcome</label>
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
                    <div className="flex items-center justify-between">
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

                      {/* Next Round Button - Show when response received but not resolved */}
                      {selectedDispute.status === "RESPONDED" && (
                        <Button
                          size="sm"
                          onClick={handleGenerateNextRound}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          <Zap className="w-4 h-4 mr-1" />
                          Generate Next Round
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </ResponsiveDialogBody>
            </>
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>

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
      <ResponsiveDialog open={cfpbDialogOpen} onOpenChange={setCfpbDialogOpen}>
        <ResponsiveDialogContent size="lg">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              CFPB Complaint Generator
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              File a complaint with the Consumer Financial Protection Bureau
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogBody>
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
          </ResponsiveDialogBody>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* New Letter Generator - Full Screen */}
      {showLetterGenerator && generatorDispute && (() => {
        const bureauNameMap: Record<string, "TransUnion" | "Experian" | "Equifax"> = {
          TRANSUNION: "TransUnion",
          EXPERIAN: "Experian",
          EQUIFAX: "Equifax",
        };
        return (
          <div className="fixed inset-0 z-50 bg-slate-900 overflow-auto">
            <div className="absolute top-4 left-4 z-10">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowLetterGenerator(false);
                  setGeneratorDispute(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                ← Back to Disputes
              </Button>
            </div>
            <LetterGenerator
              clientName={`${generatorDispute.client.firstName} ${generatorDispute.client.lastName}`}
              bureau={bureauNameMap[generatorDispute.cra] || "TransUnion"}
              round={generatorDispute.round}
              disputedAccounts={generatorDispute.items.map(item => ({
                creditorName: item.accountItem.creditorName,
                accountNumber: item.accountItem.maskedAccountId || "N/A",
                balance: item.accountItem.balance || 0,
                status: item.disputeReason || "Disputed",
              }))}
              onSave={async (content) => {
                toast({ title: "Letter Saved", description: "Your dispute letter has been saved." });
              }}
              onGenerate={async () => {
                toast({ title: "Generating...", description: "AI is generating your letter." });
              }}
            />
          </div>
        );
      })()}

      {/* New CFPB Generator - Full Screen */}
      {showCFPBGenerator && generatorDispute && (() => {
        const bureauNameMap: Record<string, "TransUnion" | "Experian" | "Equifax"> = {
          TRANSUNION: "TransUnion",
          EXPERIAN: "Experian",
          EQUIFAX: "Equifax",
        };
        return (
          <div className="fixed inset-0 z-50 bg-slate-900 overflow-auto">
            <CFPBGenerator
              clientName={`${generatorDispute.client.firstName} ${generatorDispute.client.lastName}`}
              bureau={bureauNameMap[generatorDispute.cra] || "TransUnion"}
              disputeDate={new Date(generatorDispute.sentAt || generatorDispute.createdAt)}
              disputedAccounts={generatorDispute.items.map(item => ({
                creditorName: item.accountItem.creditorName,
                accountNumber: item.accountItem.maskedAccountId || "N/A",
                balance: item.accountItem.balance || 0,
                status: item.disputeReason || "Disputed",
              }))}
              onBack={() => {
                setShowCFPBGenerator(false);
                setGeneratorDispute(null);
              }}
              onSaveDraft={async (content) => {
                toast({ title: "Draft Saved", description: "Your CFPB complaint draft has been saved." });
              }}
            />
          </div>
        );
      })()}

      {/* Detailed Response Recording Modal */}
      <ResponsiveDialog open={responseDialogOpen} onOpenChange={setResponseDialogOpen}>
        <ResponsiveDialogContent size="md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Record CRA Response
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Document the response from {selectedDispute?.cra} for this dispute
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogBody className="space-y-4">
            {/* Response Outcome */}
            <div className="space-y-2">
              <Label className="text-slate-200">Response Outcome *</Label>
              <Select value={responseData.outcome} onValueChange={(v) => setResponseData({ ...responseData, outcome: v })}>
                <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                  <SelectValue placeholder="What was the result?" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="DELETED">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span>Deleted - Items removed from report</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="VERIFIED">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span>Verified - CRA claims item is accurate</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="UPDATED">
                    <div className="flex items-center gap-2">
                      <Edit3 className="w-4 h-4 text-amber-400" />
                      <span>Updated - Changes made but not deleted</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="NO_RESPONSE">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-400" />
                      <span>No Response - 30+ days without response (FCRA violation)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="STALL_LETTER">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-400" />
                      <span>Stall Letter - Request for more info or frivolous claim</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Response Date & Method */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-200">Response Date</Label>
                <input
                  type="date"
                  value={responseData.responseDate}
                  onChange={(e) => setResponseData({ ...responseData, responseDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-md text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Response Method</Label>
                <Select value={responseData.responseMethod} onValueChange={(v) => setResponseData({ ...responseData, responseMethod: v })}>
                  <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="MAIL">Mail</SelectItem>
                    <SelectItem value="ONLINE">Online Portal</SelectItem>
                    <SelectItem value="EMAIL">Email</SelectItem>
                    <SelectItem value="PHONE">Phone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Stall Tactic Fields - Show when STALL_LETTER selected */}
            {responseData.outcome === "STALL_LETTER" && (
              <div className="space-y-4 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <p className="text-sm text-orange-400 font-medium">Stall Tactic Details</p>
                <div className="space-y-2">
                  <Label className="text-slate-200">Stall Tactic Type</Label>
                  <Select value={responseData.stallTactic} onValueChange={(v) => setResponseData({ ...responseData, stallTactic: v })}>
                    <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                      <SelectValue placeholder="What tactic did they use?" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="FRIVOLOUS_CLAIM">Frivolous Claim - "Your dispute is frivolous"</SelectItem>
                      <SelectItem value="ID_VERIFICATION">ID Verification - "Please send identification"</SelectItem>
                      <SelectItem value="MORE_INFO_NEEDED">More Info Needed - "We need more information"</SelectItem>
                      <SelectItem value="ALREADY_VERIFIED">Already Verified - "This was already verified"</SelectItem>
                      <SelectItem value="NOT_ENOUGH_DETAIL">Not Enough Detail - "Dispute lacks sufficient detail"</SelectItem>
                      <SelectItem value="DUPLICATE_DISPUTE">Duplicate Dispute - "This appears to be a duplicate"</SelectItem>
                      <SelectItem value="STANDARD_FORM">Standard Form Letter - Generic response with no action</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-200">Stall Details</Label>
                  <Textarea
                    placeholder="Quote exact language from the letter..."
                    value={responseData.stallDetails}
                    onChange={(e) => setResponseData({ ...responseData, stallDetails: e.target.value })}
                    className="bg-slate-700/50 border-slate-600 text-white"
                  />
                </div>
              </div>
            )}

            {/* Update Fields - Show when UPDATED selected */}
            {responseData.outcome === "UPDATED" && (
              <div className="space-y-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-sm text-amber-400 font-medium">Update Details</p>
                <div className="space-y-2">
                  <Label className="text-slate-200">Type of Update</Label>
                  <Select value={responseData.updateType} onValueChange={(v) => setResponseData({ ...responseData, updateType: v })}>
                    <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                      <SelectValue placeholder="What was updated?" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="BALANCE_UPDATED">Balance Updated</SelectItem>
                      <SelectItem value="STATUS_UPDATED">Account Status Changed</SelectItem>
                      <SelectItem value="DATE_CORRECTED">Date Information Corrected</SelectItem>
                      <SelectItem value="CREDITOR_UPDATED">Creditor Name/Info Updated</SelectItem>
                      <SelectItem value="PAYMENT_HISTORY">Payment History Modified</SelectItem>
                      <SelectItem value="COMMENT_ADDED">Consumer Statement Added</SelectItem>
                      <SelectItem value="PARTIAL_CORRECTION">Partial Correction</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-200">Previous Value</Label>
                    <input
                      type="text"
                      placeholder="What it was before"
                      value={responseData.previousValue}
                      onChange={(e) => setResponseData({ ...responseData, previousValue: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-md text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-200">New Value</Label>
                    <input
                      type="text"
                      placeholder="What it is now"
                      value={responseData.newValue}
                      onChange={(e) => setResponseData({ ...responseData, newValue: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-md text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Verification Fields - Show when VERIFIED selected */}
            {responseData.outcome === "VERIFIED" && (
              <div className="space-y-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400 font-medium">Verification Details</p>
                <div className="space-y-2">
                  <Label className="text-slate-200">Verification Method</Label>
                  <input
                    type="text"
                    placeholder='e.g., "Electronic verification", "Direct contact with furnisher"'
                    value={responseData.verificationMethod}
                    onChange={(e) => setResponseData({ ...responseData, verificationMethod: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-md text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-200">Furnisher Response</Label>
                  <Textarea
                    placeholder="What did the creditor/furnisher say?"
                    value={responseData.furnisherResponse}
                    onChange={(e) => setResponseData({ ...responseData, furnisherResponse: e.target.value })}
                    className="bg-slate-700/50 border-slate-600 text-white"
                  />
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-slate-200">Additional Notes</Label>
              <Textarea
                placeholder="Any other relevant details about the response..."
                value={responseData.notes}
                onChange={(e) => setResponseData({ ...responseData, notes: e.target.value })}
                className="bg-slate-700/50 border-slate-600 text-white min-h-[80px]"
              />
            </div>

            {/* FCRA Deadline Info */}
            {selectedDispute?.sentAt && (
              <div className="p-3 bg-slate-700/30 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">FCRA 30-Day Deadline:</span>
                  <span className="text-white font-medium">
                    {new Date(new Date(selectedDispute.sentAt).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                  </span>
                </div>
                {responseData.responseDate && (
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-slate-400">Days to Respond:</span>
                    <span className={`font-medium ${
                      Math.ceil((new Date(responseData.responseDate).getTime() - new Date(selectedDispute.sentAt).getTime()) / (1000 * 60 * 60 * 24)) > 30
                        ? "text-red-400"
                        : "text-green-400"
                    }`}>
                      {Math.ceil((new Date(responseData.responseDate).getTime() - new Date(selectedDispute.sentAt).getTime()) / (1000 * 60 * 60 * 24))} days
                      {Math.ceil((new Date(responseData.responseDate).getTime() - new Date(selectedDispute.sentAt).getTime()) / (1000 * 60 * 60 * 24)) > 30 && " (LATE!)"}
                    </span>
                  </div>
                )}
              </div>
            )}

          </ResponsiveDialogBody>
          <ResponsiveDialogFooter>
            <Button variant="ghost" onClick={() => setResponseDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRecordResponse}
              disabled={recordingResponse || !responseData.outcome}
            >
              {recordingResponse ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Record Response
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
