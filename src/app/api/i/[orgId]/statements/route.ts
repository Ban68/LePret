import { NextResponse } from "next/server";

import { getInvestorStatements } from "@/lib/investors";

export async function GET(
  _: Request,
  { params }: { params: { orgId: string } }
) {
  const statements = await getInvestorStatements(params.orgId);

  return NextResponse.json({ items: statements });
}
