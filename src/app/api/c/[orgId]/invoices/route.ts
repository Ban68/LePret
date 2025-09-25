import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { getUsedInvoiceIds } from "./helpers";



export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  const minAmount = url.searchParams.get('minAmount');
  const maxAmount = url.searchParams.get('maxAmount');
  const sort = url.searchParams.get('sort') || 'created_at.desc';

  const limit = Number(url.searchParams.get('limit') ?? '10');
  const page = Number(url.searchParams.get('page') ?? '1');
  const offset = Math.max(0, (page - 1) * limit);

  let query = supabase
    .from("invoices")
    .select(
      "id, amount, issue_date, due_date, status, file_path, created_by, payer, forecast_payment_date",
      { count: 'exact' },
    )
    .eq("company_id", orgId);

  const usedIds = await getUsedInvoiceIds(supabase, orgId);
  if (usedIds.size > 0) {

    for (const id of usedIds) {
      query = query.neq("id", id);
    }

  }

  if (status && status !== 'all') query = query.eq('status', status);
  if (start) query = query.gte('issue_date', start);
  if (end) query = query.lte('issue_date', end);
  if (minAmount) query = query.gte('amount', Number(minAmount));
  if (maxAmount) query = query.lte('amount', Number(maxAmount));

  const [field, direction] = (sort || '').split('.') as [string, string];
  query = query.order(field || 'created_at', { ascending: (direction || 'desc') !== 'desc' ? true : false });

  // Rango para paginación
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, items: data, total: count ?? 0 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const payload = {
    company_id: orgId,
    created_by: session.user.id,
    amount: body.amount,
    issue_date: body.issue_date,
    due_date: body.due_date,
    file_path: body.file_path ?? null,
    status: body.status ?? "uploaded",
    payer: body.payer ?? null,
    forecast_payment_date: body.forecast_payment_date ?? null,
  };
  const { data, error } = await supabase
    .from("invoices")
    .insert(payload)
    .select()
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  try {
    const { logAudit } = await import("@/lib/audit");
    await logAudit({ company_id: orgId, actor_id: session.user.id, entity: 'invoice', entity_id: data.id, action: 'created', data: { amount: body.amount } });
  } catch {}
  return NextResponse.json({ ok: true, created: data }, { status: 201 });
}
