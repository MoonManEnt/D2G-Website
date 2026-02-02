"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import {
  User,
  Building2,
  FileText,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Dna,
  Sparkles,
  AlertTriangle,
  Target,
  Zap,
  Info,
  Brain,
  Mail,
} from "lucide-react";
import { AmeliaInsightsPanel, type AmeliaInsight } from "./amelia-insights-panel";
import { MailSendDialog } from "./mail-send-dialog";
import { useToast } from "@/lib/use-toast";
import {
  getDNAClassificationLabel,
  getDNAClassificationDescription,
  type CreditDNAProfile,
  type DNAClassification,
} from "@/lib/credit-dna";
import { type LetterStructure, LETTER_STRUCTURE_DESCRIPTIONS } from "@/lib/amelia-generator";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
}

interface NegativeAccount {
  id: string;
  creditorName: string;
  maskedAccountId: string;
  cra: string;
  balance: number | null;
  issueCount: number;
  suggestedFlow: string | null;
}

interface CreateDisputeWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  onSuccess: () => void;
}

type Step = "client" | "bureau" | "flow" | "accounts" | "review";

const STEPS: { key: Step; label: string; icon: React.ReactNode }[] = [
  { key: "client", label: "Client", icon: <User className="w-4 h-4" /> },
  { key: "bureau", label: "Bureau", icon: <Building2 className="w-4 h-4" /> },
  { key: "flow", label: "Type", icon: <FileText className="w-4 h-4" /> },
  { key: "accounts", label: "Accounts", icon: <Target className="w-4 h-4" /> },
  { key: "review", label: "Review", icon: <CheckCircle className="w-4 h-4" /> },
];

const FLOWS = [
  {
    id: "ACCURACY",
    name: "Accuracy",
    description: "Dispute inaccurate information (12 rounds)",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  {
    id: "COLLECTION",
    name: "Collection",
    description: "Debt validation disputes (10 rounds)",
    color: "bg-red-500/20 text-red-400 border-red-500/30",
  },
  {
    id: "CONSENT",
    name: "Consent",
    description: "Unauthorized access disputes (4 rounds)",
    color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  },
  {
    id: "COMBO",
    name: "Combo",
    description: "Multiple issue types combined",
    color: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  },
];

const CRAS = [
  { id: "TRANSUNION", name: "TransUnion", color: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
  { id: "EXPERIAN", name: "Experian", color: "bg-primary/20 text-primary border-primary/30" },
  { id: "EQUIFAX", name: "Equifax", color: "bg-red-500/20 text-red-400 border-red-500/30" },
];

export function CreateDisputeWizard({
  open,
  onOpenChange,
  clients,
  onSuccess,
}: CreateDisputeWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("client");
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedCRA, setSelectedCRA] = useState<string>("");
  const [selectedFlow, setSelectedFlow] = useState<string>("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [negativeAccounts, setNegativeAccounts] = useState<NegativeAccount[]>([]);
  const [clientDNA, setClientDNA] = useState<CreditDNAProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [dnaLoading, setDnaLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [ameliaInsights, setAmeliaInsights] = useState<AmeliaInsight | null>(null);
  // Letter structure toggle: DAMAGES_FIRST (emotional lead) vs FACTS_FIRST (legal lead)
  const [letterStructure, setLetterStructure] = useState<LetterStructure>("DAMAGES_FIRST");
  const [createdDisputeId, setCreatedDisputeId] = useState<string | null>(null);
  const [mailDialogOpen, setMailDialogOpen] = useState(false);

  // Reset form when closed
  useEffect(() => {
    if (!open) {
      setStep("client");
      setSelectedClient("");
      setSelectedCRA("");
      setSelectedFlow("");
      setSelectedAccounts([]);
      setNegativeAccounts([]);
      setClientDNA(null);
      setAmeliaInsights(null);
      setLetterStructure("DAMAGES_FIRST");
      setCreatedDisputeId(null);
      setMailDialogOpen(false);
    }
  }, [open]);

  // Fetch DNA when client is selected
  useEffect(() => {
    if (selectedClient) {
      setDnaLoading(true);
      fetch(`/api/clients/${selectedClient}/dna`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.hasDNA) {
            setClientDNA(data.dna);
            // Auto-suggest flow from DNA
            if (data.dna?.disputeReadiness?.recommendedFlow) {
              setSelectedFlow(data.dna.disputeReadiness.recommendedFlow);
            }
          }
        })
        .finally(() => setDnaLoading(false));
    }
  }, [selectedClient]);

  // Fetch accounts when client and CRA are selected
  useEffect(() => {
    if (selectedClient && selectedCRA) {
      setLoading(true);
      fetch(`/api/accounts/negative?clientId=${selectedClient}`)
        .then((res) => res.json())
        .then((data) => {
          const filtered = (data.accounts || []).filter(
            (a: NegativeAccount) => a.cra === selectedCRA
          );
          setNegativeAccounts(filtered);
          // Auto-select all by default
          setSelectedAccounts(filtered.map((a: NegativeAccount) => a.id));
        })
        .finally(() => setLoading(false));
    }
  }, [selectedClient, selectedCRA]);

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  const canProceed = () => {
    switch (step) {
      case "client":
        return !!selectedClient;
      case "bureau":
        return !!selectedCRA;
      case "flow":
        return !!selectedFlow;
      case "accounts":
        return selectedAccounts.length > 0;
      default:
        return true;
    }
  };

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setStep(STEPS[nextIndex].key);
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(STEPS[prevIndex].key);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient,
          cra: selectedCRA,
          flow: selectedFlow,
          accountIds: selectedAccounts,
          letterStructure, // Include letter structure preference
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCreatedDisputeId(data.dispute.id);
        toast({
          title: "Dispute Created",
          description: `Round ${data.dispute.round} letter generated successfully`,
        });
        onSuccess();
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.error || "Failed to create dispute",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to create dispute",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

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

  const selectedClientObj = clients.find((c) => c.id === selectedClient);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent size="lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400" />
            Create New Dispute
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Generate a dispute letter with AI-powered recommendations
          </ResponsiveDialogDescription>

          {/* Step Indicator */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center">
                <button
                  onClick={() => i <= currentStepIndex && setStep(s.key)}
                  disabled={i > currentStepIndex}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                    step === s.key
                      ? "bg-violet-500/20 text-violet-400"
                      : i < currentStepIndex
                      ? "text-green-400 hover:bg-card"
                      : "text-muted-foreground"
                  }`}
                >
                  {i < currentStepIndex ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    s.icon
                  )}
                  <span className="hidden sm:inline text-sm font-medium">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />
                )}
              </div>
            ))}
          </div>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody>
          <AnimatePresence mode="wait">
            {/* Step 1: Select Client */}
            {step === "client" && (
              <motion.div
                key="client"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <p className="text-sm text-muted-foreground">Select a client to create a dispute for:</p>
                <div className="grid gap-2 max-h-[300px] overflow-y-auto">
                  {clients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => setSelectedClient(client.id)}
                      className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                        selectedClient === client.id
                          ? "bg-violet-500/20 border-violet-500/50"
                          : "bg-card border-border hover:border-input"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <User className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {client.firstName} {client.lastName}
                        </p>
                      </div>
                      {selectedClient === client.id && (
                        <CheckCircle className="w-5 h-5 text-violet-400 ml-auto" />
                      )}
                    </button>
                  ))}
                </div>

                {/* DNA Preview */}
                {selectedClient && (
                  <div className="mt-4">
                    {dnaLoading ? (
                      <div className="flex items-center gap-2 text-muted-foreground p-4 bg-card rounded-xl">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Loading credit DNA...</span>
                      </div>
                    ) : clientDNA ? (
                      <div className={`p-4 rounded-xl border ${getDNAColors(clientDNA.classification).border} ${getDNAColors(clientDNA.classification).bg}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Dna className={`w-5 h-5 ${getDNAColors(clientDNA.classification).text}`} />
                          <span className={`font-medium ${getDNAColors(clientDNA.classification).text}`}>
                            {getDNAClassificationLabel(clientDNA.classification)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {getDNAClassificationDescription(clientDNA.classification)}
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground p-4 bg-card rounded-xl">
                        <Info className="w-4 h-4" />
                        <span className="text-sm">No DNA profile available. Upload a credit report first.</span>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 2: Select Bureau */}
            {step === "bureau" && (
              <motion.div
                key="bureau"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <p className="text-sm text-muted-foreground">Which credit bureau are you disputing with?</p>
                <div className="grid gap-3">
                  {CRAS.map((cra) => (
                    <button
                      key={cra.id}
                      onClick={() => setSelectedCRA(cra.id)}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                        selectedCRA === cra.id
                          ? `${cra.color}`
                          : "bg-card border-border hover:border-input"
                      }`}
                    >
                      <Building2 className="w-6 h-6" />
                      <span className="font-medium text-lg">{cra.name}</span>
                      {selectedCRA === cra.id && (
                        <CheckCircle className="w-5 h-5 ml-auto" />
                      )}
                    </button>
                  ))}
                </div>

                {clientDNA?.disputeReadiness?.recommendedFirstBureau && (
                  <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                    <Zap className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-green-400">
                      DNA recommends: <strong>{clientDNA.disputeReadiness.recommendedFirstBureau}</strong>
                    </span>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 3: Select Flow */}
            {step === "flow" && (
              <motion.div
                key="flow"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <p className="text-sm text-muted-foreground">What type of dispute are you filing?</p>
                <div className="grid gap-3">
                  {FLOWS.map((flow) => (
                    <button
                      key={flow.id}
                      onClick={() => setSelectedFlow(flow.id)}
                      className={`flex items-start gap-4 p-4 rounded-xl border transition-all text-left ${
                        selectedFlow === flow.id
                          ? flow.color
                          : "bg-card border-border hover:border-input"
                      }`}
                    >
                      <FileText className="w-6 h-6 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-lg">{flow.name}</span>
                          {clientDNA?.disputeReadiness?.recommendedFlow === flow.id && (
                            <Badge className="bg-green-500/20 text-green-400 text-[10px]">
                              Recommended
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{flow.description}</p>
                      </div>
                      {selectedFlow === flow.id && (
                        <CheckCircle className="w-5 h-5" />
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 4: Select Accounts */}
            {step === "accounts" && (
              <motion.div
                key="accounts"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Select accounts to include ({selectedAccounts.length} selected)
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setSelectedAccounts(
                        selectedAccounts.length === negativeAccounts.length
                          ? []
                          : negativeAccounts.map((a) => a.id)
                      )
                    }
                  >
                    {selectedAccounts.length === negativeAccounts.length
                      ? "Deselect All"
                      : "Select All"}
                  </Button>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : negativeAccounts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
                    <p>No disputable accounts found for this bureau</p>
                  </div>
                ) : (
                  <div className="grid gap-2 max-h-[280px] overflow-y-auto">
                    {negativeAccounts.map((account) => (
                      <label
                        key={account.id}
                        className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                          selectedAccounts.includes(account.id)
                            ? "bg-violet-500/10 border-violet-500/50"
                            : "bg-card border-border hover:border-input"
                        }`}
                      >
                        <Checkbox
                          checked={selectedAccounts.includes(account.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedAccounts([...selectedAccounts, account.id]);
                            } else {
                              setSelectedAccounts(selectedAccounts.filter((id) => id !== account.id));
                            }
                          }}
                        />
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{account.creditorName}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{account.maskedAccountId}</span>
                            <span>•</span>
                            <span>{account.issueCount} issues</span>
                            {account.balance && (
                              <>
                                <span>•</span>
                                <span>${account.balance.toLocaleString()}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {account.suggestedFlow && (
                          <Badge variant="outline" className="text-[10px]">
                            {account.suggestedFlow}
                          </Badge>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 5: Review */}
            {step === "review" && !createdDisputeId && (
              <motion.div
                key="review"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <p className="text-sm text-muted-foreground">Review your dispute details:</p>

                <div className="space-y-3">
                  <div className="p-4 bg-card rounded-xl">
                    <p className="text-xs text-muted-foreground mb-1">Client</p>
                    <p className="font-medium text-foreground">
                      {selectedClientObj?.firstName} {selectedClientObj?.lastName}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-card rounded-xl">
                      <p className="text-xs text-muted-foreground mb-1">Bureau</p>
                      <p className="font-medium text-foreground">{selectedCRA}</p>
                    </div>
                    <div className="p-4 bg-card rounded-xl">
                      <p className="text-xs text-muted-foreground mb-1">Dispute Type</p>
                      <p className="font-medium text-foreground">{selectedFlow}</p>
                    </div>
                  </div>

                  {/* Letter Structure Toggle */}
                  <div className="p-4 bg-card rounded-xl">
                    <p className="text-xs text-muted-foreground mb-3">Letter Structure</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(["DAMAGES_FIRST", "FACTS_FIRST"] as LetterStructure[]).map((structure) => (
                        <button
                          key={structure}
                          onClick={() => setLetterStructure(structure)}
                          className={`p-3 rounded-lg border text-left transition-all ${
                            letterStructure === structure
                              ? "bg-violet-500/20 border-violet-500/50"
                              : "bg-muted border-input hover:border-input"
                          }`}
                        >
                          <p className={`text-sm font-medium ${
                            letterStructure === structure ? "text-violet-300" : "text-foreground"
                          }`}>
                            {LETTER_STRUCTURE_DESCRIPTIONS[structure].name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {LETTER_STRUCTURE_DESCRIPTIONS[structure].description}
                          </p>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Both structures use unique, randomly-generated content that can never be compared.
                    </p>
                  </div>

                  <div className="p-4 bg-card rounded-xl">
                    <p className="text-xs text-muted-foreground mb-2">
                      Accounts ({selectedAccounts.length})
                    </p>
                    <div className="space-y-1 max-h-[120px] overflow-y-auto">
                      {negativeAccounts
                        .filter((a) => selectedAccounts.includes(a.id))
                        .map((account) => (
                          <p key={account.id} className="text-sm text-foreground">
                            • {account.creditorName}
                          </p>
                        ))}
                    </div>
                  </div>
                </div>

                {/* AMELIA Insights Panel */}
                <AmeliaInsightsPanel
                  clientId={selectedClient}
                  cra={selectedCRA}
                  flow={selectedFlow}
                  accountIds={selectedAccounts}
                  onInsightsGenerated={setAmeliaInsights}
                />

                {ameliaInsights && (
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                    <div className="flex items-center gap-2 text-green-400">
                      <Brain className="w-5 h-5" />
                      <span className="font-medium">AI Analysis Complete</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {ameliaInsights.estimatedSuccessRate}% estimated success rate with {ameliaInsights.confidence}% confidence
                    </p>
                  </div>
                )}

                {!ameliaInsights && (
                  <div className="p-4 bg-violet-500/10 border border-violet-500/30 rounded-xl">
                    <div className="flex items-center gap-2 text-violet-400">
                      <Sparkles className="w-5 h-5" />
                      <span className="font-medium">Ready to Generate</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Generate AI insights above, or proceed to create your dispute letter.
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Success State */}
            {createdDisputeId && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6 text-center py-4"
              >
                <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Dispute Letter Generated</h3>
                  <p className="text-muted-foreground mt-1">
                    {selectedCRA} {selectedFlow} dispute for {selectedClientObj?.firstName} {selectedClientObj?.lastName}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="border-input hover:bg-card"
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => setMailDialogOpen(true)}
                    className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    Mail Letter
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </ResponsiveDialogBody>

        {!createdDisputeId && (
          <ResponsiveDialogFooter>
            {currentStepIndex > 0 && (
              <Button variant="ghost" onClick={goBack} disabled={creating}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            )}
            <div className="flex-1" />
            {step === "review" ? (
              <Button
                onClick={handleCreate}
                disabled={creating}
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                Generate Letter
              </Button>
            ) : (
              <Button onClick={goNext} disabled={!canProceed()}>
                Continue
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </ResponsiveDialogFooter>
        )}
      </ResponsiveDialogContent>

      {/* Mail Dialog */}
      {createdDisputeId && (
        <MailSendDialog
          open={mailDialogOpen}
          onOpenChange={setMailDialogOpen}
          disputeId={createdDisputeId}
          disputeType="DISPUTE"
          cra={selectedCRA}
          clientName={`${selectedClientObj?.firstName || ""} ${selectedClientObj?.lastName || ""}`}
        />
      )}
    </ResponsiveDialog>
  );
}
