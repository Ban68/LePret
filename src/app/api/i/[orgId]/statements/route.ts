import { NextResponse } from "next/server";

import { getInvestorStatements } from "@/lib/investors";

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(_: Request, { params }: RouteContext) {
  const { orgId } = await params;
  const statements = await getInvestorStatements(orgId);

  return NextResponse.json({ items: statements });
}
