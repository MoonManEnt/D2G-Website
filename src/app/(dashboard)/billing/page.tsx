"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Check,
  Zap,
  Loader2,
  Sparkles,
  Shield,
  Clock,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/lib/use-toast";
import { PLAN_FEATURES } from "@/lib/stripe";

export default function BillingPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const currentTier = session?.user?.subscriptionTier || "FREE";
  const subscriptionStatus = session?.user?.subscriptionStatus || "ACTIVE";

  const [isLoading, setIsLoading] = useState<string | null>(null);

  // Handle success/cancel redirects from Stripe
  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

    if (success === "true") {
      toast({
        title: "Subscription Activated!",
        description: "Welcome to Dispute2Go Pro! All features are now unlocked.",
      });
      // Remove query params
      window.history.replaceState({}, "", "/billing");
    } else if (canceled === "true") {
      toast({
        title: "Checkout Canceled",
        description: "No changes were made to your subscription.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/billing");
    }
  }, [searchParams, toast]);

  const handleUpgrade = async (interval: "monthly" | "yearly") => {
    setIsLoading(interval);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "PRO", interval }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error) {
      toast({
        title: "Upgrade Failed",
        description: error instanceof Error ? error.message : "Failed to start checkout",
        variant: "destructive",
      });
    } finally {
      setIsLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setIsLoading("portal");
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to open billing portal");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to open billing portal",
        variant: "destructive",
      });
    } finally {
      setIsLoading(null);
    }
  };

  const getStatusBadge = () => {
    switch (subscriptionStatus) {
      case "ACTIVE":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Active</Badge>;
      case "PAST_DUE":
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Past Due</Badge>;
      case "CANCELED":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Canceled</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 lg:ml-64 pt-16 lg:pt-0 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing</h1>
        <p className="text-slate-400 mt-1">Manage your subscription and billing</p>
      </div>

      {/* Success banner for PRO users */}
      {currentTier === "PRO" && subscriptionStatus === "ACTIVE" && (
        <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/30 rounded-lg p-4 flex items-center gap-4">
          <div className="bg-emerald-500/20 rounded-full p-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-medium">You're on Dispute2Go Pro!</h3>
            <p className="text-slate-400 text-sm">All premium features are unlocked for your organization.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManageBilling}
            disabled={isLoading === "portal"}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            {isLoading === "portal" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <ExternalLink className="w-4 h-4 mr-2" />
                Manage Billing
              </>
            )}
          </Button>
        </div>
      )}

      {/* Past due warning */}
      {subscriptionStatus === "PAST_DUE" && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-center gap-4">
          <AlertCircle className="w-6 h-6 text-amber-400" />
          <div className="flex-1">
            <h3 className="text-amber-400 font-medium">Payment Past Due</h3>
            <p className="text-slate-400 text-sm">Please update your payment method to continue using Pro features.</p>
          </div>
          <Button
            onClick={handleManageBilling}
            disabled={isLoading === "portal"}
            className="bg-amber-600 hover:bg-amber-700"
          >
            Update Payment
          </Button>
        </div>
      )}

      {/* Current Plan */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Current Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Badge
                  className={
                    currentTier === "PRO"
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-lg px-4 py-1"
                      : "bg-slate-600 text-slate-200 text-lg px-4 py-1"
                  }
                >
                  {currentTier === "PRO" && <Sparkles className="w-4 h-4 mr-1" />}
                  {currentTier}
                </Badge>
                {currentTier === "PRO" && getStatusBadge()}
              </div>
              <p className="text-slate-400 mt-2">
                {currentTier === "PRO"
                  ? "You have access to all features"
                  : "Upgrade to unlock all features and remove limits"}
              </p>
            </div>
            {currentTier === "PRO" && (
              <Button
                variant="outline"
                onClick={handleManageBilling}
                disabled={isLoading === "portal"}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                {isLoading === "portal" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Manage Subscription"
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Free Plan */}
        <Card className={`bg-slate-800/50 border-slate-700 ${currentTier === "FREE" ? "ring-2 ring-blue-500" : ""}`}>
          <CardHeader>
            <CardTitle className="text-white">Free</CardTitle>
            <CardDescription className="text-slate-400">
              Get started with basic features
            </CardDescription>
            <div className="pt-4">
              <span className="text-4xl font-bold text-white">$0</span>
              <span className="text-slate-400">/forever</span>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {PLAN_FEATURES.FREE.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            {currentTier === "FREE" && (
              <Button variant="outline" className="w-full mt-6 border-slate-600" disabled>
                Current Plan
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Pro Plan */}
        <Card className={`bg-slate-800/50 border-slate-700 relative ${currentTier === "PRO" ? "ring-2 ring-amber-500" : ""}`}>
          <div className="absolute -top-3 right-4">
            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
              <Sparkles className="w-3 h-3 mr-1" />
              Most Popular
            </Badge>
          </div>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              Pro
              <Zap className="w-5 h-5 text-amber-400" />
            </CardTitle>
            <CardDescription className="text-slate-400">
              Full access to all features
            </CardDescription>
            <div className="pt-4">
              <span className="text-4xl font-bold text-white">${PLAN_FEATURES.PRO.price}</span>
              <span className="text-slate-400">/month</span>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {PLAN_FEATURES.PRO.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>

            {currentTier === "PRO" ? (
              <Button variant="outline" className="w-full mt-6 border-amber-500/50 text-amber-400" disabled>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Current Plan
              </Button>
            ) : (
              <div className="space-y-3 mt-6">
                <Button
                  onClick={() => handleUpgrade("monthly")}
                  disabled={isLoading !== null}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                >
                  {isLoading === "monthly" ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  Upgrade to Pro - ${PLAN_FEATURES.PRO.price}/mo
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleUpgrade("yearly")}
                  disabled={isLoading !== null}
                  className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  {isLoading === "yearly" ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Clock className="w-4 h-4 mr-2" />
                  )}
                  Annual - $1,430/yr (Save 20%)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trust badges */}
      <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Secure payment via Stripe
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Cancel anytime
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          30-day money-back guarantee
        </div>
      </div>
    </div>
  );
}
