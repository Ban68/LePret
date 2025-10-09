import { NextResponse } from "next/server";

import { getInvestorPositions } from "@/lib/investors";

interface RouteContext {
  params: {
    orgId: string;
  };
}

export async function GET(_: Request, { params }: RouteContext) {
  const positions = await getInvestorPositions(params.orgId);

  return NextResponse.json({ items: positions });
}
