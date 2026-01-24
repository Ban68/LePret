import { NextResponse } from "next/server";

import {
  getInvestorTransactions,
  type InvestorTransaction,
} from "@/lib/investors";

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

  const typeParams = searchParams.getAll("type");
  const rawTypes = typeParams.flatMap((value) => value.split(","));
  const trimmedTypes = rawTypes
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const types =
    trimmedTypes.length > 0
      ? (trimmedTypes as InvestorTransaction["type"][])
      : undefined;

  const startDate = searchParams.get("from") ?? undefined;
  const endDate = searchParams.get("to") ?? undefined;

  const page =
    limit !== undefined && offset !== undefined
      ? Math.floor(offset / limit) + 1
      : undefined;

  const transactions = await getInvestorTransactions(orgId, {
    pageSize: limit,
    page,
    types,
    startDate,
    endDate,
  });

  return NextResponse.json({ items: transactions });
}
