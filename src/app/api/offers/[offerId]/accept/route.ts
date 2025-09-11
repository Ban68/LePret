import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    const { offerId } = await params;
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    // Obtener oferta para validar y conseguir org/request
    const { data: offer, error: rErr } = await supabase
      .from("offers")
      .select("id, company_id, request_id, status")
      .eq("id", offerId)
      .single();
    if (rErr || !offer) throw new Error(rErr?.message || "Offer not found");
    if (offer.status !== 'offered') throw new Error('Offer not in offered status');

    // Aceptar oferta
    const { error: upErr } = await supabase
      .from("offers")
      .update({ status: 'accepted', accepted_at: new Date().toISOString(), accepted_by: session.user.id })
      .eq("id", offerId);
    if (upErr) throw upErr;

    // Actualizar estado de la solicitud
    await supabase
      .from("funding_requests")
      .update({ status: 'accepted' })
      .eq("id", offer.request_id)
      .eq("company_id", offer.company_id);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? String(e) }, { status: 500 });
  }
}

