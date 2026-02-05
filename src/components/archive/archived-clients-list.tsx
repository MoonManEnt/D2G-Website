"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Archive,
  Search,
  Eye,
  RotateCcw,
  Trash2,
  Loader2,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Users,
  FileText,
  MessageSquare,
  Bot,
} from "lucide-react";
import { useToast } from "@/lib/use-toast";
import { ArchivedClientListItem, ArchiveStats } from "@/lib/archive/types";
import { ArchiveViewerModal } from "./archive-viewer-modal";
import { RestoreDialog } from "./restore-dialog";
import { PermanentDeleteDialog } from "./permanent-delete-dialog";
import { createLogger } from "@/lib/logger";
const log = createLogger("archived-clients-list");

export function ArchivedClientsList() {
  const { toast } = useToast();
  const [clients, setClients] = useState<ArchivedClientListItem[]>([]);
  const [stats, setStats] = useState<ArchiveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modal states
  const [selectedClient, setSelectedClient] = useState<ArchivedClientListItem | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        ...(search && { search }),
      });

      const response = await fetch(`/api/clients/archived?${params}`);
      if (response.ok) {
        const data = await response.json();
        setClients(data.items);
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
      }
    } catch (error) {
      log.error({ err: error }, "Failed to fetch archived clients");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/clients/archived/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      log.error({ err: error }, "Failed to fetch archive stats");
    }
  }, []);

  useEffect(() => {
    fetchClients();
    fetchStats();
  }, [fetchClients, fetchStats]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchClients();
  };

  const handleRestore = async () => {
    if (!selectedClient) return;

    try {
      const response = await fetch(`/api/clients/archived/${selectedClient.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Client Restored",
          description: data.ameliaContext?.personalizedMessage || "Client has been restored to active status.",
        });
        setShowRestore(false);
        fetchClients();
        fetchStats();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: "Restore Failed",
        description: error instanceof Error ? error.message : "Failed to restore client",
        variant: "destructive",
      });
    }
  };

  const handlePermanentDelete = async () => {
    if (!selectedClient) return;

    try {
      const response = await fetch(`/api/clients/archived/${selectedClient.id}?confirm=true`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Client Permanently Deleted",
          description: `Deleted ${data.deletedCounts?.disputes || 0} disputes, ${data.deletedCounts?.accounts || 0} accounts.`,
        });
        setShowDelete(false);
        fetchClients();
        fetchStats();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete client",
        variant: "destructive",
      });
    }
  };

  const getDaysRemainingBadge = (daysRemaining: number) => {
    if (daysRemaining <= 7) {
      return (
        <Badge variant="destructive" className="animate-pulse">
          <AlertTriangle className="w-3 h-3 mr-1" />
          {daysRemaining}d left
        </Badge>
      );
    }
    if (daysRemaining <= 30) {
      return (
        <Badge variant="outline" className="border-amber-500 text-amber-400">
          <Clock className="w-3 h-3 mr-1" />
          {daysRemaining}d left
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="border-border text-muted-foreground">
        <Clock className="w-3 h-3 mr-1" />
        {daysRemaining}d left
      </Badge>
    );
  };

  const getAmeliaRecommendationBadge = (recommendation: string) => {
    switch (recommendation) {
      case "CONTINUE_EXISTING":
        return <Badge className="bg-primary">Continue Disputes</Badge>;
      case "REVIEW_OUTCOMES":
        return <Badge className="bg-amber-600">Review Outcomes</Badge>;
      default:
        return <Badge className="bg-emerald-600">Start Fresh</Badge>;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <Archive className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.totalArchived}</p>
                  <p className="text-xs text-muted-foreground">Total Archived</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-600/20 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.expiringIn7Days}</p>
                  <p className="text-xs text-muted-foreground">Expiring in 7 Days</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-600/20 rounded-lg">
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.expiringIn30Days}</p>
                  <p className="text-xs text-muted-foreground">Expiring in 30 Days</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-600/20 rounded-lg">
                  <FileText className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{formatBytes(stats.totalStorageBytes)}</p>
                  <p className="text-xs text-muted-foreground">Storage Used</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-foreground flex items-center gap-2">
              <Archive className="w-5 h-5" />
              Archived Clients
              {total > 0 && (
                <Badge variant="outline" className="ml-2">{total}</Badge>
              )}
            </CardTitle>
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name..."
                  className="pl-9 bg-background border-input w-64"
                />
              </div>
              <Button type="submit" variant="outline" className="border-input">
                Search
              </Button>
            </form>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Archive className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No archived clients</p>
              <p className="text-sm">Archived clients will appear here</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Client</TableHead>
                    <TableHead className="text-muted-foreground">Archived</TableHead>
                    <TableHead className="text-muted-foreground">Retention</TableHead>
                    <TableHead className="text-muted-foreground">Records</TableHead>
                    <TableHead className="text-muted-foreground">AMELIA</TableHead>
                    <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id} className="border-border hover:bg-card">
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">
                            {client.firstName} {client.lastName}
                          </p>
                          {client.email && (
                            <p className="text-sm text-muted-foreground">{client.email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(client.archivedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {getDaysRemainingBadge(client.daysRemaining)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {client.recordCounts.disputes}
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {client.recordCounts.accounts}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {client.recordCounts.communications}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Bot className="w-4 h-4 text-purple-400" />
                          {getAmeliaRecommendationBadge(client.ameliaRecommendation)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedClient(client);
                              setShowViewer(true);
                            }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedClient(client);
                              setShowRestore(true);
                            }}
                            className="text-emerald-400 hover:text-emerald-300"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedClient(client);
                              setShowDelete(true);
                            }}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="border-input"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="border-input"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {selectedClient && (
        <>
          <ArchiveViewerModal
            open={showViewer}
            onClose={() => setShowViewer(false)}
            clientId={selectedClient.id}
            clientName={`${selectedClient.firstName} ${selectedClient.lastName}`}
          />
          <RestoreDialog
            open={showRestore}
            onClose={() => setShowRestore(false)}
            onConfirm={handleRestore}
            clientName={`${selectedClient.firstName} ${selectedClient.lastName}`}
            ameliaRecommendation={selectedClient.ameliaRecommendation}
          />
          <PermanentDeleteDialog
            open={showDelete}
            onClose={() => setShowDelete(false)}
            onConfirm={handlePermanentDelete}
            clientName={`${selectedClient.firstName} ${selectedClient.lastName}`}
            recordCounts={selectedClient.recordCounts}
          />
        </>
      )}
    </div>
  );
}
