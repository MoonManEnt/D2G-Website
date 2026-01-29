"use client";

import { AlertTriangle, ExternalLink, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface EOSCARWarningBannerProps {
  selectedAccountCount: number;
  selectedInquiryCount?: number;
  threshold?: number;
}

export function EOSCARWarningBanner({
  selectedAccountCount,
  selectedInquiryCount = 0,
  threshold = 5,
}: EOSCARWarningBannerProps) {
  const accountsExceed = selectedAccountCount > threshold;
  const inquiriesExceed = selectedInquiryCount > threshold;
  const showWarning = accountsExceed || inquiriesExceed;

  if (!showWarning) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-amber-900/30 to-amber-950/40 p-4 mb-4"
      >
        {/* Animated glow effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/5 to-transparent"
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />

        <div className="relative flex gap-4">
          {/* Icon */}
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 space-y-3">
            {/* PRO TIP Header */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wider text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded">
                PRO TIP
              </span>
              <span className="text-xs text-amber-300/70">
                e-OSCAR Frivolous Dispute Warning
              </span>
            </div>

            {/* Warning Message */}
            <p className="text-sm text-amber-100 leading-relaxed">
              <strong className="text-amber-300">
                DISPUTING MORE THAN 5 ACCOUNTS AT A TIME OR 5 HARD INQUIRIES AT A TIME,
              </strong>{" "}
              MAY RESULT IN THE E-OSCAR SYSTEM AUTOMATICALLY FLAGGING YOUR CLIENT&apos;S
              DISPUTE SUBMISSION AS FRIVOLOUS.
            </p>

            {/* Current Selection Status */}
            <div className="flex flex-wrap gap-3 text-xs">
              {accountsExceed && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Info className="w-3 h-3" />
                  {selectedAccountCount} accounts selected (exceeds {threshold})
                </span>
              )}
              {inquiriesExceed && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Info className="w-3 h-3" />
                  {selectedInquiryCount} inquiries selected (exceeds {threshold})
                </span>
              )}
            </div>

            {/* Reference Links */}
            <div className="flex flex-wrap gap-4 pt-1 text-xs">
              <a
                href="https://www.consumerfinance.gov/complaint/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-amber-300/80 hover:text-amber-200 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                CFPB Complaint Portal
              </a>
              <a
                href="https://www.e-oscar.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-amber-300/80 hover:text-amber-200 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                e-OSCAR Documentation
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
