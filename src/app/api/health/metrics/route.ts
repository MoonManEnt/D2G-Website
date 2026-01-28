import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { getMetricsSummary } from "@/lib/performance";

export const GET = withAuth(async () => {
  const summary = getMetricsSummary();

  if (!summary) {
    return NextResponse.json({ message: "No metrics collected yet" });
  }

  return NextResponse.json(summary);
}, { roles: ["ADMIN"] });
