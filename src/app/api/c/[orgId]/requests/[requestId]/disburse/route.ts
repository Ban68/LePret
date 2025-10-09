import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { getSupabaseAdminClient } from "@/lib/supabase";
import { notifyStaffDisbursementRequested } from "@/lib/notifications";

const VALID_STATUSES = new Set(["accepted", "signed"]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string; requestId: string }> }
) {
  try {
    const { orgId, requestId } = await params;
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { data: profile } = await supabase.from("profiles").select("is_staff").eq("user_id", userId).maybeSingle();
    const isStaff = Boolean(profile?.is_staff);

    const { data: membership } = await supabase
      .from("memberships")
      .select("role,status")
      .eq("company_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!isStaff && membership?.status !== "ACTIVE") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = (await req.json()) as Record<string, unknown>;
    } catch {
      // ignore invalid JSON, we'll fallback to defaults
    }

    const bankAccountId = typeof payload.bank_account_id === "string" ? payload.bank_account_id.trim() : null;

    const { data: requestRow, error: requestError } = await supabase
      .from("funding_requests")
      .select(
        "id, company_id, status, requested_amount, currency, disbursement_account_id, disbursed_at"
      )
      .eq("id", requestId)
      .eq("company_id", orgId)
      .maybeSingle();

    if (requestError) {
      return NextResponse.json({ ok: false, error: requestError.message }, { status: 500 });
    }
    if (!requestRow) {
      return NextResponse.json({ ok: false, error: "Solicitud no encontrada" }, { status: 404 });
    }

    if (!VALID_STATUSES.has(String(requestRow.status).toLowerCase())) {
      return NextResponse.json({ ok: false, error: "La solicitud aún no está lista para desembolso" }, { status: 400 });
    }

    const { data: accounts } = await supabase
      .from("bank_accounts")
      .select("id, company_id, is_default")
      .eq("company_id", orgId);

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ ok: false, error: "Registra una cuenta bancaria antes de solicitar el desembolso" }, { status: 400 });
    }

    let resolvedAccountId = bankAccountId || requestRow.disbursement_account_id || null;
    if (resolvedAccountId) {
      const exists = accounts.some((account) => account.id === resolvedAccountId);
      if (!exists) {
        return NextResponse.json({ ok: false, error: "La cuenta seleccionada no pertenece a tu empresa" }, { status: 400 });
      }
    } else {
      const preferred = accounts.find((account) => account.is_default);
      resolvedAccountId = preferred?.id ?? accounts[0]?.id ?? null;
    }

    if (!resolvedAccountId) {
      return NextResponse.json({ ok: false, error: "No pudimos determinar la cuenta de desembolso" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdminClient();

    const { data: existingPayment } = await supabaseAdmin
      .from("payments")
      .select("id, status")
      .eq("company_id", orgId)
      .eq("request_id", requestId)
      .eq("direction", "outbound")
      .maybeSingle();

    let paymentId: string | null = existingPayment?.id ?? null;

    if (paymentId) {
      const { error: updatePaymentError } = await supabaseAdmin
        .from("payments")
        .update({
          bank_account_id: resolvedAccountId,
          amount: requestRow.requested_amount,
          currency: requestRow.currency ?? "COP",
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId);
      if (updatePaymentError) {
        return NextResponse.json({ ok: false, error: updatePaymentError.message }, { status: 500 });
      }
    } else {
      const { data: inserted, error: insertPaymentError } = await supabaseAdmin
        .from("payments")
        .insert({
          company_id: orgId,
          request_id: requestId,
          bank_account_id: resolvedAccountId,
          direction: "outbound",
          status: "pending",
          amount: requestRow.requested_amount,
          currency: requestRow.currency ?? "COP",
          notes: "Solicitud de desembolso en curso",
        })
        .select("id")
        .single();

      if (insertPaymentError) {
        return NextResponse.json({ ok: false, error: insertPaymentError.message }, { status: 500 });
      }
      paymentId = inserted?.id ?? null;
    }

    const { error: updateRequestError } = await supabaseAdmin
      .from("funding_requests")
      .update({
        status: "funded",
        disbursement_account_id: resolvedAccountId,
        disbursed_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("company_id", orgId);

    if (updateRequestError) {
      return NextResponse.json({ ok: false, error: updateRequestError.message }, { status: 500 });
    }

    if (paymentId) {
      await notifyStaffDisbursementRequested(orgId, requestId, paymentId).catch(() => undefined);
    }

    return NextResponse.json({ ok: true, payment_id: paymentId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
