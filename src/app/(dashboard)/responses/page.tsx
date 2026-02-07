"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, AlertTriangle, CheckCircle, XCircle, FileText, Calendar, ChevronRight, Filter, Download, Bell, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, differenceInDays, addDays } from "date-fns";
import { createLogger } from "@/lib/logger";
const log = createLogger("responses-page");

interface PendingResponse {
  id: string;
  disputeId: string;
  clientId: string;
  clientName: string;
  cra: string;
  round: number;
  flow: string;
  letterContent: string | null;
  sentDate: string;
  responseDeadline: string;
  daysRemaining: number;
  daysElapsed: number;
  status: string;
  itemCount: number;
  accounts: Array<{ name: string; accountId: string }>;
}

interface LoggedResponse {
  id: string;
  disputeId: string;
  clientId: string;
  clientName: string;
  cra: string;
  round: number;
  flow: string;
  letterContent: string | null;
  responseDate: string | null;
  daysToRespond: number | null;
  status: string;
  responseType: string | null;
  results: { deleted: number; verified: number; updated: number };
  fcraViolation: boolean;
  nextAction: string;
}

const CRA_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  TRANSUNION: { bg: "bg-sky-500/15", text: "text-sky-400", border: "border-sky-500/30" },
  EXPERIAN: { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/30" },
  EQUIFAX: { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/30" },
};

const RESPONSE_TYPES: Record<string, { label: string; color: string; icon: string }> = {
  DELETED: { label: "Deleted", color: "text-emerald-400", icon: "check" },
  VERIFIED: { label: "Verified", color: "text-amber-400", icon: "alert" },
  UPDATED: { label: "Updated", color: "text-primary", icon: "edit" },
  FRIVOLOUS: { label: "Frivolous", color: "text-red-400", icon: "x" },
  NO_RESPONSE: { label: "No Response", color: "text-purple-400", icon: "clock" },
};

export default function ResponseTrackerPage() {
  const [activeTab, setActiveTab] = useState<"pending" | "logged">("pending");
  const [pendingResponses, setPendingResponses] = useState<PendingResponse[]>([]);
  const [loggedResponses, setLoggedResponses] = useState<LoggedResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<PendingResponse | null>(null);
  const [showLetterModal, setShowLetterModal] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<{
    clientName: string;
    cra: string;
    round: number;
    flow: string;
    letterContent: string | null;
    disputeId: string;
  } | null>(null);

  useEffect(() => {
    fetchResponses();
  }, []);

  const fetchResponses = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/disputes/responses/pending");
      if (res.ok) {
        const data = await res.json();
        setPendingResponses(data.pending || []);
        setLoggedResponses(data.logged || []);
      }
    } catch (err) {
      log.error("Failed to fetch responses");
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    pending: pendingResponses.length,
    overdue: pendingResponses.filter(r => r.daysRemaining <= 0).length,
    due7Days: pendingResponses.filter(r => r.daysRemaining > 0 && r.daysRemaining <= 7).length,
    totalLogged: loggedResponses.length,
    deletionRate: loggedResponses.length > 0
      ? Math.round((loggedResponses.reduce((sum, r) => sum + r.results.deleted, 0) /
          loggedResponses.reduce((sum, r) => sum + (r.results.deleted + r.results.verified + r.results.updated), 0)) * 100) || 0
      : 0,
    violations: loggedResponses.filter(r => r.fcraViolation).length,
  };

  const openLogModal = (dispute: PendingResponse) => {
    setSelectedDispute(dispute);
    setShowLogModal(true);
  };

  const openLetterModal = (data: {
    clientName: string;
    cra: string;
    round: number;
    flow: string;
    letterContent: string | null;
    disputeId: string;
  }) => {
    setSelectedLetter(data);
    setShowLetterModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background text-foreground p-6">
      {/* Ambient glow */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
            Response Tracker
          </h1>
          <p className="text-muted-foreground text-sm">Monitor CRA responses and FCRA compliance</p>
        </div>
        <Button variant="outline" className="gap-2 bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground">
          <Download className="w-4 h-4" />
          Export Report
        </Button>
      </header>

      {/* Stats Dashboard */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8"
      >
        <StatCard icon={<Clock className="w-5 h-5" />} label="Pending" value={stats.pending} />
        <StatCard icon={<AlertTriangle className="w-5 h-5" />} label="Overdue" value={stats.overdue} accent="text-red-400" />
        <StatCard icon={<Bell className="w-5 h-5" />} label="Due in 7 Days" value={stats.due7Days} accent="text-amber-400" />
        <StatCard icon={<FileText className="w-5 h-5" />} label="Total Logged" value={stats.totalLogged} />
        <StatCard icon={<CheckCircle className="w-5 h-5" />} label="Deletion Rate" value={stats.deletionRate + "%"} accent="text-emerald-400" />
        <StatCard icon={<XCircle className="w-5 h-5" />} label="FCRA Violations" value={stats.violations} accent="text-purple-400" />
      </motion.div>

      {/* Tabs */}
      <div className="relative z-10 flex gap-2 mb-6 bg-card p-1.5 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("pending")}
          className={"px-4 py-2 rounded-lg text-sm font-medium transition-all " +
            (activeTab === "pending" ? "bg-purple-600 text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          Pending Responses ({pendingResponses.length})
        </button>
        <button
          onClick={() => setActiveTab("logged")}
          className={"px-4 py-2 rounded-lg text-sm font-medium transition-all " +
            (activeTab === "logged" ? "bg-purple-600 text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          Logged Responses ({loggedResponses.length})
        </button>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {activeTab === "pending" ? (
          <div className="space-y-4">
            {pendingResponses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No pending responses</p>
                <p className="text-sm">Disputes awaiting CRA response will appear here</p>
              </div>
            ) : (
              pendingResponses.map((response) => (
                <PendingResponseCard
                  key={response.id}
                  response={response}
                  onLogResponse={() => openLogModal(response)}
                  onViewLetter={() => openLetterModal({
                    clientName: response.clientName,
                    cra: response.cra,
                    round: response.round,
                    flow: response.flow,
                    letterContent: response.letterContent,
                    disputeId: response.disputeId,
                  })}
                />
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {loggedResponses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No logged responses yet</p>
              </div>
            ) : (
              loggedResponses.map((response) => (
                <LoggedResponseCard
                  key={response.id}
                  response={response}
                  onViewLetter={() => openLetterModal({
                    clientName: response.clientName,
                    cra: response.cra,
                    round: response.round,
                    flow: response.flow,
                    letterContent: response.letterContent,
                    disputeId: response.disputeId,
                  })}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Log Response Modal */}
      {showLogModal && selectedDispute && (
        <LogResponseModal
          dispute={selectedDispute}
          onClose={() => {
            setShowLogModal(false);
            setSelectedDispute(null);
          }}
          onSave={() => {
            setShowLogModal(false);
            setSelectedDispute(null);
            fetchResponses();
          }}
        />
      )}

      {/* Letter Viewer Modal */}
      {showLetterModal && selectedLetter && (
        <LetterViewerModal
          letter={selectedLetter}
          onClose={() => {
            setShowLetterModal(false);
            setSelectedLetter(null);
          }}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent?: string }) {
  return (
    <div className="bg-card backdrop-blur-xl border border-border rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className="text-muted-foreground">{icon}</div>
        <div>
          <span className={"text-2xl font-bold " + (accent || "text-foreground")}>{value}</span>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        </div>
      </div>
    </div>
  );
}

function PendingResponseCard({ response, onLogResponse, onViewLetter }: { response: PendingResponse; onLogResponse: () => void; onViewLetter: () => void }) {
  const craColor = CRA_COLORS[response.cra] || CRA_COLORS.TRANSUNION;
  const isOverdue = response.daysRemaining <= 0;
  const isDueSoon = response.daysRemaining > 0 && response.daysRemaining <= 7;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={"bg-card backdrop-blur-xl border rounded-xl p-5 " +
        (isOverdue ? "border-red-500/50" : isDueSoon ? "border-amber-500/50" : "border-border")}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className={"w-12 h-12 rounded-xl flex items-center justify-center font-bold " + craColor.bg + " " + craColor.text}>
            {response.cra.slice(0, 2)}
          </div>
          <div>
            <h3 className="font-semibold text-lg">{response.clientName}</h3>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span className={"px-2 py-0.5 rounded " + craColor.bg + " " + craColor.text}>{response.cra}</span>
              <span>Round {response.round}</span>
              <span>{response.flow}</span>
              <span>{response.itemCount} items</span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className={"text-2xl font-bold " + (isOverdue ? "text-red-400" : isDueSoon ? "text-amber-400" : "text-foreground")}>
            {isOverdue ? "OVERDUE" : response.daysRemaining + " days"}
          </div>
          <p className="text-xs text-muted-foreground">
            Deadline: {format(new Date(response.responseDeadline), "MMM d, yyyy")}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Sent: {format(new Date(response.sentDate), "MMM d")}</span>
          <span>30-day window</span>
          <span>Deadline: {format(new Date(response.responseDeadline), "MMM d")}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={"h-full rounded-full transition-all " + (isOverdue ? "bg-red-500" : isDueSoon ? "bg-amber-500" : "bg-blue-500")}
            style={{ width: Math.min(100, (response.daysElapsed / 30) * 100) + "%" }}
          />
        </div>
      </div>

      {/* Accounts */}
      <div className="mt-4 flex flex-wrap gap-2">
        {response.accounts.slice(0, 3).map((acc, i) => (
          <span key={i} className="text-xs bg-muted px-2 py-1 rounded">
            {acc.name}
          </span>
        ))}
        {response.accounts.length > 3 && (
          <span className="text-xs text-muted-foreground">+{response.accounts.length - 3} more</span>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onViewLetter} className="bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground gap-1.5">
          <Eye className="w-3.5 h-3.5" />
          View Letter
        </Button>
        <Button variant="outline" size="sm" onClick={onLogResponse} className="bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground">
          Log Response
        </Button>
        {isOverdue && (
          <Button size="sm" className="bg-red-600 hover:bg-red-700">
            Report Violation
          </Button>
        )}
      </div>
    </motion.div>
  );
}

function LoggedResponseCard({ response, onViewLetter }: { response: LoggedResponse; onViewLetter: () => void }) {
  const craColor = CRA_COLORS[response.cra] || CRA_COLORS.TRANSUNION;
  const responseConfig = RESPONSE_TYPES[response.responseType || "VERIFIED"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={"bg-card backdrop-blur-xl border rounded-xl p-5 " +
        (response.fcraViolation ? "border-purple-500/50" : "border-border")}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className={"w-12 h-12 rounded-xl flex items-center justify-center font-bold " + craColor.bg + " " + craColor.text}>
            {response.cra.slice(0, 2)}
          </div>
          <div>
            <h3 className="font-semibold">{response.clientName}</h3>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span>Round {response.round}</span>
              <span>{response.flow}</span>
              {response.responseDate && (
                <span>Responded: {format(new Date(response.responseDate), "MMM d, yyyy")}</span>
              )}
            </div>
          </div>
        </div>

        <div className="text-right">
          <span className={"px-3 py-1 rounded-lg text-sm font-medium " +
            (response.fcraViolation ? "bg-purple-500/20 text-purple-400" : "bg-muted text-muted-foreground")}>
            {response.fcraViolation ? "FCRA VIOLATION" : response.status}
          </span>
        </div>
      </div>

      {/* Results */}
      <div className="mt-4 flex gap-4">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span className="text-sm">{response.results.deleted} Deleted</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="text-sm">{response.results.verified} Verified</span>
        </div>
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-sm">{response.results.updated} Updated</span>
        </div>
      </div>

      {/* Next Action */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <ChevronRight className="w-4 h-4 text-purple-400" />
          <span className="text-muted-foreground">{response.nextAction}</span>
        </div>
        <Button variant="outline" size="sm" onClick={onViewLetter} className="bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground gap-1.5">
          <Eye className="w-3.5 h-3.5" />
          View Letter
        </Button>
      </div>
    </motion.div>
  );
}

function LetterViewerModal({
  letter,
  onClose,
}: {
  letter: {
    clientName: string;
    cra: string;
    round: number;
    flow: string;
    letterContent: string | null;
    disputeId: string;
  };
  onClose: () => void;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      // Try to download the PDF from the API
      const response = await fetch(`/api/disputes/${letter.disputeId}/pdf`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${letter.clientName} - Round ${letter.round} ${letter.flow}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      log.error("Failed to download letter PDF");
    } finally {
      setDownloading(false);
    }
  };

  const craColor = CRA_COLORS[letter.cra] || CRA_COLORS.TRANSUNION;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-3xl max-h-[85vh] bg-background rounded-2xl border border-border flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-4">
            <div className={"w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm " + craColor.bg + " " + craColor.text}>
              {letter.cra.slice(0, 2)}
            </div>
            <div>
              <h2 className="text-lg font-bold">{letter.clientName}</h2>
              <p className="text-sm text-muted-foreground">
                {letter.cra} - Round {letter.round} - {letter.flow}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={downloading}
              className="bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              {downloading ? "Downloading..." : "Download PDF"}
            </Button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Letter Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {letter.letterContent ? (
            <div className="bg-white text-black rounded-lg p-8 min-h-[500px] font-serif text-sm leading-relaxed whitespace-pre-wrap">
              {letter.letterContent}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Letter content not available</p>
              <p className="text-sm mt-1">The letter content was not saved for this dispute</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={downloading}
                className="mt-4 gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Try downloading PDF instead
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function LogResponseModal({ dispute, onClose, onSave }: { dispute: PendingResponse; onClose: () => void; onSave: () => void }) {
  const [responseType, setResponseType] = useState<string>("VERIFIED");
  const [accountResults, setAccountResults] = useState<Record<string, string>>(
    Object.fromEntries(dispute.accounts.map(a => [a.accountId, "VERIFIED"]))
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/disputes/" + dispute.disputeId + "/response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responseType,
          accountResults,
          responseDate: new Date().toISOString(),
        }),
      });
      onSave();
    } catch (err) {
      log.error("Failed to log response");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-lg bg-background rounded-2xl border border-border p-6"
      >
        <h2 className="text-xl font-bold mb-4">Log CRA Response</h2>
        <p className="text-muted-foreground text-sm mb-6">
          {dispute.clientName} - {dispute.cra} Round {dispute.round}
        </p>

        {/* Response Type */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Overall Response Type</label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(RESPONSE_TYPES).map(([type, config]) => (
              <button
                key={type}
                onClick={() => setResponseType(type)}
                className={"p-3 rounded-lg border text-sm font-medium transition-all " +
                  (responseType === type
                    ? "border-purple-500 bg-purple-500/20 " + config.color
                    : "border-border text-muted-foreground hover:border-input")}
              >
                {config.label}
              </button>
            ))}
          </div>
        </div>

        {/* Per-Account Results */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Per-Account Results</label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {dispute.accounts.map((acc) => (
              <div key={acc.accountId} className="flex items-center justify-between bg-card p-3 rounded-lg">
                <span className="text-sm">{acc.name}</span>
                <select
                  value={accountResults[acc.accountId]}
                  onChange={(e) => setAccountResults({ ...accountResults, [acc.accountId]: e.target.value })}
                  className="bg-muted border-none rounded px-2 py-1 text-sm"
                >
                  <option value="DELETED">Deleted</option>
                  <option value="VERIFIED">Verified</option>
                  <option value="UPDATED">Updated</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} className="text-muted-foreground hover:text-foreground hover:bg-card">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-foreground">
            {saving ? "Saving..." : "Log Response"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
