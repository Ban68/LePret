import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { createRequestWithInvoices } from "../helpers";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const invoiceIds: string[] = Array.isArray(body?.invoice_ids) ? body.invoice_ids : [];
    const requestedAmount = Number(body?.requested_amount ?? 0);
    const targetRateRaw = body?.target_rate;
    const targetRate = typeof targetRateRaw === "number" && Number.isFinite(targetRateRaw)
      ? targetRateRaw
      : typeof targetRateRaw === "string" && targetRateRaw.trim().length > 0 && Number.isFinite(Number(targetRateRaw))
        ? Number(targetRateRaw)
        : undefined;
    const expectedDate = typeof body?.expected_disbursement_date === "string" ? body.expected_disbursement_date : undefined;
    const notes = typeof body?.notes === "string" ? body.notes : undefined;

    const result = await createRequestWithInvoices({
      supabase,
      orgId,
      userId: session.user.id,
      invoiceIds,
      requestedAmount: Number.isFinite(requestedAmount) ? requestedAmount : undefined,
      targetRate,
      expectedDate,
      notes,
    });

    if (!result.ok) {
      const payload: Record<string, unknown> = { ok: false, error: result.error };
      if (result.details) payload.details = result.details;
      return NextResponse.json(payload, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      request: result.request,
      total: result.total,
      count: result.count,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
