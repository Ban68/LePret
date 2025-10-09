import { NextResponse } from "next/server";

import { getInvestorPositions } from "@/lib/investors";

export async function GET(
  _: Request,
  { params }: { params: { orgId: string } }
) {
  const positions = await getInvestorPositions(params.orgId);

  return NextResponse.json({ items: positions });
}
