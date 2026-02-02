"use client";

/**
 * SENTRY ACCOUNT SELECTOR
 *
 * Select accounts to dispute with e-OSCAR code targeting.
 */

import { useState, useMemo } from "react";
import {
  type SentryAccountSelectorProps,
  type SentryAccountForUI,
  SENTRY_CRA_COLORS,
} from "./types";

export function SentryAccountSelector({
  accounts,
  selectedIds,
  onSelectionChange,
  cra,
}: SentryAccountSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "collections" | "tradelines">("all");

  const craColors = SENTRY_CRA_COLORS[cra];

  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      // Search filter
      const matchesSearch =
        !searchTerm ||
        account.creditorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (account.maskedAccountId?.toLowerCase().includes(searchTerm.toLowerCase()));

      // Type filter
      const matchesType =
        filterType === "all" ||
        (filterType === "collections" && account.isCollection) ||
        (filterType === "tradelines" && !account.isCollection);

      return matchesSearch && matchesType;
    });
  }, [accounts, searchTerm, filterType]);

  const toggleAccount = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const selectAll = () => {
    onSelectionChange(filteredAccounts.map((a) => a.id));
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  return (
    <div className="bg-card rounded-lg border border-border">
      {/* Header */}
      <div className={`p-4 border-b border-border ${craColors.bg} rounded-t-lg`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`text-sm font-medium ${craColors.text}`}>{cra} Accounts</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedIds.length} of {accounts.length} selected
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="px-2 py-1 text-xs text-muted-foreground hover:text-muted-foreground"
            >
              Select All
            </button>
            <button
              onClick={clearAll}
              className="px-2 py-1 text-xs text-muted-foreground hover:text-muted-foreground"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-3 border-b border-border space-y-3">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search accounts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 bg-muted border border-input rounded-lg text-sm text-foreground placeholder-slate-500 focus:outline-none focus:border-primary/50"
          />
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Type filter */}
        <div className="flex gap-2">
          {[
            { key: "all" as const, label: "All" },
            { key: "collections" as const, label: "Collections" },
            { key: "tradelines" as const, label: "Tradelines" },
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => setFilterType(filter.key)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                filterType === filter.key
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-muted-foreground"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Account list */}
      <div className="max-h-96 overflow-y-auto">
        {filteredAccounts.length > 0 ? (
          <div className="divide-y divide-border">
            {filteredAccounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                isSelected={selectedIds.includes(account.id)}
                onToggle={() => toggleAccount(account.id)}
              />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No accounts match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AccountCard({
  account,
  isSelected,
  onToggle,
}: {
  account: SentryAccountForUI;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`p-4 cursor-pointer transition-colors ${
        isSelected
          ? "bg-primary/10"
          : "hover:bg-muted"
      }`}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
          isSelected ? "bg-blue-500" : "border border-input"
        }`}>
          {isSelected && (
            <svg className="w-3 h-3 text-foreground" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </div>

        {/* Account info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground truncate">
              {account.creditorName}
            </span>
            {account.isCollection && (
              <span className="px-1.5 py-0.5 text-xs rounded bg-red-500/20 text-red-400">
                Collection
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {account.maskedAccountId && (
              <span>...{account.maskedAccountId}</span>
            )}
            {account.balance !== null && (
              <span>${account.balance.toLocaleString()}</span>
            )}
            {account.accountType && (
              <span className="truncate">{account.accountType}</span>
            )}
          </div>

          {/* Issues */}
          {account.detectedIssues.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {account.detectedIssues.slice(0, 3).map((issue, i) => (
                <span
                  key={i}
                  className={`px-1.5 py-0.5 text-xs rounded ${
                    issue.severity === "HIGH"
                      ? "bg-red-500/20 text-red-400"
                      : issue.severity === "MEDIUM"
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {issue.description.length > 30
                    ? issue.description.substring(0, 30) + "..."
                    : issue.description}
                </span>
              ))}
              {account.detectedIssues.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{account.detectedIssues.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SentryAccountSelector;
