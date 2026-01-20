"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/lib/use-toast";

interface AddReminderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId?: string;
  disputeId?: string;
  onReminderAdded: () => void;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
}

interface Dispute {
  id: string;
  cra: string;
}

const REMINDER_TYPES = [
  { value: "FOLLOW_UP", label: "Follow-up" },
  { value: "DEADLINE", label: "Deadline" },
  { value: "DOCUMENT_REQUEST", label: "Document Request" },
  { value: "RESPONSE_DUE", label: "Response Due" },
  { value: "SCORE_CHECK", label: "Credit Score Check" },
  { value: "CUSTOM", label: "Custom" },
];

const REPEAT_OPTIONS = [
  { value: "NONE", label: "Does not repeat" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
];

export function AddReminderModal({
  open,
  onOpenChange,
  clientId: initialClientId,
  disputeId: initialDisputeId,
  onReminderAdded,
}: AddReminderModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingDisputes, setLoadingDisputes] = useState(false);

  const [formData, setFormData] = useState({
    clientId: initialClientId || "",
    disputeId: initialDisputeId || "",
    reminderType: "FOLLOW_UP",
    title: "",
    description: "",
    scheduledFor: "",
    scheduledTime: "09:00",
    repeatInterval: "NONE",
  });

  // Fetch clients if no initial clientId
  useEffect(() => {
    if (open && !initialClientId) {
      setLoadingClients(true);
      fetch("/api/clients?limit=100")
        .then((res) => res.json())
        .then((data) => {
          setClients(data.clients || []);
        })
        .catch(console.error)
        .finally(() => setLoadingClients(false));
    }
  }, [open, initialClientId]);

  // Fetch disputes for selected client
  useEffect(() => {
    if (formData.clientId && !initialDisputeId) {
      setLoadingDisputes(true);
      fetch(`/api/disputes?clientId=${formData.clientId}`)
        .then((res) => res.json())
        .then((data) => {
          setDisputes(data.disputes || []);
        })
        .catch(console.error)
        .finally(() => setLoadingDisputes(false));
    }
  }, [formData.clientId, initialDisputeId]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setFormData({
        clientId: initialClientId || "",
        disputeId: initialDisputeId || "",
        reminderType: "FOLLOW_UP",
        title: "",
        description: "",
        scheduledFor: new Date().toISOString().split("T")[0],
        scheduledTime: "09:00",
        repeatInterval: "NONE",
      });
    }
  }, [open, initialClientId, initialDisputeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.clientId) {
      toast({ title: "Error", description: "Please select a client", variant: "destructive" });
      return;
    }

    if (!formData.title.trim()) {
      toast({ title: "Error", description: "Please enter a title", variant: "destructive" });
      return;
    }

    if (!formData.scheduledFor) {
      toast({ title: "Error", description: "Please select a date", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      // Combine date and time
      const scheduledDateTime = new Date(
        `${formData.scheduledFor}T${formData.scheduledTime}:00`
      ).toISOString();

      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: formData.clientId,
          disputeId: formData.disputeId || undefined,
          reminderType: formData.reminderType,
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          scheduledFor: scheduledDateTime,
          repeatInterval: formData.repeatInterval,
        }),
      });

      if (res.ok) {
        toast({ title: "Reminder Created", description: "Your reminder has been scheduled." });
        onReminderAdded();
        onOpenChange(false);
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.error || "Failed to create reminder",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Error", description: "An error occurred", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">Add Reminder</DialogTitle>
          <DialogDescription className="text-slate-400">
            Schedule a reminder for client follow-up
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client Selection */}
          {!initialClientId && (
            <div className="space-y-2">
              <Label className="text-slate-300">Client</Label>
              <Select
                value={formData.clientId}
                onValueChange={(v) => setFormData({ ...formData, clientId: v, disputeId: "" })}
              >
                <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                  <SelectValue placeholder={loadingClients ? "Loading..." : "Select client"} />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.firstName} {client.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Dispute Selection (optional) */}
          {!initialDisputeId && formData.clientId && disputes.length > 0 && (
            <div className="space-y-2">
              <Label className="text-slate-300">Related Dispute (Optional)</Label>
              <Select
                value={formData.disputeId}
                onValueChange={(v) => setFormData({ ...formData, disputeId: v })}
              >
                <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                  <SelectValue placeholder={loadingDisputes ? "Loading..." : "Select dispute"} />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="">No dispute</SelectItem>
                  {disputes.map((dispute) => (
                    <SelectItem key={dispute.id} value={dispute.id}>
                      {dispute.cra} Dispute
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Reminder Type */}
          <div className="space-y-2">
            <Label className="text-slate-300">Type</Label>
            <Select
              value={formData.reminderType}
              onValueChange={(v) => setFormData({ ...formData, reminderType: v })}
            >
              <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {REMINDER_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label className="text-slate-300">Title</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Follow up on dispute status"
              className="bg-slate-700/50 border-slate-600 text-white"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-slate-300">Description (Optional)</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Additional notes..."
              className="bg-slate-700/50 border-slate-600 text-white resize-none"
              rows={2}
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Date</Label>
              <Input
                type="date"
                value={formData.scheduledFor}
                onChange={(e) => setFormData({ ...formData, scheduledFor: e.target.value })}
                className="bg-slate-700/50 border-slate-600 text-white"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Time</Label>
              <Input
                type="time"
                value={formData.scheduledTime}
                onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                className="bg-slate-700/50 border-slate-600 text-white"
                required
              />
            </div>
          </div>

          {/* Repeat */}
          <div className="space-y-2">
            <Label className="text-slate-300">Repeat</Label>
            <Select
              value={formData.repeatInterval}
              onValueChange={(v) => setFormData({ ...formData, repeatInterval: v })}
            >
              <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {REPEAT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-slate-400"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Reminder
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
