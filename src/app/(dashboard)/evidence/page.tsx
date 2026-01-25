"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Layers,
  Edit3,
  GitCompare,
  FolderOpen,
  Plus,
  Download,
  Eye,
  GripVertical,
  X,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  Save,
  ArrowRight,
  Square,
  Circle,
  Type,
  Highlighter,
  Brain,
} from "lucide-react";
import { useToast } from "@/lib/use-toast";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

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

interface Annotation {
  id: string;
  type: "rectangle" | "circle" | "arrow" | "text" | "highlight" | "redact";
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  color: string;
  filled?: boolean;
}

interface Exhibit {
  id: string;
  label: string;
  evidenceId: string;
  evidence: EvidenceItem;
  caption: string;
  notes: string;
}

interface Divergence {
  field: string;
  label: string;
  type: string;
  severity: "HIGH" | "MEDIUM" | "LOW" | "INFO";
  values: Record<string, string>;
  difference?: string;
  note: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CRA_COLORS: Record<string, { color: string; bg: string }> = {
  TRANSUNION: { color: "#0ea5e9", bg: "rgba(14, 165, 233, 0.15)" },
  EXPERIAN: { color: "#3b82f6", bg: "rgba(59, 130, 246, 0.15)" },
  EQUIFAX: { color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)" },
};

const SEVERITY_CONFIG = {
  HIGH: { color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)", label: "High", icon: "🚨" },
  MEDIUM: { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)", label: "Medium", icon: "⚠️" },
  LOW: { color: "#3b82f6", bg: "rgba(59, 130, 246, 0.15)", label: "Low", icon: "ℹ️" },
  INFO: { color: "#64748b", bg: "rgba(100, 116, 139, 0.15)", label: "Info", icon: "📝" },
};

const ANNOTATION_TOOLS = [
  { id: "select", icon: "🖱️", label: "Select", cursor: "default" },
  { id: "rectangle", icon: "⬜", label: "Rectangle", cursor: "crosshair" },
  { id: "circle", icon: "⭕", label: "Circle", cursor: "crosshair" },
  { id: "arrow", icon: "➡️", label: "Arrow", cursor: "crosshair" },
  { id: "text", icon: "💬", label: "Text Callout", cursor: "text" },
  { id: "highlight", icon: "🖍️", label: "Highlight", cursor: "crosshair" },
  { id: "redact", icon: "█", label: "Redact", cursor: "crosshair" },
];

const ANNOTATION_COLORS = [
  { id: "red", color: "#ef4444", label: "Red - Violation" },
  { id: "yellow", color: "#f59e0b", label: "Yellow - Warning" },
  { id: "green", color: "#10b981", label: "Green - Verified" },
  { id: "blue", color: "#3b82f6", label: "Blue - Note" },
  { id: "purple", color: "#8b5cf6", label: "Purple - Important" },
];

const PRESET_CALLOUTS = [
  { id: "balance", text: "BALANCE DISCREPANCY", icon: "💰" },
  { id: "date", text: "DATE MISMATCH", icon: "📅" },
  { id: "prior", text: "PRIOR DISPUTE ON FILE", icon: "⚖️" },
  { id: "chargeoff", text: "CHARGE-OFF", icon: "🚨" },
  { id: "late", text: "LATE PAYMENT", icon: "⏰" },
  { id: "verify", text: "VERIFY THIS DATA", icon: "🔍" },
  { id: "inaccurate", text: "INACCURATE REPORTING", icon: "❌" },
  { id: "fcra", text: "FCRA VIOLATION", icon: "⚠️" },
];

const EXHIBIT_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function EvidencePage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("library");
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

  // Annotator state
  const [annotatorEvidence, setAnnotatorEvidence] = useState<EvidenceItem | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  // Exhibit builder state
  const [exhibits, setExhibits] = useState<Exhibit[]>([]);
  const [selectedExhibit, setSelectedExhibitState] = useState<string | null>(null);

  // Bureau comparison state
  const [comparisonEvidence, setComparisonEvidence] = useState<EvidenceItem | null>(null);

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

    if (filterCra !== "all" && item.accountItem?.cra !== filterCra) {
      return false;
    }

    if (filterType !== "all" && item.evidenceType !== filterType) {
      return false;
    }

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
      case "BUREAU_COMPARISON":
        return <GitCompare className="w-4 h-4" />;
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
      case "BUREAU_COMPARISON":
        return "Bureau Comparison";
      default:
        return type;
    }
  };

  const getCraBadgeColor = (cra: string) => {
    switch (cra) {
      case "TRANSUNION":
        return "bg-sky-500/20 text-sky-300 border-sky-500/30";
      case "EXPERIAN":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "EQUIFAX":
        return "bg-red-500/20 text-red-300 border-red-500/30";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    }
  };

  // Open evidence in annotator
  const openInAnnotator = (item: EvidenceItem) => {
    setAnnotatorEvidence(item);
    setAnnotations([]);
    setActiveTab("annotator");
  };

  // Add evidence to exhibits
  const addToExhibits = (item: EvidenceItem) => {
    const nextLabel = EXHIBIT_LABELS[exhibits.length] || `#${exhibits.length + 1}`;
    const newExhibit: Exhibit = {
      id: `exhibit-${Date.now()}`,
      label: nextLabel,
      evidenceId: item.id,
      evidence: item,
      caption: `${getTypeLabel(item.evidenceType)} - ${item.accountItem?.creditorName || "Unknown"}`,
      notes: "",
    };
    setExhibits((prev) => [...prev, newExhibit]);
    setActiveTab("exhibits");
    toast({
      title: "Added to Exhibits",
      description: `Evidence added as Exhibit ${nextLabel}`,
    });
  };

  // Open bureau comparison for evidence
  const openBureauComparison = (item: EvidenceItem) => {
    setComparisonEvidence(item);
    setActiveTab("comparison");
  };

  return (
    <div className="space-y-6 lg:ml-64 pt-16 lg:pt-0 p-6 relative">
      {/* Ambient glow effects */}
      <div className="fixed top-[10%] left-[20%] w-[600px] h-[600px] bg-[radial-gradient(ellipse,rgba(124,58,237,0.08)_0%,transparent_70%)] pointer-events-none" />
      <div className="fixed bottom-[20%] right-[10%] w-[400px] h-[400px] bg-[radial-gradient(ellipse,rgba(16,185,129,0.06)_0%,transparent_70%)] pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between relative z-10">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent flex items-center gap-3">
            <FolderOpen className="w-7 h-7 text-white" />
            Evidence Center
          </h1>
          <p className="text-slate-400 mt-1">
            Capture, annotate, and organize dispute evidence
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="relative z-10">
        <TabsList className="bg-slate-800/60 border border-slate-700/50">
          <TabsTrigger value="library" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <Layers className="w-4 h-4 mr-2" />
            Library
          </TabsTrigger>
          <TabsTrigger value="annotator" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <Edit3 className="w-4 h-4 mr-2" />
            Annotator
          </TabsTrigger>
          <TabsTrigger value="exhibits" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <FileText className="w-4 h-4 mr-2" />
            Exhibit Builder
            {exhibits.length > 0 && (
              <Badge className="ml-2 bg-purple-500/30 text-purple-300">{exhibits.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="comparison" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <GitCompare className="w-4 h-4 mr-2" />
            Bureau Comparison
          </TabsTrigger>
        </TabsList>

        {/* ============================================================================ */}
        {/* LIBRARY TAB */}
        {/* ============================================================================ */}
        <TabsContent value="library" className="mt-6 space-y-6">
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-blue-500/20">
                      <FileText className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{stats.total}</p>
                      <p className="text-xs text-slate-400">Total Evidence</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-emerald-500/20">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
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

              <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-amber-500/20">
                      <AlertCircle className="w-5 h-5 text-amber-400" />
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

              <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-purple-500/20">
                      <Building2 className="w-5 h-5 text-purple-400" />
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
                className="pl-10 bg-slate-800/60 border-slate-700/50 text-white"
              />
            </div>

            <div className="flex gap-2">
              <Select value={filterCra} onValueChange={setFilterCra}>
                <SelectTrigger className="w-[140px] bg-slate-800/60 border-slate-700/50 text-white">
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
                <SelectTrigger className="w-[150px] bg-slate-800/60 border-slate-700/50 text-white">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="PDF_TEXT_EXTRACT">Text Extract</SelectItem>
                  <SelectItem value="SCREENSHOT">Screenshot</SelectItem>
                  <SelectItem value="ANNOTATION">Annotation</SelectItem>
                  <SelectItem value="BUREAU_COMPARISON">Bureau Comparison</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterAttached} onValueChange={setFilterAttached}>
                <SelectTrigger className="w-[150px] bg-slate-800/60 border-slate-700/50 text-white">
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
            <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-xl">
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
                  className="bg-slate-800/60 border-slate-700/50 backdrop-blur-xl hover:border-purple-500/50 transition-all cursor-pointer group"
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
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
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

                    {/* Quick Actions - visible on hover */}
                    <div className="flex gap-2 mb-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-500/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          openInAnnotator(item);
                        }}
                      >
                        <Edit3 className="w-3 h-3 mr-1" />
                        Annotate
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          addToExhibits(item);
                        }}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Exhibit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          openBureauComparison(item);
                        }}
                      >
                        <GitCompare className="w-3 h-3 mr-1" />
                        Compare
                      </Button>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
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
        </TabsContent>

        {/* ============================================================================ */}
        {/* ANNOTATOR TAB */}
        {/* ============================================================================ */}
        <TabsContent value="annotator" className="mt-6">
          <EvidenceAnnotator
            evidence={annotatorEvidence}
            annotations={annotations}
            setAnnotations={setAnnotations}
            onBack={() => setActiveTab("library")}
            onSave={(updatedAnnotations) => {
              setAnnotations(updatedAnnotations);
              toast({
                title: "Annotations Saved",
                description: "Your annotations have been saved.",
              });
            }}
          />
        </TabsContent>

        {/* ============================================================================ */}
        {/* EXHIBIT BUILDER TAB */}
        {/* ============================================================================ */}
        <TabsContent value="exhibits" className="mt-6">
          <ExhibitBuilder
            exhibits={exhibits}
            setExhibits={setExhibits}
            availableEvidence={evidence}
            selectedExhibit={selectedExhibit}
            setSelectedExhibit={setSelectedExhibitState}
            onAddEvidence={(item) => addToExhibits(item)}
          />
        </TabsContent>

        {/* ============================================================================ */}
        {/* BUREAU COMPARISON TAB */}
        {/* ============================================================================ */}
        <TabsContent value="comparison" className="mt-6">
          <BureauComparison
            evidence={comparisonEvidence}
            allEvidence={evidence}
            onBack={() => setActiveTab("library")}
            onAddToExhibit={addToExhibits}
          />
        </TabsContent>
      </Tabs>

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
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                      Attached to {selectedEvidence.documentAttachments.length} document(s)
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-400 border-amber-400/30">
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
                            ? "bg-red-500/20 text-red-300 border-red-500/30"
                            : "text-slate-400 border-slate-600"
                        }
                      >
                        {selectedEvidence.accountItem.issueCount} issues
                      </Badge>
                    </div>
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

              {/* Quick Actions */}
              <div className="flex gap-2 pt-4 border-t border-slate-700">
                <Button
                  variant="outline"
                  className="flex-1 border-purple-500/50 text-purple-400 hover:bg-purple-500/20"
                  onClick={() => {
                    setDetailDialogOpen(false);
                    openInAnnotator(selectedEvidence);
                  }}
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Annotate
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20"
                  onClick={() => {
                    setDetailDialogOpen(false);
                    addToExhibits(selectedEvidence);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add to Exhibit
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-blue-500/50 text-blue-400 hover:bg-blue-500/20"
                  onClick={() => {
                    setDetailDialogOpen(false);
                    openBureauComparison(selectedEvidence);
                  }}
                >
                  <GitCompare className="w-4 h-4 mr-2" />
                  Compare
                </Button>
              </div>

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
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Evidence?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This action cannot be undone. This will permanently delete the evidence
              and remove it from any associated disputes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="border-slate-600">
              Cancel
            </AlertDialogCancel>
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

// ============================================================================
// EVIDENCE ANNOTATOR COMPONENT
// ============================================================================

function EvidenceAnnotator({
  evidence,
  annotations,
  setAnnotations,
  onBack,
  onSave,
}: {
  evidence: EvidenceItem | null;
  annotations: Annotation[];
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
  onBack: () => void;
  onSave: (annotations: Annotation[]) => void;
}) {
  const [activeTool, setActiveTool] = useState("select");
  const [activeColor, setActiveColor] = useState("#ef4444");
  const [selectedAnnotation, setSelectedAnnotation] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showAmeliaPanel, setShowAmeliaPanel] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Mock detected violations for Amelia panel
  const detectedViolations = useMemo(() => {
    if (!evidence?.accountItem) return [];
    return [
      {
        type: "BALANCE_DISCREPANCY",
        field: "Balance",
        values: { TU: "$29,778.00", EQ: "$29,621.00" },
        difference: "$157.00",
        suggestedRegion: { x: 450, y: 280, width: 200, height: 30 },
      },
      {
        type: "PRIOR_DISPUTE",
        field: "Comments",
        values: { TU: "Dispute resolved; customer disagrees", EQ: "Consumer disputes after resolution" },
        suggestedRegion: { x: 100, y: 420, width: 600, height: 50 },
      },
    ];
  }, [evidence]);

  const applySuggestion = (violation: typeof detectedViolations[0]) => {
    if (violation.suggestedRegion) {
      const newAnnotation: Annotation = {
        id: `ann-${Date.now()}`,
        type: "rectangle",
        ...violation.suggestedRegion,
        color: "#ef4444",
        filled: true,
      };
      setAnnotations((prev) => [...prev, newAnnotation]);
    }
  };

  const addPresetCallout = (preset: typeof PRESET_CALLOUTS[0]) => {
    const newAnnotation: Annotation = {
      id: `ann-${Date.now()}`,
      type: "text",
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 100,
      text: preset.text,
      color: activeColor,
    };
    setAnnotations((prev) => [...prev, newAnnotation]);
  };

  const deleteSelected = () => {
    if (selectedAnnotation !== null) {
      setAnnotations((prev) => prev.filter((_, i) => i !== selectedAnnotation));
      setSelectedAnnotation(null);
    }
  };

  const clearAll = () => {
    setAnnotations([]);
    setSelectedAnnotation(null);
  };

  if (!evidence) {
    return (
      <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-xl">
        <CardContent className="py-16 text-center">
          <Edit3 className="w-12 h-12 mx-auto text-slate-600" />
          <h3 className="text-lg font-medium text-white mt-4">No Evidence Selected</h3>
          <p className="text-slate-400 mt-2 mb-6">
            Select evidence from the Library to start annotating
          </p>
          <Button onClick={onBack} variant="outline" className="border-slate-600">
            Go to Library
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-280px)]">
      {/* Left Toolbar */}
      <div className="w-16 bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 flex flex-col gap-4 backdrop-blur-xl">
        <div className="flex flex-col items-center gap-2">
          <span className="text-[10px] text-slate-500 uppercase">Tools</span>
          {ANNOTATION_TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all ${
                activeTool === tool.id
                  ? "bg-purple-500/30 ring-2 ring-purple-500"
                  : "bg-slate-700/50 hover:bg-slate-700"
              }`}
              title={tool.label}
            >
              {tool.icon}
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center gap-2">
          <span className="text-[10px] text-slate-500 uppercase">Color</span>
          {ANNOTATION_COLORS.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveColor(c.color)}
              className={`w-7 h-7 rounded-md transition-all ${
                activeColor === c.color ? "ring-2 ring-white scale-110" : ""
              }`}
              style={{ background: c.color }}
              title={c.label}
            />
          ))}
        </div>

        <div className="flex flex-col items-center gap-2">
          <span className="text-[10px] text-slate-500 uppercase">Zoom</span>
          <button
            onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
            className="w-8 h-6 bg-slate-700/50 rounded text-white text-sm hover:bg-slate-700"
          >
            +
          </button>
          <span className="text-[10px] text-slate-400">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="w-8 h-6 bg-slate-700/50 rounded text-white text-sm hover:bg-slate-700"
          >
            −
          </button>
        </div>

        <div className="flex flex-col items-center gap-2 mt-auto">
          <button
            onClick={deleteSelected}
            disabled={selectedAnnotation === null}
            className="w-full p-2 bg-slate-700/50 rounded-lg text-xs text-slate-400 hover:bg-red-500/20 hover:text-red-400 disabled:opacity-50"
          >
            🗑️ Del
          </button>
          <button
            onClick={clearAll}
            className="w-full p-2 bg-slate-700/50 rounded-lg text-xs text-slate-400 hover:bg-slate-700"
          >
            🧹 Clear
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 bg-slate-900/50 rounded-xl border border-slate-700/50 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button onClick={onBack} variant="ghost" size="sm" className="text-slate-400">
              ← Back
            </Button>
            <div>
              <h3 className="text-white font-medium">{evidence.accountItem?.creditorName || "Evidence"}</h3>
              <p className="text-xs text-slate-500">
                {evidence.accountItem?.maskedAccountId || ""} • Page {evidence.sourcePageNum || "N/A"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="text-slate-400">
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-slate-400">
              <Redo2 className="w-4 h-4" />
            </Button>
            <Button onClick={() => onSave(annotations)} size="sm" className="bg-purple-600 hover:bg-purple-700">
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button variant="outline" size="sm" className="border-slate-600">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        <div
          className="rounded-lg overflow-hidden shadow-lg"
          style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
        >
          {/* Placeholder for actual canvas/image */}
          <div className="w-[800px] h-[600px] bg-slate-100 relative">
            {/* Mock credit report table */}
            <div className="absolute inset-0 p-4">
              <div className="bg-slate-800 text-white p-3 rounded-t-lg font-bold">
                {evidence.accountItem?.creditorName || "ACCOUNT"}
              </div>
              <div className="bg-white border border-slate-300">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-2 text-left border">Field</th>
                      <th className="p-2 text-center border">TransUnion</th>
                      <th className="p-2 text-center border">Experian</th>
                      <th className="p-2 text-center border">Equifax</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-2 border text-slate-600">Account #</td>
                      <td className="p-2 border text-center">11**</td>
                      <td className="p-2 border text-center">-</td>
                      <td className="p-2 border text-center">430015XXXX****</td>
                    </tr>
                    <tr className="bg-red-50">
                      <td className="p-2 border text-slate-600">Balance</td>
                      <td className="p-2 border text-center font-medium">$29,778.00</td>
                      <td className="p-2 border text-center">-</td>
                      <td className="p-2 border text-center font-medium">$29,621.00</td>
                    </tr>
                    <tr>
                      <td className="p-2 border text-slate-600">Status</td>
                      <td className="p-2 border text-center">Open</td>
                      <td className="p-2 border text-center">-</td>
                      <td className="p-2 border text-center">Open</td>
                    </tr>
                    <tr className="bg-amber-50">
                      <td className="p-2 border text-slate-600">Comments</td>
                      <td className="p-2 border text-center text-xs">Dispute resolved; customer disagrees</td>
                      <td className="p-2 border text-center">-</td>
                      <td className="p-2 border text-center text-xs">Consumer disputes after resolution</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Render annotations */}
            {annotations.map((ann, i) => (
              <div
                key={ann.id}
                onClick={() => setSelectedAnnotation(i)}
                className={`absolute cursor-pointer ${selectedAnnotation === i ? "ring-2 ring-white" : ""}`}
                style={{
                  left: ann.x,
                  top: ann.y,
                  width: ann.width || "auto",
                  height: ann.height || "auto",
                  ...(ann.type === "rectangle" && {
                    border: `2px solid ${ann.color}`,
                    backgroundColor: ann.filled ? `${ann.color}30` : "transparent",
                  }),
                  ...(ann.type === "highlight" && {
                    backgroundColor: `${ann.color}40`,
                  }),
                  ...(ann.type === "text" && {
                    backgroundColor: ann.color,
                    padding: "4px 8px",
                    borderRadius: "4px",
                    color: "white",
                    fontSize: "12px",
                    fontWeight: "bold",
                  }),
                }}
              >
                {ann.type === "text" && ann.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Amelia AI */}
      {showAmeliaPanel && (
        <div className="w-80 bg-slate-800/60 border border-slate-700/50 rounded-xl backdrop-blur-xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
            <div className="flex items-center gap-2 text-emerald-400">
              <Brain className="w-5 h-5" />
              <span className="font-semibold">Amelia AI</span>
            </div>
            <button
              onClick={() => setShowAmeliaPanel(false)}
              className="w-7 h-7 bg-slate-700/50 rounded-lg flex items-center justify-center text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Detected Violations */}
            <div className="p-4 border-b border-slate-700/50">
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-3">
                Detected Violations
              </h4>
              {detectedViolations.map((v, i) => (
                <div key={i} className="mb-3 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-red-400">
                      {v.type.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">Field: {v.field}</p>
                  <div className="space-y-1 mb-2">
                    {Object.entries(v.values).map(([bureau, value]) => (
                      <div key={bureau} className="flex gap-2 text-xs">
                        <span className="text-slate-500 w-6">{bureau}:</span>
                        <span className="text-white font-mono">{value}</span>
                      </div>
                    ))}
                  </div>
                  {v.difference && (
                    <div className="inline-block px-2 py-1 bg-red-500/20 rounded text-xs font-semibold text-red-400 mb-2">
                      Δ {v.difference}
                    </div>
                  )}
                  <button
                    onClick={() => applySuggestion(v)}
                    className="w-full p-2 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-xs font-semibold text-emerald-400 hover:bg-emerald-500/25"
                  >
                    ✨ Auto-Highlight
                  </button>
                </div>
              ))}
            </div>

            {/* Quick Callouts */}
            <div className="p-4 border-b border-slate-700/50">
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-3">
                Quick Callouts
              </h4>
              <div className="flex flex-wrap gap-2">
                {PRESET_CALLOUTS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => addPresetCallout(preset)}
                    className="px-2 py-1 bg-slate-700/50 border border-slate-600/50 rounded text-[10px] text-white hover:bg-slate-700"
                  >
                    {preset.icon} {preset.text}
                  </button>
                ))}
              </div>
            </div>

            {/* Annotations List */}
            <div className="p-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-3">
                Annotations ({annotations.length})
              </h4>
              {annotations.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No annotations yet</p>
              ) : (
                <div className="space-y-2">
                  {annotations.map((ann, i) => (
                    <div
                      key={ann.id}
                      onClick={() => setSelectedAnnotation(i)}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                        selectedAnnotation === i
                          ? "bg-purple-500/20 ring-1 ring-purple-500"
                          : "bg-slate-700/30 hover:bg-slate-700/50"
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ background: ann.color }}
                      />
                      <span className="text-xs text-white truncate">
                        {ann.type === "text" ? `"${ann.text}"` : ann.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!showAmeliaPanel && (
        <button
          onClick={() => setShowAmeliaPanel(true)}
          className="fixed right-6 top-1/3 w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
        >
          <Brain className="w-6 h-6 text-white" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// EXHIBIT BUILDER COMPONENT
// ============================================================================

function ExhibitBuilder({
  exhibits,
  setExhibits,
  availableEvidence,
  selectedExhibit,
  setSelectedExhibit,
  onAddEvidence,
}: {
  exhibits: Exhibit[];
  setExhibits: React.Dispatch<React.SetStateAction<Exhibit[]>>;
  availableEvidence: EvidenceItem[];
  selectedExhibit: string | null;
  setSelectedExhibit: (id: string | null) => void;
  onAddEvidence: (item: EvidenceItem) => void;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const [draggedItem, setDraggedItem] = useState<{ item: EvidenceItem | Exhibit; type: "evidence" | "exhibit" } | null>(null);

  // Get unused evidence
  const unusedEvidence = availableEvidence.filter(
    (ev) => !exhibits.some((ex) => ex.evidenceId === ev.id)
  );

  const removeExhibit = (exhibitId: string) => {
    setExhibits((prev) => {
      const filtered = prev.filter((ex) => ex.id !== exhibitId);
      return filtered.map((ex, i) => ({
        ...ex,
        label: EXHIBIT_LABELS[i] || `#${i + 1}`,
      }));
    });
    if (selectedExhibit === exhibitId) {
      setSelectedExhibit(null);
    }
  };

  const updateCaption = (exhibitId: string, caption: string) => {
    setExhibits((prev) =>
      prev.map((ex) => (ex.id === exhibitId ? { ...ex, caption } : ex))
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "PDF_TEXT_EXTRACT":
        return <FileText className="w-4 h-4" />;
      case "SCREENSHOT":
        return <Image className="w-4 h-4" />;
      case "BUREAU_COMPARISON":
        return <GitCompare className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-280px)]">
      {/* Left Panel - Available Evidence */}
      <div className="w-72 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Available Evidence</h3>
          <span className="text-xs text-slate-500">{unusedEvidence.length} items</span>
        </div>
        <p className="text-xs text-slate-500 mb-4">Drag evidence to add to exhibits</p>

        <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto pr-2">
          {unusedEvidence.map((ev) => (
            <div
              key={ev.id}
              draggable
              onDragStart={() => setDraggedItem({ item: ev, type: "evidence" })}
              className="flex items-start gap-3 p-3 bg-slate-800/60 border border-slate-700/50 rounded-xl cursor-grab hover:border-purple-500/50 transition-colors"
            >
              <div className="p-2 bg-slate-700/50 rounded-lg text-lg">
                {getTypeIcon(ev.evidenceType)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-white truncate">
                  {ev.accountItem?.creditorName || "Evidence"}
                </h4>
                <p className="text-xs text-slate-500">
                  {ev.evidenceType === "SCREENSHOT" ? "Screenshot" : "Text Extract"}
                </p>
                {ev.accountItem?.cra && (
                  <div className="flex gap-1 mt-1">
                    <span
                      className="px-1.5 py-0.5 rounded text-[9px] font-semibold"
                      style={{
                        backgroundColor: CRA_COLORS[ev.accountItem.cra]?.bg,
                        color: CRA_COLORS[ev.accountItem.cra]?.color,
                      }}
                    >
                      {ev.accountItem.cra.slice(0, 2)}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => onAddEvidence(ev)}
                className="w-7 h-7 bg-emerald-500/15 border border-emerald-500/30 rounded-md text-emerald-400 hover:bg-emerald-500/25"
              >
                +
              </button>
            </div>
          ))}

          {unusedEvidence.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
              <p className="text-sm">All evidence added</p>
            </div>
          )}
        </div>
      </div>

      {/* Main - Exhibit Builder */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Exhibit Package</h3>
          <div className="flex gap-2">
            <span className="px-3 py-1.5 bg-purple-500/15 rounded-lg text-xs font-semibold text-purple-400">
              {exhibits.length} Exhibit{exhibits.length !== 1 ? "s" : ""}
            </span>
            <Button
              onClick={() => setShowPreview(true)}
              variant="outline"
              size="sm"
              className="border-slate-600"
              disabled={exhibits.length === 0}
            >
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
              disabled={exhibits.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Generate PDF
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {exhibits.map((exhibit) => (
            <div
              key={exhibit.id}
              onClick={() => setSelectedExhibit(exhibit.id)}
              className={`flex items-stretch bg-slate-800/60 border rounded-xl overflow-hidden cursor-pointer transition-all ${
                selectedExhibit === exhibit.id
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-slate-700/50 hover:border-slate-600"
              }`}
            >
              {/* Exhibit Label */}
              <div className="w-14 bg-gradient-to-b from-purple-600 to-purple-700 flex items-center justify-center shrink-0">
                <span className="text-2xl font-bold text-white">{exhibit.label}</span>
              </div>

              {/* Thumbnail */}
              <div className="w-20 bg-slate-900/50 flex items-center justify-center shrink-0">
                <div className="text-2xl">{getTypeIcon(exhibit.evidence.evidenceType)}</div>
              </div>

              {/* Content */}
              <div className="flex-1 p-3 min-w-0">
                <h4 className="text-sm font-semibold text-white truncate">
                  {exhibit.evidence.accountItem?.creditorName || "Evidence"}
                </h4>
                <p className="text-xs text-slate-500 mb-2">
                  {exhibit.evidence.evidenceType === "SCREENSHOT" ? "Screenshot" : "Text Extract"}
                </p>
                <div onClick={(e) => e.stopPropagation()}>
                  <label className="text-[10px] text-slate-500 block mb-1">Caption:</label>
                  <input
                    type="text"
                    value={exhibit.caption}
                    onChange={(e) => updateCaption(exhibit.id, e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700/50 rounded text-xs text-white outline-none focus:border-purple-500"
                    placeholder="Enter exhibit caption..."
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col items-center justify-between p-2 bg-slate-900/30">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeExhibit(exhibit.id);
                  }}
                  className="w-8 h-8 bg-slate-700/50 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-500/20"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="text-slate-600 cursor-grab">
                  <GripVertical className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}

          {/* Drop Zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedItem?.type === "evidence") {
                onAddEvidence(draggedItem.item as EvidenceItem);
              }
              setDraggedItem(null);
            }}
            className={`p-8 border-2 border-dashed rounded-xl text-center transition-all ${
              draggedItem?.type === "evidence"
                ? "border-emerald-500 bg-emerald-500/10"
                : "border-slate-700/50"
            }`}
          >
            <Plus className="w-8 h-8 mx-auto text-slate-600 mb-2" />
            <p className="text-sm text-slate-500">
              {draggedItem?.type === "evidence"
                ? `Drop to add as Exhibit ${EXHIBIT_LABELS[exhibits.length]}`
                : "Drag evidence here to add"}
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Amelia Suggestions */}
      <div className="w-72 shrink-0">
        <Card className="bg-gradient-to-b from-emerald-500/10 to-slate-800/60 border-emerald-500/20">
          <CardHeader className="pb-2 border-b border-emerald-500/20">
            <CardTitle className="flex items-center gap-2 text-sm text-emerald-400">
              <Brain className="w-4 h-4" />
              Amelia&apos;s Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-xs text-slate-400 mb-4">
              For ACCURACY disputes, I recommend including:
            </p>
            <ul className="space-y-2 mb-4">
              <li className="flex items-center gap-2 text-xs text-white">
                <span className="text-emerald-400">✓</span>
                Bureau comparison for balance discrepancies
              </li>
              <li className="flex items-center gap-2 text-xs text-white">
                <span className="text-emerald-400">✓</span>
                Prior dispute documentation
              </li>
              <li className="flex items-center gap-2 text-xs text-slate-500">
                <span>○</span>
                Payment history differences
              </li>
            </ul>
            <Button className="w-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25">
              ✨ Auto-Build Package
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="bg-slate-800 border-slate-700 max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-white">Exhibit Package Preview</DialogTitle>
              <DialogDescription className="text-slate-400">
                {exhibits.length + 1} pages total
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Cover Sheet */}
              <div className="bg-white rounded-lg p-8 text-slate-900">
                <h1 className="text-2xl font-bold text-center border-b-2 border-slate-900 pb-4 mb-6">
                  EXHIBIT PACKAGE
                </h1>
                <div className="space-y-2 mb-6">
                  <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                </div>
                <div className="bg-slate-100 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Index of Exhibits</h3>
                  <ul className="space-y-1">
                    {exhibits.map((ex) => (
                      <li key={ex.id} className="text-sm">
                        <strong>Exhibit {ex.label}:</strong> {ex.caption}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Exhibit Pages */}
              {exhibits.map((ex) => (
                <div key={ex.id} className="bg-white rounded-lg overflow-hidden">
                  <div className="bg-slate-900 text-white text-center py-2 font-bold tracking-widest">
                    EXHIBIT {ex.label}
                  </div>
                  <div className="p-8">
                    <div className="h-64 bg-slate-100 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center">
                      <div className="text-4xl mb-2">{ex.evidence.evidenceType === "SCREENSHOT" ? "📷" : "📄"}</div>
                      <p className="font-semibold text-slate-700">{ex.evidence.accountItem?.creditorName}</p>
                      <p className="text-sm text-slate-500">
                        {ex.evidence.evidenceType === "SCREENSHOT" ? "Screenshot" : "Text Extract"}
                      </p>
                    </div>
                  </div>
                  <div className="px-8 pb-4 text-center text-sm text-slate-500 italic border-t border-slate-200 pt-4">
                    {ex.caption}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-slate-700">
              <span className="text-sm text-slate-500">{exhibits.length + 1} pages total</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowPreview(false)} className="border-slate-600">
                  Close
                </Button>
                <Button className="bg-purple-600 hover:bg-purple-700">
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ============================================================================
// BUREAU COMPARISON COMPONENT
// ============================================================================

function BureauComparison({
  evidence,
  allEvidence,
  onBack,
  onAddToExhibit,
}: {
  evidence: EvidenceItem | null;
  allEvidence: EvidenceItem[];
  onBack: () => void;
  onAddToExhibit: (item: EvidenceItem) => void;
}) {
  const [highlightDivergences, setHighlightDivergences] = useState(true);
  const [showOnlyDivergent, setShowOnlyDivergent] = useState(false);
  const [selectedDivergence, setSelectedDivergence] = useState<number | null>(null);

  // Mock data for demonstration - in production this would come from parsed report data
  const mockDivergences: Divergence[] = useMemo(() => {
    if (!evidence?.accountItem) return [];
    return [
      {
        field: "accountNumber",
        label: "Account Number",
        type: "MISMATCH",
        severity: "HIGH",
        values: { TU: "11**", EQ: "430015XXXX****" },
        note: "Account numbers should match across bureaus",
      },
      {
        field: "balance",
        label: "Balance",
        type: "AMOUNT_DIFF",
        severity: "HIGH",
        values: { TU: "$29,778.00", EQ: "$29,621.00" },
        difference: "$157.00",
        note: "Balance differs by $157 - FCRA violation potential",
      },
      {
        field: "dateOpened",
        label: "Date Opened",
        type: "MISMATCH",
        severity: "MEDIUM",
        values: { TU: "01/04/2023", EQ: "01/01/2023" },
        note: "3-day discrepancy in account opening date",
      },
      {
        field: "comments",
        label: "Comments",
        type: "DIFFERENT_TEXT",
        severity: "INFO",
        values: { TU: "Dispute resolved; customer disagrees", EQ: "Consumer disputes after resolution" },
        note: "Both indicate prior dispute - strengthen R3+ letters",
      },
    ];
  }, [evidence]);

  const divergenceCounts = useMemo(() => {
    const counts: Record<string, number> = { HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
    mockDivergences.forEach((d) => counts[d.severity]++);
    return counts;
  }, [mockDivergences]);

  if (!evidence) {
    return (
      <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-xl">
        <CardContent className="py-16 text-center">
          <GitCompare className="w-12 h-12 mx-auto text-slate-600" />
          <h3 className="text-lg font-medium text-white mt-4">No Evidence Selected</h3>
          <p className="text-slate-400 mt-2 mb-6">
            Select evidence from the Library to compare across bureaus
          </p>
          <Button onClick={onBack} variant="outline" className="border-slate-600">
            Go to Library
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button onClick={onBack} variant="ghost" size="sm" className="text-slate-400">
            ← Back
          </Button>
          <div>
            <h3 className="text-white font-semibold">{evidence.accountItem?.creditorName || "Account"}</h3>
            <p className="text-xs text-slate-500">
              {evidence.accountItem?.report?.client?.firstName}{" "}
              {evidence.accountItem?.report?.client?.lastName}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-slate-600"
            onClick={() => onAddToExhibit(evidence)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add to Exhibit
          </Button>
          <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
            <Download className="w-4 h-4 mr-2" />
            Capture Comparison
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex gap-4">
        <Card className="bg-slate-800/60 border-slate-700/50 p-4 flex items-center gap-3">
          <span className="text-2xl">📊</span>
          <div>
            <p className="text-xl font-bold text-white">{mockDivergences.length}</p>
            <p className="text-xs text-slate-500">Total Divergences</p>
          </div>
        </Card>
        {Object.entries(divergenceCounts).map(([severity, count]) => {
          if (count === 0) return null;
          const config = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG];
          return (
            <Card
              key={severity}
              className="border-slate-700/50 p-4 flex items-center gap-3"
              style={{ background: config.bg }}
            >
              <span className="text-2xl">{config.icon}</span>
              <div>
                <p className="text-xl font-bold" style={{ color: config.color }}>
                  {count}
                </p>
                <p className="text-xs text-slate-500">{config.label}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex gap-6">
        {/* Left Panel - Divergence List */}
        <div className="w-80 shrink-0 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-white font-semibold">Detected Divergences</h4>
            <Badge className="bg-red-500/20 text-red-400">{mockDivergences.length}</Badge>
          </div>

          <div className="space-y-3">
            {mockDivergences.map((div, i) => {
              const config = SEVERITY_CONFIG[div.severity];
              const isSelected = selectedDivergence === i;
              return (
                <div
                  key={i}
                  onClick={() => setSelectedDivergence(isSelected ? null : i)}
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    isSelected
                      ? `border-[${config.color}]`
                      : "border-transparent bg-slate-800/50"
                  }`}
                  style={{
                    borderColor: isSelected ? config.color : "transparent",
                    background: isSelected ? config.bg : undefined,
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-semibold"
                      style={{ background: config.bg, color: config.color }}
                    >
                      {config.icon} {config.label}
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase">
                      {div.type.replace(/_/g, " ")}
                    </span>
                  </div>
                  <h5 className="text-sm font-semibold text-white mb-2">{div.label}</h5>
                  <div className="space-y-1">
                    {Object.entries(div.values).map(([bureau, value]) => {
                      const bureauName = bureau === "TU" ? "TRANSUNION" : bureau === "EX" ? "EXPERIAN" : "EQUIFAX";
                      const bureauConfig = CRA_COLORS[bureauName];
                      return (
                        <div key={bureau} className="flex items-center gap-2">
                          <span
                            className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                            style={{ background: bureauConfig?.bg, color: bureauConfig?.color }}
                          >
                            {bureau}
                          </span>
                          <span className="text-xs text-white font-mono">{value}</span>
                        </div>
                      );
                    })}
                  </div>
                  {div.difference && (
                    <div className="mt-2 inline-block px-2 py-1 bg-red-500/20 rounded text-xs font-bold text-red-400">
                      Δ {div.difference}
                    </div>
                  )}
                  {isSelected && (
                    <p className="mt-2 p-2 bg-slate-900/50 rounded text-xs text-slate-400">
                      {div.note}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Amelia Card */}
          <Card className="bg-gradient-to-b from-emerald-500/10 to-slate-800/60 border-emerald-500/20">
            <CardHeader className="pb-2 border-b border-emerald-500/20">
              <CardTitle className="flex items-center gap-2 text-sm text-emerald-400">
                <Brain className="w-4 h-4" />
                Amelia&apos;s Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-xs text-slate-400 mb-3">
                <strong className="text-white">{divergenceCounts.HIGH} actionable violations</strong> detected.
                The balance discrepancy and account number mismatch are strong grounds for FCRA § 1681e(b) accuracy claims.
              </p>
              <p className="text-xs text-slate-400 mb-4">
                Prior dispute comments on both bureaus make this ideal for <strong className="text-white">R3+ escalation</strong>.
              </p>
              <Button className="w-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25">
                ✨ Generate Dispute Points
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Main - Comparison Table */}
        <div className="flex-1 space-y-4">
          {/* Controls */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={highlightDivergences}
                onChange={(e) => setHighlightDivergences(e.target.checked)}
                className="w-4 h-4"
              />
              Highlight divergences
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyDivergent}
                onChange={(e) => setShowOnlyDivergent(e.target.checked)}
                className="w-4 h-4"
              />
              Show only divergent fields
            </label>
          </div>

          {/* Comparison Table */}
          <Card className="bg-slate-800/60 border-slate-700/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-900/50">
                    <th className="p-3 text-left text-xs font-semibold text-slate-400">Field</th>
                    {["TRANSUNION", "EXPERIAN", "EQUIFAX"].map((bureau) => (
                      <th
                        key={bureau}
                        className="p-3 text-center text-xs font-semibold"
                        style={{
                          color: CRA_COLORS[bureau]?.color,
                          borderBottom: `3px solid ${CRA_COLORS[bureau]?.color}`,
                        }}
                      >
                        {bureau === "TRANSUNION" ? "TransUnion" : bureau === "EXPERIAN" ? "Experian" : "Equifax"}
                        {bureau === "EXPERIAN" && (
                          <span className="block text-[10px] text-slate-500">Not Reporting</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { field: "Account #", tu: "11**", ex: "-", eq: "430015XXXX****", divergent: true },
                    { field: "Account Type", tu: "Installment", ex: "-", eq: "Installment", divergent: false },
                    { field: "Status", tu: "Open", ex: "-", eq: "Open", divergent: false },
                    { field: "Monthly Payment", tu: "$1,028.00", ex: "-", eq: "$1,028.00", divergent: false },
                    { field: "Date Opened", tu: "01/04/2023", ex: "-", eq: "01/01/2023", divergent: true },
                    { field: "Balance", tu: "$29,778.00", ex: "-", eq: "$29,621.00", divergent: true },
                    { field: "High Credit", tu: "$42,500.00", ex: "-", eq: "$42,500.00", divergent: false },
                    { field: "Past Due", tu: "$0.00", ex: "-", eq: "$0.00", divergent: false },
                    { field: "Payment Status", tu: "Current", ex: "-", eq: "Current", divergent: false },
                    { field: "Comments", tu: "Dispute resolved; customer disagrees", ex: "-", eq: "Consumer disputes after resolution", divergent: true },
                  ]
                    .filter((row) => !showOnlyDivergent || row.divergent)
                    .map((row, i) => {
                      const divergence = mockDivergences.find(
                        (d) => d.label.toLowerCase() === row.field.toLowerCase()
                      );
                      const config = divergence ? SEVERITY_CONFIG[divergence.severity] : null;
                      return (
                        <tr
                          key={i}
                          className="border-b border-slate-700/30"
                          style={{
                            background: highlightDivergences && divergence ? config?.bg : "transparent",
                          }}
                        >
                          <td className="p-3 text-sm text-slate-400 flex items-center gap-2">
                            {row.field}
                            {divergence && (
                              <span
                                className="px-1 py-0.5 rounded text-[10px]"
                                style={{ background: config?.bg, color: config?.color }}
                              >
                                {config?.icon}
                              </span>
                            )}
                          </td>
                          <td
                            className="p-3 text-sm text-center font-mono"
                            style={{
                              color: highlightDivergences && divergence ? config?.color : "#f8fafc",
                              fontWeight: highlightDivergences && divergence ? 600 : 400,
                            }}
                          >
                            {row.tu}
                          </td>
                          <td className="p-3 text-sm text-center font-mono text-slate-500 opacity-30">
                            {row.ex}
                          </td>
                          <td
                            className="p-3 text-sm text-center font-mono"
                            style={{
                              color: highlightDivergences && divergence ? config?.color : "#f8fafc",
                              fontWeight: highlightDivergences && divergence ? 600 : 400,
                            }}
                          >
                            {row.eq}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Payment History */}
          <Card className="bg-slate-800/60 border-slate-700/50 p-4">
            <h4 className="text-sm font-semibold text-white mb-4">Payment History Comparison</h4>
            <div className="space-y-3">
              {["TRANSUNION", "EQUIFAX"].map((bureau) => (
                <div key={bureau} className="flex items-center gap-3">
                  <span
                    className="w-8 text-xs font-bold"
                    style={{ color: CRA_COLORS[bureau]?.color }}
                  >
                    {bureau.slice(0, 2)}
                  </span>
                  <div className="flex gap-1">
                    {Array.from({ length: 24 }).map((_, i) => {
                      const status = i === 20 ? "30" : "OK";
                      return (
                        <div
                          key={i}
                          className="w-5 h-5 rounded flex items-center justify-center"
                          style={{
                            background: status === "OK" ? "#10b981" : "#f59e0b",
                          }}
                          title={`Month ${i + 1}: ${status}`}
                        >
                          {status !== "OK" && (
                            <span className="text-[8px] font-bold text-white">{status}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-4 pt-4 border-t border-slate-700/50">
              <span className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-3 h-3 rounded bg-emerald-500" /> OK
              </span>
              <span className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-3 h-3 rounded bg-amber-500" /> 30 Days
              </span>
              <span className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-3 h-3 rounded bg-red-500" /> 60 Days
              </span>
              <span className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-3 h-3 rounded bg-red-700" /> 90+ Days
              </span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
