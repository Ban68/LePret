import { NextResponse } from "next/server";

import { getInvestorTransactions } from "@/lib/investors";

interface RouteContext {
  params: {
    orgId: string;
  };
}

export async function GET(_: Request, { params }: RouteContext) {
  const transactions = await getInvestorTransactions(params.orgId);

  return NextResponse.json({ items: transactions });
}
