"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Building2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  groupAccountsByCreditor,
  type CreditorGroup,
  type CreditorInconsistency,
} from "@/lib/creditor-normalization";
import type { ParsedAccountWithIssues } from "./types";

interface CreditorGroupedViewProps {
  accounts: ParsedAccountWithIssues[];
  selectedAccounts: string[];
  onToggleAccount: (accountId: string) => void;
  selectedCRA: string;
}

export function CreditorGroupedView({
  accounts,
  selectedAccounts,
  onToggleAccount,
  selectedCRA,
}: CreditorGroupedViewProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Group accounts by creditor
  const groups = groupAccountsByCreditor(accounts);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  const selectAllInGroup = (group: CreditorGroup) => {
    const availableIds = group.accounts
      .filter((a) => {
        const fullAccount = accounts.find((acc) => acc.id === a.id);
        return !fullAccount?.activeDispute;
      })
      .map((a) => a.id);

    availableIds.forEach((id) => {
      if (!selectedAccounts.includes(id)) {
        onToggleAccount(id);
      }
    });
  };

  const getSeverityColor = (severity: CreditorInconsistency["severity"]) => {
    switch (severity) {
      case "HIGH":
        return "text-red-400 bg-red-500/20 border-red-500/30";
      case "MEDIUM":
        return "text-amber-400 bg-amber-500/20 border-amber-500/30";
      case "LOW":
        return "text-blue-400 bg-blue-500/20 border-blue-500/30";
    }
  };

  const getTypeIcon = (type: CreditorInconsistency["type"]) => {
    switch (type) {
      case "BALANCE_MISMATCH":
        return <AlertTriangle className="w-3 h-3" />;
      case "STATUS_MISMATCH":
        return <XCircle className="w-3 h-3" />;
      case "ACCOUNT_NUMBER_MISMATCH":
        return <AlertTriangle className="w-3 h-3" />;
      case "MISSING_FROM_BUREAU":
        return <XCircle className="w-3 h-3" />;
    }
  };

  if (groups.length === 0) {
    return (
      <div className="py-8 text-center">
        <Building2 className="w-10 h-10 mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground mt-2">No accounts to group</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
      {groups.map((group) => {
        const isExpanded = expandedGroups.has(group.normalizedName);
        const hasInconsistencies = group.inconsistencies.length > 0;
        const selectedInGroup = group.accounts.filter((a) =>
          selectedAccounts.includes(a.id)
        ).length;
        const availableInGroup = group.accounts.filter((a) => {
          const fullAccount = accounts.find((acc) => acc.id === a.id);
          return !fullAccount?.activeDispute;
        }).length;

        return (
          <div
            key={group.normalizedName}
            className={cn(
              "rounded-xl border overflow-hidden transition-all",
              hasInconsistencies
                ? "border-amber-500/30 bg-amber-950/10"
                : "border-border bg-card"
            )}
          >
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(group.normalizedName)}
              className="w-full flex items-center gap-3 p-4 hover:bg-muted transition-colors"
            >
              <div className="flex-shrink-0">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </div>

              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {group.normalizedName}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-xs border-input text-muted-foreground"
                  >
                    {group.accounts.length} account{group.accounts.length !== 1 ? "s" : ""}
                  </Badge>
                  {hasInconsistencies && (
                    <Badge className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {group.inconsistencies.length} inconsistenc{group.inconsistencies.length !== 1 ? "ies" : "y"}
                    </Badge>
                  )}
                </div>

                {/* Original name variations */}
                <div className="flex flex-wrap gap-1 mt-1">
                  {[...new Set(group.accounts.map((a) => a.originalCreditorName))].map(
                    (name, idx) => (
                      <span
                        key={idx}
                        className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded"
                      >
                        {name}
                      </span>
                    )
                  )}
                </div>
              </div>

              {/* Selection info */}
              <div className="flex items-center gap-2">
                {selectedInGroup > 0 && (
                  <span className="text-xs text-purple-400">
                    {selectedInGroup} selected
                  </span>
                )}
                {availableInGroup > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectAllInGroup(group);
                    }}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Select All
                  </Button>
                )}
              </div>
            </button>

            {/* Expanded Content */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                    {/* Inconsistencies Alert */}
                    {hasInconsistencies && (
                      <div className="space-y-2">
                        {group.inconsistencies.map((inconsistency, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "flex items-start gap-2 p-2 rounded-lg border text-xs",
                              getSeverityColor(inconsistency.severity)
                            )}
                          >
                            {getTypeIcon(inconsistency.type)}
                            <div>
                              <span className="font-medium">
                                {inconsistency.type.replace(/_/g, " ")}:
                              </span>{" "}
                              {inconsistency.description}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Account List */}
                    <div className="space-y-2">
                      {group.accounts.map((account) => {
                        const fullAccount = accounts.find(
                          (a) => a.id === account.id
                        );
                        const isSelected = selectedAccounts.includes(account.id);
                        const isLocked = !!fullAccount?.activeDispute;
                        const isSameBureau =
                          account.bureau.toUpperCase() === selectedCRA.toUpperCase();

                        return (
                          <div
                            key={account.id}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border transition-all",
                              isLocked
                                ? "border-amber-500/30 bg-amber-950/20 opacity-60"
                                : isSelected
                                ? "border-purple-500/50 bg-purple-500/10"
                                : "border-border bg-card hover:border-input"
                            )}
                          >
                            {/* Checkbox */}
                            <button
                              onClick={() => !isLocked && onToggleAccount(account.id)}
                              disabled={isLocked}
                              className={cn(
                                "w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors",
                                isLocked
                                  ? "bg-amber-500/20 border-amber-500/30 cursor-not-allowed"
                                  : isSelected
                                  ? "bg-purple-500 border-purple-500"
                                  : "border-input hover:border-purple-500/50"
                              )}
                            >
                              {isSelected && !isLocked && (
                                <CheckCircle2 className="w-3 h-3 text-foreground" />
                              )}
                              {isLocked && (
                                <span className="text-[10px] text-amber-400">!</span>
                              )}
                            </button>

                            {/* Account Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-foreground truncate">
                                  {account.originalCreditorName}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px]",
                                    isSameBureau
                                      ? "border-green-500/30 text-green-400"
                                      : "border-input text-muted-foreground"
                                  )}
                                >
                                  {account.bureau}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                {account.accountNumber && (
                                  <span>#{account.accountNumber}</span>
                                )}
                                {account.balance !== undefined && account.balance !== null && (
                                  <span className="text-red-400">
                                    ${account.balance.toLocaleString()}
                                  </span>
                                )}
                                {account.status && (
                                  <span className="text-muted-foreground">
                                    {account.status}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Lock indicator */}
                            {isLocked && (
                              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                                Pending
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
