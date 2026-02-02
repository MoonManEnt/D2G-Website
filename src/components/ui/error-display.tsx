"use client";

import { AlertCircle, RefreshCw, Home, ChevronDown } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

interface ErrorDisplayProps {
  title?: string;
  message?: string;
  details?: string;
  onRetry?: () => void;
  showHome?: boolean;
  variant?: "full" | "inline" | "compact";
}

export function ErrorDisplay({
  title = "Something went wrong",
  message = "An unexpected error occurred. Please try again.",
  details,
  onRetry,
  showHome = true,
  variant = "full",
}: ErrorDisplayProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm" role="alert">
        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
        <span className="text-red-300 flex-1">{message}</span>
        {onRetry && (
          <button onClick={onRetry} className="text-red-400 hover:text-red-300 p-1">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl" role="alert">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-red-500/20 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1">
            <h4 className="text-red-300 font-medium text-sm">{title}</h4>
            <p className="text-red-300/70 text-sm mt-1">{message}</p>
            {details && (
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-1 text-xs text-red-400/60 mt-2 hover:text-red-400"
              >
                <ChevronDown className={`w-3 h-3 transition-transform ${showDetails ? "rotate-180" : ""}`} />
                {showDetails ? "Hide" : "Show"} details
              </button>
            )}
            {showDetails && details && (
              <pre className="mt-2 p-2 bg-black/30 rounded text-xs text-red-300/50 overflow-x-auto">
                {details}
              </pre>
            )}
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-300 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Full variant (page-level error)
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8" role="alert">
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-full mb-6">
        <AlertCircle className="w-10 h-10 text-red-400" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">{title}</h2>
      <p className="text-muted-foreground text-center max-w-md mb-6">{message}</p>

      {details && (
        <div className="w-full max-w-md mb-6">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-muted-foreground mb-2"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${showDetails ? "rotate-180" : ""}`} />
            Technical details
          </button>
          {showDetails && (
            <pre className="p-3 bg-card border border-border rounded-lg text-xs text-muted-foreground overflow-x-auto">
              {details}
            </pre>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-foreground rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        )}
        {showHome && (
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-muted text-muted-foreground rounded-lg text-sm font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </Link>
        )}
      </div>
    </div>
  );
}
