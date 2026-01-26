/**
 * SENTRY DISPUTE - CLIENT LIST PAGE
 *
 * Lists all clients with options to start Sentry disputes.
 * This is the entry point to the Sentry Dispute system.
 */

import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sentry Dispute | Dispute2Go",
  description: "Advanced dispute intelligence system",
};

async function getClients(organizationId: string) {
  const clients = await prisma.client.findMany({
    where: {
      organizationId,
      isActive: true,
      archivedAt: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      stage: true,
      currentRound: true,
      _count: {
        select: {
          accounts: true,
          sentryDisputes: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return clients;
}

async function getSentryStats(organizationId: string) {
  const [total, draft, sent, resolved] = await Promise.all([
    prisma.sentryDispute.count({ where: { organizationId } }),
    prisma.sentryDispute.count({ where: { organizationId, status: "DRAFT" } }),
    prisma.sentryDispute.count({ where: { organizationId, status: "SENT" } }),
    prisma.sentryDispute.count({ where: { organizationId, status: "RESOLVED" } }),
  ]);

  return { total, draft, sent, resolved };
}

export default async function SentryPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  const [clients, stats] = await Promise.all([
    getClients(session.user.organizationId),
    getSentryStats(session.user.organizationId),
  ]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-200">Sentry Dispute</h1>
          <p className="text-slate-400 mt-1">
            Advanced dispute intelligence with e-OSCAR optimization
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 text-xs bg-emerald-500/20 text-emerald-400 rounded-lg">
            Sentry Engine v1.0
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
          <div className="text-2xl font-bold text-slate-200">{stats.total}</div>
          <div className="text-xs text-slate-400">Total Disputes</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
          <div className="text-2xl font-bold text-slate-400">{stats.draft}</div>
          <div className="text-xs text-slate-400">Drafts</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
          <div className="text-2xl font-bold text-amber-400">{stats.sent}</div>
          <div className="text-xs text-slate-400">Sent</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
          <div className="text-2xl font-bold text-emerald-400">{stats.resolved}</div>
          <div className="text-xs text-slate-400">Resolved</div>
        </div>
      </div>

      {/* Feature highlights */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-blue-500/20 p-6 mb-8">
        <h2 className="text-lg font-semibold text-slate-200 mb-4">Sentry Intelligence Features</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-200">e-OSCAR Optimization</div>
              <div className="text-xs text-slate-400">Strategic code selection</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-200">OCR Safety</div>
              <div className="text-xs text-slate-400">Avoid frivolous flags</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-200">Citation Validation</div>
              <div className="text-xs text-slate-400">Verified legal accuracy</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-200">Metro 2 Targeting</div>
              <div className="text-xs text-slate-400">Field-level disputes</div>
            </div>
          </div>
        </div>
      </div>

      {/* Client list */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50">
        <div className="p-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-slate-200">Select a Client</h2>
          <p className="text-sm text-slate-400">Choose a client to start a Sentry dispute</p>
        </div>

        {clients.length > 0 ? (
          <div className="divide-y divide-slate-700/50">
            {clients.map((client) => (
              <Link
                key={client.id}
                href={`/sentry/${client.id}`}
                className="flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center text-slate-300 font-medium">
                    {client.firstName[0]}{client.lastName[0]}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-200">
                      {client.firstName} {client.lastName}
                    </div>
                    <div className="text-xs text-slate-400">
                      {client._count.accounts} accounts • {client._count.sentryDisputes} Sentry disputes
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 text-xs rounded ${
                    client.stage === "ACTIVE" ? "bg-emerald-500/20 text-emerald-400" :
                    client.stage === "DISPUTING" ? "bg-amber-500/20 text-amber-400" :
                    "bg-slate-500/20 text-slate-400"
                  }`}>
                    {client.stage}
                  </span>
                  <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <svg className="w-12 h-12 text-slate-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-slate-400 mb-4">No clients found</p>
            <Link
              href="/clients/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Add Your First Client
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
