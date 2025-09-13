import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const invoice_ids: string[] = Array.isArray(body?.invoice_ids) ? body.invoice_ids : [];
    if (!invoice_ids.length) return NextResponse.json({ ok: false, error: 'missing_invoice_ids' }, { status: 400 });

    // Leer facturas y validar que pertenezcan a la empresa
    const { data: invoices, error: invErr } = await supabase
      .from('invoices')
      .select('id, amount, company_id')
      .in('id', invoice_ids)
      .eq('company_id', orgId);
    if (invErr) return NextResponse.json({ ok: false, error: invErr.message }, { status: 500 });
    if (!invoices || !invoices.length) return NextResponse.json({ ok: false, error: 'no_invoices_found' }, { status: 404 });

    const total = invoices.reduce((acc: number, it: any) => acc + Number(it.amount || 0), 0);
    if (total <= 0) return NextResponse.json({ ok: false, error: 'invalid_total' }, { status: 400 });

    // Crear solicitud
    const { data: reqRow, error: rErr } = await supabase
      .from('funding_requests')
      .insert({
        company_id: orgId,
        created_by: session.user.id,
        requested_amount: total,
        status: 'review',
      })
      .select()
      .single();
    if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 400 });

    // Relacionar facturas con la solicitud
    const rows = invoices.map((inv: any) => ({ request_id: reqRow.id, invoice_id: inv.id }));
    const { error: friErr } = await supabase
      .from('funding_request_invoices')
      .insert(rows);
    if (friErr) return NextResponse.json({ ok: false, error: friErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, request: reqRow, total, count: invoices.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

