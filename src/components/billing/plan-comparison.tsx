"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Zap,
  Loader2,
  Sparkles,
  Building2,
  Crown,
} from "lucide-react";

interface PlanComparisonProps {
  currentTier: string;
  interval: "monthly" | "yearly";
  onUpgrade: (plan: "STARTER" | "PROFESSIONAL", interval: "monthly" | "yearly") => void;
  onEnterpriseClick: () => void;
  isLoading?: string | null;
  foundingMemberSpotsLeft?: number;
}

const TIER_ORDER = ["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"] as const;

interface PlanDefinition {
  key: (typeof TIER_ORDER)[number];
  name: string;
  monthlyPrice: number | null;
  yearlyMonthlyEquiv: number | null;
  yearlyTotal: number | null;
  description: string;
  features: string[];
  highlight?: boolean;
  icon: React.ReactNode;
}

const PLANS: PlanDefinition[] = [
  {
    key: "FREE",
    name: "Free",
    monthlyPrice: 0,
    yearlyMonthlyEquiv: 0,
    yearlyTotal: 0,
    description: "Get started with the basics",
    features: [
      "5 clients",
      "15 disputes / month",
      "10 reports / month",
      "Basic dispute tracking",
      "500MB storage",
    ],
    icon: <Zap className="w-5 h-5 text-muted-foreground" />,
  },
  {
    key: "STARTER",
    name: "Starter",
    monthlyPrice: 149,
    yearlyMonthlyEquiv: 124,
    yearlyTotal: 1490,
    description: "For growing credit repair businesses",
    features: [
      "50 clients",
      "100 disputes / month",
      "50 reports / month",
      "5 team seats",
      "5GB storage",
      "AI-generated letters",
      "Bulk dispute creation",
      "Credit DNA analysis",
      "Email support",
    ],
    icon: <Sparkles className="w-5 h-5 text-blue-400" />,
  },
  {
    key: "PROFESSIONAL",
    name: "Professional",
    monthlyPrice: 249,
    yearlyMonthlyEquiv: 207,
    yearlyTotal: 2490,
    description: "Full power for professionals",
    highlight: true,
    features: [
      "250 clients",
      "400 disputes / month",
      "200 reports / month",
      "15 team seats",
      "25GB storage",
      "CFPB complaint generator",
      "Litigation Scanner",
      "White-label customization",
      "Priority support",
    ],
    icon: <Crown className="w-5 h-5 text-amber-400" />,
  },
  {
    key: "ENTERPRISE",
    name: "Enterprise",
    monthlyPrice: null,
    yearlyMonthlyEquiv: null,
    yearlyTotal: null,
    description: "Custom solutions at scale",
    features: [
      "Unlimited clients",
      "Unlimited disputes",
      "Unlimited reports",
      "Unlimited team seats",
      "100GB storage",
      "API access",
      "Custom integrations",
      "Dedicated account manager",
      "SLA guarantee",
    ],
    icon: <Building2 className="w-5 h-5 text-violet-400" />,
  },
];

export function PlanComparison({
  currentTier,
  interval,
  onUpgrade,
  onEnterpriseClick,
  isLoading,
  foundingMemberSpotsLeft,
}: PlanComparisonProps) {
  const currentIndex = TIER_ORDER.indexOf(
    currentTier as (typeof TIER_ORDER)[number]
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {PLANS.map((plan) => {
        const planIndex = TIER_ORDER.indexOf(plan.key);
        const isCurrent = plan.key === currentTier;
        const isBelow = planIndex < currentIndex;
        const isAbove = planIndex > currentIndex;
        const isEnterprise = plan.key === "ENTERPRISE";

        let priceDisplay: React.ReactNode;
        if (plan.monthlyPrice === null) {
          priceDisplay = (
            <span className="text-3xl font-bold text-foreground">Custom</span>
          );
        } else if (plan.monthlyPrice === 0) {
          priceDisplay = (
            <>
              <span className="text-4xl font-bold text-foreground">$0</span>
              <span className="text-muted-foreground ml-1">/forever</span>
            </>
          );
        } else if (interval === "yearly") {
          priceDisplay = (
            <>
              <span className="text-4xl font-bold text-foreground">
                ${plan.yearlyMonthlyEquiv}
              </span>
              <span className="text-muted-foreground ml-1">/mo</span>
              <span className="block text-xs text-muted-foreground mt-1">
                Billed ${plan.yearlyTotal?.toLocaleString()}/yr
              </span>
            </>
          );
        } else {
          priceDisplay = (
            <>
              <span className="text-4xl font-bold text-foreground">
                ${plan.monthlyPrice}
              </span>
              <span className="text-muted-foreground ml-1">/mo</span>
            </>
          );
        }

        return (
          <Card
            key={plan.key}
            className={[
              "bg-card border-border relative flex flex-col",
              plan.highlight ? "ring-2 ring-amber-500/60" : "",
              isCurrent ? "ring-2 ring-blue-500" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="absolute -top-3 right-4 flex items-center gap-2">
              {plan.highlight && !isCurrent && (
                <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Most Popular
                </Badge>
              )}
              {isCurrent && (
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                  Current Plan
                </Badge>
              )}
              {interval === "yearly" &&
                plan.monthlyPrice !== null &&
                plan.monthlyPrice > 0 && (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    Save 17%
                  </Badge>
                )}
            </div>

            <CardHeader className="pb-4">
              <CardTitle className="text-foreground flex items-center gap-2">
                {plan.icon}
                {plan.name}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {plan.description}
              </p>
              <div className="pt-4">{priceDisplay}</div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col">
              {plan.key === "PROFESSIONAL" &&
                foundingMemberSpotsLeft != null &&
                foundingMemberSpotsLeft > 0 && (
                  <div className="mb-4 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-center text-sm text-amber-400 font-medium">
                    Founding Member: Only {foundingMemberSpotsLeft} spots left!
                  </div>
                )}

              <ul className="space-y-2.5 flex-1">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {isCurrent ? (
                  <Button
                    variant="outline"
                    className="w-full border-blue-500/50 text-blue-400"
                    disabled
                  >
                    Current Plan
                  </Button>
                ) : isEnterprise ? (
                  <Button
                    variant="outline"
                    className="w-full border-violet-500/50 text-violet-400 hover:bg-violet-500/10"
                    onClick={onEnterpriseClick}
                  >
                    <Building2 className="w-4 h-4 mr-2" />
                    Contact Sales
                  </Button>
                ) : isBelow ? (
                  <Button
                    variant="outline"
                    className="w-full border-input text-muted-foreground hover:bg-muted"
                    onClick={() =>
                      onUpgrade(
                        plan.key as "STARTER" | "PROFESSIONAL",
                        interval
                      )
                    }
                    disabled={isLoading !== null && isLoading !== undefined}
                  >
                    {isLoading === plan.key ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Downgrade
                  </Button>
                ) : isAbove ? (
                  <Button
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                    onClick={() =>
                      onUpgrade(
                        plan.key as "STARTER" | "PROFESSIONAL",
                        interval
                      )
                    }
                    disabled={isLoading !== null && isLoading !== undefined}
                  >
                    {isLoading === plan.key ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4 mr-2" />
                    )}
                    Upgrade
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
