"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Camera,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface PDFViewerProps {
  pdfUrl: string;
  searchText?: string;
  onCapture?: (imageData: string, pageNumber: number) => void;
  highlightPages?: number[];
}

export function PDFViewer({
  pdfUrl,
  searchText,
  onCapture,
  highlightPages = [],
}: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdf, setPdf] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfjsLib, setPdfjsLib] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  // Dynamically load pdfjs-dist
  useEffect(() => {
    const loadPdfJs = async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        // Set worker source to local file in public folder (verified to exist)
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        setPdfjsLib(pdfjs);
      } catch (err) {
        console.error("Error loading pdfjs:", err);
        setError("Failed to load PDF library");
        setLoading(false);
      }
    };
    loadPdfJs();
  }, []);

  // Load PDF once pdfjs is ready
  useEffect(() => {
    if (!pdfjsLib || !pdfUrl) return;

    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(null);

        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdfDoc = await loadingTask.promise;

        setPdf(pdfDoc);
        setTotalPages(pdfDoc.numPages);
        setCurrentPage(1);
      } catch (err) {
        console.error("Error loading PDF:", err);
        setError(err instanceof Error ? err.message : "Failed to load PDF");
      } finally {
        setLoading(false);
      }
    };

    loadPdf();
  }, [pdfjsLib, pdfUrl]);

  // Render current page
  useEffect(() => {
    if (!pdf || !canvasRef.current || !pdfjsLib) return;

    const renderPage = async () => {
      try {
        const page = await pdf.getPage(currentPage);
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;

        // Highlight search text if provided
        if (searchText && pdfjsLib.Util) {
          const textContent = await page.getTextContent();
          highlightText(context, textContent, viewport, searchText);
        }
      } catch (err) {
        console.error("Error rendering page:", err);
      }
    };

    renderPage();
  }, [pdf, pdfjsLib, currentPage, scale, searchText]);

  // Highlight matching text - using 'any' for pdfjs internal types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const highlightText = (
    context: CanvasRenderingContext2D,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    textContent: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    viewport: any,
    searchStr: string
  ) => {
    if (!pdfjsLib?.Util) return;

    const searchUpper = searchStr.toUpperCase();
    context.fillStyle = "rgba(255, 255, 0, 0.3)";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    textContent.items.forEach((item: any) => {
      if (!item.str) return;

      if (item.str.toUpperCase().includes(searchUpper) && item.transform) {
        const transform = pdfjsLib.Util.transform(
          viewport.transform,
          item.transform
        );

        const x = transform[4];
        const y = transform[5];
        const width = (item.width || 0) * viewport.scale;
        const height = (item.height || 0) * viewport.scale;

        context.fillRect(x, y - height, width, height);
      }
    });
  };

  // Capture current page as image
  const captureCurrentPage = useCallback(async () => {
    if (!canvasRef.current || !onCapture) return;

    setCapturing(true);
    try {
      // Create a high-resolution capture
      const canvas = canvasRef.current;
      const imageData = canvas.toDataURL("image/png", 1.0);
      onCapture(imageData, currentPage);
    } catch (err) {
      console.error("Error capturing page:", err);
    } finally {
      setCapturing(false);
    }
  }, [currentPage, onCapture]);

  // Navigation
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const zoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const zoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));

  if (loading) {
    return (
      <Card className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading PDF...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-2 text-destructive">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm">{error}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm min-w-[100px] text-center">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {highlightPages.includes(currentPage) && (
            <Badge variant="destructive" className="mr-2">
              Issue Found
            </Badge>
          )}

          <Button variant="outline" size="sm" onClick={zoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="outline" size="sm" onClick={zoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>

          {onCapture && (
            <Button
              variant="default"
              size="sm"
              onClick={captureCurrentPage}
              disabled={capturing}
              className="ml-4"
            >
              {capturing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Camera className="h-4 w-4 mr-2" />
              )}
              Capture Page
            </Button>
          )}
        </div>
      </div>

      {/* Page navigation thumbnails for highlighted pages */}
      {highlightPages.length > 0 && (
        <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded-lg">
          <span className="text-sm font-medium text-destructive">
            Pages with issues:
          </span>
          {highlightPages.map((page) => (
            <Button
              key={page}
              variant={currentPage === page ? "destructive" : "outline"}
              size="sm"
              onClick={() => goToPage(page)}
            >
              {page}
            </Button>
          ))}
        </div>
      )}

      {/* Canvas */}
      <Card className="overflow-auto max-h-[600px] p-4 bg-muted/50">
        <canvas
          ref={canvasRef}
          className="mx-auto shadow-lg"
          style={{ maxWidth: "100%" }}
        />
      </Card>
    </div>
  );
}
