"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/lib/use-toast";
import { Loader2 } from "lucide-react";

interface AddScoreModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  onScoreAdded: () => void;
}

const CRAS = ["TRANSUNION", "EXPERIAN", "EQUIFAX"] as const;
const SCORE_TYPES = ["VANTAGE3", "VANTAGE4", "FICO8", "FICO9"] as const;

export function AddScoreModal({
  open,
  onOpenChange,
  clientId,
  onScoreAdded,
}: AddScoreModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    cra: "TRANSUNION" as (typeof CRAS)[number],
    score: "",
    scoreDate: new Date().toISOString().split("T")[0],
    scoreType: "VANTAGE3" as (typeof SCORE_TYPES)[number],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const score = parseInt(formData.score);
    if (isNaN(score) || score < 300 || score > 850) {
      toast({
        title: "Invalid Score",
        description: "Score must be between 300 and 850",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/clients/${clientId}/scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cra: formData.cra,
          score,
          scoreDate: formData.scoreDate,
          scoreType: formData.scoreType,
          source: "MANUAL",
        }),
      });

      if (res.ok) {
        toast({
          title: "Score Added",
          description: `${formData.cra} score of ${score} has been recorded.`,
        });
        onScoreAdded();
        onOpenChange(false);
        setFormData({
          cra: "TRANSUNION",
          score: "",
          scoreDate: new Date().toISOString().split("T")[0],
          scoreType: "VANTAGE3",
        });
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to add score");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add score",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Quick add for all three bureaus
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkScores, setBulkScores] = useState({
    TRANSUNION: "",
    EXPERIAN: "",
    EQUIFAX: "",
  });

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const results = { success: 0, failed: 0 };

    for (const cra of CRAS) {
      const score = parseInt(bulkScores[cra]);
      if (isNaN(score) || score < 300 || score > 850) continue;

      try {
        const res = await fetch(`/api/clients/${clientId}/scores`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cra,
            score,
            scoreDate: formData.scoreDate,
            scoreType: formData.scoreType,
            source: "MANUAL",
          }),
        });

        if (res.ok) {
          results.success++;
        } else {
          results.failed++;
        }
      } catch {
        results.failed++;
      }
    }

    setLoading(false);

    if (results.success > 0) {
      toast({
        title: "Scores Added",
        description: `${results.success} score(s) recorded${
          results.failed > 0 ? `, ${results.failed} failed` : ""
        }`,
      });
      onScoreAdded();
      onOpenChange(false);
      setBulkScores({ TRANSUNION: "", EXPERIAN: "", EQUIFAX: "" });
    } else {
      toast({
        title: "Error",
        description: "No valid scores to add",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Add Credit Score</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Record a new credit score for this client
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Button
            variant={bulkMode ? "outline" : "default"}
            size="sm"
            onClick={() => setBulkMode(false)}
            className={!bulkMode ? "bg-primary" : "border-input text-muted-foreground"}
          >
            Single Score
          </Button>
          <Button
            variant={bulkMode ? "default" : "outline"}
            size="sm"
            onClick={() => setBulkMode(true)}
            className={bulkMode ? "bg-primary" : "border-input text-muted-foreground"}
          >
            All Bureaus
          </Button>
        </div>

        {bulkMode ? (
          <form onSubmit={handleBulkSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {CRAS.map((cra) => (
                <div key={cra} className="space-y-2">
                  <Label className="text-muted-foreground text-xs">{cra}</Label>
                  <Input
                    type="number"
                    min={300}
                    max={850}
                    placeholder="---"
                    value={bulkScores[cra]}
                    onChange={(e) =>
                      setBulkScores({ ...bulkScores, [cra]: e.target.value })
                    }
                    className="bg-muted border-input text-foreground text-center"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Date</Label>
                <Input
                  type="date"
                  value={formData.scoreDate}
                  onChange={(e) =>
                    setFormData({ ...formData, scoreDate: e.target.value })
                  }
                  className="bg-muted border-input text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Score Type</Label>
                <Select
                  value={formData.scoreType}
                  onValueChange={(v) =>
                    setFormData({ ...formData, scoreType: v as typeof formData.scoreType })
                  }
                >
                  <SelectTrigger className="bg-muted border-input text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {SCORE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-muted-foreground"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Add Scores
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Credit Bureau</Label>
                <Select
                  value={formData.cra}
                  onValueChange={(v) =>
                    setFormData({ ...formData, cra: v as typeof formData.cra })
                  }
                >
                  <SelectTrigger className="bg-muted border-input text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {CRAS.map((cra) => (
                      <SelectItem key={cra} value={cra}>
                        {cra}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Score</Label>
                <Input
                  type="number"
                  min={300}
                  max={850}
                  placeholder="300-850"
                  value={formData.score}
                  onChange={(e) => setFormData({ ...formData, score: e.target.value })}
                  className="bg-muted border-input text-foreground"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Date</Label>
                <Input
                  type="date"
                  value={formData.scoreDate}
                  onChange={(e) =>
                    setFormData({ ...formData, scoreDate: e.target.value })
                  }
                  className="bg-muted border-input text-foreground"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Score Type</Label>
                <Select
                  value={formData.scoreType}
                  onValueChange={(v) =>
                    setFormData({ ...formData, scoreType: v as typeof formData.scoreType })
                  }
                >
                  <SelectTrigger className="bg-muted border-input text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {SCORE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-muted-foreground"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Add Score
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
