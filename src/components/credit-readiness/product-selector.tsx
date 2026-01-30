"use client";

import { useState } from "react";
import {
  Home,
  Car,
  CreditCard,
  Banknote,
  Briefcase,
  Target,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/use-toast";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";

const PRODUCT_OPTIONS = [
  {
    type: "MORTGAGE",
    label: "Mortgage",
    description: "FICO 2/4/5 tri-merge middle score",
    icon: Home,
  },
  {
    type: "AUTO",
    label: "Auto Loan",
    description: "FICO Auto Score 8",
    icon: Car,
  },
  {
    type: "CREDIT_CARD",
    label: "Credit Card",
    description: "FICO Bankcard Score 8",
    icon: CreditCard,
  },
  {
    type: "PERSONAL_LOAN",
    label: "Personal Loan",
    description: "FICO Score 8",
    icon: Banknote,
  },
  {
    type: "BUSINESS_LOC",
    label: "Business Line of Credit",
    description: "Highest available score",
    icon: Briefcase,
  },
  {
    type: "GENERAL",
    label: "General Assessment",
    description: "FICO Score 8 baseline",
    icon: Target,
  },
];

const INCOME_TYPES = [
  { value: "SALARY", label: "Salary" },
  { value: "HOURLY", label: "Hourly" },
  { value: "SELF_EMPLOYED", label: "Self-Employed" },
  { value: "RETIREMENT", label: "Retirement" },
  { value: "OTHER", label: "Other" },
];

interface ProductSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  onAnalysisComplete: (analysis: any) => void;
}

export function ProductSelector({
  open,
  onOpenChange,
  clientId,
  onAnalysisComplete,
}: ProductSelectorProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [statedIncome, setStatedIncome] = useState("");
  const [incomeType, setIncomeType] = useState("SALARY");
  const [reasonForApplying, setReasonForApplying] = useState("");
  const [loading, setLoading] = useState(false);

  const resetState = () => {
    setStep(1);
    setSelectedProduct(null);
    setStatedIncome("");
    setIncomeType("SALARY");
    setReasonForApplying("");
    setLoading(false);
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) resetState();
    onOpenChange(value);
  };

  const handleProductSelect = (productType: string) => {
    setSelectedProduct(productType);
    setStep(2);
  };

  const handleRunAnalysis = async () => {
    if (!selectedProduct) return;

    setLoading(true);
    try {
      const body: Record<string, any> = { productType: selectedProduct };
      if (statedIncome) body.statedIncome = parseFloat(statedIncome);
      if (incomeType) body.incomeType = incomeType;
      if (reasonForApplying) body.reasonForApplying = reasonForApplying;

      const res = await fetch(`/api/clients/${clientId}/readiness`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || "Analysis failed");
      }

      const data = await res.json();
      toast({
        title: "Analysis Complete",
        description: "Credit readiness analysis has been generated.",
      });
      onAnalysisComplete(data);
      handleOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Analysis Failed",
        description: err.message || "Failed to run readiness analysis.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent size="lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {step === 1 ? "New Credit Readiness Analysis" : "Analysis Details"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {step === 1
              ? "Select a credit product to analyze approval readiness"
              : `Analyzing for: ${PRODUCT_OPTIONS.find((p) => p.type === selectedProduct)?.label}`}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody>
          {step === 1 ? (
            /* Step 1: Product type grid */
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PRODUCT_OPTIONS.map((product) => {
                const Icon = product.icon;
                const isSelected = selectedProduct === product.type;
                return (
                  <button
                    key={product.type}
                    onClick={() => handleProductSelect(product.type)}
                    className={`bg-slate-700/30 hover:bg-slate-700/50 rounded-xl p-4 cursor-pointer border-2 transition-all text-left ${
                      isSelected
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-transparent"
                    }`}
                  >
                    <Icon className="w-6 h-6 text-blue-400 mb-2" />
                    <p className="text-sm font-medium text-slate-200">{product.label}</p>
                    <p className="text-xs text-slate-400 mt-1">{product.description}</p>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Step 2: Income + reason inputs */
            <div className="space-y-5">
              {loading ? (
                /* Loading state */
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
                  <p className="text-lg font-medium text-slate-200">
                    Amelia is analyzing...
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    This may take a few seconds
                  </p>
                </div>
              ) : (
                <>
                  {/* Income input */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Annual Income (optional)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        $
                      </span>
                      <input
                        type="number"
                        value={statedIncome}
                        onChange={(e) => setStatedIncome(e.target.value)}
                        placeholder="85,000"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 pl-7 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Income type select */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Income Type
                    </label>
                    <select
                      value={incomeType}
                      onChange={(e) => setIncomeType(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 appearance-none"
                    >
                      {INCOME_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Reason textarea */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Reason for Applying (optional)
                    </label>
                    <textarea
                      value={reasonForApplying}
                      onChange={(e) => setReasonForApplying(e.target.value)}
                      placeholder="e.g., First home purchase, refinancing..."
                      rows={3}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 resize-none"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </ResponsiveDialogBody>

        {!loading && (
          <ResponsiveDialogFooter>
            {step === 2 && (
              <>
                <Button
                  variant="ghost"
                  onClick={() => setStep(1)}
                  className="gap-2 text-slate-400"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
                <Button
                  onClick={handleRunAnalysis}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  Run Analysis
                </Button>
              </>
            )}
          </ResponsiveDialogFooter>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
