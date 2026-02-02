"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Mail,
  Send,
  Loader2,
  CheckCircle,
  MapPin,
  Building,
  Printer,
  FileCheck,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/lib/use-toast";

interface MailSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disputeId: string;
  disputeType: "DISPUTE" | "SENTRY";
  clientName: string;
  cra: string;
  onSuccess?: () => void;
}

const CRA_DISPLAY_ADDRESSES: Record<
  string,
  { name: string; address: string; city: string; state: string; zip: string }
> = {
  TRANSUNION: {
    name: "TransUnion LLC Consumer Dispute Center",
    address: "P.O. Box 2000",
    city: "Chester",
    state: "PA",
    zip: "19016",
  },
  EXPERIAN: {
    name: "Experian",
    address: "P.O. Box 4500",
    city: "Allen",
    state: "TX",
    zip: "75013",
  },
  EQUIFAX: {
    name: "Equifax Information Services LLC",
    address: "P.O. Box 740256",
    city: "Atlanta",
    state: "GA",
    zip: "30374",
  },
};

interface MailingResult {
  letterId: string;
  mailedAt: string;
}

export function MailSendDialog({
  open,
  onOpenChange,
  disputeId,
  disputeType,
  clientName,
  cra,
  onSuccess,
}: MailSendDialogProps) {
  const { toast } = useToast();

  const [certified, setCertified] = useState(false);
  const [returnReceipt, setReturnReceipt] = useState(false);
  const [color, setColor] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [mailingResult, setMailingResult] = useState<MailingResult | null>(null);

  const craAddress = CRA_DISPLAY_ADDRESSES[cra];

  const resetState = () => {
    setCertified(false);
    setReturnReceipt(false);
    setColor(false);
    setSending(false);
    setSent(false);
    setMailingResult(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetState();
    }
    onOpenChange(nextOpen);
  };

  const handleSend = async () => {
    setSending(true);

    try {
      const endpoint =
        disputeType === "SENTRY"
          ? `/api/sentry/${disputeId}/mail`
          : `/api/disputes/${disputeId}/mail`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "DOCUPOST",
          certified,
          returnReceipt,
          color,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send letter");
      }

      const data = await res.json();
      setSent(true);
      setMailingResult({
        letterId: data.letterId || data.id || "N/A",
        mailedAt: data.mailedAt || new Date().toISOString(),
      });

      toast({
        title: "Letter Queued",
        description: "Letter queued for mailing via DocuPost",
      });
    } catch (err) {
      toast({
        title: "Mail Failed",
        description:
          err instanceof Error ? err.message : "Failed to send letter",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleDone = () => {
    onSuccess?.();
    handleOpenChange(false);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent size="md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Send Dispute Letter
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Mail your dispute letter via DocuPost certified mail service
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody>
          {sent ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center py-8 space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">
                Letter Sent!
              </h3>
              <p className="text-sm text-muted-foreground text-center">
                Your dispute letter has been queued for mailing.
              </p>
              {mailingResult && (
                <div className="bg-muted rounded-lg p-4 w-full max-w-sm">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Mailing ID</span>
                    <span className="text-foreground font-mono text-xs">
                      {mailingResult.letterId}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-muted-foreground">Queued At</span>
                    <span className="text-foreground text-xs">
                      {new Date(mailingResult.mailedAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
              <Button
                onClick={handleDone}
                className="mt-4 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Done
              </Button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Recipient Card */}
              {craAddress && (
                <div className="bg-muted rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                        Recipient
                      </p>
                      <p className="text-sm font-semibold text-foreground">
                        {craAddress.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {craAddress.address}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {craAddress.city}, {craAddress.state} {craAddress.zip}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sender Card */}
              <div className="bg-muted rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Building className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      Sender
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {clientName}
                    </p>
                    <p className="text-xs text-muted-foreground">Address on file</p>
                  </div>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Mailing Options
                </p>

                {/* Certified Mail Toggle */}
                <div
                  onClick={() => {
                    const next = !certified;
                    setCertified(next);
                    if (!next) {
                      setReturnReceipt(false);
                    }
                  }}
                  className="bg-muted rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Certified Mail
                      </p>
                      <p className="text-xs text-muted-foreground">
                        USPS Certified with tracking number
                      </p>
                    </div>
                  </div>
                  <div
                    className={`w-10 h-5 rounded-full relative transition-colors ${
                      certified ? "bg-emerald-500" : "bg-muted"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        certified ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                </div>

                {/* Return Receipt Toggle */}
                <div
                  onClick={() => {
                    if (certified) {
                      setReturnReceipt(!returnReceipt);
                    }
                  }}
                  className={`bg-muted rounded-lg p-3 flex items-center justify-between transition-colors ${
                    certified
                      ? "cursor-pointer hover:bg-muted"
                      : "opacity-50 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FileCheck className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Return Receipt
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Request signed delivery confirmation
                      </p>
                    </div>
                  </div>
                  <div
                    className={`w-10 h-5 rounded-full relative transition-colors ${
                      returnReceipt ? "bg-emerald-500" : "bg-muted"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        returnReceipt ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                </div>

                {/* Color Printing Toggle */}
                <div
                  onClick={() => setColor(!color)}
                  className="bg-muted rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Printer className="w-4 h-4 text-amber-400" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Color Printing
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Print in full color
                      </p>
                    </div>
                  </div>
                  <div
                    className={`w-10 h-5 rounded-full relative transition-colors ${
                      color ? "bg-emerald-500" : "bg-muted"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        color ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Provider Badge */}
              <div className="flex items-center justify-center pt-2">
                <Badge className="bg-muted text-muted-foreground border-input">
                  <Mail className="w-3 h-3 mr-1" />
                  DocuPost
                </Badge>
              </div>
            </motion.div>
          )}
        </ResponsiveDialogBody>

        {!sent && (
          <ResponsiveDialogFooter>
            <Button variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Letter
                </>
              )}
            </Button>
          </ResponsiveDialogFooter>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
