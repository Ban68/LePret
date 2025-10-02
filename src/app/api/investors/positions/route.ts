import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import {
  fetchInvestorDistributions,
  fetchInvestorPositions,
  summarizePortfolio,
} from "@/lib/investors";
import { getInvestorCompanyIds, isInvestorAllowed } from "@/lib/hq-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const allowed = await isInvestorAllowed(session.user.id, session.user.email);
    if (!allowed) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const requestedCompanyId = url.searchParams.get("companyId");
    const allowedCompanyIds = await getInvestorCompanyIds(session.user.id);

    if (!allowedCompanyIds.length) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const companyId = requestedCompanyId && allowedCompanyIds.includes(requestedCompanyId)
      ? requestedCompanyId
      : allowedCompanyIds[0];

    const [positions, distributions] = await Promise.all([
      fetchInvestorPositions(supabase, companyId),
      fetchInvestorDistributions(supabase, companyId),
    ]);

    const summary = summarizePortfolio(positions, distributions);

    return NextResponse.json({ companyId, summary, positions });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api:investors:positions]", message);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
