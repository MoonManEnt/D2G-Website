"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Calculator, DollarSign, HeartPulse } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";

export interface DamagesData {
    financial: {
        deniedCredit: boolean;
        deniedCreditDetails: string;
        higherInterest: boolean;
        higherInterestAmount: string;
        outOfPocketExpenses: string;
    };
    emotional: {
        anxiety: boolean;
        lossOfSleep: boolean;
        relationshipStrain: boolean;
        emotionalDetails: string;
    };
    statutory: {
        violationCount: number;
        estimatedValue: number;
    };
}

interface DamagesWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    disputeRound: number;
    violationCount: number;
    onComplete: (data: DamagesData) => void;
}

export function DamagesWizard({
    open,
    onOpenChange,
    disputeRound,
    violationCount,
    onComplete,
}: DamagesWizardProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1);

    const [data, setData] = useState<DamagesData>({
        financial: {
            deniedCredit: false,
            deniedCreditDetails: "",
            higherInterest: false,
            higherInterestAmount: "",
            outOfPocketExpenses: "",
        },
        emotional: {
            anxiety: false,
            lossOfSleep: false,
            relationshipStrain: false,
            emotionalDetails: "",
        },
        statutory: {
            violationCount: violationCount,
            estimatedValue: violationCount * 1000,
        },
    });

    const updateFinancial = (updates: Partial<DamagesData["financial"]>) => {
        setData((prev) => ({
            ...prev,
            financial: { ...prev.financial, ...updates },
        }));
    };

    const updateEmotional = (updates: Partial<DamagesData["emotional"]>) => {
        setData((prev) => ({
            ...prev,
            emotional: { ...prev.emotional, ...updates },
        }));
    };

    const handleNext = () => setStep((s) => (s + 1) as 1 | 2 | 3);
    const handleBack = () => setStep((s) => (s - 1) as 1 | 2 | 3);

    const handleSubmit = () => {
        onComplete(data);
        onOpenChange(false);
        // Reset after close
        setTimeout(() => setStep(1), 300);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] border-border bg-background p-0 overflow-hidden">
                <div className="bg-muted px-6 py-4 border-b border-border">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-foreground">
                            <Calculator className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            Litigation Damages Calculator
                        </DialogTitle>
                        <DialogDescription>
                            Quantify the client's damages to populate the Notice and Cure Demand Letter.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Stepper indicator */}
                    <div className="flex items-center gap-2 mt-4">
                        {[1, 2, 3].map((s) => (
                            <div
                                key={s}
                                className={`h-1.5 flex-1 rounded-full \${
                  step >= s ? "bg-purple-500" : "bg-border"
                }`}
                            />
                        ))}
                    </div>
                </div>

                <ScrollArea className="max-h-[60vh]">
                    <div className="p-6">
                        {step === 1 && (
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    <h3 className="text-sm font-medium text-foreground">Financial Damages (Actual Loss)</h3>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between border border-border p-3 rounded-md bg-card">
                                        <div>
                                            <Label className="text-sm text-foreground">Denied Credit / Housing</Label>
                                            <p className="text-xs text-muted-foreground mt-1">Was the client denied a loan, credit card, or housing due to these errors?</p>
                                        </div>
                                        <Switch
                                            checked={data.financial.deniedCredit}
                                            onCheckedChange={(c: boolean) => updateFinancial({ deniedCredit: c })}
                                        />
                                    </div>
                                    {data.financial.deniedCredit && (
                                        <div className="pl-4">
                                            <Label className="text-xs text-muted-foreground mb-1 block">Describe the denial (Institution, Date)</Label>
                                            <Textarea
                                                value={data.financial.deniedCreditDetails}
                                                onChange={(e) => updateFinancial({ deniedCreditDetails: e.target.value })}
                                                placeholder="e.g., Denied an auto loan by Chase on 01/15/2026..."
                                                className="h-16 text-sm"
                                            />
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between border border-border p-3 rounded-md bg-card">
                                        <div>
                                            <Label className="text-sm text-foreground">Higher Interest Rates</Label>
                                            <p className="text-xs text-muted-foreground mt-1">Is the client paying higher interest or subprime rates?</p>
                                        </div>
                                        <Switch
                                            checked={data.financial.higherInterest}
                                            onCheckedChange={(c: boolean) => updateFinancial({ higherInterest: c })}
                                        />
                                    </div>
                                    {data.financial.higherInterest && (
                                        <div className="pl-4">
                                            <Label className="text-xs text-muted-foreground mb-1 block">Estimated Financial Loss ($)</Label>
                                            <Input
                                                type="number"
                                                value={data.financial.higherInterestAmount}
                                                onChange={(e) => updateFinancial({ higherInterestAmount: e.target.value })}
                                                placeholder="e.g., 2500"
                                                className="text-sm"
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-1 mt-4">
                                        <Label className="text-sm text-foreground">Other Out-Of-Pocket Expenses</Label>
                                        <p className="text-xs text-muted-foreground">Certified mail, credit monitoring fees, etc.</p>
                                        <Input
                                            value={data.financial.outOfPocketExpenses}
                                            onChange={(e) => updateFinancial({ outOfPocketExpenses: e.target.value })}
                                            placeholder="e.g., $150 in postage and credit subscriptions"
                                            className="text-sm mt-1"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <HeartPulse className="w-4 h-4 text-rose-400" />
                                    <h3 className="text-sm font-medium text-foreground">Emotional Distress</h3>
                                </div>

                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <Card className={`cursor-pointer border \${data.emotional.anxiety ? "border-purple-500 bg-purple-500/10" : "border-border bg-card"}`} onClick={() => updateEmotional({ anxiety: !data.emotional.anxiety })}>
                                            <CardContent className="p-4 text-center">
                                                <span className="text-sm font-medium">Anxiety / Stress</span>
                                            </CardContent>
                                        </Card>
                                        <Card className={`cursor-pointer border \${data.emotional.lossOfSleep ? "border-purple-500 bg-purple-500/10" : "border-border bg-card"}`} onClick={() => updateEmotional({ lossOfSleep: !data.emotional.lossOfSleep })}>
                                            <CardContent className="p-4 text-center">
                                                <span className="text-sm font-medium">Loss of Sleep</span>
                                            </CardContent>
                                        </Card>
                                        <Card className={`cursor-pointer border \${data.emotional.relationshipStrain ? "border-purple-500 bg-purple-500/10" : "border-border bg-card"}`} onClick={() => updateEmotional({ relationshipStrain: !data.emotional.relationshipStrain })}>
                                            <CardContent className="p-4 text-center">
                                                <span className="text-sm font-medium">Relationship Strain</span>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <div className="space-y-1 pt-2">
                                        <Label className="text-sm text-foreground">Brief Narrative for Demand Letter</Label>
                                        <p className="text-xs text-muted-foreground">Describe how the unverified reporting has impacted the client's daily life.</p>
                                        <Textarea
                                            value={data.emotional.emotionalDetails}
                                            onChange={(e) => updateEmotional({ emotionalDetails: e.target.value })}
                                            placeholder="e.g., The constant unaddressed errors have caused severe anxiety and loss of sleep..."
                                            className="h-24 text-sm mt-1"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                    <h3 className="text-sm font-medium text-foreground">Statutory Violations Summary</h3>
                                </div>

                                <Card className="bg-amber-500/10 border-amber-500/30">
                                    <CardContent className="p-4 space-y-3">
                                        <div className="flex justify-between items-center text-sm border-b border-border/50 pb-2">
                                            <span className="text-muted-foreground">Dispute Rounds Ignored:</span>
                                            <span className="font-semibold text-foreground">{disputeRound - 1}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm border-b border-border/50 pb-2">
                                            <span className="text-muted-foreground">FCRA Violations Logged:</span>
                                            <span className="font-semibold text-foreground">{violationCount} items</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm pt-1">
                                            <span className="text-foreground font-medium">Est. Statutory Damages:</span>
                                            <span className="font-bold text-amber-600 dark:text-amber-400 text-lg">
                                                \${data.statutory.estimatedValue.toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground pt-1">
                                            *Calculated at maximum \$1,000 per willful violation under 15 U.S.C. § 1681n.
                                        </p>
                                    </CardContent>
                                </Card>

                                <div className="text-sm text-muted-foreground p-3 border border-border rounded-md bg-muted">
                                    These calculated damages will be automatically injected into the final "Notice and Cure" Demand Letter to maximize settlement leverage prior to litigation.
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <div className="bg-muted px-6 py-4 border-t border-border mt-auto">
                    <DialogFooter className="flex items-center sm:justify-between w-full">
                        <Button
                            variant="outline"
                            onClick={step === 1 ? () => onOpenChange(false) : handleBack}
                            className="text-muted-foreground"
                        >
                            {step === 1 ? "Cancel" : "Back"}
                        </Button>
                        <Button
                            onClick={step === 3 ? handleSubmit : handleNext}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            {step === 3 ? "Generate Demand Letter" : "Continue"}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
