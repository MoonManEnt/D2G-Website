"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, Camera, Image, FileText, Filter } from "lucide-react";
import { EvidenceGallery, type EvidenceItem } from "./evidence-gallery";
import { EvidencePreviewModal } from "./evidence-preview-modal";
import { EvidenceUploadDialog } from "./evidence-upload-dialog";

interface EvidenceTabProps {
  clientId: string;
}

interface EvidenceResponse {
  evidence: EvidenceItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface DisputeOption {
  id: string;
  cra: string;
  round: number;
}

export function EvidenceTab({ clientId }: EvidenceTabProps) {
  const [data, setData] = useState<EvidenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [disputes, setDisputes] = useState<DisputeOption[]>([]);

  const fetchEvidence = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (activeTab === "uploads") {
        params.set("captureSource", "UPLOAD");
      } else if (activeTab === "captures") {
        params.set("captureSource", "PDF_CROP");
      }

      const res = await fetch(
        `/api/clients/${clientId}/evidence?${params.toString()}`
      );

      if (!res.ok) {
        throw new Error("Failed to fetch evidence");
      }

      const json: EvidenceResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load evidence");
    } finally {
      setLoading(false);
    }
  }, [clientId, activeTab]);

  // Fetch disputes for the upload dialog
  useEffect(() => {
    async function loadDisputes() {
      try {
        const res = await fetch(`/api/clients/${clientId}/evidence?limit=1`);
        if (res.ok) {
          const json = await res.json();
          // Extract unique disputes from evidence items
          const disputeMap = new Map<string, DisputeOption>();
          json.evidence?.forEach((ev: EvidenceItem) => {
            if (ev.dispute) {
              disputeMap.set(ev.dispute.id, {
                id: ev.dispute.id,
                cra: ev.dispute.cra,
                round: ev.dispute.round,
              });
            }
          });
          setDisputes(Array.from(disputeMap.values()));
        }
      } catch {
        // Non-critical, disputes list is optional
      }
    }
    loadDisputes();
  }, [clientId]);

  useEffect(() => {
    fetchEvidence();
  }, [fetchEvidence]);

  const handleSelect = (id: string) => {
    setPreviewId(id);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(
        `/api/clients/${clientId}/evidence/${id}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        throw new Error("Failed to delete evidence");
      }

      setSelectedIds((prev) => prev.filter((sid) => sid !== id));
      fetchEvidence();
    } catch {
      // Error is silently handled; the gallery can show individual errors
    }
  };

  const evidence = data?.evidence ?? [];

  // Loading skeleton
  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-44" />
          </div>
        </div>
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[4/3] w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (!loading && evidence.length === 0 && activeTab === "all") {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-foreground">
            Evidence Center
          </h2>
          <div className="flex gap-2">
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Upload Evidence
            </Button>
            <Button variant="outline">
              <Camera className="w-4 h-4 mr-2" />
              Capture from Report
            </Button>
          </div>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Image className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">
              No evidence yet
            </h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
              Upload documents, screenshots, or capture sections from credit reports to build
              your evidence collection.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => setUploadOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Upload Evidence
              </Button>
              <Button variant="outline">
                <Camera className="w-4 h-4 mr-2" />
                Capture from Report
              </Button>
            </div>
          </CardContent>
        </Card>

        <EvidenceUploadDialog
          clientId={clientId}
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          onUploaded={() => {
            setUploadOpen(false);
            fetchEvidence();
          }}
          disputes={disputes}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            Evidence Center
          </h2>
          {data && (
            <p className="text-sm text-muted-foreground mt-1">
              {data.total} item{data.total !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Upload Evidence
          </Button>
          <Button variant="outline">
            <Camera className="w-4 h-4 mr-2" />
            Capture from Report
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">
            <Filter className="w-3.5 h-3.5 mr-1.5" />
            All
          </TabsTrigger>
          <TabsTrigger value="uploads">
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Uploads
          </TabsTrigger>
          <TabsTrigger value="captures">
            <Camera className="w-3.5 h-3.5 mr-1.5" />
            Captures
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {error && (
            <Card className="border-destructive">
              <CardContent className="py-4">
                <p className="text-sm text-destructive">{error}</p>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-[4/3] w-full rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : evidence.length === 0 ? (
            <Card className="border-dashed mt-4">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="w-8 h-8 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  No {activeTab === "uploads" ? "uploaded" : "captured"} evidence found
                </p>
              </CardContent>
            </Card>
          ) : (
            <EvidenceGallery
              evidence={evidence}
              onSelect={handleSelect}
              onDelete={handleDelete}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Preview Modal */}
      <EvidencePreviewModal
        evidenceId={previewId}
        clientId={clientId}
        onClose={() => setPreviewId(null)}
        onUpdate={fetchEvidence}
      />

      {/* Upload Dialog */}
      <EvidenceUploadDialog
        clientId={clientId}
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          setUploadOpen(false);
          fetchEvidence();
        }}
        disputes={disputes}
      />
    </div>
  );
}
