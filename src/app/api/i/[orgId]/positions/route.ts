import { NextResponse } from "next/server";

import { getInvestorPositions } from "@/lib/investors";

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(_: Request, { params }: RouteContext) {
  const { orgId } = await params;
  const positions = await getInvestorPositions(orgId);

  return NextResponse.json({ items: positions });
}
