import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { fetchInvestorDistributions, getDefaultInvestorCompanyId } from "@/lib/investors";
import { getInvestorCompanyIds, isBackofficeAllowed, isInvestorAllowed } from "@/lib/hq-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { notifyInvestorDistributionPublished } from "@/lib/notifications";

export const dynamic = "force-dynamic";

function parseAmount(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

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

    const distributions = await fetchInvestorDistributions(supabase, companyId);

    return NextResponse.json({ companyId, distributions });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api:investors:distributions:get]", message);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      investor_company_id?: string;
      vehicle_company_id?: string | null;
      period_start?: string | null;
      period_end?: string | null;
      gross_amount?: number | string | null;
      net_amount?: number | string | null;
      reinvested_amount?: number | string | null;
      notes?: string | null;
      file_path?: string | null;
      send_notification?: boolean;
    };

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const canManage = await isBackofficeAllowed(session.user.id, session.user.email);
    if (!canManage) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const investorCompanyId = payload.investor_company_id ?? (await getDefaultInvestorCompanyId(session.user.id));

    if (!investorCompanyId) {
      return NextResponse.json({ error: "invalid_investor_company" }, { status: 400 });
    }

    const insertPayload = {
      investor_company_id: investorCompanyId,
      vehicle_company_id: payload.vehicle_company_id ?? null,
      period_start: payload.period_start ?? null,
      period_end: payload.period_end ?? null,
      gross_amount: parseAmount(payload.gross_amount),
      net_amount: parseAmount(payload.net_amount),
      reinvested_amount: parseAmount(payload.reinvested_amount),
      notes: payload.notes ?? null,
      file_path: payload.file_path ?? null,
      created_by: session.user.id,
    };

    const { data, error } = await supabaseAdmin
      .from("investor_distributions")
      .insert(insertPayload)
      .select("id, investor_company_id, vehicle_company_id, net_amount")
      .single();

    if (error || !data) {
      const message = error?.message ?? "insert_failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    if (payload.send_notification !== false) {
      try {
        await notifyInvestorDistributionPublished({
          investorCompanyId,
          vehicleCompanyId: data.vehicle_company_id ?? null,
          netAmount: parseAmount(data.net_amount as number | string | null | undefined),
          filePath: payload.file_path ?? null,
        });
      } catch (err) {
        console.error("[api:investors:distributions:notify]", err);
      }
    }

    return NextResponse.json({ ok: true, distributionId: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api:investors:distributions:post]", message);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
