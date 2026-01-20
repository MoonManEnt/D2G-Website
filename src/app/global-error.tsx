"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="bg-slate-900 min-h-screen flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            Something went wrong
          </h1>

          <p className="text-slate-400 mb-6">
            We've been notified and are working to fix the issue. Please try again.
          </p>

          {error.digest && (
            <p className="text-xs text-slate-500 mb-4 font-mono">
              Error ID: {error.digest}
            </p>
          )}

          <div className="flex gap-3 justify-center">
            <Button
              onClick={reset}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>

            <Button
              variant="outline"
              onClick={() => window.location.href = "/"}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
