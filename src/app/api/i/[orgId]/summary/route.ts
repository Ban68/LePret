import { NextResponse } from "next/server";

import { getInvestorSummary } from "@/lib/investors";

interface RouteContext {
  params: {
    orgId: string;
  };
}

export async function GET(_: Request, { params }: RouteContext) {
  const summary = await getInvestorSummary(params.orgId);

  return NextResponse.json(summary);
}
