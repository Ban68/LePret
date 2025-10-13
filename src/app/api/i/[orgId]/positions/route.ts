import { NextResponse } from "next/server";

import { getInvestorPositions } from "@/lib/investors";

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
      : 0;

  const positions = await getInvestorPositions(orgId);
  const startIndex = Math.min(offset, positions.length);
  const endIndex =
    limit !== undefined ? Math.min(startIndex + limit, positions.length) : positions.length;
  const items = positions.slice(startIndex, endIndex);

  return NextResponse.json({ items });
}
