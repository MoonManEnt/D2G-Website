"use client";

import { motion } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  Shield,
  AlertTriangle,
  Scale,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DamageSummaryProps {
  damageEstimate: {
    totalMin: number;
    totalMax: number;
    breakdown: Array<{
      type: string;
      label: string;
      min: number;
      max: number;
      description: string;
    }>;
    perDefendant: Array<{
      name: string;
      type: string;
      violationCount: number;
      estimatedMin: number;
      estimatedMax: number;
    }>;
  };
}

const damageTypeConfig: Record<
  string,
  { color: string; bg: string; border: string; icon: React.ElementType }
> = {
  STATUTORY: {
    color: "text-blue-400",
    bg: "bg-blue-500/15",
    border: "border-blue-500/30",
    icon: Scale,
  },
  ACTUAL: {
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/30",
    icon: DollarSign,
  },
  PUNITIVE: {
    color: "text-red-400",
    bg: "bg-red-500/15",
    border: "border-red-500/30",
    icon: AlertTriangle,
  },
  ATTORNEY_FEES: {
    color: "text-purple-400",
    bg: "bg-purple-500/15",
    border: "border-purple-500/30",
    icon: Shield,
  },
  COURT_COSTS: {
    color: "text-amber-400",
    bg: "bg-amber-500/15",
    border: "border-amber-500/30",
    icon: TrendingUp,
  },
};

function formatCentsAsDollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function DamageSummary({ damageEstimate }: DamageSummaryProps) {
  return (
    <div className="space-y-6">
      {/* Total Damages Hero Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="bg-gradient-to-br from-emerald-900/30 to-slate-800/50 border-emerald-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-emerald-500/20">
                <DollarSign className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400 font-medium">
                  Total Estimated Damages
                </p>
                <p className="text-xs text-slate-500">
                  Combined potential recovery across all violations
                </p>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex items-baseline gap-3"
            >
              <span className="text-3xl font-bold text-emerald-400 tracking-tight">
                {formatCentsAsDollars(damageEstimate.totalMin)}
              </span>
              <span className="text-xl text-slate-500">-</span>
              <span className="text-3xl font-bold text-emerald-400 tracking-tight">
                {formatCentsAsDollars(damageEstimate.totalMax)}
              </span>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Breakdown by Type */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3">
          Damage Breakdown by Type
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {damageEstimate.breakdown.map((item, idx) => {
            const config = damageTypeConfig[item.type] || damageTypeConfig.STATUTORY;
            const TypeIcon = config.icon;

            return (
              <motion.div
                key={item.type}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 * idx }}
              >
                <Card
                  className={`bg-slate-800/50 ${config.border} hover:shadow-lg transition-shadow duration-200`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`p-1.5 rounded-lg ${config.bg}`}>
                        <TypeIcon className={`w-3.5 h-3.5 ${config.color}`} />
                      </div>
                      <span className={`text-xs font-semibold ${config.color}`}>
                        {item.label}
                      </span>
                    </div>

                    <p className="text-lg font-bold text-slate-100 mb-1">
                      {formatCentsAsDollars(item.min)} -{" "}
                      {formatCentsAsDollars(item.max)}
                    </p>

                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Per-Defendant Breakdown */}
      {damageEstimate.perDefendant.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-300">
                Liability by Defendant
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="bg-slate-900/50 rounded-lg border border-slate-700/30 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/30">
                      <th className="text-left py-2.5 px-4 text-xs text-slate-500 font-medium">
                        Defendant
                      </th>
                      <th className="text-left py-2.5 px-4 text-xs text-slate-500 font-medium">
                        Type
                      </th>
                      <th className="text-center py-2.5 px-4 text-xs text-slate-500 font-medium">
                        Violations
                      </th>
                      <th className="text-right py-2.5 px-4 text-xs text-slate-500 font-medium">
                        Estimated Liability
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {damageEstimate.perDefendant.map((def, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-slate-700/20 last:border-0 hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-2.5 px-4 text-slate-200 font-medium">
                          {def.name}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              def.type === "CRA"
                                ? "bg-blue-500/20 text-blue-400"
                                : def.type === "FURNISHER"
                                ? "bg-purple-500/20 text-purple-400"
                                : "bg-red-500/20 text-red-400"
                            }`}
                          >
                            {def.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span className="text-xs font-semibold text-slate-300 bg-slate-700/50 px-2 py-0.5 rounded-full">
                            {def.violationCount}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <span className="text-emerald-400 font-semibold">
                            {formatCentsAsDollars(def.estimatedMin)} -{" "}
                            {formatCentsAsDollars(def.estimatedMax)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

export default DamageSummary;
