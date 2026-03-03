// ============================================================================
// DISPUTE2GO - Letter Print View
// Print-optimized rendering of dispute letters
// ============================================================================

import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface LetterPrintViewProps {
  content: string;
  clientName: string;
  date: string;
}

// ============================================================================
// Component
// ============================================================================

export function LetterPrintView({
  content,
  clientName,
  date,
}: LetterPrintViewProps) {
  return (
    <>
      {/* Print-specific styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body * {
                visibility: hidden !important;
              }
              .letter-print-view,
              .letter-print-view * {
                visibility: visible !important;
              }
              .letter-print-view {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                display: block !important;
                margin: 0 !important;
                padding: 1in !important;
                font-size: 12pt !important;
                line-height: 1.5 !important;
                font-family: "Times New Roman", Times, serif !important;
                color: #000 !important;
                background: #fff !important;
              }
              .letter-print-view .letter-header {
                margin-bottom: 24pt !important;
              }
              .letter-print-view .letter-date {
                margin-bottom: 18pt !important;
              }
              .letter-print-view .letter-body {
                white-space: pre-wrap !important;
                page-break-inside: auto !important;
              }
              .letter-print-view .letter-body p {
                margin-bottom: 12pt !important;
                page-break-inside: avoid !important;
              }
              .letter-print-view .letter-signature {
                margin-top: 36pt !important;
                page-break-inside: avoid !important;
              }
              @page {
                margin: 1in;
                size: letter;
              }
            }
          `,
        }}
      />

      {/* Letter content - hidden in normal view, visible in print */}
      <div className={cn("hidden print:block letter-print-view")}>
        {/* Header / Sender Info */}
        {clientName && (
          <div className="letter-header">
            <p style={{ fontWeight: "bold", fontSize: "12pt" }}>
              {clientName}
            </p>
          </div>
        )}

        {/* Date */}
        <div className="letter-date">
          <p>{date}</p>
        </div>

        {/* Letter Body */}
        <div className="letter-body">
          {content.split("\n\n").map((paragraph, i) => (
            <p key={i} style={{ marginBottom: "12pt" }}>
              {paragraph}
            </p>
          ))}
        </div>

        {/* Signature Block */}
        <div className="letter-signature">
          <p>Sincerely,</p>
          <br />
          <br />
          <br />
          {clientName && (
            <p style={{ borderTop: "1px solid #000", display: "inline-block", paddingTop: "4pt" }}>
              {clientName}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

export default LetterPrintView;
