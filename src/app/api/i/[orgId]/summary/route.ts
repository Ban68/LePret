import { NextResponse } from "next/server";

import { getInvestorSummary, type InvestorTransaction } from "@/lib/investors";

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { orgId } = await params;
  const { searchParams } = new URL(request.url);

  const limitParam = searchParams.get("limit");
  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
  const upcomingLimit =
    parsedLimit !== undefined && !Number.isNaN(parsedLimit) && parsedLimit > 0
      ? parsedLimit
      : undefined;

  const typeParams = searchParams.getAll("type");
  const rawTypes = typeParams.flatMap((value) => value.split(","));
  const trimmedTypes = rawTypes
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const upcomingTypes =
    trimmedTypes.length > 0
      ? (trimmedTypes as InvestorTransaction["type"][])
      : undefined;

  const upcomingFromDate = searchParams.get("from") ?? undefined;
  const upcomingToDate = searchParams.get("to") ?? undefined;

  const summary = await getInvestorSummary(orgId, {
    upcomingLimit,
    upcomingTypes,
    upcomingFromDate,
    upcomingToDate,
  });

  return NextResponse.json(summary);
}
