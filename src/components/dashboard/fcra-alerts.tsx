"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Clock,
  Loader2,
  ChevronRight,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Bell,
} from "lucide-react";
import Link from "next/link";
import { createLogger } from "@/lib/logger";
const log = createLogger("fcra-alerts");

interface FCRAAlert {
  id: string;
  cra: string;
  clientName: string;
  clientId: string;
  sentDate: string;
  daysRemaining: number;
  isOverdue: boolean;
  round: number;
  itemCount: number;
}

interface FCRAAlertsSummary {
  overdue: FCRAAlert[];
  approaching: FCRAAlert[];
  totalOverdue: number;
  totalApproaching: number;
}

export function FCRAAlerts() {
  const [alerts, setAlerts] = useState<FCRAAlertsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function fetchAlerts() {
      try {
        setLoading(true);
        const res = await fetch("/api/disputes?status=SENT");
        if (res.ok) {
          const data = await res.json();

          const now = new Date();
          const overdue: FCRAAlert[] = [];
          const approaching: FCRAAlert[] = [];

          // Process disputes to calculate FCRA deadlines
          for (const dispute of data.disputes || []) {
            if (!dispute.sentAt) continue;

            const sentDate = new Date(dispute.sentAt);
            const deadlineDate = new Date(sentDate);
            deadlineDate.setDate(deadlineDate.getDate() + 30);

            const daysRemaining = Math.ceil(
              (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );

            const alert: FCRAAlert = {
              id: dispute.id,
              cra: dispute.cra,
              clientName: `${dispute.client.firstName} ${dispute.client.lastName}`,
              clientId: dispute.client.id,
              sentDate: dispute.sentAt,
              daysRemaining,
              isOverdue: daysRemaining < 0,
              round: dispute.round,
              itemCount: dispute._count?.items || 0,
            };

            if (daysRemaining < 0) {
              overdue.push(alert);
            } else if (daysRemaining <= 5) {
              approaching.push(alert);
            }
          }

          // Sort by urgency
          overdue.sort((a, b) => a.daysRemaining - b.daysRemaining);
          approaching.sort((a, b) => a.daysRemaining - b.daysRemaining);

          setAlerts({
            overdue,
            approaching,
            totalOverdue: overdue.length,
            totalApproaching: approaching.length,
          });
        }
      } catch (error) {
        log.error({ err: error }, "Failed to fetch FCRA alerts");
      } finally {
        setLoading(false);
      }
    }

    fetchAlerts();
  }, []);

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!alerts || (alerts.totalOverdue === 0 && alerts.totalApproaching === 0)) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-green-400">
            <CheckCircle className="w-5 h-5" />
            <div>
              <p className="font-medium">All FCRA Deadlines Met</p>
              <p className="text-sm text-muted-foreground">
                No disputes are approaching or past the 30-day deadline
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getCRAColor = (cra: string) => {
    const colors: Record<string, string> = {
      TRANSUNION: "bg-sky-600/20 text-sky-400 border-sky-600/30",
      EXPERIAN: "bg-primary/20 text-primary border-blue-600/30",
      EQUIFAX: "bg-red-600/20 text-red-400 border-red-600/30",
    };
    return colors[cra] || "bg-muted text-muted-foreground border-border";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card
        className={`overflow-hidden ${
          alerts.totalOverdue > 0
            ? "bg-red-500/10 border-red-500/30"
            : "bg-amber-500/10 border-amber-500/30"
        }`}
      >
        {/* Animated background */}
        <motion.div
          className={`absolute inset-0 ${
            alerts.totalOverdue > 0
              ? "bg-gradient-to-r from-red-500/5 to-transparent"
              : "bg-gradient-to-r from-amber-500/5 to-transparent"
          }`}
          animate={{
            x: ["-100%", "100%"],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear",
          }}
        />

        <CardHeader className="relative pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground flex items-center gap-2">
              {alerts.totalOverdue > 0 ? (
                <ShieldAlert className="w-5 h-5 text-red-400" />
              ) : (
                <Clock className="w-5 h-5 text-amber-400" />
              )}
              FCRA Compliance Alerts
            </CardTitle>
            <div className="flex items-center gap-2">
              {alerts.totalOverdue > 0 && (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                  {alerts.totalOverdue} Overdue
                </Badge>
              )}
              {alerts.totalApproaching > 0 && (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                  {alerts.totalApproaching} Approaching
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative space-y-4">
          {/* Summary message */}
          <div
            className={`p-3 rounded-lg ${
              alerts.totalOverdue > 0
                ? "bg-red-500/10 border border-red-500/20"
                : "bg-amber-500/10 border border-amber-500/20"
            }`}
          >
            {alerts.totalOverdue > 0 ? (
              <p className="text-sm text-red-300">
                <strong>{alerts.totalOverdue} dispute(s)</strong> have exceeded
                the 30-day FCRA response deadline. CRAs are in violation and you
                may demand immediate deletion or file CFPB complaints.
              </p>
            ) : (
              <p className="text-sm text-amber-300">
                <strong>{alerts.totalApproaching} dispute(s)</strong> are
                approaching the 30-day FCRA deadline. Monitor closely and
                prepare escalation if no response is received.
              </p>
            )}
          </div>

          {/* Overdue disputes */}
          {alerts.overdue.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-red-400 uppercase tracking-wider flex items-center gap-2">
                <XCircle className="w-3 h-3" />
                Overdue - FCRA Violation
              </h4>
              <div className="space-y-2">
                {alerts.overdue
                  .slice(0, expanded ? undefined : 3)
                  .map((alert) => (
                    <Link
                      key={alert.id}
                      href={`/disputes?id=${alert.id}`}
                      className="block"
                    >
                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge className={getCRAColor(alert.cra)}>
                              {alert.cra}
                            </Badge>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {alert.clientName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Round {alert.round} • {alert.itemCount} items
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm font-bold text-red-400">
                                {Math.abs(alert.daysRemaining)} days overdue
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Sent{" "}
                                {new Date(alert.sentDate).toLocaleDateString()}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      </motion.div>
                    </Link>
                  ))}
              </div>
            </div>
          )}

          {/* Approaching deadline disputes */}
          {alerts.approaching.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-3 h-3" />
                Approaching Deadline
              </h4>
              <div className="space-y-2">
                {alerts.approaching
                  .slice(0, expanded ? undefined : 2)
                  .map((alert) => (
                    <Link
                      key={alert.id}
                      href={`/disputes?id=${alert.id}`}
                      className="block"
                    >
                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge className={getCRAColor(alert.cra)}>
                              {alert.cra}
                            </Badge>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {alert.clientName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Round {alert.round} • {alert.itemCount} items
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm font-bold text-amber-400">
                                {alert.daysRemaining} day
                                {alert.daysRemaining !== 1 ? "s" : ""} left
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Deadline{" "}
                                {new Date(
                                  new Date(alert.sentDate).getTime() +
                                    30 * 24 * 60 * 60 * 1000
                                ).toLocaleDateString()}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      </motion.div>
                    </Link>
                  ))}
              </div>
            </div>
          )}

          {/* Show more/less button */}
          {(alerts.overdue.length > 3 || alerts.approaching.length > 2) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="w-full text-muted-foreground hover:text-foreground"
            >
              {expanded ? "Show Less" : "Show All Alerts"}
            </Button>
          )}

          {/* Action buttons */}
          {alerts.totalOverdue > 0 && (
            <div className="flex items-center gap-2 pt-2 border-t border-red-500/20">
              <Link href="/disputes?filter=overdue" className="flex-1">
                <Button
                  size="sm"
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  <ShieldAlert className="w-4 h-4 mr-2" />
                  View All Overdue Disputes
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
