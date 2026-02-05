"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock, Send, Loader2, ExternalLink, CheckCircle2 } from "lucide-react";
import { useToast } from "@/lib/use-toast";

interface EnterpriseContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EnterpriseContactModal({ open, onOpenChange }: EnterpriseContactModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [estimatedVolume, setEstimatedVolume] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const resetForm = () => {
    setName("");
    setEmail("");
    setCompany("");
    setEstimatedVolume("");
    setTeamSize("");
    setMessage("");
    setSubmitted(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setTimeout(resetForm, 300);
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/billing/enterprise-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, company, estimatedVolume, teamSize, message }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send inquiry");
      }
      setSubmitted(true);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send inquiry",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">Enterprise Solutions</DialogTitle>
          <DialogDescription>
            Let us tailor a plan for your team&apos;s needs.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="schedule" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="schedule" className="flex-1">
              <CalendarClock className="w-4 h-4 mr-2" />
              Schedule a Call
            </TabsTrigger>
            <TabsTrigger value="message" className="flex-1">
              <Send className="w-4 h-4 mr-2" />
              Send a Message
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Book a 30-minute call with our enterprise team. We&apos;ll walk through
              your requirements, discuss pricing, and answer any questions.
            </p>
            <Button
              className="w-full"
              onClick={() =>
                window.open(
                  "https://calendly.com/dispute2go/enterprise",
                  "_blank",
                  "noopener,noreferrer"
                )
              }
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Schedule via Calendly
            </Button>
          </TabsContent>

          <TabsContent value="message" className="pt-4">
            {submitted ? (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                <div className="bg-emerald-500/20 rounded-full p-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-foreground font-medium text-lg">Message Received</h3>
                <p className="text-muted-foreground text-sm max-w-xs">
                  Thank you! Our enterprise team will get back to you within 1 business day.
                </p>
                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                  Close
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ent-name">
                    Name <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="ent-name"
                    placeholder="Jane Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ent-email">
                    Email <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="ent-email"
                    type="email"
                    placeholder="jane@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ent-company">
                    Company Name <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="ent-company"
                    placeholder="Acme Credit Repair"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Monthly Volume</Label>
                    <Select value={estimatedVolume} onValueChange={setEstimatedVolume}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="under-100">Under 100</SelectItem>
                        <SelectItem value="100-500">100 - 500</SelectItem>
                        <SelectItem value="500-1000">500 - 1,000</SelectItem>
                        <SelectItem value="1000+">1,000+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Team Size</Label>
                    <Select value={teamSize} onValueChange={setTeamSize}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-5">1 - 5</SelectItem>
                        <SelectItem value="6-15">6 - 15</SelectItem>
                        <SelectItem value="16-50">16 - 50</SelectItem>
                        <SelectItem value="50+">50+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ent-message">Message (optional)</Label>
                  <Textarea
                    id="ent-message"
                    placeholder="Tell us about your needs..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Send Inquiry
                </Button>
              </form>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
