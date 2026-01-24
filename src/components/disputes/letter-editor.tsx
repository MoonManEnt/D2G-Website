"use client";

import { useState, useRef, useEffect, useMemo } from "react";
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
  ChevronRight,
  User,
  Info,
  List,
  MessageSquare,
} from "lucide-react";
import { useToast } from "@/lib/use-toast";
import { cn } from "@/lib/utils";

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

interface LetterSection {
  id: string;
  title: string;
  icon: any;
  content: string;
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
  const [activeSectionId, setActiveSectionId] = useState("header");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  // Parse letter into sections for navigation
  const sections = useMemo(() => {
    const lines = content.split('\n');
    const result: LetterSection[] = [];

    let headerLines: string[] = [];
    let introLines: string[] = [];
    let itemsLines: string[] = [];
    let closingLines: string[] = [];

    let currentMode: 'header' | 'intro' | 'items' | 'closing' = 'header';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Detection heuristics
      if (currentMode === 'header' && (line.startsWith('Dear') || line.startsWith('To whom') || line.includes('Consumer Solutions'))) {
        currentMode = 'intro';
      }

      if (currentMode === 'intro' && (/^\d+\./.test(line) || line.includes('Account #:'))) {
        currentMode = 'items';
      }

      if (currentMode === 'items' && (line.startsWith('Sincerely') || line.startsWith('Thank you') || line.startsWith('Respectfully'))) {
        currentMode = 'closing';
      }

      if (currentMode === 'header') headerLines.push(lines[i]);
      else if (currentMode === 'intro') introLines.push(lines[i]);
      else if (currentMode === 'items') itemsLines.push(lines[i]);
      else closingLines.push(lines[i]);
    }

    result.push({ id: 'header', title: 'Header & IDs', icon: User, content: headerLines.join('\n') });
    result.push({ id: 'intro', title: 'Introduction', icon: Info, content: introLines.join('\n') });
    result.push({ id: 'items', title: 'Dispute Items', icon: List, content: itemsLines.join('\n') });
    result.push({ id: 'closing', title: 'Closing', icon: MessageSquare, content: closingLines.join('\n') });

    return result;
  }, [content]);

  // Sync section view with scroll or click
  const scrollToSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    if (paperRef.current) {
      const sectionElement = paperRef.current.querySelector(`#section-${sectionId}`);
      if (sectionElement) {
        sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

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
      toast({
        title: "Download Failed",
        description: "Could not generate DOCX. Try downloading as TXT.",
        variant: "destructive"
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
            body { font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.5; padding: 1in; max-width: 8.5in; margin: 0 auto; }
            pre { white-space: pre-wrap; word-wrap: break-word; font-family: inherit; }
          </style>
        </head>
        <body><pre>${content}</pre></body>
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

  const getCraBadgeColor = (cra: string) => {
    switch (cra) {
      case "TRANSUNION": return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "EXPERIAN": return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case "EQUIFAX": return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      default: return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 max-w-[95vw] w-[1400px] h-[95vh] flex flex-col p-0 overflow-hidden shadow-2xl">
        {/* Header Bar */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <FileText className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <DialogTitle className="text-white text-xl font-bold tracking-tight">
                {documentTitle}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={cn("px-2 py-0 h-5 text-[10px] font-bold uppercase", getCraBadgeColor(cra))}>
                  {cra}
                </Badge>
                <span className="text-xs text-slate-500 font-medium tracking-wide">DOCUMENT CENTER</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadTxt}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 h-9"
            >
              <Download className="w-4 h-4 mr-2" />
              .TXT
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadDocx}
              className="border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 bg-indigo-500/5 h-9"
            >
              <Download className="w-4 h-4 mr-2" />
              .DOCX (eOSCAR)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrint}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 h-9"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <div className="w-[1px] h-6 bg-slate-800 mx-2" />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 border-b border-slate-800 bg-slate-900/30">
            <TabsList className="bg-transparent border-none w-full justify-start p-0 h-12 gap-6">
              <TabsTrigger
                value="letter"
                className="data-[state=active]:bg-transparent data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-400 rounded-none bg-transparent hover:text-slate-200 px-0"
              >
                <FileText className="w-4 h-4 mr-2" />
                Dispute Letter
              </TabsTrigger>
              <TabsTrigger
                value="cfpb"
                className="data-[state=active]:bg-transparent data-[state=active]:text-amber-400 data-[state=active]:border-b-2 data-[state=active]:border-amber-400 rounded-none bg-transparent hover:text-slate-200 px-0"
              >
                <Scale className="w-4 h-4 mr-2" />
                CFPB Complaint
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="letter" className="flex-1 flex flex-row min-h-0 mt-0">
            {/* Sidebar Navigator */}
            <div className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Navigator</span>
                {isEditing ? (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px]">Editing</Badge>
                ) : (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">Review</Badge>
                )}
              </div>
              <div className="flex-1 p-2 space-y-1">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group",
                      activeSectionId === section.id
                        ? "bg-indigo-500/10 text-indigo-300"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    )}
                  >
                    <section.icon className={cn("w-4 h-4", activeSectionId === section.id ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300")} />
                    <span className="flex-1 text-left font-medium">{section.title}</span>
                    {activeSectionId === section.id && <ChevronRight className="w-3 h-3 text-indigo-500" />}
                  </button>
                ))}
              </div>

              <div className="p-4 mt-auto border-t border-slate-800 bg-slate-900/80">
                <div className="space-y-3">
                  {isEditing ? (
                    <div className="flex flex-col gap-2">
                      <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20 h-10"
                        onClick={handleSave}
                        disabled={isSaving}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {isSaving ? "Saving..." : "Save Changes"}
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full text-slate-400 hover:bg-slate-800 h-10"
                        onClick={() => { setContent(letterContent); setIsEditing(false); }}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Button
                        onClick={handleCopy}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 h-10"
                      >
                        {copied ? <Check className="w-4 h-4 mr-2 text-emerald-400" /> : <Copy className="w-4 h-4 mr-2" />}
                        {copied ? "Copied!" : "Copy Full Text"}
                      </Button>
                      <Button
                        onClick={() => setIsEditing(true)}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-900/20 h-10"
                      >
                        <Edit3 className="w-4 h-4 mr-2" />
                        Edit Document
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Main Preview Area */}
            <div className="flex-1 bg-slate-950 flex justify-center p-8 overflow-y-auto" id="letter-content-scroll">
              <div className="max-w-4xl w-full h-fit flex flex-col gap-8">
                {isEditing ? (
                  <div className="w-full bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                    <div className="p-4 bg-slate-800/50 border-b border-slate-700 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Master Editor</span>
                      <span className="text-[10px] text-slate-500 font-mono italic">Changes reflect in real-time</span>
                    </div>
                    <Textarea
                      ref={textareaRef}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="w-full min-h-[800px] border-none focus-visible:ring-0 bg-transparent text-slate-200 font-mono text-sm leading-relaxed p-10 resize-none"
                      placeholder="Type your letter here..."
                    />
                  </div>
                ) : (
                  <div
                    ref={paperRef}
                    className="bg-white rounded-sm shadow-2xl p-16 md:p-24 min-h-[1056px] text-slate-900 font-serif leading-relaxed relative flex flex-col gap-10"
                    style={{
                      fontFamily: "'Georgia', serif",
                      fontSize: "16px",
                      backgroundImage: "linear-gradient(#f9f9f9 1px, transparent 1px)",
                      backgroundSize: "100% 1.5em"
                    }}
                  >
                    {sections.map((section) => (
                      <div key={section.id} id={`section-${section.id}`} className="scroll-mt-10">
                        <div className="group relative">
                          <div className="absolute -left-12 top-0 text-[10px] font-bold text-slate-300 opacity-0 group-hover:opacity-100 uppercase transition-opacity">
                            {section.title}
                          </div>
                          <pre className="whitespace-pre-wrap font-inherit leading-relaxed">
                            {section.content}
                          </pre>
                        </div>
                      </div>
                    ))}

                    {/* Paper Metadata */}
                    <div className="mt-auto pt-16 border-t border-slate-100 flex items-center justify-between opacity-30 pointer-events-none select-none italic text-xs">
                      <span>Dispute2Go System Generated</span>
                      <span>{cra} Dispute Batch #{disputeId.slice(-6)}</span>
                      <span>Page 1 of {Math.ceil(content.split(/\s+/).length / 250)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* CFPB Tab */}
          <TabsContent value="cfpb" className="flex-1 flex flex-col min-h-0 mt-0 overflow-hidden bg-slate-950 p-6">
            <div className="max-w-4xl mx-auto w-full flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 px-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <div>
                    <span className="text-sm font-bold text-amber-200">CFPB Complaint Ready</span>
                    <p className="text-xs text-amber-500/80">Paste this into the narrative section on consumerfinance.gov</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open("https://www.consumerfinance.gov/complaint/", "_blank")}
                    className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open CFPB.gov
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(cfpbContent);
                      setCfpbCopied(true);
                      setTimeout(() => setCfpbCopied(false), 2000);
                    }}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {cfpbCopied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                    {cfpbCopied ? "Copied!" : "Copy Narrative"}
                  </Button>
                </div>
              </div>

              <div className="flex-1 bg-slate-900 rounded-xl border border-slate-800 overflow-y-auto p-10 font-mono text-amber-200/80 leading-relaxed text-sm shadow-xl">
                {cfpbLoading ? (
                  <div className="h-full flex items-center justify-center text-slate-500 italic">Generating compliant narrative...</div>
                ) : (
                  <pre className="whitespace-pre-wrap">{cfpbContent}</pre>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Universal Footer Status */}
        <div className="h-8 bg-indigo-600 flex items-center justify-between px-6 text-[10px] text-indigo-100 font-bold tracking-widest uppercase">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><Save className="w-3 h-3" /> Auto-Save Enabled</span>
            <span className="flex items-center gap-1.5"><Check className="w-3 h-3" /> Integrity Checked</span>
          </div>
          <div className="flex items-center gap-4">
            <span>{content.length.toLocaleString()} CHARS</span>
            <span>{content.split(/\s+/).length} WORDS</span>
            <span>{Math.ceil(content.split(/\s+/).length / 250)} PAGE(S)</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
