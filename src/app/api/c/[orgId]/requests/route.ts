import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  const minAmount = url.searchParams.get('minAmount');
  const maxAmount = url.searchParams.get('maxAmount');
  const withInvoice = url.searchParams.get('withInvoice');
  const sort = url.searchParams.get('sort') || 'created_at.desc';
  const limit = Number(url.searchParams.get('limit') ?? '10');
  const page = Number(url.searchParams.get('page') ?? '1');
  const offset = Math.max(0, (page - 1) * limit);

  let query: any = supabase
    .from("funding_requests")
    .select("id, invoice_id, requested_amount, status, created_at, file_path, created_by", { count: 'exact' })
    .eq("company_id", orgId);

  if (status && status !== 'all') query = query.eq('status', status);
  if (start) query = query.gte('created_at', start);
  if (end) query = query.lte('created_at', end);
  if (minAmount) query = query.gte('requested_amount', Number(minAmount));
  if (maxAmount) query = query.lte('requested_amount', Number(maxAmount));
  if (withInvoice === 'true') query = query.not('invoice_id', 'is', null);
  if (withInvoice === 'false') query = query.is('invoice_id', null);

  const [field, direction] = (sort || '').split('.') as [string, string];
  query = query.order(field || 'created_at', { ascending: (direction || 'desc') !== 'desc' ? true : false });

  query = query.range(offset, offset + limit - 1);
  const { data, error, count } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Enriquecer con facturas asociadas (múltiples)
  const reqs = data || [];
  const reqIds = reqs.map((r: any) => r.id);
  let byReq: Record<string, { invoice_ids: string[]; total: number }> = {};
  if (reqIds.length) {
    const fri = await supabase
      .from('funding_request_invoices')
      .select('request_id, invoice_id')
      .in('request_id', reqIds);
    const mapIds: Record<string, string[]> = {};
    const allInvIds: string[] = [];
    for (const row of (fri.data || [])) {
      (mapIds[row.request_id] ||= []).push(row.invoice_id);
      allInvIds.push(row.invoice_id);
    }
    let amounts: Record<string, number> = {};
    if (allInvIds.length) {
      const inv = await supabase
        .from('invoices')
        .select('id, amount')
        .in('id', allInvIds);
      for (const v of (inv.data || [])) amounts[v.id] = Number(v.amount || 0);
    }
    Object.entries(mapIds).forEach(([rid, ids]) => {
      const total = ids.reduce((acc, id) => acc + (amounts[id] || 0), 0);
      byReq[rid] = { invoice_ids: ids, total };
    });
  }

  const enriched = reqs.map((r: any) => ({
    ...r,
    invoice_ids: byReq[r.id]?.invoice_ids || (r.invoice_id ? [r.invoice_id] : []),
    invoices_count: (byReq[r.id]?.invoice_ids?.length) || (r.invoice_id ? 1 : 0),
    invoices_total: byReq[r.id]?.total ?? (r.invoice_id ? Number(r.requested_amount || 0) : 0),
  }));

  return NextResponse.json({ ok: true, items: enriched, total: count ?? 0 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const payload = {
    company_id: orgId,
    created_by: session.user.id,
    invoice_id: body.invoice_id ?? null,
    requested_amount: body.requested_amount,
    file_path: body.file_path ?? null,
    status: body.status ?? "review",
  };
  const { data, error } = await supabase
    .from("funding_requests")
    .insert(payload)
    .select()
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  // Notificar al staff (nueva solicitud)
  try {
    const { notifyStaffNewRequest } = await import("@/lib/notifications");
    await notifyStaffNewRequest(orgId, data.id);
  } catch {}
  // Auditoría
  try {
    const { logAudit } = await import("@/lib/audit");
    await logAudit({ company_id: orgId, actor_id: session.user.id, entity: 'request', entity_id: data.id, action: 'created', data: { requested_amount: body.requested_amount } });
  } catch {}
  return NextResponse.json({ ok: true, created: data }, { status: 201 });
}
