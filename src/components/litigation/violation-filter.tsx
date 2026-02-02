"use client";

import { useState } from "react";
import { Filter, X, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ViolationFilterProps {
  totalCount: number;
  filteredCount: number;
  categories: string[];
  severities: string[];
  activeCategories: string[];
  activeSeverities: string[];
  searchQuery: string;
  onCategoryToggle: (category: string) => void;
  onSeverityToggle: (severity: string) => void;
  onSearchChange: (query: string) => void;
  onClearAll: () => void;
}

const categoryColors: Record<string, { active: string; inactive: string }> = {
  FCRA: {
    active: "bg-purple-500/30 text-purple-300 border-purple-500/50",
    inactive: "bg-card text-muted-foreground border-input hover:border-purple-500/30 hover:text-purple-400",
  },
  FDCPA: {
    active: "bg-blue-500/30 text-blue-300 border-blue-500/50",
    inactive: "bg-card text-muted-foreground border-input hover:border-primary/30 hover:text-primary",
  },
  METRO2: {
    active: "bg-muted text-foreground border-input",
    inactive: "bg-card text-muted-foreground border-input hover:border-input hover:text-muted-foreground",
  },
};

const severityColors: Record<string, { active: string; inactive: string }> = {
  CRITICAL: {
    active: "bg-red-500/30 text-red-300 border-red-500/50",
    inactive: "bg-card text-muted-foreground border-input hover:border-red-500/30 hover:text-red-400",
  },
  HIGH: {
    active: "bg-orange-500/30 text-orange-300 border-orange-500/50",
    inactive: "bg-card text-muted-foreground border-input hover:border-orange-500/30 hover:text-orange-400",
  },
  MEDIUM: {
    active: "bg-yellow-500/30 text-yellow-300 border-yellow-500/50",
    inactive: "bg-card text-muted-foreground border-input hover:border-yellow-500/30 hover:text-yellow-400",
  },
  LOW: {
    active: "bg-blue-500/30 text-blue-300 border-blue-500/50",
    inactive: "bg-card text-muted-foreground border-input hover:border-primary/30 hover:text-primary",
  },
};

export function ViolationFilter({
  totalCount,
  filteredCount,
  categories,
  severities,
  activeCategories,
  activeSeverities,
  searchQuery,
  onCategoryToggle,
  onSeverityToggle,
  onSearchChange,
  onClearAll,
}: ViolationFilterProps) {
  const hasActiveFilters =
    activeCategories.length > 0 ||
    activeSeverities.length > 0 ||
    searchQuery.length > 0;

  return (
    <div className="bg-card rounded-lg border border-border p-4 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            Filters
          </span>
          <span className="text-xs text-muted-foreground">
            {filteredCount} of {totalCount} violations
          </span>
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
          >
            <X className="w-3 h-3 mr-1" />
            Clear all
          </Button>
        )}
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by creditor name..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 bg-background border-border text-foreground placeholder:text-muted-foreground h-9 text-sm focus:border-purple-500/50"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Category filters */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Category
        </p>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const isActive = activeCategories.includes(cat);
            const colors = categoryColors[cat] || categoryColors.FCRA;

            return (
              <button
                key={cat}
                onClick={() => onCategoryToggle(cat)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all duration-150 ${
                  isActive ? colors.active : colors.inactive
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Severity filters */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Severity
        </p>
        <div className="flex flex-wrap gap-2">
          {severities.map((sev) => {
            const isActive = activeSeverities.includes(sev);
            const colors = severityColors[sev] || severityColors.LOW;

            return (
              <button
                key={sev}
                onClick={() => onSeverityToggle(sev)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all duration-150 ${
                  isActive ? colors.active : colors.inactive
                }`}
              >
                {sev}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active filter summary */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
          <span className="text-[10px] text-muted-foreground self-center mr-1">
            Active:
          </span>
          {activeCategories.map((cat) => (
            <Badge
              key={`cat-${cat}`}
              className={`text-[10px] px-2 py-0.5 cursor-pointer border-0 ${
                (categoryColors[cat] || categoryColors.FCRA).active
              }`}
              onClick={() => onCategoryToggle(cat)}
            >
              {cat}
              <X className="w-2.5 h-2.5 ml-1" />
            </Badge>
          ))}
          {activeSeverities.map((sev) => (
            <Badge
              key={`sev-${sev}`}
              className={`text-[10px] px-2 py-0.5 cursor-pointer border-0 ${
                (severityColors[sev] || severityColors.LOW).active
              }`}
              onClick={() => onSeverityToggle(sev)}
            >
              {sev}
              <X className="w-2.5 h-2.5 ml-1" />
            </Badge>
          ))}
          {searchQuery && (
            <Badge
              className="text-[10px] px-2 py-0.5 cursor-pointer bg-muted text-muted-foreground border-0"
              onClick={() => onSearchChange("")}
            >
              &quot;{searchQuery}&quot;
              <X className="w-2.5 h-2.5 ml-1" />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

export default ViolationFilter;
