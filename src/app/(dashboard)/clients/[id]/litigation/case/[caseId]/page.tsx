"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  RefreshCw,
  FileText,
  Users,
  Clock,
  GitBranch,
} from "lucide-react";
import { useToast } from "@/lib/use-toast";

import { CaseHeader } from "@/components/litigation/case-header";
import { JurisdictionCard } from "@/components/litigation/jurisdiction-card";
import { LitigationWorkflow } from "@/components/litigation/litigation-workflow";
import { DocumentGeneratorModal } from "@/components/litigation/document-generator-modal";
import { DocumentList } from "@/components/litigation/document-list";
import { DefendantManager } from "@/components/litigation/defendant-manager";
import { DeadlineTracker } from "@/components/litigation/deadline-tracker";

// =============================================================================
// TYPES
// =============================================================================

interface Defendant {
  id: string;
  entityName: string;
  entityType: string;
  violationCount: number;
  estimatedLiabilityMin: number;
  estimatedLiabilityMax: number;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  serviceStatus?: string | null;
  servedAt?: string | null;
  responseDeadline?: string | null;
  hasResponded?: boolean;
}

interface WorkflowAction {
  id: string;
  stage: string;
  actionType: string;
  status: string;
  sortOrder: number;
  targetEntityName?: string | null;
  deliveryMethod?: string | null;
  documentType?: string | null;
  targetDefendantId?: string | null;
  document?: {
    id: string;
    title: string;
    approvalStatus: string;
  } | null;
  targetDefendant?: {
    id: string;
    entityName: string;
  } | null;
}

interface CaseDocument {
  id: string;
  title: string;
  documentType: string;
  approvalStatus: string;
  version: number;
  createdAt: string;
  isAiGenerated?: boolean;
  targetDefendantName?: string | null;
}

interface Deadline {
  id: string;
  title: string;
  description?: string | null;
  deadlineType: string;
  dueDate: string;
  status: string;
}

interface LitigationCase {
  id: string;
  caseNumber: string;
  status: string;
  strengthScore: number;
  strengthLabel: string;
  totalViolations: number;
  estimatedDamagesMin: number;
  estimatedDamagesMax: number;
  courtType: string;
  courtName: string;
  courtAddress?: string | null;
  courtDistrict?: string | null;
  filingState?: string | null;
  filingCounty?: string | null;
  filingZipCode?: string | null;
  currentStage: string;
  openedAt: string;
  defendants: Defendant[];
  actions: WorkflowAction[];
  documents: CaseDocument[];
  deadlines: Deadline[];
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function LitigationCaseDashboard() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const clientId = params.id as string;
  const caseId = params.caseId as string;

  // State
  const [caseData, setCaseData] = useState<LitigationCase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("workflow");

  // Document generator modal state
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docModalActionId, setDocModalActionId] = useState<string | null>(null);
  const [docModalDocType, setDocModalDocType] = useState<string | null>(null);
  const [docModalDefendantId, setDocModalDefendantId] = useState<string | null>(
    null
  );

  // Data fetching
  const fetchCaseData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/clients/${clientId}/litigation-cases/${caseId}`
      );

      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? "Case not found"
            : "Failed to load case data"
        );
      }

      const data = await response.json();
      setCaseData(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [clientId, caseId]);

  useEffect(() => {
    fetchCaseData();
  }, [fetchCaseData]);

  // Handler: Generate document from workflow
  const handleGenerateDocument = useCallback(
    (actionId: string, documentType: string, targetDefendantId?: string) => {
      setDocModalActionId(actionId);
      setDocModalDocType(documentType);
      setDocModalDefendantId(targetDefendantId || null);
      setDocModalOpen(true);
    },
    []
  );

  // Handler: Update workflow action status
  const handleUpdateAction = useCallback(
    async (actionId: string, status: string) => {
      try {
        const response = await fetch(
          `/api/clients/${clientId}/litigation-cases/${caseId}/actions/${actionId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          }
        );

        if (!response.ok) throw new Error("Failed to update action");

        toast({
          title: "Action Updated",
          description: `Action marked as ${status.toLowerCase().replace("_", " ")}.`,
        });

        // Refresh case data
        fetchCaseData();
      } catch {
        toast({
          title: "Update Failed",
          description: "Could not update the action status.",
          variant: "destructive",
        });
      }
    },
    [clientId, caseId, toast, fetchCaseData]
  );

  // Handler: Update defendant
  const handleUpdateDefendant = useCallback(
    (updated: Defendant) => {
      if (!caseData) return;
      setCaseData({
        ...caseData,
        defendants: caseData.defendants.map((d) =>
          d.id === updated.id ? updated : d
        ),
      });
    },
    [caseData]
  );

  // Handler: View document (opens modal in preview)
  const handleViewDocument = useCallback(
    (docId: string) => {
      setDocModalActionId(null);
      setDocModalDocType(null);
      setDocModalDefendantId(null);
      // For now, navigate or open export
      window.open(
        `/api/clients/${clientId}/litigation-cases/${caseId}/documents/${docId}/export?format=pdf`,
        "_blank"
      );
    },
    [clientId, caseId]
  );

  // Handler: Edit document
  const handleEditDocument = useCallback(
    (docId: string) => {
      // Open document generator modal in edit mode
      setDocModalActionId(null);
      setDocModalDocType(null);
      setDocModalDefendantId(null);
      setDocModalOpen(true);
    },
    []
  );

  // Handler: Close document modal and refresh
  const handleCloseDocModal = useCallback(() => {
    setDocModalOpen(false);
    setDocModalActionId(null);
    setDocModalDocType(null);
    setDocModalDefendantId(null);
    // Refresh to pick up any new documents
    fetchCaseData();
  }, [fetchCaseData]);

  // ===================== LOADING STATE =====================

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="w-8 h-8 text-primary" />
        </motion.div>
        <p className="text-sm text-muted-foreground">Loading case data...</p>
      </div>
    );
  }

  // ===================== ERROR STATE =====================

  if (error || !caseData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="p-4 rounded-full bg-red-500/10">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground mb-1">
            {error || "Case not found"}
          </p>
          <p className="text-xs text-muted-foreground">
            There was a problem loading this case.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchCaseData}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Retry
          </Button>
          <Link href={`/clients/${clientId}/litigation`}>
            <Button variant="ghost">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Cases
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ===================== MAIN RENDER =====================

  return (
    <div className="space-y-6 pb-8">
      {/* Back button */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Link href={`/clients/${clientId}/litigation`}>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
            Back to Litigation
          </Button>
        </Link>
      </motion.div>

      {/* Case Header */}
      <CaseHeader case={caseData} />

      {/* Jurisdiction Card */}
      <JurisdictionCard
        courtType={caseData.courtType}
        courtName={caseData.courtName}
        courtAddress={caseData.courtAddress}
        courtDistrict={caseData.courtDistrict}
        filingState={caseData.filingState}
        filingCounty={caseData.filingCounty}
        filingZipCode={caseData.filingZipCode}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="workflow" className="gap-1.5 text-xs">
            <GitBranch className="w-3.5 h-3.5" />
            Workflow
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5 text-xs">
            <FileText className="w-3.5 h-3.5" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="defendants" className="gap-1.5 text-xs">
            <Users className="w-3.5 h-3.5" />
            Defendants
          </TabsTrigger>
          <TabsTrigger value="deadlines" className="gap-1.5 text-xs">
            <Clock className="w-3.5 h-3.5" />
            Deadlines
          </TabsTrigger>
        </TabsList>

        {/* Workflow Tab */}
        <TabsContent value="workflow" className="mt-6">
          <LitigationWorkflow
            actions={caseData.actions}
            currentStage={caseData.currentStage}
            onGenerateDocument={handleGenerateDocument}
            onUpdateAction={handleUpdateAction}
          />
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-6">
          <DocumentList
            documents={caseData.documents}
            caseId={caseId}
            clientId={clientId}
            onViewDocument={handleViewDocument}
            onEditDocument={handleEditDocument}
          />
        </TabsContent>

        {/* Defendants Tab */}
        <TabsContent value="defendants" className="mt-6">
          <DefendantManager
            defendants={caseData.defendants}
            caseId={caseId}
            clientId={clientId}
            onUpdate={handleUpdateDefendant}
          />
        </TabsContent>

        {/* Deadlines Tab */}
        <TabsContent value="deadlines" className="mt-6">
          <DeadlineTracker deadlines={caseData.deadlines} />
        </TabsContent>
      </Tabs>

      {/* Document Generator Modal */}
      <DocumentGeneratorModal
        open={docModalOpen}
        onClose={handleCloseDocModal}
        caseId={caseId}
        clientId={clientId}
        actionId={docModalActionId}
        documentType={docModalDocType}
        targetDefendantId={docModalDefendantId}
        defendants={caseData.defendants.map((d) => ({
          id: d.id,
          entityName: d.entityName,
          entityType: d.entityType,
        }))}
      />
    </div>
  );
}
