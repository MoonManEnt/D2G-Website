"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Eye,
  Edit3,
  Download,
  Copy,
  Check,
  FileText,
  Save,
  X,
  Printer,
  Scale,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/lib/use-toast";

interface LetterEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  letterContent: string;
  documentId: string;
  documentTitle: string;
  disputeId: string;
  cra: string;
  onSave?: (content: string) => Promise<void>;
}

export function LetterEditor({
  open,
  onOpenChange,
  letterContent,
  documentId,
  documentTitle,
  disputeId,
  cra,
  onSave,
}: LetterEditorProps) {
  const { toast } = useToast();
  const [content, setContent] = useState(letterContent);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cfpbCopied, setCfpbCopied] = useState(false);
  const [cfpbContent, setCfpbContent] = useState<string>("");
  const [cfpbLoading, setCfpbLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("letter");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch CFPB complaint when tab is activated
  useEffect(() => {
    const fetchComplaint = async () => {
      setCfpbLoading(true);
      try {
        const response = await fetch(`/api/disputes/${disputeId}/cfpb?format=text`);
        if (response.ok) {
          const text = await response.text();
          setCfpbContent(text);
        } else {
          setCfpbContent("Failed to generate CFPB complaint. Please try again.");
        }
      } catch {
        setCfpbContent("Error loading CFPB complaint.");
      } finally {
        setCfpbLoading(false);
      }
    };

    if (activeTab === "cfpb" && !cfpbContent && disputeId) {
      fetchComplaint();
    }
  }, [activeTab, disputeId, cfpbContent]);

  const fetchCFPBComplaint = async () => {
    setCfpbLoading(true);
    try {
      const response = await fetch(`/api/disputes/${disputeId}/cfpb?format=text`);
      if (response.ok) {
        const text = await response.text();
        setCfpbContent(text);
      } else {
        setCfpbContent("Failed to generate CFPB complaint. Please try again.");
      }
    } catch {
      setCfpbContent("Error loading CFPB complaint.");
    } finally {
      setCfpbLoading(false);
    }
  };

  const handleCopyCFPB = async () => {
    try {
      await navigator.clipboard.writeText(cfpbContent);
      setCfpbCopied(true);
      toast({
        title: "CFPB Complaint Copied",
        description: "Ready to paste into CFPB.gov complaint form.",
      });
      setTimeout(() => setCfpbCopied(false), 2000);
    } catch {
      toast({
        title: "Copy Failed",
        description: "Please select and copy the text manually.",
        variant: "destructive",
      });
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast({
        title: "Copied to Clipboard",
        description: "Letter content copied. Ready to paste into DisputeFox or other systems.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Copy Failed",
        description: "Please select and copy the text manually.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${documentTitle.replace(/\s+/g, "_")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Downloaded",
      description: "Letter saved as text file.",
    });
  };

  const handleDownloadDocx = async () => {
    try {
      toast({
        title: "Generating DOCX",
        description: "Creating professionally formatted letter...",
      });

      const response = await fetch(`/api/disputes/${disputeId}/docx`);

      if (!response.ok) {
        throw new Error("Failed to generate DOCX");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${documentTitle.replace(/\s+/g, "_")}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Downloaded",
        description: "Professionally formatted DOCX file ready for eOSCAR.",
      });
    } catch {
      // Fallback to RTF if DOCX generation fails
      const rtfContent = `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0 Arial;}}
{\\colortbl;\\red0\\green0\\blue0;}
\\f0\\fs24
${content.replace(/\n/g, "\\par\n").replace(/[{}\\]/g, "\\$&")}
}`;

      const blob = new Blob([rtfContent], { type: "application/rtf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${documentTitle.replace(/\s+/g, "_")}.rtf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Downloaded (Fallback)",
        description: "Letter saved as RTF file. DOCX templates may need setup.",
      });
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${documentTitle}</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              line-height: 1.5;
              padding: 1in;
              max-width: 8.5in;
              margin: 0 auto;
            }
            pre {
              white-space: pre-wrap;
              word-wrap: break-word;
              font-family: inherit;
            }
          </style>
        </head>
        <body>
          <pre>${content}</pre>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(content);
      setIsEditing(false);
      toast({
        title: "Saved",
        description: "Letter changes have been saved.",
      });
    } catch {
      toast({
        title: "Save Failed",
        description: "Could not save changes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setContent(letterContent);
    setIsEditing(false);
  };

  const getCraBadgeColor = (cra: string) => {
    switch (cra) {
      case "TRANSUNION":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "EXPERIAN":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case "EQUIFAX":
        return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-white flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {documentTitle}
              </DialogTitle>
              <DialogDescription className="text-slate-400 flex items-center gap-2 mt-1">
                <Badge variant="outline" className={getCraBadgeColor(cra)}>
                  {cra}
                </Badge>
                <span>Dispute Letter</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs for Letter and CFPB Complaint */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="bg-slate-700/50 border-slate-600 w-full justify-start">
            <TabsTrigger value="letter" className="data-[state=active]:bg-slate-600">
              <FileText className="w-4 h-4 mr-2" />
              Dispute Letter
            </TabsTrigger>
            <TabsTrigger value="cfpb" className="data-[state=active]:bg-amber-600/30 data-[state=active]:text-amber-300">
              <Scale className="w-4 h-4 mr-2" />
              CFPB Complaint
            </TabsTrigger>
          </TabsList>

          {/* Letter Tab */}
          <TabsContent value="letter" className="flex-1 flex flex-col overflow-hidden mt-0">
            {/* Letter Toolbar */}
            <div className="flex items-center justify-between py-2 border-b border-slate-700">
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={isSaving}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Save className="w-4 h-4 mr-1" />
                      {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancel}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    <Edit3 className="w-4 h-4 mr-1" />
                    Edit Letter
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  {copied ? (
                    <Check className="w-4 h-4 mr-1 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4 mr-1" />
                  )}
                  {copied ? "Copied!" : "Copy for DisputeFox"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadTxt}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <Download className="w-4 h-4 mr-1" />
                  .TXT
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadDocx}
                  className="border-emerald-600 text-emerald-300 hover:bg-emerald-700/30 bg-emerald-600/10"
                >
                  <Download className="w-4 h-4 mr-1" />
                  .DOCX (eOSCAR)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePrint}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <Printer className="w-4 h-4 mr-1" />
                  Print
                </Button>
              </div>
            </div>

            {/* Letter Content Area */}
            <div className="flex-1 overflow-hidden">
              {isEditing ? (
                <Textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full h-full min-h-[400px] bg-slate-900 border-slate-700 text-slate-200 font-mono text-sm resize-none"
                  placeholder="Letter content..."
                />
              ) : (
                <div className="h-full overflow-y-auto bg-white rounded-lg p-8">
                  <pre className="whitespace-pre-wrap font-mono text-sm text-slate-900 leading-relaxed">
                    {content}
                  </pre>
                </div>
              )}
            </div>

            {/* Letter Footer */}
            <div className="pt-3 border-t border-slate-700 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <span className="text-amber-400">Editing mode - changes not saved yet</span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" /> Preview mode - eOSCAR formatted letter
                  </span>
                )}
              </div>
              <div>
                {content.length.toLocaleString()} characters | ~{Math.ceil(content.split(/\s+/).length / 250)} pages
              </div>
            </div>
          </TabsContent>

          {/* CFPB Complaint Tab */}
          <TabsContent value="cfpb" className="flex-1 flex flex-col overflow-hidden mt-0">
            {/* CFPB Toolbar */}
            <div className="flex items-center justify-between py-2 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  CFPB Complaint Template
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyCFPB}
                  disabled={cfpbLoading || !cfpbContent}
                  className="border-amber-600 text-amber-300 hover:bg-amber-700/30 bg-amber-600/10"
                >
                  {cfpbCopied ? (
                    <Check className="w-4 h-4 mr-1 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4 mr-1" />
                  )}
                  {cfpbCopied ? "Copied!" : "Copy for CFPB.gov"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open("https://www.consumerfinance.gov/complaint/", "_blank")}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  Open CFPB.gov
                </Button>
              </div>
            </div>

            {/* CFPB Content Area */}
            <div className="flex-1 overflow-hidden">
              {cfpbLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-slate-400">Generating CFPB complaint...</div>
                </div>
              ) : (
                <div className="h-full overflow-y-auto bg-slate-900 rounded-lg p-6">
                  <pre className="whitespace-pre-wrap font-mono text-sm text-amber-200/90 leading-relaxed">
                    {cfpbContent}
                  </pre>
                </div>
              )}
            </div>

            {/* CFPB Footer */}
            <div className="pt-3 border-t border-slate-700">
              <div className="flex items-center gap-2 text-xs text-amber-400/70">
                <AlertTriangle className="w-3 h-3" />
                <span>
                  This complaint is pre-formatted for CFPB.gov. Copy and paste each section into the corresponding fields.
                </span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
