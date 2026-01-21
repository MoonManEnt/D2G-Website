"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileText, Upload, AlertCircle, Loader2, CheckCircle, XCircle, Eye, AlertTriangle, Scale, ShieldAlert } from "lucide-react";
import { useToast } from "@/lib/use-toast";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
}

interface Report {
  id: string;
  reportDate: string;
  uploadedAt: string;
  parseStatus: string;
  parseError?: string;
  pageCount: number;
  client: {
    firstName: string;
    lastName: string;
  };
  _count: {
    accounts: number;
  };
}

interface AccountIssue {
  code: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  suggestedFlow: string;
  fcraSection?: string;
}

interface AccountItem {
  id: string;
  creditorName: string;
  maskedAccountId: string;
  cra: string;
  accountStatus: string;
  balance: number | null;
  pastDue: number | null;
  paymentStatus: string | null;
  confidenceScore: number;
  confidenceLevel: string;
  isDisputable: boolean;
  issueCount: number;
  detectedIssues: string | null;
  suggestedFlow: string | null;
}

export default function ReportsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewingReport, setViewingReport] = useState<Report | null>(null);
  const [reportAccounts, setReportAccounts] = useState<AccountItem[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const fetchData = async () => {
    try {
      const [clientsRes, reportsRes] = await Promise.all([
        fetch("/api/clients"),
        fetch("/api/reports"),
      ]);

      if (clientsRes.ok) {
        const clientsData = await clientsRes.json();
        setClients(clientsData);
      }

      if (reportsRes.ok) {
        const reportsData = await reportsRes.json();
        setReports(reportsData);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchReportAccounts = async (reportId: string) => {
    setLoadingAccounts(true);
    try {
      const res = await fetch(`/api/reports/${reportId}/parse`);
      if (res.ok) {
        const data = await res.json();
        setReportAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleViewReport = (report: Report) => {
    setViewingReport(report);
    if (report.parseStatus === "COMPLETED" && report._count.accounts > 0) {
      fetchReportAccounts(report.id);
    } else {
      setReportAccounts([]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast({
          title: "Invalid File",
          description: "Please select a PDF file.",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedClient) {
      toast({
        title: "Missing Information",
        description: "Please select a client and a file.",
        variant: "destructive",
      });
      return;
    }

    if (session?.user?.subscriptionTier === "FREE") {
      toast({
        title: "Upgrade Required",
        description: "Report uploads require a Pro subscription.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Upload file to Vercel Blob via our server endpoint
      const formData = new FormData();
      formData.append("file", selectedFile);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const uploadError = await uploadRes.json();
        throw new Error(uploadError.error || "Failed to upload file");
      }

      const blob = await uploadRes.json();

      // Now process the report with the blob URL
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient,
          blobUrl: blob.url,
          fileName: selectedFile.name,
          reportDate: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        toast({
          title: "Upload Successful",
          description: "Your credit report has been uploaded and is being processed.",
        });
        setIsDialogOpen(false);
        setSelectedFile(null);
        setSelectedClient("");
        fetchData();
      } else {
        const error = await res.json();
        toast({
          title: "Upload Failed",
          description: error.error || "Failed to upload report",
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
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <Badge className="bg-brand-success/20 text-brand-success">Parsed</Badge>;
      case "PROCESSING":
        return <Badge className="bg-brand-info/20 text-brand-info">Processing</Badge>;
      case "PENDING":
        return <Badge className="bg-brand-warning/20 text-brand-warning">Pending</Badge>;
      case "FAILED":
        return <Badge className="bg-brand-error/20 text-brand-error">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getCRABadge = (cra: string) => {
    const colors: Record<string, string> = {
      TRANSUNION: "bg-sky-600/20 text-sky-400",
      EXPERIAN: "bg-blue-600/20 text-blue-400",
      EQUIFAX: "bg-red-600/20 text-red-400",
    };
    return <Badge className={colors[cra] || "bg-slate-500/20 text-slate-400"}>{cra}</Badge>;
  };

  const getConfidenceBadge = (level: string) => {
    const colors: Record<string, string> = {
      HIGH: "bg-brand-success/20 text-brand-success",
      MEDIUM: "bg-brand-warning/20 text-brand-warning",
      LOW: "bg-brand-error/20 text-brand-error",
    };
    return <Badge className={colors[level] || "bg-slate-500/20 text-slate-400"}>{level}</Badge>;
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const parseIssues = (detectedIssues: string | null): AccountIssue[] => {
    if (!detectedIssues) return [];
    try {
      return JSON.parse(detectedIssues);
    } catch {
      return [];
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "HIGH":
        return <ShieldAlert className="w-4 h-4 text-brand-error" />;
      case "MEDIUM":
        return <AlertTriangle className="w-4 h-4 text-brand-warning" />;
      default:
        return <AlertCircle className="w-4 h-4 text-brand-info" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      HIGH: "bg-brand-error/20 text-brand-error border-brand-error/30",
      MEDIUM: "bg-brand-warning/20 text-brand-warning border-brand-warning/30",
      LOW: "bg-brand-info/20 text-brand-info border-brand-info/30",
    };
    return colors[severity] || "bg-slate-500/20 text-slate-400";
  };

  const getFlowBadge = (flow: string | null) => {
    if (!flow) return null;
    const colors: Record<string, string> = {
      ACCURACY: "bg-brand-accent/20 text-brand-accent",
      COLLECTION: "bg-brand-warning/20 text-brand-warning",
      CONSENT: "bg-brand-info/20 text-brand-info",
    };
    return <Badge className={colors[flow] || "bg-slate-500/20 text-slate-400"}>{flow}</Badge>;
  };

  return (
    <div className="space-y-6 lg:ml-64 pt-16 lg:pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Credit Reports</h1>
          <p className="text-slate-400 mt-1">Upload and manage IdentityIQ credit reports</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="w-4 h-4 mr-2" />
              Upload Report
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">Upload Credit Report</DialogTitle>
              <DialogDescription className="text-slate-400">
                Upload a full-color IdentityIQ PDF to parse account data
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {session?.user?.subscriptionTier === "FREE" && (
                <div className="flex items-center gap-2 p-3 text-amber-400 bg-amber-400/10 rounded-md border border-amber-400/20">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">Pro subscription required for uploads</span>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-slate-200">Select Client</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                    <SelectValue placeholder="Choose a client" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.firstName} {client.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-200">Credit Report PDF</Label>
                <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center">
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2 text-emerald-400">
                      <CheckCircle className="w-5 h-5" />
                      <span>{selectedFile.name}</span>
                    </div>
                  ) : (
                    <>
                      <FileText className="w-10 h-10 mx-auto text-slate-500" />
                      <p className="text-slate-400 mt-2">Click to select a PDF file</p>
                    </>
                  )}
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    style={{ position: "relative" }}
                  />
                </div>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileSelect}
                  className="w-full text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-slate-700 file:text-white hover:file:bg-slate-600"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={uploading || !selectedFile || !selectedClient || session?.user?.subscriptionTier === "FREE"}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    "Upload Report"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Reports List */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Uploaded Reports</CardTitle>
          <CardDescription className="text-slate-400">
            Previously uploaded credit reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-slate-600" />
              <p className="text-slate-400 mt-4">No reports uploaded yet</p>
              <p className="text-sm text-slate-500">Upload your first IdentityIQ report to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="p-4 bg-slate-700/30 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors cursor-pointer"
                  onClick={() => handleViewReport(report)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">
                        {report.client.firstName} {report.client.lastName}
                      </p>
                      <p className="text-sm text-slate-400 mt-1">
                        Uploaded {new Date(report.uploadedAt).toLocaleDateString()} • {report._count.accounts} accounts parsed
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(report.parseStatus)}
                      <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Details Dialog */}
      <Dialog open={!!viewingReport} onOpenChange={(open) => !open && setViewingReport(null)}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              Report Details - {viewingReport?.client.firstName} {viewingReport?.client.lastName}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Uploaded {viewingReport && new Date(viewingReport.uploadedAt).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {/* Status Section */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">Status:</span>
                {viewingReport && getStatusBadge(viewingReport.parseStatus)}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">Pages:</span>
                <span className="text-white">{viewingReport?.pageCount || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">Accounts:</span>
                <span className="text-white">{viewingReport?._count.accounts || 0}</span>
              </div>
            </div>

            {/* Error Message */}
            {viewingReport?.parseStatus === "FAILED" && viewingReport.parseError && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 rounded-md border border-red-500/20">
                <XCircle className="w-5 h-5 text-red-400 mt-0.5" />
                <div>
                  <p className="text-sm text-red-400 font-medium">Parsing Failed</p>
                  <p className="text-sm text-red-300 mt-1">{viewingReport.parseError}</p>
                </div>
              </div>
            )}

            {/* Accounts List */}
            {viewingReport?.parseStatus === "COMPLETED" && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-slate-300">Parsed Accounts</h3>

                {loadingAccounts ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                    <p className="text-slate-400 mt-2 text-sm">Loading accounts...</p>
                  </div>
                ) : reportAccounts.length === 0 ? (
                  <p className="text-slate-500 text-sm">No accounts found</p>
                ) : (
                  <div className="space-y-3">
                    {reportAccounts.map((account) => {
                      const issues = parseIssues(account.detectedIssues);
                      return (
                        <div
                          key={account.id}
                          className={`p-4 rounded-lg border ${
                            account.isDisputable
                              ? "bg-red-900/10 border-red-500/30"
                              : "bg-slate-700/30 border-slate-700/50"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-white">{account.creditorName}</p>
                                {getCRABadge(account.cra)}
                                {account.isDisputable && (
                                  <Badge className="bg-red-500/20 text-red-400 border border-red-500/30">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    {account.issueCount} Issue{account.issueCount !== 1 ? "s" : ""}
                                  </Badge>
                                )}
                                {getFlowBadge(account.suggestedFlow)}
                              </div>
                              <p className="text-sm text-slate-400 mt-1">
                                Account: {account.maskedAccountId}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-sm flex-wrap">
                                <span className="text-slate-400">
                                  Balance: <span className="text-white">{formatCurrency(account.balance)}</span>
                                </span>
                                {account.pastDue !== null && account.pastDue > 0 && (
                                  <span className="text-red-400 font-medium">
                                    Past Due: {formatCurrency(account.pastDue)}
                                  </span>
                                )}
                                <span className="text-slate-400">
                                  Status: <span className="text-white">{account.accountStatus}</span>
                                </span>
                                {account.paymentStatus && (
                                  <span className="text-slate-400">
                                    Payment: <span className={account.paymentStatus.toLowerCase().includes("late") ? "text-red-400" : "text-white"}>
                                      {account.paymentStatus}
                                    </span>
                                  </span>
                                )}
                              </div>

                              {/* Display Issues */}
                              {issues.length > 0 && (
                                <div className="mt-3 space-y-2">
                                  <p className="text-xs font-medium text-slate-300 flex items-center gap-1">
                                    <Scale className="w-3 h-3" /> Potential FCRA Issues:
                                  </p>
                                  {issues.map((issue, idx) => (
                                    <div
                                      key={idx}
                                      className={`p-2 rounded text-xs border ${getSeverityBadge(issue.severity)}`}
                                    >
                                      <div className="flex items-start gap-2">
                                        {getSeverityIcon(issue.severity)}
                                        <div className="flex-1">
                                          <p className="font-medium">{issue.description}</p>
                                          {issue.fcraSection && (
                                            <p className="text-slate-400 mt-0.5">
                                              Cite: {issue.fcraSection}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 ml-4">
                              {getConfidenceBadge(account.confidenceLevel)}
                              <span className="text-xs text-slate-500">{account.confidenceScore}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
              <Button variant="ghost" onClick={() => setViewingReport(null)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
