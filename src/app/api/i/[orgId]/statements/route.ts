import { NextResponse } from "next/server";

import { getInvestorStatements } from "@/lib/investors";

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { orgId } = await params;
  const { searchParams } = new URL(request.url);

  const limitParam = searchParams.get("limit");
  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
  const limit =
    parsedLimit !== undefined && !Number.isNaN(parsedLimit) && parsedLimit > 0
      ? parsedLimit
      : undefined;

  const offsetParam = searchParams.get("offset");
  const parsedOffset = offsetParam ? Number.parseInt(offsetParam, 10) : undefined;
  const offset =
    parsedOffset !== undefined && !Number.isNaN(parsedOffset) && parsedOffset >= 0
      ? parsedOffset
      : undefined;

  const page =
    limit !== undefined && offset !== undefined
      ? Math.floor(offset / limit) + 1
      : undefined;

  const startPeriod = searchParams.get("from") ?? undefined;
  const endPeriod = searchParams.get("to") ?? undefined;

  const statements = await getInvestorStatements(orgId, {
    pageSize: limit,
    page,
    startPeriod,
    endPeriod,
  });

  return NextResponse.json({ items: statements });
}
