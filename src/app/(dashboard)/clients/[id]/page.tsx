"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  User,
  FileText,
  AlertTriangle,
  Scale,
  Image as ImageIcon,
  Upload,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Edit,
  Loader2,
  ShieldAlert,
  CheckCircle,
  TrendingUp,
} from "lucide-react";
import { ScoreChart, AddScoreModal } from "@/components/credit-scores";
import { useToast } from "@/lib/use-toast";

interface ClientData {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  ssnLast4: string | null;
  dateOfBirth: string | null;
  notes: string | null;
  createdAt: string;
  reports: Array<{
    id: string;
    reportType: string;
    reportDate: string | null;
    parseStatus: string;
    createdAt: string;
    originalFile: {
      id: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
    } | null;
    _count: { accounts: number };
  }>;
  accounts: Array<{
    id: string;
    creditorName: string;
    maskedAccountId: string | null;
    cra: string;
    accountStatus: string;
    balance: number | null;
    pastDue: number | null;
    issueCount: number;
    detectedIssues: string | null;
    suggestedFlow: string | null;
    reportId: string;
    evidences: Array<{
      id: string;
      evidenceType: string;
      title: string | null;
      createdAt: string;
    }>;
  }>;
  disputes: Array<{
    id: string;
    disputeStatus: string;
    cra: string;
    createdAt: string;
  }>;
}

interface Summary {
  totalReports: number;
  totalAccounts: number;
  totalDisputes: number;
  negativeItems: number;
  highSeverityIssues: number;
  totalEvidence: number;
}

interface CreditScore {
  id: string;
  cra: string;
  score: number;
  scoreDate: string;
  scoreType: string;
  factorsPositive?: string;
  factorsNegative?: string;
}

interface ScoreStats {
  latest: Record<string, number>;
  change30Days: Record<string, number>;
  change90Days: Record<string, number>;
  highest: Record<string, number>;
  lowest: Record<string, number>;
}

interface ChartDataPoint {
  date: string;
  TRANSUNION?: number;
  EXPERIAN?: number;
  EQUIFAX?: number;
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const clientId = params.id as string;

  const [client, setClient] = useState<ClientData | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addScoreModalOpen, setAddScoreModalOpen] = useState(false);
  const [creditScores, setCreditScores] = useState<CreditScore[]>([]);
  const [scoreStats, setScoreStats] = useState<ScoreStats | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  const fetchClient = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setClient(data.client);
        setSummary(data.summary);
        setEditForm({
          firstName: data.client.firstName,
          lastName: data.client.lastName,
          email: data.client.email || "",
          phone: data.client.phone || "",
        });
      } else {
        toast({
          title: "Error",
          description: "Client not found",
          variant: "destructive",
        });
        router.push("/clients");
      }
    } catch (error) {
      console.error("Failed to fetch client:", error);
    } finally {
      setLoading(false);
    }
  }, [clientId, router, toast]);

  const fetchCreditScores = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}/scores`);
      if (res.ok) {
        const data = await res.json();
        setCreditScores(data.scores);
        setScoreStats(data.stats);
        setChartData(data.chartData);
      }
    } catch (error) {
      console.error("Failed to fetch credit scores:", error);
    }
  }, [clientId]);

  useEffect(() => {
    fetchClient();
    fetchCreditScores();
  }, [fetchClient, fetchCreditScores]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast({
        title: "Invalid File",
        description: "Please upload a PDF file",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("clientId", clientId);
    formData.append("reportType", "IDENTITY_IQ");

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        toast({
          title: "Report Uploaded",
          description: "Credit report uploaded and parsing started",
        });
        fetchClient();
      } else {
        const error = await res.json();
        toast({
          title: "Upload Failed",
          description: error.error || "Failed to upload report",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      if (res.ok) {
        toast({ title: "Client Updated" });
        setEditDialogOpen(false);
        fetchClient();
      } else {
        toast({
          title: "Update Failed",
          description: "Could not update client",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const parseIssues = (detectedIssues: string | null) => {
    if (!detectedIssues) return [];
    try {
      return JSON.parse(detectedIssues);
    } catch {
      return [];
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 lg:ml-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!client) {
    return null;
  }

  return (
    <div className="space-y-6 lg:ml-64 pt-16 lg:pt-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/clients")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-primary font-bold text-lg">
                {client.firstName.charAt(0)}{client.lastName.charAt(0)}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {client.firstName} {client.lastName}
              </h1>
              <p className="text-slate-400 text-sm">
                Client since {new Date(client.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <label>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
            <Button asChild disabled={uploading}>
              <span>
                {uploading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Upload Report
              </span>
            </Button>
          </label>
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <FileText className="w-6 h-6 mx-auto text-blue-400" />
              <p className="text-2xl font-bold text-white mt-2">{summary.totalReports}</p>
              <p className="text-xs text-slate-400">Reports</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <User className="w-6 h-6 mx-auto text-green-400" />
              <p className="text-2xl font-bold text-white mt-2">{summary.totalAccounts}</p>
              <p className="text-xs text-slate-400">Accounts</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <AlertTriangle className="w-6 h-6 mx-auto text-red-400" />
              <p className="text-2xl font-bold text-red-400 mt-2">{summary.negativeItems}</p>
              <p className="text-xs text-slate-400">Negative Items</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <ShieldAlert className="w-6 h-6 mx-auto text-amber-400" />
              <p className="text-2xl font-bold text-amber-400 mt-2">{summary.highSeverityIssues}</p>
              <p className="text-xs text-slate-400">High Severity</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <Scale className="w-6 h-6 mx-auto text-purple-400" />
              <p className="text-2xl font-bold text-white mt-2">{summary.totalDisputes}</p>
              <p className="text-xs text-slate-400">Disputes</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <ImageIcon className="w-6 h-6 mx-auto text-teal-400" />
              <p className="text-2xl font-bold text-white mt-2">{summary.totalEvidence}</p>
              <p className="text-xs text-slate-400">Evidence</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Contact Info */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg">Contact Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-400" />
              <span className="text-white">{client.email || "No email"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-400" />
              <span className="text-white">{client.phone || "No phone"}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span className="text-white">
                {client.city && client.state
                  ? `${client.city}, ${client.state}`
                  : "No address"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-white">
                {client.dateOfBirth
                  ? new Date(client.dateOfBirth).toLocaleDateString()
                  : "No DOB"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="negative" className="w-full">
        <TabsList className="bg-slate-800 border-slate-700">
          <TabsTrigger value="negative" className="data-[state=active]:bg-slate-700">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Negative Items ({client.accounts.length})
          </TabsTrigger>
          <TabsTrigger value="reports" className="data-[state=active]:bg-slate-700">
            <FileText className="w-4 h-4 mr-2" />
            Reports ({client.reports.length})
          </TabsTrigger>
          <TabsTrigger value="disputes" className="data-[state=active]:bg-slate-700">
            <Scale className="w-4 h-4 mr-2" />
            Disputes ({client.disputes.length})
          </TabsTrigger>
          <TabsTrigger value="scores" className="data-[state=active]:bg-slate-700">
            <TrendingUp className="w-4 h-4 mr-2" />
            Credit Scores
          </TabsTrigger>
        </TabsList>

        {/* Negative Items Tab */}
        <TabsContent value="negative" className="mt-4">
          {client.accounts.length === 0 ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="py-12 text-center">
                <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
                <h3 className="text-lg font-medium text-white mt-4">No Negative Items</h3>
                <p className="text-slate-400 mt-2">Upload a credit report to analyze for issues</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {client.accounts.map((account) => {
                const issues = parseIssues(account.detectedIssues);
                return (
                  <Card key={account.id} className="bg-red-900/10 border-red-500/30">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-white">{account.creditorName}</span>
                            <Badge className="bg-slate-600">{account.cra}</Badge>
                            <Badge variant="destructive">{account.issueCount} Issues</Badge>
                            {account.evidences.length > 0 && (
                              <Badge className="bg-green-500/20 text-green-400">
                                <ImageIcon className="w-3 h-3 mr-1" />
                                {account.evidences.length} Evidence
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-4 gap-4 text-sm mb-2">
                            <div>
                              <span className="text-slate-500">Account:</span>
                              <span className="text-white ml-1">{account.maskedAccountId || "N/A"}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Status:</span>
                              <span className="text-red-400 ml-1">{account.accountStatus}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Balance:</span>
                              <span className="text-white ml-1">{formatCurrency(account.balance)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Past Due:</span>
                              <span className="text-red-400 ml-1">{formatCurrency(account.pastDue)}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            {issues.slice(0, 2).map((issue: { severity: string; description: string }, idx: number) => (
                              <div key={idx} className="flex items-center gap-2 text-xs">
                                <Badge
                                  variant={issue.severity === "HIGH" ? "destructive" : "secondary"}
                                  className="text-[10px] px-1.5"
                                >
                                  {issue.severity}
                                </Badge>
                                <span className="text-slate-300">{issue.description}</span>
                              </div>
                            ))}
                            {issues.length > 2 && (
                              <span className="text-xs text-slate-500">+{issues.length - 2} more</span>
                            )}
                          </div>
                        </div>
                        <Link href={`/negative-items?account=${account.id}`}>
                          <Button size="sm" variant="outline">
                            View Details
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="mt-4">
          {client.reports.length === 0 ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 mx-auto text-slate-600" />
                <h3 className="text-lg font-medium text-white mt-4">No Reports</h3>
                <p className="text-slate-400 mt-2">Upload a credit report to get started</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {client.reports.map((report) => (
                <Card key={report.id} className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded bg-blue-500/20 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            {report.originalFile?.filename || "Credit Report"}
                          </p>
                          <p className="text-sm text-slate-400">
                            {new Date(report.createdAt).toLocaleDateString()} • {report._count.accounts} accounts
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            report.parseStatus === "COMPLETED"
                              ? "bg-green-500/20 text-green-400"
                              : report.parseStatus === "FAILED"
                              ? "bg-red-500/20 text-red-400"
                              : "bg-amber-500/20 text-amber-400"
                          }
                        >
                          {report.parseStatus}
                        </Badge>
                        <Link href={`/reports?id=${report.id}`}>
                          <Button size="sm" variant="outline">
                            View
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Disputes Tab */}
        <TabsContent value="disputes" className="mt-4">
          {client.disputes.length === 0 ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="py-12 text-center">
                <Scale className="w-12 h-12 mx-auto text-slate-600" />
                <h3 className="text-lg font-medium text-white mt-4">No Disputes</h3>
                <p className="text-slate-400 mt-2">Create a dispute from the negative items</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {client.disputes.map((dispute) => (
                <Card key={dispute.id} className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded bg-purple-500/20 flex items-center justify-center">
                          <Scale className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">Dispute to {dispute.cra}</p>
                          <p className="text-sm text-slate-400">
                            {new Date(dispute.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Badge>{dispute.disputeStatus}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Credit Scores Tab */}
        <TabsContent value="scores" className="mt-4">
          {scoreStats ? (
            <ScoreChart
              scores={creditScores}
              stats={scoreStats}
              chartData={chartData}
              onAddScore={() => setAddScoreModalOpen(true)}
            />
          ) : (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="py-12 text-center">
                <TrendingUp className="w-12 h-12 mx-auto text-slate-600" />
                <h3 className="text-lg font-medium text-white mt-4">No Credit Scores</h3>
                <p className="text-slate-400 mt-2">Track credit score changes over time</p>
                <Button className="mt-4" onClick={() => setAddScoreModalOpen(true)}>
                  Add First Score
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Score Modal */}
      <AddScoreModal
        open={addScoreModalOpen}
        onOpenChange={setAddScoreModalOpen}
        clientId={clientId}
        onScoreAdded={fetchCreditScores}
      />

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Client</DialogTitle>
            <DialogDescription className="text-slate-400">
              Update client information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateClient} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-200">First Name</Label>
                <Input
                  value={editForm.firstName}
                  onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  className="bg-slate-700/50 border-slate-600 text-white"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-200">Last Name</Label>
                <Input
                  value={editForm.lastName}
                  onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  className="bg-slate-700/50 border-slate-600 text-white"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-200">Email</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="bg-slate-700/50 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-200">Phone</Label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="bg-slate-700/50 border-slate-600 text-white"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
