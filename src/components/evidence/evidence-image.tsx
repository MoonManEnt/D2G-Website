"use client";

import { useState, useEffect } from "react";
import { Loader2, ImageOff, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface EvidenceImageProps {
  fileId: string | null | undefined;
  alt: string;
  className?: string;
  containerClassName?: string;
  showPlaceholder?: boolean;
  onLoad?: () => void;
  onError?: (error: string) => void;
}

/**
 * EvidenceImage Component
 *
 * Fetches and displays an image from the file storage system.
 * Handles loading states, errors, and provides fallback UI.
 */
export function EvidenceImage({
  fileId,
  alt,
  className,
  containerClassName,
  showPlaceholder = true,
  onLoad,
  onError,
}: EvidenceImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileId) {
      setLoading(false);
      setError("No file ID provided");
      return;
    }

    let isMounted = true;

    const fetchImageUrl = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/files/${fileId}/download`);

        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }

        const data = await response.json();

        if (!data.url) {
          throw new Error("No URL returned from API");
        }

        if (isMounted) {
          setImageUrl(data.url);
          setLoading(false);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to load image";
        if (isMounted) {
          setError(errorMsg);
          setLoading(false);
          onError?.(errorMsg);
        }
      }
    };

    fetchImageUrl();

    return () => {
      isMounted = false;
    };
  }, [fileId, onError]);

  // Loading state
  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-slate-800/50 rounded-lg",
          containerClassName
        )}
      >
        <div className="flex flex-col items-center gap-2 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="text-sm">Loading image...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !imageUrl) {
    if (!showPlaceholder) return null;

    return (
      <div
        className={cn(
          "flex items-center justify-center bg-slate-800/50 rounded-lg",
          containerClassName
        )}
      >
        <div className="flex flex-col items-center gap-2 text-slate-500">
          {error ? (
            <>
              <AlertCircle className="w-8 h-8 text-red-400" />
              <span className="text-sm text-red-400">Failed to load</span>
            </>
          ) : (
            <>
              <ImageOff className="w-8 h-8" />
              <span className="text-sm">No image available</span>
            </>
          )}
        </div>
      </div>
    );
  }

  // Success state - render the image
  return (
    <div className={cn("relative", containerClassName)}>
      <img
        src={imageUrl}
        alt={alt}
        className={cn("max-w-full h-auto", className)}
        onLoad={() => onLoad?.()}
        onError={() => {
          setError("Image failed to load");
          onError?.("Image failed to load");
        }}
      />
    </div>
  );
}

/**
 * Hook to fetch image URL for use in custom components
 */
export function useEvidenceImageUrl(fileId: string | null | undefined) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileId) {
      setLoading(false);
      setError("No file ID provided");
      return;
    }

    let isMounted = true;

    const fetchImageUrl = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/files/${fileId}/download`);

        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }

        const data = await response.json();

        if (!data.url) {
          throw new Error("No URL returned from API");
        }

        if (isMounted) {
          setImageUrl(data.url);
          setLoading(false);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to load image";
        if (isMounted) {
          setError(errorMsg);
          setLoading(false);
        }
      }
    };

    fetchImageUrl();

    return () => {
      isMounted = false;
    };
  }, [fileId]);

  return { imageUrl, loading, error };
}

export default EvidenceImage;
