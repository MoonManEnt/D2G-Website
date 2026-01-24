"use client";

import { useState } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Loader2, AlertTriangle, Users, FileText, MessageSquare } from "lucide-react";

interface PermanentDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  clientName: string;
  recordCounts: {
    disputes: number;
    accounts: number;
    communications: number;
  };
}

export function PermanentDeleteDialog({
  open,
  onClose,
  onConfirm,
  clientName,
  recordCounts,
}: PermanentDeleteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const CONFIRM_PHRASE = "PERMANENTLY DELETE";

  const handleConfirm = async () => {
    if (confirmText !== CONFIRM_PHRASE) return;

    setLoading(true);
    try {
      await onConfirm();
      setConfirmText("");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setConfirmText("");
    onClose();
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={handleClose}>
      <ResponsiveDialogContent size="sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2 text-red-400">
            <Trash2 className="w-5 h-5" />
            Permanently Delete Client
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            This action cannot be undone. All data will be permanently removed.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody className="space-y-4">
          {/* Warning Banner */}
          <div className="bg-red-950/50 border border-red-900 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-300 mb-1">
                  Warning: This is irreversible
                </p>
                <p className="text-sm text-slate-300">
                  You are about to permanently delete <strong>{clientName}</strong> and
                  all associated data. This cannot be recovered.
                </p>
              </div>
            </div>
          </div>

          {/* Data to be deleted */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-medium text-white mb-3">Data to be deleted:</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-2 bg-slate-900/50 rounded">
                <Users className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-white">{recordCounts.disputes}</p>
                <p className="text-xs text-slate-400">Disputes</p>
              </div>
              <div className="p-2 bg-slate-900/50 rounded">
                <FileText className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-white">{recordCounts.accounts}</p>
                <p className="text-xs text-slate-400">Accounts</p>
              </div>
              <div className="p-2 bg-slate-900/50 rounded">
                <MessageSquare className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-white">{recordCounts.communications}</p>
                <p className="text-xs text-slate-400">Communications</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3 text-center">
              Plus all credit reports, scores, evidence, documents, and event logs
            </p>
          </div>

          {/* Confirmation Input */}
          <div className="space-y-2">
            <Label className="text-slate-200">
              Type <code className="bg-slate-800 px-2 py-0.5 rounded text-red-400">{CONFIRM_PHRASE}</code> to confirm
            </Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="bg-slate-700/50 border-slate-600 text-white font-mono"
              placeholder="Type confirmation..."
            />
          </div>
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
            className="border-slate-600"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || confirmText !== CONFIRM_PHRASE}
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Forever
              </>
            )}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
