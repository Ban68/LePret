import { NextResponse } from "next/server";

import { getInvestorSummary } from "@/lib/investors";

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(_: Request, { params }: RouteContext) {
  const { orgId } = await params;
  const summary = await getInvestorSummary(orgId);

  return NextResponse.json(summary);
}
