/**
 * SENTRY DISPUTE - CLIENT BUILDER PAGE
 *
 * Main Sentry Dispute builder for a specific client.
 * Uses the SentryDisputePage component for the UI.
 */

import { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { SentryDisputePage } from "@/components/sentry";

interface PageProps {
  params: {
    clientId: string;
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.organizationId) {
    return { title: "Sentry Dispute | Dispute2Go" };
  }

  const client = await prisma.client.findFirst({
    where: {
      id: params.clientId,
      organizationId: session.user.organizationId,
    },
    select: {
      firstName: true,
      lastName: true,
    },
  });

  if (!client) {
    return { title: "Client Not Found | Dispute2Go" };
  }

  return {
    title: `Sentry Dispute - ${client.firstName} ${client.lastName} | Dispute2Go`,
    description: `Create a Sentry dispute for ${client.firstName} ${client.lastName}`,
  };
}

async function validateClient(clientId: string, organizationId: string) {
  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      organizationId,
      isActive: true,
      archivedAt: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      _count: {
        select: {
          accounts: true,
        },
      },
    },
  });

  return client;
}

export default async function SentryClientPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  const client = await validateClient(params.clientId, session.user.organizationId);

  if (!client) {
    notFound();
  }

  // Check if client has accounts
  if (client._count.accounts === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <a
            href="/sentry"
            className="text-sm text-slate-400 hover:text-slate-300 flex items-center gap-1 mb-4"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Sentry
          </a>
          <h1 className="text-2xl font-bold text-slate-200">
            Sentry Dispute - {client.firstName} {client.lastName}
          </h1>
        </div>

        {/* No accounts message */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-12 text-center">
          <svg
            className="w-16 h-16 text-slate-600 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h2 className="text-lg font-semibold text-slate-200 mb-2">No Accounts Found</h2>
          <p className="text-slate-400 mb-6">
            This client doesn't have any credit report accounts yet.
            Upload a credit report to get started.
          </p>
          <a
            href={`/clients/${client.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Go to Client Profile
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Back link */}
      <a
        href="/sentry"
        className="text-sm text-slate-400 hover:text-slate-300 flex items-center gap-1 mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Sentry
      </a>

      {/* Main component */}
      <SentryDisputePage clientId={params.clientId} />
    </div>
  );
}
