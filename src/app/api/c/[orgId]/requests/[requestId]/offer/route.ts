import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { logStatusChange } from "@/lib/audit";

function computeOffer(input: { requested: number }): {
  annual_rate: number;
  advance_pct: number;
  fees: Record<string, number>;
  net_amount: number;
  valid_until: string;
} {
  const annual_rate = 0.30; // 30% EA (demo)
  const advance_pct = 85; // 85% de anticipo
  const processing = Math.max(50000, Math.min(200000, input.requested * 0.005));
  const wire = 5000;
  const advance = input.requested * (advance_pct / 100);
  const fees_total = processing + wire;
  const net_amount = Math.max(0, Math.round(advance - fees_total));
  const valid_until = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  return {
    annual_rate,
    advance_pct,
    fees: { processing, wire },
    net_amount,
    valid_until,
  };
}

function computeCustomOffer(input: {
  requested: number;
  annualRatePct: number;
  advancePct: number;
  processingFee: number;
  wireFee: number;
  validForDays: number;
}): {
  annual_rate: number;
  advance_pct: number;
  fees: Record<string, number>;
  net_amount: number;
  valid_until: string;
} {
  const annual_pct = Number.isFinite(input.annualRatePct) ? input.annualRatePct : 30;
  const advance_pct = Number.isFinite(input.advancePct) ? input.advancePct : 85;
  const processing = Number.isFinite(input.processingFee) ? input.processingFee : 0;
  const wire = Number.isFinite(input.wireFee) ? input.wireFee : 0;
  const valid_days = Number.isFinite(input.validForDays) ? input.validForDays : 7;

  const normalizedAdvancePct = Math.max(0, Math.min(100, advance_pct));
  const normalizedAnnualRate = Math.max(0, Math.min(200, annual_pct));
  const normalizedProcessing = Math.max(0, Math.round(processing));
  const normalizedWire = Math.max(0, Math.round(wire));
  const normalizedValidDays = Math.max(1, Math.min(90, Math.round(valid_days)));

  const advance = input.requested * (normalizedAdvancePct / 100);
  const fees_total = normalizedProcessing + normalizedWire;
  const net_amount = Math.max(0, Math.round(advance - fees_total));
  const valid_until = new Date(Date.now() + normalizedValidDays * 24 * 3600 * 1000).toISOString();

  return {
    annual_rate: normalizedAnnualRate / 100,
    advance_pct: normalizedAdvancePct,
    fees: { processing: normalizedProcessing, wire: normalizedWire },
    net_amount,
    valid_until,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; requestId: string }> }
) {
  const { orgId, requestId } = await params;
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("offers")
    .select("*")
    .eq("company_id", orgId)
    .eq("request_id", requestId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, offer: data });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string; requestId: string }> }
) {
  try {
    const { orgId, requestId } = await params;
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    // Leer la solicitud para calcular
    const { data: reqRow, error: rErr } = await supabase
      .from("funding_requests")
      .select("id, company_id, requested_amount, status")
      .eq("id", requestId)
      .eq("company_id", orgId)
      .single();
    if (rErr || !reqRow) throw new Error(rErr?.message || "Request not found");

    const payload = await req.json().catch(() => null);
    const requestedAmount = Number(reqRow.requested_amount) || 0;
    const manualPayload =
      payload && typeof payload === "object" && payload !== null && "mode" in payload && (payload as { mode?: string }).mode === "manual"
        ? payload as { mode: "manual"; values?: Partial<Record<string, unknown>> }
        : null;

    const calc = manualPayload
      ? computeCustomOffer({
          requested: requestedAmount,
          annualRatePct: Number(manualPayload.values?.annualRate),
          advancePct: Number(manualPayload.values?.advancePct),
          processingFee: Number(manualPayload.values?.processingFee),
          wireFee: Number(manualPayload.values?.wireFee),
          validForDays: Number(manualPayload.values?.validForDays),
        })
      : computeOffer({ requested: requestedAmount });

    const { data: offer, error: insErr } = await supabase
      .from("offers")
      .insert({
        company_id: orgId,
        request_id: requestId,
        annual_rate: calc.annual_rate,
        advance_pct: calc.advance_pct,
        fees: calc.fees,
        net_amount: calc.net_amount,
        valid_until: calc.valid_until,
        created_by: session.user.id,
        status: "offered",
      })
      .select()
      .single();
    if (insErr) throw new Error(insErr.message);

    // Marcar solicitud como offered
    await supabase
      .from("funding_requests")
      .update({ status: "offered" })
      .eq("id", requestId)
      .eq("company_id", orgId);

    await logStatusChange({
      company_id: orgId,
      actor_id: session.user.id,
      entity_id: requestId,
      from_status: reqRow.status ?? null,
      to_status: "offered",
    });

    // Notificar al cliente: oferta generada
    try {
      const { notifyClientOfferGenerated } = await import("@/lib/notifications");
      await notifyClientOfferGenerated(orgId, offer.id);
    } catch {}

    // AuditorÃ­a
    try {
      const { logAudit } = await import("@/lib/audit");
      await logAudit({ company_id: orgId, actor_id: session.user.id, entity: 'offer', entity_id: offer.id, action: 'created', data: { request_id: requestId } });
      await logAudit({ company_id: orgId, actor_id: session.user.id, entity: 'request', entity_id: requestId, action: 'status_changed', data: { status: 'offered' } });
    } catch {}

    return NextResponse.json({ ok: true, offer });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}








