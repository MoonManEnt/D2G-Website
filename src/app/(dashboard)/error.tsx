"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log exception to remote service (e.g. Sentry)
        console.error("Dashboard Error:", error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center space-y-4">
            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
                <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Something went wrong</h2>
            <p className="text-muted-foreground max-w-[500px]">
                We encountered an unexpected error while rendering this page.
                {error.message && <span className="block mt-2 text-xs opacity-70 font-mono bg-slate-100 dark:bg-slate-800 p-2 rounded">{error.message}</span>}
            </p>
            <div className="flex gap-4 mt-6">
                <Button onClick={() => window.location.reload()} variant="outline">
                    Reload Page
                </Button>
                <Button onClick={() => reset()}>Try Again</Button>
            </div>
        </div>
    );
}
