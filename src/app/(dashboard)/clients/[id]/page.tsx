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
  Dna,
  Activity,
  Target,
  Zap,
  RefreshCw,
  ChevronRight,
  BarChart3,
  Shield,
  Clock,
  Lightbulb,
} from "lucide-react";
import { ScoreChart, AddScoreModal } from "@/components/credit-scores";
import { useToast } from "@/lib/use-toast";
import {
  getDNAClassificationLabel,
  getDNAClassificationDescription,
  getDNARecommendedStrategy,
  type CreditDNAProfile,
  type DNAClassification,
} from "@/lib/credit-dna";
import { Progress } from "@/components/ui/progress";

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

// DNA Color Helper Functions
function getDNABorderColor(classification: DNAClassification): string {
  const colors: Record<DNAClassification, string> = {
    THIN_FILE_REBUILDER: "border-amber-500/50",
    THICK_FILE_DEROG: "border-red-500/50",
    CLEAN_THIN: "border-green-500/50",
    COLLECTION_HEAVY: "border-red-500/50",
    LATE_PAYMENT_PATTERN: "border-orange-500/50",
    MIXED_FILE: "border-blue-500/50",
    INQUIRY_DAMAGED: "border-purple-500/50",
    CHARGE_OFF_HEAVY: "border-red-500/50",
    IDENTITY_ISSUES: "border-yellow-500/50",
    HIGH_UTILIZATION: "border-orange-500/50",
    RECOVERING: "border-emerald-500/50",
    NEAR_PRIME: "border-teal-500/50",
  };
  return colors[classification];
}

function getDNABgColor(classification: DNAClassification): string {
  const colors: Record<DNAClassification, string> = {
    THIN_FILE_REBUILDER: "bg-amber-500/20",
    THICK_FILE_DEROG: "bg-red-500/20",
    CLEAN_THIN: "bg-green-500/20",
    COLLECTION_HEAVY: "bg-red-500/20",
    LATE_PAYMENT_PATTERN: "bg-orange-500/20",
    MIXED_FILE: "bg-blue-500/20",
    INQUIRY_DAMAGED: "bg-purple-500/20",
    CHARGE_OFF_HEAVY: "bg-red-500/20",
    IDENTITY_ISSUES: "bg-yellow-500/20",
    HIGH_UTILIZATION: "bg-orange-500/20",
    RECOVERING: "bg-emerald-500/20",
    NEAR_PRIME: "bg-teal-500/20",
  };
  return colors[classification];
}

function getDNAIconColor(classification: DNAClassification): string {
  const colors: Record<DNAClassification, string> = {
    THIN_FILE_REBUILDER: "text-amber-400",
    THICK_FILE_DEROG: "text-red-400",
    CLEAN_THIN: "text-green-400",
    COLLECTION_HEAVY: "text-red-400",
    LATE_PAYMENT_PATTERN: "text-orange-400",
    MIXED_FILE: "text-blue-400",
    INQUIRY_DAMAGED: "text-purple-400",
    CHARGE_OFF_HEAVY: "text-red-400",
    IDENTITY_ISSUES: "text-yellow-400",
    HIGH_UTILIZATION: "text-orange-400",
    RECOVERING: "text-emerald-400",
    NEAR_PRIME: "text-teal-400",
  };
  return colors[classification];
}

function getDNABadgeColor(level: "LOW" | "MEDIUM" | "HIGH"): string {
  const colors = {
    LOW: "bg-red-500/20 text-red-400",
    MEDIUM: "bg-amber-500/20 text-amber-400",
    HIGH: "bg-green-500/20 text-green-400",
  };
  return colors[level];
}

function getThicknessBadgeColor(thickness: string): string {
  const colors: Record<string, string> = {
    ULTRA_THIN: "bg-red-500/20 text-red-400",
    THIN: "bg-amber-500/20 text-amber-400",
    MODERATE: "bg-blue-500/20 text-blue-400",
    THICK: "bg-green-500/20 text-green-400",
    VERY_THICK: "bg-emerald-500/20 text-emerald-400",
  };
  return colors[thickness] || "bg-slate-500/20 text-slate-400";
}

function getSeverityBadgeColor(severity: string): string {
  const colors: Record<string, string> = {
    NONE: "bg-green-500/20 text-green-400",
    LIGHT: "bg-blue-500/20 text-blue-400",
    MODERATE: "bg-amber-500/20 text-amber-400",
    HEAVY: "bg-orange-500/20 text-orange-400",
    SEVERE: "bg-red-500/20 text-red-400",
  };
  return colors[severity] || "bg-slate-500/20 text-slate-400";
}

function getUtilBadgeColor(status: string): string {
  const colors: Record<string, string> = {
    EXCELLENT: "bg-green-500/20 text-green-400",
    GOOD: "bg-emerald-500/20 text-emerald-400",
    FAIR: "bg-amber-500/20 text-amber-400",
    POOR: "bg-orange-500/20 text-orange-400",
    CRITICAL: "bg-red-500/20 text-red-400",
  };
  return colors[status] || "bg-slate-500/20 text-slate-400";
}

function getInquiryBadgeColor(status: string): string {
  const colors: Record<string, string> = {
    MINIMAL: "bg-green-500/20 text-green-400",
    LIGHT: "bg-blue-500/20 text-blue-400",
    MODERATE: "bg-amber-500/20 text-amber-400",
    HEAVY: "bg-orange-500/20 text-orange-400",
    EXCESSIVE: "bg-red-500/20 text-red-400",
  };
  return colors[status] || "bg-slate-500/20 text-slate-400";
}

function getStrengthBadgeColor(strength: string): string {
  const colors: Record<string, string> = {
    WEAK: "bg-red-500/20 text-red-400",
    FAIR: "bg-amber-500/20 text-amber-400",
    MODERATE: "bg-blue-500/20 text-blue-400",
    STRONG: "bg-green-500/20 text-green-400",
    EXCELLENT: "bg-emerald-500/20 text-emerald-400",
  };
  return colors[strength] || "bg-slate-500/20 text-slate-400";
}

function getComplexityBadgeColor(complexity: string): string {
  const colors: Record<string, string> = {
    SIMPLE: "bg-green-500/20 text-green-400",
    MODERATE: "bg-blue-500/20 text-blue-400",
    COMPLEX: "bg-amber-500/20 text-amber-400",
    VERY_COMPLEX: "bg-red-500/20 text-red-400",
  };
  return colors[complexity] || "bg-slate-500/20 text-slate-400";
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
  const [dnaProfile, setDnaProfile] = useState<CreditDNAProfile | null>(null);
  const [dnaLoading, setDnaLoading] = useState(false);
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

  const fetchDNA = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}/dna`);
      if (res.ok) {
        const data = await res.json();
        if (data.hasDNA) {
          setDnaProfile(data.dna);
        }
      }
    } catch (error) {
      console.error("Failed to fetch DNA profile:", error);
    }
  }, [clientId]);

  const generateDNA = async () => {
    setDnaLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/dna`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setDnaProfile(data.dna);
        toast({
          title: "DNA Analysis Complete",
          description: `Profile classified as ${getDNAClassificationLabel(data.dna.classification)}`,
        });
      } else {
        const error = await res.json();
        toast({
          title: "Analysis Failed",
          description: error.error || "Could not generate DNA profile",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to generate DNA:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setDnaLoading(false);
    }
  };

  useEffect(() => {
    fetchClient();
    fetchCreditScores();
    fetchDNA();
  }, [fetchClient, fetchCreditScores, fetchDNA]);

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

    try {
      let finalUrl = "";

      // Try Vercel Blob first, fall back to local upload
      try {
        const { upload } = await import("@vercel/blob/client");
        const timestamp = Date.now();
        const randomNum = Math.floor(Math.random() * 100000);
        const safePath = `reports/report${timestamp}${randomNum}.pdf`;

        console.log("Starting Vercel Blob upload...");

        const blob = await upload(safePath, file, {
          access: "public",
          handleUploadUrl: "/api/reports/upload-token",
        });

        finalUrl = blob.url;
        console.log("Vercel Blob upload complete:", finalUrl);
      } catch (blobError) {
        console.warn("Vercel Blob upload failed, falling back to local:", blobError);

        // Local Fallback
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", "reports");

        const localRes = await fetch("/api/upload/local", {
          method: "POST",
          body: formData,
        });

        if (!localRes.ok) {
          const errorData = await localRes.json();
          throw new Error(errorData.error || "Local upload failed");
        }

        const localData = await localRes.json();
        finalUrl = localData.url;
        console.log("Local upload complete:", finalUrl);
      }

      // Now process the report with the final URL (could be blob or local)
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          blobUrl: finalUrl,
          fileName: file.name,
        }),
      });

      if (res.ok) {
        toast({
          title: "Report Uploaded",
          description: "Credit report uploaded and parsing started",
        });
        fetchClient();
      } else {
        let errorMessage = "Failed to process report";
        try {
          const error = await res.json();
          errorMessage = error.error || errorMessage;
        } catch {
          // Ignore JSON parse errors
        }
        toast({
          title: "Upload Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
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
          <TabsTrigger value="dna" className="data-[state=active]:bg-slate-700">
            <Dna className="w-4 h-4 mr-2" />
            Credit DNA
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

        {/* Credit DNA Tab */}
        <TabsContent value="dna" className="mt-4">
          {dnaProfile ? (
            <div className="space-y-6">
              {/* DNA Classification Header */}
              <Card className={`border-2 ${getDNABorderColor(dnaProfile.classification)}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${getDNABgColor(dnaProfile.classification)}`}>
                        <Dna className={`w-8 h-8 ${getDNAIconColor(dnaProfile.classification)}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h2 className="text-2xl font-bold text-white">
                            {getDNAClassificationLabel(dnaProfile.classification)}
                          </h2>
                          <Badge className={getDNABadgeColor(dnaProfile.confidenceLevel)}>
                            {dnaProfile.confidenceLevel} Confidence
                          </Badge>
                        </div>
                        <p className="text-slate-400 max-w-2xl">
                          {getDNAClassificationDescription(dnaProfile.classification)}
                        </p>
                        {dnaProfile.subClassifications.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {dnaProfile.subClassifications.map((sub) => (
                              <Badge key={sub} variant="outline" className="text-slate-300 border-slate-600">
                                {sub.replace(/_/g, " ")}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={generateDNA}
                      disabled={dnaLoading}
                    >
                      {dnaLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Refresh Analysis
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Score Gauges */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-slate-400">Health Score</span>
                      </div>
                      <span className="text-2xl font-bold text-white">{dnaProfile.overallHealthScore}</span>
                    </div>
                    <Progress value={dnaProfile.overallHealthScore} className="h-2" />
                    <p className="text-xs text-slate-500 mt-2">Overall credit health assessment</p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-green-400" />
                        <span className="text-sm text-slate-400">Improvement Potential</span>
                      </div>
                      <span className="text-2xl font-bold text-white">{dnaProfile.improvementPotential}</span>
                    </div>
                    <Progress value={dnaProfile.improvementPotential} className="h-2 [&>div]:bg-green-500" />
                    <p className="text-xs text-slate-500 mt-2">Estimated room for score improvement</p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <span className="text-sm text-slate-400">Urgency Score</span>
                      </div>
                      <span className="text-2xl font-bold text-white">{dnaProfile.urgencyScore}</span>
                    </div>
                    <Progress value={dnaProfile.urgencyScore} className="h-2 [&>div]:bg-amber-500" />
                    <p className="text-xs text-slate-500 mt-2">Priority for immediate action</p>
                  </CardContent>
                </Card>
              </div>

              {/* Key Insights & Immediate Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-lg flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-yellow-400" />
                      Key Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {dnaProfile.keyInsights.map((insight, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <ChevronRight className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-slate-300">{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-lg flex items-center gap-2">
                      <Target className="w-5 h-5 text-green-400" />
                      Immediate Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {dnaProfile.immediateActions.map((action, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs text-green-400 font-medium">{idx + 1}</span>
                          </div>
                          <span className="text-sm text-slate-300">{action}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* Recommended Strategy */}
              <Card className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-blue-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-400" />
                    Recommended Strategy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-300">{getDNARecommendedStrategy(dnaProfile.classification)}</p>
                  <div className="flex gap-4 mt-4">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-500/20 text-blue-400">
                        {dnaProfile.disputeReadiness.recommendedFlow}
                      </Badge>
                      <span className="text-sm text-slate-400">Recommended Flow</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-500/20 text-purple-400">
                        {dnaProfile.disputeReadiness.recommendedFirstBureau}
                      </Badge>
                      <span className="text-sm text-slate-400">Start With</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-amber-500/20 text-amber-400">
                        ~{dnaProfile.disputeReadiness.estimatedRounds} Rounds
                      </Badge>
                      <span className="text-sm text-slate-400">Estimated</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Component Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* File Thickness */}
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white text-sm flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-slate-400" />
                      File Thickness
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge className={getThicknessBadgeColor(dnaProfile.fileThickness.thickness)}>
                      {dnaProfile.fileThickness.thickness.replace("_", " ")}
                    </Badge>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                      <div>
                        <span className="text-slate-500">Total:</span>
                        <span className="text-white ml-1">{dnaProfile.fileThickness.totalAccounts}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Open:</span>
                        <span className="text-white ml-1">{dnaProfile.fileThickness.openAccounts}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Avg Age:</span>
                        <span className="text-white ml-1">{Math.round(dnaProfile.fileThickness.averageAccountAge / 12)}yr</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Oldest:</span>
                        <span className="text-white ml-1">{Math.round(dnaProfile.fileThickness.oldestAccountAge / 12)}yr</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Derogatory Profile */}
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      Derogatory Profile
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge className={getSeverityBadgeColor(dnaProfile.derogatoryProfile.severity)}>
                      {dnaProfile.derogatoryProfile.severity}
                    </Badge>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                      <div>
                        <span className="text-slate-500">Collections:</span>
                        <span className="text-red-400 ml-1">{dnaProfile.derogatoryProfile.collectionCount}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Charge-offs:</span>
                        <span className="text-red-400 ml-1">{dnaProfile.derogatoryProfile.chargeOffCount}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Late Pays:</span>
                        <span className="text-amber-400 ml-1">{dnaProfile.derogatoryProfile.latePaymentAccounts}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Total:</span>
                        <span className="text-white ml-1">{dnaProfile.derogatoryProfile.totalDerogatoryItems}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Utilization */}
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white text-sm flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-400" />
                      Utilization
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge className={getUtilBadgeColor(dnaProfile.utilization.status)}>
                      {dnaProfile.utilization.status}
                    </Badge>
                    <div className="mt-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-400">Overall</span>
                        <span className={dnaProfile.utilization.overallUtilization > 30 ? "text-red-400" : "text-green-400"}>
                          {Math.round(dnaProfile.utilization.overallUtilization)}%
                        </span>
                      </div>
                      <Progress
                        value={Math.min(dnaProfile.utilization.overallUtilization, 100)}
                        className="h-2"
                      />
                      <p className="text-xs text-slate-500 mt-2">
                        {dnaProfile.utilization.accountsMaxedOut} maxed, {dnaProfile.utilization.accountsUnder30Percent} under 30%
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Inquiry Analysis */}
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white text-sm flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-400" />
                      Hard Inquiries
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge className={getInquiryBadgeColor(dnaProfile.inquiryAnalysis.status)}>
                      {dnaProfile.inquiryAnalysis.status}
                    </Badge>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                      <div>
                        <span className="text-slate-500">Total:</span>
                        <span className="text-white ml-1">{dnaProfile.inquiryAnalysis.totalHardInquiries}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Last 6mo:</span>
                        <span className="text-white ml-1">{dnaProfile.inquiryAnalysis.inquiriesLast6Months}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Impact:</span>
                        <span className="text-amber-400 ml-1">-{dnaProfile.inquiryAnalysis.estimatedScoreImpact}pts</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Disputable:</span>
                        <span className="text-green-400 ml-1">{dnaProfile.inquiryAnalysis.inquiriesDisputable}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Positive Factors */}
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white text-sm flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      Positive Factors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge className={getStrengthBadgeColor(dnaProfile.positiveFactors.strength)}>
                      {dnaProfile.positiveFactors.strength}
                    </Badge>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                      <div>
                        <span className="text-slate-500">On-Time:</span>
                        <span className="text-green-400 ml-1">{Math.round(dnaProfile.positiveFactors.onTimePaymentPercentage)}%</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Perfect:</span>
                        <span className="text-white ml-1">{dnaProfile.positiveFactors.perfectPaymentAccounts}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Mix Score:</span>
                        <span className="text-white ml-1">{dnaProfile.positiveFactors.creditMixScore}/100</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Well Managed:</span>
                        <span className="text-white ml-1">{dnaProfile.positiveFactors.wellManagedAccounts}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Dispute Readiness */}
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white text-sm flex items-center gap-2">
                      <Scale className="w-4 h-4 text-amber-400" />
                      Dispute Readiness
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge className={getComplexityBadgeColor(dnaProfile.disputeReadiness.complexity)}>
                      {dnaProfile.disputeReadiness.complexity}
                    </Badge>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                      <div>
                        <span className="text-slate-500">High Priority:</span>
                        <span className="text-red-400 ml-1">{dnaProfile.disputeReadiness.highPriorityItems}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Medium:</span>
                        <span className="text-amber-400 ml-1">{dnaProfile.disputeReadiness.mediumPriorityItems}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Est. Removal:</span>
                        <span className="text-green-400 ml-1">{dnaProfile.disputeReadiness.estimatedRemovalRate}%</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Est. Improve:</span>
                        <span className="text-green-400 ml-1">+{dnaProfile.disputeReadiness.estimatedScoreImprovement}pts</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Summary */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-lg">Analysis Summary</CardTitle>
                  <CardDescription className="text-slate-400">
                    Generated {new Date(dnaProfile.analyzedAt).toLocaleDateString()} at{" "}
                    {new Date(dnaProfile.analyzedAt).toLocaleTimeString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-300 leading-relaxed">{dnaProfile.summary}</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="py-12 text-center">
                <Dna className="w-12 h-12 mx-auto text-slate-600" />
                <h3 className="text-lg font-medium text-white mt-4">No DNA Profile</h3>
                <p className="text-slate-400 mt-2 max-w-md mx-auto">
                  Generate a Credit DNA profile to understand this client&apos;s credit characteristics
                  and get personalized dispute strategy recommendations.
                </p>
                <Button className="mt-4" onClick={generateDNA} disabled={dnaLoading}>
                  {dnaLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Dna className="w-4 h-4 mr-2" />
                  )}
                  Generate DNA Profile
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
