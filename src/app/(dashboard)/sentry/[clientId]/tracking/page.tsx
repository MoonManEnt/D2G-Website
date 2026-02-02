/**
 * SENTRY TRACKING PAGE
 *
 * Combined view with account tracking matrix, quick stats,
 * pending actions, and recent activity.
 */

import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { SentryTrackingClient } from "./tracking-client";

export const metadata: Metadata = {
  title: "Sentry Tracking | Dispute2Go",
  description: "Track dispute progress across all bureaus",
};

interface PageProps {
  params: Promise<{ clientId: string }>;
}

export default async function SentryTrackingPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  const { clientId } = await params;

  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  // Get client info
  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      organizationId: session.user.organizationId,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!client) {
    redirect("/sentry");
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href={`/sentry/${clientId}`}
            className="p-2 hover:bg-card rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Sentry Tracking
            </h1>
            <p className="text-muted-foreground">
              {client.firstName} {client.lastName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/sentry/${clientId}`}
            className="px-4 py-2 bg-blue-500 text-foreground rounded-lg hover:bg-primary transition-colors text-sm font-medium"
          >
            + New Dispute
          </Link>
          <span className="px-3 py-1 text-xs bg-emerald-500/20 text-emerald-400 rounded-lg">
            Sentry Engine v1.0
          </span>
        </div>
      </div>

      {/* Client Component for Interactive Features */}
      <SentryTrackingClient clientId={clientId} />
    </div>
  );
}
