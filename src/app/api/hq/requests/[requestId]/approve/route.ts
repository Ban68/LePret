import { NextResponse } from "next/server";

import { isBackofficeAllowed } from "@/lib/hq-auth";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCompanyDefaults, resolveCompanySegment } from "@/lib/hq-company-parameters";
import { logStatusChange } from "@/lib/audit";

export const dynamic = "force-dynamic";

function ensureNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;
  const sessionClient = await supabaseServer();
  const {
    data: { session },
  } = await sessionClient.auth.getSession();

  if (!session) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const allowed = await isBackofficeAllowed(session.user?.id, session.user?.email);
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
  }

  try {
    const { data: requestRow, error: requestError } = await supabaseAdmin
      .from('funding_requests')
      .select('id, company_id, requested_amount, status, created_at, currency, invoice_id')
      .eq('id', requestId)
      .maybeSingle();

    if (requestError) throw new Error(requestError.message);
    if (!requestRow) {
      return NextResponse.json({ ok: false, error: "Solicitud no encontrada" }, { status: 404 });
    }

    if (requestRow.status !== 'review') {
      return NextResponse.json({ ok: false, error: 'Solo solicitudes en revisión pueden aprobarse automáticamente' }, { status: 400 });
    }

    const { data: companyRow, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id, name, type')
      .eq('id', requestRow.company_id)
      .maybeSingle();
    if (companyError) throw new Error(companyError.message);

    const resolvedDefaults = await resolveCompanyDefaults({
      companyId: requestRow.company_id,
      companyType: companyRow?.type ?? null,
    });
    const settings = resolvedDefaults.settings;
    const segmentKey = resolveCompanySegment(companyRow?.type ?? null);
    const creditLimit = settings.creditLimits[segmentKey] ?? settings.creditLimits.default ?? 0;
    const tenorLimit = resolvedDefaults.operationDays;
    const exposureMultiplier = settings.autoApproval?.maxExposureRatio ?? 1;
    const tenorBuffer = settings.autoApproval?.maxTenorBufferDays ?? 0;

    const { data: exposureRows, error: exposureError } = await supabaseAdmin
      .from('funding_requests')
      .select('id, requested_amount, status')
      .eq('company_id', requestRow.company_id)
      .in('status', ['review', 'offered', 'accepted', 'signed', 'funded']);
    if (exposureError) throw new Error(exposureError.message);

    const totalExposure = (exposureRows || []).reduce((sum, row) => sum + ensureNumber(row.requested_amount), 0);

    if (creditLimit > 0 && totalExposure > creditLimit * exposureMultiplier) {
      return NextResponse.json(
        { ok: false, error: 'La solicitud excede el límite de crédito configurado para este segmento' },
        { status: 400 }
      );
    }

    const invoiceIds = new Set<string>();
    if (requestRow.invoice_id) {
      invoiceIds.add(requestRow.invoice_id);
    }
    const { data: linkRows, error: linkError } = await supabaseAdmin
      .from('funding_request_invoices')
      .select('invoice_id')
      .eq('request_id', requestId);
    if (linkError) throw new Error(linkError.message);
    for (const row of linkRows || []) {
      if (row.invoice_id) invoiceIds.add(row.invoice_id);
    }

    const { data: invoices, error: invoicesError } = invoiceIds.size
      ? await supabaseAdmin
          .from('invoices')
          .select('id, due_date, amount')
          .in('id', Array.from(invoiceIds))
      : { data: [] as Array<{ due_date?: string | null; amount?: unknown }>, error: null };
    if (invoicesError) throw new Error(invoicesError.message);

    const now = Date.now();
    const tenorDays = invoices
      .map((invoice) => {
        const due = (invoice as { due_date?: string | null }).due_date;
        if (!due) return null;
        const dueAt = new Date(due).getTime();
        if (Number.isNaN(dueAt)) return null;
        return Math.round((dueAt - now) / (1000 * 60 * 60 * 24));
      })
      .filter((value): value is number => Number.isFinite(value));
    const maxTenor = tenorDays.length ? Math.max(...tenorDays) : null;

    if (maxTenor !== null && maxTenor > tenorLimit + tenorBuffer) {
      return NextResponse.json(
        { ok: false, error: 'El plazo de pago excede el máximo permitido para aprobación automática' },
        { status: 400 }
      );
    }

    const requestedAmount = ensureNumber(requestRow.requested_amount);
    const discountRate = Math.min(Math.max(resolvedDefaults.discountRate ?? 24, 0), 200);
    const annualRate = discountRate / 100;
    const advancePct = Math.max(0, Math.min(100, resolvedDefaults.advancePct ?? 85));
    const processingFee = Math.max(50000, Math.min(250000, Math.round(requestedAmount * 0.005)));
    const wireFee = 5000;
    const advanceAmount = requestedAmount * (advancePct / 100);
    const netAmount = Math.max(0, Math.round(advanceAmount - processingFee - wireFee));
    const validUntil = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();

    const { data: offer, error: offerError } = await supabaseAdmin
      .from('offers')
      .insert({
        company_id: requestRow.company_id,
        request_id: requestRow.id,
        annual_rate: annualRate,
        advance_pct: advancePct,
        net_amount: netAmount,
        fees: { processing: processingFee, wire: wireFee },
        valid_until: validUntil,
        status: 'accepted',
        created_by: session.user.id,
        accepted_by: session.user.id,
        accepted_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (offerError) throw new Error(offerError.message);

    const { error: updateError } = await supabaseAdmin
      .from('funding_requests')
      .update({ status: 'accepted' })
      .eq('id', requestRow.id);
    if (updateError) throw new Error(updateError.message);

    await logStatusChange({
      company_id: requestRow.company_id,
      actor_id: session.user.id,
      entity_id: requestRow.id,
      from_status: requestRow.status,
      to_status: 'accepted',
    });

    return NextResponse.json({ ok: true, status: 'accepted', offer });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error inesperado';
    console.error('[hq-auto-approve] POST', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
