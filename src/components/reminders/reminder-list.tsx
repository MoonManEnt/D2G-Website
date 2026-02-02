"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  MoreVertical,
  Plus,
  Loader2,
  User,
  FileText,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/lib/use-toast";
import { AddReminderModal } from "./add-reminder-modal";

interface Reminder {
  id: string;
  clientId: string;
  disputeId: string | null;
  reminderType: string;
  title: string;
  description: string | null;
  scheduledFor: string;
  status: string;
  repeatInterval: string;
  completedAt: string | null;
  client: {
    id: string;
    firstName: string;
    lastName: string;
  };
  dispute: {
    id: string;
    cra: string;
    disputeStatus: string;
  } | null;
}

interface ReminderStats {
  pending: number;
  completed: number;
  snoozed: number;
  overdue: number;
}

interface ReminderListProps {
  clientId?: string;
  showStats?: boolean;
  compact?: boolean;
}

const REMINDER_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  FOLLOW_UP: { label: "Follow-up", color: "bg-primary/20 text-blue-400" },
  DEADLINE: { label: "Deadline", color: "bg-red-500/20 text-red-400" },
  DOCUMENT_REQUEST: { label: "Document", color: "bg-amber-500/20 text-amber-400" },
  RESPONSE_DUE: { label: "Response Due", color: "bg-purple-500/20 text-purple-400" },
  SCORE_CHECK: { label: "Score Check", color: "bg-green-500/20 text-green-400" },
  CUSTOM: { label: "Custom", color: "bg-muted text-muted-foreground" },
};

export function ReminderList({ clientId, showStats = true, compact = false }: ReminderListProps) {
  const { toast } = useToast();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [stats, setStats] = useState<ReminderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const fetchReminders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (clientId) params.set("clientId", clientId);
      params.set("upcoming", "true");

      const res = await fetch(`/api/reminders?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReminders(data.reminders);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch reminders:", error);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const handleComplete = async (reminderId: string) => {
    try {
      const res = await fetch(`/api/reminders/${reminderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });

      if (res.ok) {
        toast({ title: "Reminder completed" });
        fetchReminders();
      } else {
        toast({ title: "Error", description: "Failed to complete reminder", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "An error occurred", variant: "destructive" });
    }
  };

  const handleSnooze = async (reminderId: string, hours: number) => {
    try {
      const newDate = new Date();
      newDate.setHours(newDate.getHours() + hours);

      const res = await fetch(`/api/reminders/${reminderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledFor: newDate.toISOString(),
          status: "PENDING",
        }),
      });

      if (res.ok) {
        toast({ title: `Reminder snoozed for ${hours} hour${hours !== 1 ? "s" : ""}` });
        fetchReminders();
      }
    } catch {
      toast({ title: "Error", description: "An error occurred", variant: "destructive" });
    }
  };

  const handleDelete = async (reminderId: string) => {
    try {
      const res = await fetch(`/api/reminders/${reminderId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast({ title: "Reminder deleted" });
        fetchReminders();
      }
    } catch {
      toast({ title: "Error", description: "An error occurred", variant: "destructive" });
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? "s" : ""} overdue`, isOverdue: true };
    }
    if (diffDays === 0) {
      return { text: "Today", isOverdue: false };
    }
    if (diffDays === 1) {
      return { text: "Tomorrow", isOverdue: false };
    }
    if (diffDays <= 7) {
      return { text: `In ${diffDays} days`, isOverdue: false };
    }
    return { text: date.toLocaleDateString(), isOverdue: false };
  };

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-8">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {showStats && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <Clock className="w-6 h-6 mx-auto text-primary" />
              <p className="text-2xl font-bold text-foreground mt-1">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <AlertTriangle className="w-6 h-6 mx-auto text-red-400" />
              <p className="text-2xl font-bold text-red-400 mt-1">{stats.overdue}</p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <CheckCircle className="w-6 h-6 mx-auto text-green-400" />
              <p className="text-2xl font-bold text-foreground mt-1">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <Bell className="w-6 h-6 mx-auto text-amber-400" />
              <p className="text-2xl font-bold text-foreground mt-1">{stats.snoozed}</p>
              <p className="text-xs text-muted-foreground">Snoozed</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Bell className="w-5 h-5" />
                {compact ? "Upcoming Reminders" : "Reminders"}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Stay on top of client follow-ups
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setAddModalOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Add Reminder
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {reminders.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="w-12 h-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground mt-2">No upcoming reminders</p>
              <Button
                variant="outline"
                className="mt-4 border-input text-muted-foreground"
                onClick={() => setAddModalOpen(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Create Reminder
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {reminders.slice(0, compact ? 5 : undefined).map((reminder) => {
                const dateInfo = formatDate(reminder.scheduledFor);
                const typeInfo = REMINDER_TYPE_LABELS[reminder.reminderType] || REMINDER_TYPE_LABELS.CUSTOM;

                return (
                  <div
                    key={reminder.id}
                    className={`p-3 rounded-lg border ${
                      dateInfo.isOverdue
                        ? "bg-red-900/20 border-red-500/30"
                        : "bg-muted border-input"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium text-foreground">{reminder.title}</span>
                          <Badge className={typeInfo.color}>{typeInfo.label}</Badge>
                          {reminder.repeatInterval !== "NONE" && (
                            <Badge className="bg-muted text-muted-foreground">
                              {reminder.repeatInterval.toLowerCase()}
                            </Badge>
                          )}
                        </div>
                        {reminder.description && (
                          <p className="text-sm text-muted-foreground mb-2">{reminder.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {reminder.client.firstName} {reminder.client.lastName}
                          </span>
                          {reminder.dispute && (
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {reminder.dispute.cra}
                            </span>
                          )}
                          <span
                            className={`flex items-center gap-1 ${
                              dateInfo.isOverdue ? "text-red-400" : ""
                            }`}
                          >
                            <Calendar className="w-3 h-3" />
                            {dateInfo.text}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                          onClick={() => handleComplete(reminder.id)}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-muted-foreground">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-card border-border">
                            <DropdownMenuItem
                              className="text-muted-foreground"
                              onClick={() => handleSnooze(reminder.id, 1)}
                            >
                              Snooze 1 hour
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-muted-foreground"
                              onClick={() => handleSnooze(reminder.id, 24)}
                            >
                              Snooze 1 day
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-muted-foreground"
                              onClick={() => handleSnooze(reminder.id, 168)}
                            >
                              Snooze 1 week
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-400"
                              onClick={() => handleDelete(reminder.id)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AddReminderModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        clientId={clientId}
        onReminderAdded={fetchReminders}
      />
    </div>
  );
}
