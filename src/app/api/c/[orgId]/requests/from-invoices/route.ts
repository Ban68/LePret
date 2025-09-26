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
    let requestedAmount: number | undefined;
    const requestedAmountValue = body?.requested_amount;
    if (typeof requestedAmountValue === "number" && Number.isFinite(requestedAmountValue)) {
      requestedAmount = requestedAmountValue;
    } else if (typeof requestedAmountValue === "string" && requestedAmountValue.trim().length > 0) {
      const parsed = Number(requestedAmountValue);
      if (Number.isFinite(parsed)) requestedAmount = parsed;
    }

    const result = await createRequestWithInvoices({
      supabase,
      orgId,
      userId: session.user.id,
      invoiceIds,
      requestedAmount: Number.isFinite(requestedAmount ?? NaN) ? (requestedAmount as number) : undefined,
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
