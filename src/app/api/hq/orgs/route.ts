import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { isBackofficeAllowed } from "@/lib/hq-auth";

export async function GET() {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const isAllowed = await isBackofficeAllowed(session.user?.id, session.user?.email);
  if (!isAllowed) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdminClient();

  const { data: companies, error } = await supabaseAdmin
    .from('companies')
    .select('id, name, type, created_at')
    .order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const result: Array<{ id: string; name: string; type: string; created_at: string; invoices: number; requests: number }> = [];
  for (const c of companies || []) {
    const [{ count: invCount }, { count: reqCount }] = await Promise.all([
      supabaseAdmin.from('invoices').select('id', { count: 'exact', head: true }).eq('company_id', c.id),
      supabaseAdmin.from('funding_requests').select('id', { count: 'exact', head: true }).eq('company_id', c.id),
    ]);
    result.push({ ...c, invoices: invCount ?? 0, requests: reqCount ?? 0 });
  }

  return NextResponse.json({ ok: true, companies: result });
}

