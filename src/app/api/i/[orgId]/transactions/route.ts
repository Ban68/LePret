import { NextResponse } from "next/server";

import { getInvestorTransactions } from "@/lib/investors";

export async function GET(
  _: Request,
  { params }: { params: { orgId: string } }
) {
  const transactions = await getInvestorTransactions(params.orgId);

  return NextResponse.json({ items: transactions });
}
