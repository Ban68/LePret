import { NextResponse } from "next/server";

import { getInvestorSummary } from "@/lib/investors";

export async function GET(
  _: Request,
  { params }: { params: { orgId: string } }
) {
  const summary = await getInvestorSummary(params.orgId);

  return NextResponse.json(summary);
}
