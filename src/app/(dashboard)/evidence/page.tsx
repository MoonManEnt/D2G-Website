"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Image,
  FileText,
  Search,
  Filter,
  Trash2,
  ExternalLink,
  Calendar,
  User,
  AlertCircle,
  CheckCircle,
  Building2,
} from "lucide-react";
import { useToast } from "@/lib/use-toast";

interface EvidenceItem {
  id: string;
  evidenceType: string;
  title: string | null;
  description: string | null;
  sourcePageNum: number | null;
  cropRegion: string | null;
  annotations: string | null;
  createdAt: string;
  accountItem: {
    id: string;
    creditorName: string;
    maskedAccountId: string | null;
    cra: string;
    accountStatus: string;
    issueCount: number;
    report: {
      id: string;
      client: {
        id: string;
        firstName: string;
        lastName: string;
      } | null;
    } | null;
  } | null;
  sourceFile: {
    id: string;
    filename: string;
    storagePath: string;
  } | null;
  renderedFile: {
    id: string;
    filename: string;
    storagePath: string;
  } | null;
  documentAttachments: Array<{
    documentId: string;
    document: {
      id: string;
      title: string;
      disputeId: string | null;
    };
  }>;
}

interface EvidenceStats {
  total: number;
  byType: Record<string, number>;
  byCra: Record<string, number>;
  attachedToDisputes: number;
}

export default function EvidencePage() {
  const { toast } = useToast();
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [stats, setStats] = useState<EvidenceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCra, setFilterCra] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterAttached, setFilterAttached] = useState<string>("all");
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [evidenceToDelete, setEvidenceToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchEvidence = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/evidence");
      if (res.ok) {
        const data = await res.json();
        setEvidence(data.evidence);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch evidence:", error);
      toast({
        title: "Error",
        description: "Failed to load evidence",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvidence();
  }, []);

  const confirmDelete = (evidenceId: string) => {
    setEvidenceToDelete(evidenceId);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!evidenceToDelete) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/evidence?id=${evidenceToDelete}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast({
          title: "Evidence Deleted",
          description: "The evidence has been removed.",
        });
        fetchEvidence();
        setDetailDialogOpen(false);
      } else {
        throw new Error("Failed to delete");
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete evidence",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setEvidenceToDelete(null);
    }
  };

  const filteredEvidence = evidence.filter((item) => {
    // Search filter
    const searchText = [
      item.title,
      item.description,
      item.accountItem?.creditorName,
      item.accountItem?.report?.client?.firstName,
      item.accountItem?.report?.client?.lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (searchQuery && !searchText.includes(searchQuery.toLowerCase())) {
      return false;
    }

    // CRA filter
    if (filterCra !== "all" && item.accountItem?.cra !== filterCra) {
      return false;
    }

    // Type filter
    if (filterType !== "all" && item.evidenceType !== filterType) {
      return false;
    }

    // Attached filter
    if (filterAttached === "attached" && item.documentAttachments.length === 0) {
      return false;
    }
    if (filterAttached === "unattached" && item.documentAttachments.length > 0) {
      return false;
    }

    return true;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "PDF_TEXT_EXTRACT":
        return <FileText className="w-4 h-4" />;
      case "SCREENSHOT":
        return <Image className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "PDF_TEXT_EXTRACT":
        return "Text Extract";
      case "SCREENSHOT":
        return "Screenshot";
      case "ANNOTATION":
        return "Annotation";
      default:
        return type;
    }
  };

  const getCraBadgeColor = (cra: string) => {
    switch (cra) {
      case "TRANSUNION":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "EXPERIAN":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case "EQUIFAX":
        return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    }
  };

  return (
    <div className="space-y-6 lg:ml-64 pt-16 lg:pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Evidence Gallery</h1>
          <p className="text-slate-400 mt-1">
            View and manage all captured evidence from credit reports
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-brand-info/20">
                  <FileText className="w-5 h-5 text-brand-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                  <p className="text-xs text-slate-400">Total Evidence</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-brand-success/20">
                  <CheckCircle className="w-5 h-5 text-brand-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {stats.attachedToDisputes}
                  </p>
                  <p className="text-xs text-slate-400">Attached to Disputes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-brand-warning/20">
                  <AlertCircle className="w-5 h-5 text-brand-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {stats.total - stats.attachedToDisputes}
                  </p>
                  <p className="text-xs text-slate-400">Unattached</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-brand-accent/20">
                  <Building2 className="w-5 h-5 text-brand-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {Object.keys(stats.byCra).length}
                  </p>
                  <p className="text-xs text-slate-400">Credit Bureaus</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search by account, client, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-800/50 border-slate-700 text-white"
          />
        </div>

        <div className="flex gap-2">
          <Select value={filterCra} onValueChange={setFilterCra}>
            <SelectTrigger className="w-[140px] bg-slate-800/50 border-slate-700 text-white">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="CRA" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all">All CRAs</SelectItem>
              <SelectItem value="TRANSUNION">TransUnion</SelectItem>
              <SelectItem value="EXPERIAN">Experian</SelectItem>
              <SelectItem value="EQUIFAX">Equifax</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[150px] bg-slate-800/50 border-slate-700 text-white">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="PDF_TEXT_EXTRACT">Text Extract</SelectItem>
              <SelectItem value="SCREENSHOT">Screenshot</SelectItem>
              <SelectItem value="ANNOTATION">Annotation</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterAttached} onValueChange={setFilterAttached}>
            <SelectTrigger className="w-[150px] bg-slate-800/50 border-slate-700 text-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="attached">Attached</SelectItem>
              <SelectItem value="unattached">Unattached</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Evidence Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading evidence...</div>
      ) : filteredEvidence.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-12 text-center">
            <Image className="w-12 h-12 mx-auto text-slate-600" />
            <h3 className="text-lg font-medium text-white mt-4">No evidence found</h3>
            <p className="text-slate-400 mt-2">
              {searchQuery || filterCra !== "all" || filterType !== "all"
                ? "Try adjusting your filters"
                : "Capture evidence from the Negative Items page to get started"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvidence.map((item) => (
            <Card
              key={item.id}
              className="bg-slate-800/50 border-slate-700 hover:border-slate-500 transition-colors cursor-pointer"
              onClick={() => {
                setSelectedEvidence(item);
                setDetailDialogOpen(true);
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-slate-700/50">
                      {getTypeIcon(item.evidenceType)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white truncate max-w-[180px]">
                        {item.title || "Untitled Evidence"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {getTypeLabel(item.evidenceType)}
                      </p>
                    </div>
                  </div>
                  {item.documentAttachments.length > 0 ? (
                    <Badge className="bg-brand-success/20 text-brand-success border-brand-success/30">
                      Attached
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-400 border-slate-600">
                      Unattached
                    </Badge>
                  )}
                </div>

                {item.accountItem && (
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3 h-3 text-slate-500" />
                      <p className="text-sm text-slate-300 truncate">
                        {item.accountItem.creditorName}
                      </p>
                    </div>
                    {item.accountItem.report?.client && (
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-slate-500" />
                        <p className="text-sm text-slate-400">
                          {item.accountItem.report.client.firstName}{" "}
                          {item.accountItem.report.client.lastName}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-700">
                  <div className="flex items-center gap-2">
                    {item.accountItem?.cra && (
                      <Badge
                        variant="outline"
                        className={getCraBadgeColor(item.accountItem.cra)}
                      >
                        {item.accountItem.cra}
                      </Badge>
                    )}
                    {item.sourcePageNum && (
                      <Badge variant="outline" className="text-slate-400 border-slate-600">
                        Page {item.sourcePageNum}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Calendar className="w-3 h-3" />
                    {formatDate(item.createdAt)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Evidence Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Evidence Details</DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedEvidence?.title || "Untitled Evidence"}
            </DialogDescription>
          </DialogHeader>

          {selectedEvidence && (
            <div className="space-y-4">
              {/* Evidence Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 uppercase">Type</p>
                  <div className="flex items-center gap-2">
                    {getTypeIcon(selectedEvidence.evidenceType)}
                    <p className="text-sm text-white">
                      {getTypeLabel(selectedEvidence.evidenceType)}
                    </p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 uppercase">Source Page</p>
                  <p className="text-sm text-white">
                    {selectedEvidence.sourcePageNum
                      ? `Page ${selectedEvidence.sourcePageNum}`
                      : "N/A"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 uppercase">Captured</p>
                  <p className="text-sm text-white">
                    {formatDate(selectedEvidence.createdAt)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 uppercase">Status</p>
                  {selectedEvidence.documentAttachments.length > 0 ? (
                    <Badge className="bg-brand-success/20 text-brand-success border-brand-success/30">
                      Attached to {selectedEvidence.documentAttachments.length} document(s)
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-brand-warning border-brand-warning/30">
                      Not attached to any dispute
                    </Badge>
                  )}
                </div>
              </div>

              {/* Account Info */}
              {selectedEvidence.accountItem && (
                <Card className="bg-slate-900/50 border-slate-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-white">Account Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Creditor</span>
                      <span className="text-sm text-white font-medium">
                        {selectedEvidence.accountItem.creditorName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Account #</span>
                      <span className="text-sm text-white">
                        {selectedEvidence.accountItem.maskedAccountId || "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Credit Bureau</span>
                      <Badge
                        variant="outline"
                        className={getCraBadgeColor(selectedEvidence.accountItem.cra)}
                      >
                        {selectedEvidence.accountItem.cra}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Status</span>
                      <span className="text-sm text-white">
                        {selectedEvidence.accountItem.accountStatus}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Issues Detected</span>
                      <Badge
                        variant="outline"
                        className={
                          selectedEvidence.accountItem.issueCount > 0
                            ? "bg-brand-error/20 text-brand-error border-brand-error/30"
                            : "text-slate-400 border-slate-600"
                        }
                      >
                        {selectedEvidence.accountItem.issueCount} issues
                      </Badge>
                    </div>
                    {selectedEvidence.accountItem.report?.client && (
                      <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                        <span className="text-sm text-slate-400">Client</span>
                        <span className="text-sm text-white">
                          {selectedEvidence.accountItem.report.client.firstName}{" "}
                          {selectedEvidence.accountItem.report.client.lastName}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Description */}
              {selectedEvidence.description && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 uppercase">Description / Extract</p>
                  <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">
                      {selectedEvidence.description}
                    </p>
                  </div>
                </div>
              )}

              {/* Attached Documents */}
              {selectedEvidence.documentAttachments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 uppercase">Attached Documents</p>
                  <div className="space-y-2">
                    {selectedEvidence.documentAttachments.map((attachment) => (
                      <div
                        key={attachment.documentId}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-white">
                            {attachment.document.title}
                          </span>
                        </div>
                        {attachment.document.disputeId && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-slate-400 hover:text-white"
                            onClick={() => {
                              window.location.href = `/disputes?id=${attachment.document.disputeId}`;
                            }}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-700">
                <Button
                  variant="ghost"
                  onClick={() => setDetailDialogOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  Close
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => confirmDelete(selectedEvidence.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Evidence
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Evidence?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the evidence
              and remove it from any associated disputes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
