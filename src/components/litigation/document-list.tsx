"use client";

import { motion } from "framer-motion";
import {
  FileText,
  Eye,
  Pencil,
  Download,
  Send,
  Sparkles,
  Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// =============================================================================
// TYPES
// =============================================================================

interface Document {
  id: string;
  title: string;
  documentType: string;
  approvalStatus: string;
  version: number;
  createdAt: string;
  isAiGenerated?: boolean;
  targetDefendantName?: string | null;
}

interface DocumentListProps {
  documents: Document[];
  caseId: string;
  clientId: string;
  onViewDocument: (docId: string) => void;
  onEditDocument: (docId: string) => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const APPROVAL_STATUS_CONFIG: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  DRAFT: {
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-100 dark:bg-slate-500/20",
    label: "Draft",
  },
  PENDING_REVIEW: {
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-500/20",
    label: "Pending Review",
  },
  APPROVED: {
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-500/20",
    label: "Approved",
  },
  SENT: {
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-500/20",
    label: "Sent",
  },
  FILED: {
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-100 dark:bg-purple-500/20",
    label: "Filed",
  },
};

const DOC_TYPE_LABELS: Record<string, string> = {
  DEMAND_LETTER: "Demand Letter",
  COMPLAINT: "Complaint",
  SUMMONS: "Summons",
  AFFIDAVIT_OF_SERVICE: "Affidavit of Service",
  DISCOVERY_REQUEST: "Discovery Request",
  INTERROGATORIES: "Interrogatories",
  REQUEST_FOR_PRODUCTION: "Request for Production",
  MOTION: "Motion",
  SETTLEMENT_AGREEMENT: "Settlement Agreement",
  DECLARATION: "Declaration",
};

// =============================================================================
// HELPERS
// =============================================================================

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

export function DocumentList({
  documents,
  caseId,
  clientId,
  onViewDocument,
  onEditDocument,
}: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No documents have been generated yet.</p>
        <p className="text-xs mt-1">
          Use the Workflow tab to generate documents for each action.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground">
        Documents ({documents.length})
      </h3>

      <div className="space-y-2">
        {documents.map((doc, idx) => {
          const statusCfg =
            APPROVAL_STATUS_CONFIG[doc.approvalStatus] ||
            APPROVAL_STATUS_CONFIG.DRAFT;

          return (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 * idx }}
            >
              <Card className="bg-card border-border hover:shadow-lg transition-shadow duration-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    {/* Doc icon */}
                    <div className="p-2 rounded-lg bg-primary/15 flex-shrink-0">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="text-sm font-medium text-foreground truncate">
                          {doc.title}
                        </h4>

                        {doc.isAiGenerated && (
                          <div className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-primary" />
                            <span className="text-[9px] text-primary font-medium">
                              AI
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Document type badge */}
                        <Badge className="bg-muted text-muted-foreground border-0 text-[10px] px-2 py-0">
                          {DOC_TYPE_LABELS[doc.documentType] || doc.documentType}
                        </Badge>

                        {/* Approval status badge */}
                        <Badge
                          className={`${statusCfg.bg} ${statusCfg.color} border-0 text-[10px] px-2 py-0`}
                        >
                          {statusCfg.label}
                        </Badge>

                        {/* Version */}
                        <span className="text-[10px] text-muted-foreground">
                          v{doc.version}
                        </span>

                        {/* Target defendant */}
                        {doc.targetDefendantName && (
                          <span className="text-[10px] text-muted-foreground">
                            for {doc.targetDefendantName}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mt-1">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(doc.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        title="View"
                        onClick={() => onViewDocument(doc.id)}
                      >
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        title="Edit"
                        onClick={() => onEditDocument(doc.id)}
                      >
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        title="Download"
                        onClick={() => {
                          window.open(
                            `/api/clients/${clientId}/litigation-cases/${caseId}/documents/${doc.id}/export?format=pdf`,
                            "_blank"
                          );
                        }}
                      >
                        <Download className="w-4 h-4 text-muted-foreground" />
                      </Button>

                      {(doc.approvalStatus === "APPROVED" ||
                        doc.approvalStatus === "SENT" ||
                        doc.approvalStatus === "FILED") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          title="Send"
                          onClick={() => {
                            // Trigger send flow - the parent page can handle this
                            // For now, open the document view where send controls exist
                            onViewDocument(doc.id);
                          }}
                        >
                          <Send className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default DocumentList;
