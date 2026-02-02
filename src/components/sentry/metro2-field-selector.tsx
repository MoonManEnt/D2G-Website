"use client";

/**
 * SENTRY METRO 2 FIELD SELECTOR
 *
 * Select specific Metro 2 data fields to target in disputes.
 */

import { useState } from "react";
import { type Metro2FieldSelectorProps, type Metro2FieldUI } from "./types";

export function Metro2FieldSelector({
  availableFields,
  selectedFields,
  onFieldSelect,
}: Metro2FieldSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredFields = availableFields.filter(
    (field) =>
      field.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      field.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const recommendedFields = filteredFields.filter((f) => f.isRecommended);
  const otherFields = filteredFields.filter((f) => !f.isRecommended);

  const toggleField = (code: string) => {
    if (selectedFields.includes(code)) {
      onFieldSelect(selectedFields.filter((c) => c !== code));
    } else {
      onFieldSelect([...selectedFields, code]);
    }
  };

  const selectAll = (fields: Metro2FieldUI[]) => {
    const newFields = new Set([...selectedFields, ...fields.map((f) => f.code)]);
    onFieldSelect(Array.from(newFields));
  };

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">Metro 2 Field Targeting</h3>
        <span className="text-xs text-muted-foreground">
          {selectedFields.length} selected
        </span>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <input
          type="text"
          placeholder="Search fields..."
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

      {/* Recommended fields */}
      {recommendedFields.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-emerald-400">Recommended for this account</h4>
            <button
              onClick={() => selectAll(recommendedFields)}
              className="text-xs text-muted-foreground hover:text-muted-foreground"
            >
              Select all
            </button>
          </div>
          <div className="space-y-2">
            {recommendedFields.map((field) => (
              <FieldCard
                key={field.code}
                field={field}
                isSelected={selectedFields.includes(field.code)}
                onToggle={() => toggleField(field.code)}
                isRecommended
              />
            ))}
          </div>
        </div>
      )}

      {/* Other fields */}
      {otherFields.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">Other fields</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {otherFields.map((field) => (
              <FieldCard
                key={field.code}
                field={field}
                isSelected={selectedFields.includes(field.code)}
                onToggle={() => toggleField(field.code)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {filteredFields.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No fields match your search
        </p>
      )}

      {/* Tip */}
      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          <strong className="text-muted-foreground">Tip:</strong> Targeting specific Metro 2 fields forces furnishers to verify exact data elements instead of batch-verifying the whole account.
        </p>
      </div>
    </div>
  );
}

function FieldCard({
  field,
  isSelected,
  onToggle,
  isRecommended,
}: {
  field: Metro2FieldUI;
  isSelected: boolean;
  onToggle: () => void;
  isRecommended?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full text-left p-3 rounded-lg transition-colors ${
        isSelected
          ? isRecommended
            ? "bg-emerald-500/20 border border-emerald-500/50"
            : "bg-primary/20 border border-blue-500/50"
          : "bg-muted hover:bg-muted border border-transparent"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-muted-foreground">{field.code}</span>
            <span className="text-sm font-medium text-foreground">{field.name}</span>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{field.description}</p>
        </div>
        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ml-2 ${
          isSelected
            ? isRecommended
              ? "bg-emerald-500"
              : "bg-blue-500"
            : "border border-input"
        }`}>
          {isSelected && (
            <svg className="w-3 h-3 text-foreground" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>
    </button>
  );
}

export default Metro2FieldSelector;
