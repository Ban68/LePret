import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; requestId: string }> }
) {
  const { orgId, requestId } = await params;
  const cookieStore = await cookies();
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
  _req: Request,
  { params }: { params: Promise<{ orgId: string; requestId: string }> }
) {
  try {
    const { orgId, requestId } = await params;
    const cookieStore = await cookies();
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

    const calc = computeOffer({ requested: Number(reqRow.requested_amount) || 0 });

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

    // Notificar al cliente: oferta generada
    try {
      const { notifyClientOfferGenerated } = await import("@/lib/notifications");
      await notifyClientOfferGenerated(orgId, offer.id);
    } catch {}

    // Auditoría
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
