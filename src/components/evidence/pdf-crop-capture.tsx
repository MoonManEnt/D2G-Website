"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CropRegionSelector } from "./crop-region-selector";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  Upload,
  Scissors,
  Save,
  AlertCircle,
} from "lucide-react";

interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PdfCropCaptureProps {
  clientId: string;
  open: boolean;
  onClose: () => void;
  onCaptured: () => void;
  reportUrl?: string;
  disputeId?: string;
}

// Display scale for layout; actual PDF renders at 2x for hi-res capture
const DISPLAY_SCALE = 1.5;
const RENDER_SCALE = DISPLAY_SCALE * 2;

export function PdfCropCapture({
  clientId,
  open,
  onClose,
  onCaptured,
  reportUrl,
  disputeId,
}: PdfCropCaptureProps) {
  // PDF state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Canvas dimensions (display size)
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);

  // Crop state — fractional coordinates (0-1)
  const [cropRegion, setCropRegion] = useState<CropRegion | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  // Form fields
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Refs
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const hiResCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load pdfjs-dist dynamically
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfjsLib, setPdfjsLib] = useState<any>(null);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        if (typeof window !== "undefined") {
          pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        }
        setPdfjsLib(pdfjs);
      } catch {
        setPdfError("Failed to load PDF library");
      }
    };
    load();
  }, [open]);

  // Load PDF document from URL or file
  const loadPdfFromSource = useCallback(
    async (source: string | ArrayBuffer) => {
      if (!pdfjsLib) return;
      try {
        setPdfLoading(true);
        setPdfError(null);
        setCropRegion(null);
        setPreviewDataUrl(null);

        const loadingTask = pdfjsLib.getDocument(
          typeof source === "string" ? source : { data: source }
        );
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
      } catch (err) {
        setPdfError(
          err instanceof Error ? err.message : "Failed to load PDF"
        );
      } finally {
        setPdfLoading(false);
      }
    },
    [pdfjsLib]
  );

  // Auto-load if reportUrl is provided
  useEffect(() => {
    if (pdfjsLib && reportUrl) {
      loadPdfFromSource(reportUrl);
    }
  }, [pdfjsLib, reportUrl, loadPdfFromSource]);

  // Handle local file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== "application/pdf") return;
    const arrayBuffer = await file.arrayBuffer();
    loadPdfFromSource(arrayBuffer);
  };

  // Render current page onto both display canvas and hi-res canvas
  useEffect(() => {
    if (!pdfDoc || !displayCanvasRef.current || !hiResCanvasRef.current) return;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);

        // Display canvas (normal res)
        const displayViewport = page.getViewport({ scale: DISPLAY_SCALE });
        const displayCanvas = displayCanvasRef.current;
        if (!displayCanvas) return;
        const displayCtx = displayCanvas.getContext("2d");
        if (!displayCtx) return;

        displayCanvas.width = displayViewport.width;
        displayCanvas.height = displayViewport.height;
        setCanvasWidth(displayViewport.width);
        setCanvasHeight(displayViewport.height);

        await page.render({
          canvasContext: displayCtx,
          viewport: displayViewport,
        }).promise;

        // Hi-res canvas (2x for crisp capture)
        const hiResViewport = page.getViewport({ scale: RENDER_SCALE });
        const hiResCanvas = hiResCanvasRef.current;
        if (!hiResCanvas) return;
        const hiResCtx = hiResCanvas.getContext("2d");
        if (!hiResCtx) return;

        hiResCanvas.width = hiResViewport.width;
        hiResCanvas.height = hiResViewport.height;

        await page.render({
          canvasContext: hiResCtx,
          viewport: hiResViewport,
        }).promise;
      } catch {
        setPdfError("Failed to render page");
      }
    };

    // Clear previous crop when navigating pages
    setCropRegion(null);
    setPreviewDataUrl(null);
    renderPage();
  }, [pdfDoc, currentPage]);

  // Generate cropped preview when a crop region is selected
  useEffect(() => {
    if (!cropRegion || !hiResCanvasRef.current) {
      setPreviewDataUrl(null);
      return;
    }

    const hiResCanvas = hiResCanvasRef.current;
    // Convert fractional coordinates to hi-res pixel coordinates
    const sx = Math.round(cropRegion.x * hiResCanvas.width);
    const sy = Math.round(cropRegion.y * hiResCanvas.height);
    const sw = Math.round(cropRegion.width * hiResCanvas.width);
    const sh = Math.round(cropRegion.height * hiResCanvas.height);

    if (sw <= 0 || sh <= 0) return;

    // Create a temporary canvas for the cropped region
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = sw;
    cropCanvas.height = sh;
    const cropCtx = cropCanvas.getContext("2d");
    if (!cropCtx) return;

    cropCtx.drawImage(hiResCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
    setPreviewDataUrl(cropCanvas.toDataURL("image/png"));
  }, [cropRegion]);

  // Handle saving the capture
  const handleSave = async () => {
    if (!previewDataUrl || !cropRegion) return;

    setSaving(true);
    setSaveError(null);

    try {
      const response = await fetch(
        `/api/clients/${clientId}/evidence/capture`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageData: previewDataUrl,
            pageNumber: currentPage,
            cropRegion: {
              x: cropRegion.x,
              y: cropRegion.y,
              width: cropRegion.width,
              height: cropRegion.height,
            },
            label: label || undefined,
            description: description || undefined,
            disputeId: disputeId || undefined,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Save failed (${response.status})`);
      }

      // Reset form state
      setCropRegion(null);
      setPreviewDataUrl(null);
      setLabel("");
      setDescription("");
      onCaptured();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save capture"
      );
    } finally {
      setSaving(false);
    }
  };

  // Handle Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Page navigation
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 text-white/80 hover:text-white transition-colors"
        aria-label="Close crop capture"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Left side — PDF Viewer (70%) */}
      <div className="w-[70%] flex flex-col h-full p-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-3 bg-white/10 rounded-lg px-4 py-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1 || !pdfDoc}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-white min-w-[120px] text-center">
              Page {currentPage} of {totalPages || "--"}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages || !pdfDoc}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {cropRegion && (
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <Scissors className="h-4 w-4" />
              Region selected
            </div>
          )}
        </div>

        {/* PDF Canvas Area */}
        <div className="flex-1 overflow-auto flex items-start justify-center">
          {!pdfDoc && !pdfLoading && !pdfError && !reportUrl && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="text-white/60 text-center">
                <Upload className="h-12 w-12 mx-auto mb-3" />
                <p className="text-lg font-medium">Select a PDF to capture from</p>
                <p className="text-sm text-white/40 mt-1">
                  Choose a PDF file, then draw a rectangle to crop a region
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose PDF File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          )}

          {pdfLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-white/60" />
              <p className="text-sm text-white/60">Loading PDF...</p>
            </div>
          )}

          {pdfError && (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-red-400">{pdfError}</p>
              {!reportUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPdfError(null);
                    fileInputRef.current?.click();
                  }}
                  className="mt-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  Try Another File
                </Button>
              )}
            </div>
          )}

          {pdfDoc && (
            <div className="relative inline-block">
              {/* Display canvas */}
              <canvas
                ref={displayCanvasRef}
                className="shadow-2xl"
                style={{ display: "block" }}
              />

              {/* Crop overlay */}
              {canvasWidth > 0 && canvasHeight > 0 && (
                <CropRegionSelector
                  canvasWidth={canvasWidth}
                  canvasHeight={canvasHeight}
                  onRegionSelected={(region) => setCropRegion(region)}
                  onClear={() => {
                    setCropRegion(null);
                    setPreviewDataUrl(null);
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Hidden hi-res canvas */}
        <canvas ref={hiResCanvasRef} className="hidden" />
      </div>

      {/* Right side — Preview & Form (30%) */}
      <div className="w-[30%] bg-gray-900 border-l border-white/10 flex flex-col h-full p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold text-white mb-4">
          Capture Details
        </h2>

        {/* Preview */}
        <div className="mb-4">
          <Label className="text-white/70 text-xs uppercase tracking-wider mb-2 block">
            Preview
          </Label>
          <div className="bg-black/40 rounded-lg border border-white/10 min-h-[160px] flex items-center justify-center overflow-hidden">
            {previewDataUrl ? (
              <img
                src={previewDataUrl}
                alt="Crop preview"
                className="max-w-full max-h-[240px] object-contain"
              />
            ) : (
              <p className="text-white/30 text-sm text-center px-4">
                Draw a rectangle on the PDF to select a region to capture
              </p>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4 flex-1">
          <div>
            <Label htmlFor="capture-label" className="text-white/70 text-xs uppercase tracking-wider">
              Label
            </Label>
            <Input
              id="capture-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Late Payment Entry - Page 3"
              className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>

          <div>
            <Label htmlFor="capture-description" className="text-white/70 text-xs uppercase tracking-wider">
              Description
            </Label>
            <Textarea
              id="capture-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this capture shows..."
              rows={3}
              className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
            />
          </div>

          {currentPage > 0 && pdfDoc && (
            <p className="text-xs text-white/40">
              Source: Page {currentPage} of {totalPages}
            </p>
          )}
        </div>

        {/* Error */}
        {saveError && (
          <div className="flex items-center gap-2 text-red-400 text-sm mt-2 bg-red-400/10 rounded-md px-3 py-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {saveError}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-4 space-y-2">
          <Button
            onClick={handleSave}
            disabled={!previewDataUrl || saving}
            className="w-full"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Capture
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full text-white/60 hover:text-white hover:bg-white/10"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
