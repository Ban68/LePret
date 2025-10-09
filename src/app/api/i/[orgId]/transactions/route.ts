import { NextResponse } from "next/server";

import { getInvestorTransactions } from "@/lib/investors";

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(_: Request, { params }: RouteContext) {
  const { orgId } = await params;
  const transactions = await getInvestorTransactions(orgId);

  return NextResponse.json({ items: transactions });
}
