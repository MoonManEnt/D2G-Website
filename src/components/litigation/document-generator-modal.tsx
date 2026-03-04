"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Loader2,
  Check,
  Download,
  Send,
  Pencil,
  Eye,
  Sparkles,
  ChevronLeft,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/lib/use-toast";

// =============================================================================
// TYPES
// =============================================================================

interface Defendant {
  id: string;
  entityName: string;
  entityType: string;
}

interface DocumentGeneratorModalProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  clientId: string;
  actionId?: string | null;
  documentType?: string | null;
  targetDefendantId?: string | null;
  defendants: Defendant[];
}

type ModalStep =
  | "select_type"
  | "select_defendant"
  | "generating"
  | "preview"
  | "edit"
  | "approved"
  | "export";

// =============================================================================
// CONSTANTS
// =============================================================================

const DOCUMENT_TYPES = [
  { value: "DEMAND_LETTER", label: "Demand Letter" },
  { value: "COMPLAINT", label: "Complaint" },
  { value: "SUMMONS", label: "Summons" },
  { value: "AFFIDAVIT_OF_SERVICE", label: "Affidavit of Service" },
  { value: "DISCOVERY_REQUEST", label: "Discovery Request" },
  { value: "INTERROGATORIES", label: "Interrogatories" },
  { value: "REQUEST_FOR_PRODUCTION", label: "Request for Production" },
  { value: "MOTION", label: "Motion" },
  { value: "SETTLEMENT_AGREEMENT", label: "Settlement Agreement" },
  { value: "DECLARATION", label: "Declaration" },
];

const DELIVERY_METHODS = [
  { value: "CERTIFIED_MAIL", label: "Certified Mail" },
  { value: "PROCESS_SERVER", label: "Process Server" },
  { value: "EMAIL", label: "Email" },
  { value: "EFILING", label: "E-Filing" },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function DocumentGeneratorModal({
  open,
  onClose,
  caseId,
  clientId,
  actionId,
  documentType: preselectedDocType,
  targetDefendantId: preselectedDefendantId,
  defendants,
}: DocumentGeneratorModalProps) {
  const { toast } = useToast();

  // State
  const [step, setStep] = useState<ModalStep>(
    preselectedDocType ? (preselectedDefendantId || defendants.length <= 1 ? "generating" : "select_defendant") : "select_type"
  );
  const [selectedDocType, setSelectedDocType] = useState<string>(
    preselectedDocType || ""
  );
  const [selectedDefendantId, setSelectedDefendantId] = useState<string>(
    preselectedDefendantId || ""
  );
  const [generatedContent, setGeneratedContent] = useState<string>("");
  const [editContent, setEditContent] = useState<string>("");
  const [documentId, setDocumentId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<string>("");

  // Reset state when modal closes
  const handleClose = useCallback(() => {
    setStep(
      preselectedDocType
        ? preselectedDefendantId || defendants.length <= 1
          ? "select_type"
          : "select_defendant"
        : "select_type"
    );
    setSelectedDocType(preselectedDocType || "");
    setSelectedDefendantId(preselectedDefendantId || "");
    setGeneratedContent("");
    setEditContent("");
    setDocumentId("");
    setIsLoading(false);
    setDeliveryMethod("");
    onClose();
  }, [onClose, preselectedDocType, preselectedDefendantId, defendants.length]);

  // API Calls
  const generateDocument = useCallback(async () => {
    setStep("generating");
    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/clients/${clientId}/litigation-cases/${caseId}/documents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentType: selectedDocType,
            targetDefendantId: selectedDefendantId || undefined,
            actionId: actionId || undefined,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate document");
      }

      const data = await response.json();
      setDocumentId(data.id);
      setGeneratedContent(data.content || data.generatedContent || "");
      setEditContent(data.content || data.generatedContent || "");
      setStep("preview");
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "Could not generate document. Please try again.",
        variant: "destructive",
      });
      setStep("select_type");
    } finally {
      setIsLoading(false);
    }
  }, [clientId, caseId, selectedDocType, selectedDefendantId, actionId, toast]);

  const saveEdits = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/clients/${clientId}/litigation-cases/${caseId}/documents/${documentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: editContent }),
        }
      );

      if (!response.ok) throw new Error("Failed to save edits");

      setGeneratedContent(editContent);
      toast({
        title: "Document Saved",
        description: "Your edits have been saved.",
      });
      setStep("preview");
    } catch {
      toast({
        title: "Save Failed",
        description: "Could not save edits. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [clientId, caseId, documentId, editContent, toast]);

  const approveDocument = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/clients/${clientId}/litigation-cases/${caseId}/documents/${documentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approvalStatus: "APPROVED" }),
        }
      );

      if (!response.ok) throw new Error("Failed to approve document");

      toast({
        title: "Document Approved",
        description: "The document has been approved and is ready for export.",
      });
      setStep("approved");
    } catch {
      toast({
        title: "Approval Failed",
        description: "Could not approve document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [clientId, caseId, documentId, toast]);

  const exportDocument = useCallback(
    (format: "pdf" | "docx") => {
      const url = `/api/clients/${clientId}/litigation-cases/${caseId}/documents/${documentId}/export?format=${format}`;
      window.open(url, "_blank");
    },
    [clientId, caseId, documentId]
  );

  const sendDocument = useCallback(async () => {
    if (!deliveryMethod) {
      toast({
        title: "Select Delivery Method",
        description: "Please select a delivery method before sending.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/clients/${clientId}/litigation-cases/${caseId}/documents/${documentId}/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deliveryMethod }),
        }
      );

      if (!response.ok) throw new Error("Failed to send document");

      toast({
        title: "Document Sent",
        description: `Document has been sent via ${deliveryMethod.replace(/_/g, " ").toLowerCase()}.`,
      });
      handleClose();
    } catch {
      toast({
        title: "Send Failed",
        description: "Could not send document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [clientId, caseId, documentId, deliveryMethod, toast, handleClose]);

  // Step navigation
  const handleDocTypeNext = () => {
    if (!selectedDocType) return;
    if (defendants.length > 1 && !selectedDefendantId) {
      setStep("select_defendant");
    } else {
      generateDocument();
    }
  };

  const handleDefendantNext = () => {
    if (!selectedDefendantId && defendants.length > 0) {
      setSelectedDefendantId(defendants[0].id);
    }
    generateDocument();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Document Generator
          </DialogTitle>
          <DialogDescription>
            {step === "select_type" && "Select the type of document to generate."}
            {step === "select_defendant" && "Select the target defendant for this document."}
            {step === "generating" && "Generating your document..."}
            {step === "preview" && "Review the generated document."}
            {step === "edit" && "Edit the document content."}
            {step === "approved" && "Document approved. Export or send."}
            {step === "export" && "Choose export or delivery options."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* Step 1: Select Document Type */}
            {step === "select_type" && (
              <motion.div
                key="select_type"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 py-4"
              >
                <div className="space-y-2">
                  <Label>Document Type</Label>
                  <Select
                    value={selectedDocType}
                    onValueChange={setSelectedDocType}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select document type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((dt) => (
                        <SelectItem key={dt.value} value={dt.value}>
                          {dt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleDocTypeNext}
                    disabled={!selectedDocType}
                  >
                    Next
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 2: Select Defendant */}
            {step === "select_defendant" && (
              <motion.div
                key="select_defendant"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 py-4"
              >
                <div className="space-y-2">
                  <Label>Target Defendant</Label>
                  <Select
                    value={selectedDefendantId}
                    onValueChange={setSelectedDefendantId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select defendant..." />
                    </SelectTrigger>
                    <SelectContent>
                      {defendants.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.entityName} ({d.entityType})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-between">
                  <Button variant="ghost" onClick={() => setStep("select_type")}>
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                  <Button
                    onClick={handleDefendantNext}
                    disabled={!selectedDefendantId && defendants.length > 0}
                  >
                    Generate
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Generating */}
            {step === "generating" && (
              <motion.div
                key="generating"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-16 gap-4"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Sparkles className="w-10 h-10 text-primary" />
                </motion.div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">
                    AI is drafting your document...
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This may take a moment
                  </p>
                </div>
                <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
              </motion.div>
            )}

            {/* Step 4: Preview */}
            {step === "preview" && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 py-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Document Preview
                  </span>
                  <div className="flex items-center gap-1 ml-auto">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span className="text-[10px] text-primary font-medium">
                      AI Generated
                    </span>
                  </div>
                </div>

                <div className="bg-background border border-border rounded-lg p-4 max-h-[40vh] overflow-y-auto">
                  <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                    {generatedContent}
                  </pre>
                </div>

                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditContent(generatedContent);
                      setStep("edit");
                    }}
                  >
                    <Pencil className="w-4 h-4 mr-1" />
                    Edit
                  </Button>

                  <Button
                    onClick={approveDocument}
                    disabled={isLoading}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-1" />
                    )}
                    Approve
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 5: Edit */}
            {step === "edit" && (
              <motion.div
                key="edit"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 py-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Pencil className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Edit Document
                  </span>
                </div>

                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[40vh] font-mono text-xs"
                  placeholder="Document content..."
                />

                <div className="flex justify-between">
                  <Button
                    variant="ghost"
                    onClick={() => setStep("preview")}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back to Preview
                  </Button>

                  <Button onClick={saveEdits} disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-1" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 6: Approved / Export & Send */}
            {step === "approved" && (
              <motion.div
                key="approved"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 py-4"
              >
                {/* Approved confirmation */}
                <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                  <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-500/20">
                    <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      Document Approved
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Your document is ready to export or send.
                    </p>
                  </div>
                </div>

                {/* Export section */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Export
                  </h4>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => exportDocument("pdf")}
                      className="flex-1"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download PDF
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => exportDocument("docx")}
                      className="flex-1"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download DOCX
                    </Button>
                  </div>
                </div>

                {/* Send section */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Send Document
                  </h4>
                  <div className="space-y-2">
                    <Select
                      value={deliveryMethod}
                      onValueChange={setDeliveryMethod}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select delivery method..." />
                      </SelectTrigger>
                      <SelectContent>
                        {DELIVERY_METHODS.map((dm) => (
                          <SelectItem key={dm.value} value={dm.value}>
                            {dm.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      onClick={sendDocument}
                      disabled={isLoading || !deliveryMethod}
                      className="w-full"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-1" />
                      )}
                      Send Document
                    </Button>
                  </div>
                </div>

                {/* Done */}
                <div className="flex justify-end pt-2">
                  <Button variant="ghost" onClick={handleClose}>
                    Done
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DocumentGeneratorModal;
