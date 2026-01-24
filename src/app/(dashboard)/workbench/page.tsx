"use client"

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Loader2,
    AlertCircle,
    PlayCircle,
    Clock,
    CheckCircle2,
    ArrowRight,
    TrendingUp,
    Inbox
} from "lucide-react";

interface WorkbenchClient {
    id: string;
    name: string;
    stats: {
        readyItems: number;
        activeDisputes: number;
        needsResponse: number;
        totalResolved: number;
    };
    urgentActions: Array<{
        id: string;
        cra: string;
        round: number;
        reason: string;
    }>;
}

interface WorkbenchData {
    clients: WorkbenchClient[];
    summary: {
        totalReady: number;
        totalNeedsResponse: number;
        totalActive: number;
    };
}

export default function WorkbenchPage() {
    const router = useRouter();
    const [data, setData] = useState<WorkbenchData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/workbench/summary")
            .then((res) => res.json())
            .then((data) => {
                setData(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="space-y-6 pt-2">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">My Workbench</h1>
                <p className="text-muted-foreground">
                    Global overview of all dispute operations and actionable items.
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-gradient-to-br from-red-900/10 to-transparent border-red-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-red-500">
                            Needs Response
                        </CardTitle>
                        <AlertCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{data.summary.totalNeedsResponse}</div>
                        <p className="text-xs text-muted-foreground">
                            Overdue or responded disputes
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-900/10 to-transparent border-blue-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-blue-500">
                            Ready for Dispute
                        </CardTitle>
                        <PlayCircle className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{data.summary.totalReady}</div>
                        <p className="text-xs text-muted-foreground">
                            Negative items waiting for action
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-900/10 to-transparent border-amber-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-amber-500">
                            Active Disputes
                        </CardTitle>
                        <Clock className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{data.summary.totalActive}</div>
                        <p className="text-xs text-muted-foreground">
                            Currently in process with bureaus
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Active Work Queue */}
            <Card className="border-slate-800 bg-slate-900/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Inbox className="w-5 h-5 text-primary" />
                        Global Work Queue
                    </CardTitle>
                    <CardDescription>
                        Prioritized list of clients requiring attention.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow className="border-slate-800 hover:bg-slate-800/50">
                                <TableHead className="text-slate-400">Client Name</TableHead>
                                <TableHead className="text-center text-slate-400">Urgent Issues</TableHead>
                                <TableHead className="text-center text-slate-400">Ready for Round 1</TableHead>
                                <TableHead className="text-center text-slate-400">Active Rounds</TableHead>
                                <TableHead className="text-right text-slate-400">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.clients.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        No active clients found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                data.clients.map((client) => (
                                    <TableRow key={client.id} className="border-slate-800 hover:bg-slate-800/50">
                                        <TableCell className="font-medium text-white">
                                            {client.name}
                                        </TableCell>

                                        <TableCell className="text-center">
                                            {client.stats.needsResponse > 0 ? (
                                                <Badge className="bg-red-500/20 text-red-500 hover:bg-red-500/30 border-red-500/20">
                                                    {client.stats.needsResponse} Attention
                                                </Badge>
                                            ) : (
                                                <span className="text-slate-600">-</span>
                                            )}
                                        </TableCell>

                                        <TableCell className="text-center">
                                            {client.stats.readyItems > 0 ? (
                                                <Badge className="bg-blue-500/20 text-blue-500 hover:bg-blue-500/30 border-blue-500/20 transition-all">
                                                    {client.stats.readyItems} Items
                                                </Badge>
                                            ) : (
                                                <span className="text-slate-600">All Clear</span>
                                            )}
                                        </TableCell>

                                        <TableCell className="text-center">
                                            <span className="text-slate-400 font-mono">
                                                {client.stats.activeDisputes}
                                            </span>
                                        </TableCell>

                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                {client.stats.readyItems > 0 && (
                                                    <Button
                                                        size="sm"
                                                        variant="default"
                                                        className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
                                                        onClick={() => router.push(`/negative-items?clientId=${client.id}`)}
                                                    >
                                                        Start Dispute <ArrowRight className="w-3 h-3 ml-1" />
                                                    </Button>
                                                )}
                                                {client.stats.needsResponse > 0 && (
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        className="h-8 text-xs"
                                                        onClick={() => router.push(`/disputes?clientId=${client.id}`)}
                                                    >
                                                        Resolve Issues
                                                    </Button>
                                                )}
                                                {client.stats.readyItems === 0 && client.stats.needsResponse === 0 && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 text-xs text-slate-500"
                                                        onClick={() => router.push(`/clients/${client.id}`)}
                                                    >
                                                        View Client
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
