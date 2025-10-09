import { NextResponse } from "next/server";

import { getInvestorStatements } from "@/lib/investors";

interface RouteContext {
  params: {
    orgId: string;
  };
}

export async function GET(_: Request, { params }: RouteContext) {
  const statements = await getInvestorStatements(params.orgId);

  return NextResponse.json({ items: statements });
}
