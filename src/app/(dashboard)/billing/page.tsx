"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlanComparison } from "@/components/billing/plan-comparison";
import { UsageDashboard } from "@/components/billing/usage-dashboard";
import { EnterpriseContactModal } from "@/components/enterprise-contact-modal";
import {
  Loader2, Sparkles, Shield, Clock,
  AlertCircle, ExternalLink, CheckCircle2,
} from "lucide-react";
import { useToast } from "@/lib/use-toast";

export default function BillingPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [showEnterpriseModal, setShowEnterpriseModal] = useState(false);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const currentTier = (session?.user as any)?.subscriptionTier || "FREE";
  const subscriptionStatus = (session?.user as any)?.subscriptionStatus || "ACTIVE";

  // Handle success/cancel redirects from Stripe
  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    if (success === "true") {
      toast({ title: "Subscription Activated!", description: "Welcome! All features are now unlocked." });
      window.history.replaceState({}, "", "/billing");
    } else if (canceled === "true") {
      toast({ title: "Checkout Canceled", description: "No changes were made.", variant: "destructive" });
      window.history.replaceState({}, "", "/billing");
    }
  }, [searchParams, toast]);
  const handleUpgrade = (plan: "SOLO" | "STARTER" | "PROFESSIONAL", interval: "monthly" | "yearly") => {
    setIsLoading(plan);
    fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, interval }),
    })
      .then((res) => res.json())
      .then((data) => { if (data.url) window.location.href = data.url; })
      .catch((err) => {
        console.error(err);
        toast({ title: "Upgrade Failed", description: "Could not start checkout.", variant: "destructive" });
      })
      .finally(() => setIsLoading(null));
  };
  const handleManageBilling = () => {
    setIsLoading("portal");
    fetch("/api/billing/portal", { method: "POST" })
      .then((res) => res.json())
      .then((data) => { if (data.url) window.location.href = data.url; })
      .catch((err) => {
        console.error(err);
        toast({ title: "Error", description: "Failed to open billing portal.", variant: "destructive" });
      })
      .finally(() => setIsLoading(null));
  };
  const getStatusBadge = () => {
    switch (subscriptionStatus) {
      case "ACTIVE": return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Active</Badge>;
      case "PAST_DUE": return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Past Due</Badge>;
      case "CANCELED": return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Canceled</Badge>;
      default: return null;
    }
  };

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Billing & Plans</h1>
        <p className="text-muted-foreground mt-1">Manage your subscription and view usage</p>
      </div>
      {/* Pro active banner */}
      {currentTier === "PROFESSIONAL" && subscriptionStatus === "ACTIVE" && (
        <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/30 rounded-lg p-4 flex items-center gap-4">
          <div className="bg-emerald-500/20 rounded-full p-2"><CheckCircle2 className="w-6 h-6 text-emerald-400" /></div>
          <div className="flex-1">
            <h3 className="text-foreground font-medium">You are on Dispute2Go Pro!</h3>
            <p className="text-muted-foreground text-sm">All premium features are unlocked.</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleManageBilling} disabled={isLoading === "portal"} className="border-input text-muted-foreground hover:bg-muted">
            {isLoading === "portal" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ExternalLink className="w-4 h-4 mr-2" />Manage Billing</>}
          </Button>
        </div>
      )}
      {/* Past due warning */}
      {subscriptionStatus === "PAST_DUE" && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-center gap-4">
          <AlertCircle className="w-6 h-6 text-amber-400" />
          <div className="flex-1">
            <h3 className="text-amber-400 font-medium">Payment Past Due</h3>
            <p className="text-muted-foreground text-sm">Please update your payment method.</p>
          </div>
          <Button onClick={handleManageBilling} disabled={isLoading === "portal"} className="bg-amber-600 hover:bg-amber-700">Update Payment</Button>
        </div>
      )}
      {/* Current plan card */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Badge className={currentTier === "PROFESSIONAL" ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-lg px-4 py-1" : "bg-muted text-foreground text-lg px-4 py-1"}>
                  {currentTier === "PROFESSIONAL" && <Sparkles className="w-4 h-4 mr-1" />}
                  {currentTier}
                </Badge>
                {getStatusBadge()}
              </div>
              <p className="text-muted-foreground mt-2">{currentTier === "FREE" ? "Upgrade to unlock all features" : "You have access to all features"}</p>
            </div>
            {currentTier !== "FREE" && (
              <Button variant="outline" onClick={handleManageBilling} disabled={isLoading === "portal"} className="border-input text-muted-foreground hover:bg-muted">
                {isLoading === "portal" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Manage Subscription"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      {/* Usage Dashboard */}
      <UsageDashboard onUpgradeClick={() => {
        const el = document.getElementById("plan-comparison");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }} />

      {/* Billing interval toggle */}
      <div className="flex justify-center gap-2" id="plan-comparison">
        <button onClick={() => setBillingInterval("monthly")} className={billingInterval === "monthly" ? "bg-primary text-primary-foreground px-4 py-2 rounded-lg" : "px-4 py-2 rounded-lg border border-border text-muted-foreground hover:bg-muted"}>Monthly</button>
        <button onClick={() => setBillingInterval("yearly")} className={billingInterval === "yearly" ? "bg-primary text-primary-foreground px-4 py-2 rounded-lg" : "px-4 py-2 rounded-lg border border-border text-muted-foreground hover:bg-muted"}>Yearly <span className="text-xs ml-1 text-emerald-500">Save 18%</span></button>
      </div>
      {/* Plan Comparison */}
      <PlanComparison
        currentTier={currentTier}
        interval={billingInterval}
        onUpgrade={handleUpgrade}
        onEnterpriseClick={() => setShowEnterpriseModal(true)}
        isLoading={isLoading}
      />

      {/* Trust badges */}
      <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2"><Shield className="w-4 h-4" />Secure payment via Stripe</div>
        <div className="flex items-center gap-2"><Clock className="w-4 h-4" />Cancel anytime</div>
        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />30-day money-back guarantee</div>
      </div>

      {/* Enterprise Modal */}
      <EnterpriseContactModal open={showEnterpriseModal} onOpenChange={setShowEnterpriseModal} />
    </div>
  );
}
