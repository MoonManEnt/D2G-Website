import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileStack, AlertTriangle, CheckCircle, Clock } from "lucide-react";

async function getAccountItems(organizationId: string) {
  return prisma.accountItem.findMany({
    where: { organizationId },
    include: {
      client: { select: { firstName: true, lastName: true } },
      report: { select: { reportDate: true } },
    },
    orderBy: [
      { isConfirmed: "asc" },
      { confidenceLevel: "asc" },
      { createdAt: "desc" },
    ],
    take: 100,
  });
}

export default async function LedgerPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const accounts = await getAccountItems(session.user.organizationId);

  const needsReview = accounts.filter(a => !a.isConfirmed && a.confidenceLevel === "LOW");
  const confirmed = accounts.filter(a => a.isConfirmed);

  const getConfidenceBadge = (level: string, isConfirmed: boolean) => {
    if (isConfirmed) {
      return <Badge className="bg-green-500/20 text-green-400">Confirmed</Badge>;
    }
    switch (level) {
      case "HIGH":
        return <Badge className="bg-emerald-500/20 text-emerald-400">High</Badge>;
      case "MEDIUM":
        return <Badge className="bg-amber-500/20 text-amber-400">Medium</Badge>;
      case "LOW":
        return <Badge className="bg-red-500/20 text-red-400">Needs Review</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getCRABadge = (cra: string) => {
    const colors: Record<string, string> = {
      EXPERIAN: "bg-blue-500/20 text-blue-400",
      EQUIFAX: "bg-red-500/20 text-red-400",
      TRANSUNION: "bg-purple-500/20 text-purple-400",
    };
    return <Badge className={colors[cra] || "bg-slate-500/20"}>{cra}</Badge>;
  };

  return (
    <div className="space-y-6 lg:ml-64 pt-16 lg:pt-0">
      <div>
        <h1 className="text-2xl font-bold text-white">Account Ledger</h1>
        <p className="text-slate-400 mt-1">Review and manage parsed account items</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-red-500/10">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{needsReview.length}</p>
              <p className="text-sm text-slate-400">Needs Review</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-green-500/10">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{confirmed.length}</p>
              <p className="text-sm text-slate-400">Confirmed</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-blue-500/10">
              <FileStack className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{accounts.length}</p>
              <p className="text-sm text-slate-400">Total Accounts</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Needs Review Section */}
      {needsReview.length > 0 && (
        <Card className="bg-amber-500/10 border-amber-500/20">
          <CardHeader>
            <CardTitle className="text-amber-200 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Accounts Needing Review
            </CardTitle>
            <CardDescription className="text-amber-300/70">
              These accounts have low parse confidence and require specialist confirmation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {needsReview.slice(0, 5).map((account) => (
                <div
                  key={account.id}
                  className="p-4 bg-slate-800/50 rounded-lg border border-slate-700"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">{account.creditorName}</p>
                      <p className="text-sm text-slate-400">
                        {account.client.firstName} {account.client.lastName} • {account.maskedAccountId}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getCRABadge(account.cra)}
                      {getConfidenceBadge(account.confidenceLevel, account.isConfirmed)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Accounts */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">All Accounts</CardTitle>
          <CardDescription className="text-slate-400">
            Complete ledger of parsed account items
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-12">
              <FileStack className="w-12 h-12 mx-auto text-slate-600" />
              <p className="text-slate-400 mt-4">No accounts found</p>
              <p className="text-sm text-slate-500">Upload a credit report to populate the ledger</p>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="p-4 bg-slate-700/30 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">{account.creditorName}</p>
                        {account.assignedFlow && (
                          <Badge variant="outline" className="text-xs">
                            {account.assignedFlow} R{account.currentRound}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-400 mt-1">
                        {account.client.firstName} {account.client.lastName} • {account.maskedAccountId}
                      </p>
                      {account.balance && (
                        <p className="text-sm text-slate-500 mt-1">
                          Balance: ${Number(account.balance).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {getCRABadge(account.cra)}
                      {getConfidenceBadge(account.confidenceLevel, account.isConfirmed)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
