import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

async function isStaff(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.from('profiles').select('is_staff').eq('user_id', userId).maybeSingle();
  return !!(data && data.is_staff);
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

    const allowed = await isStaff(supabase, session.user.id);
    if (!allowed) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

    // Validar que la solicitud exista
    const { data: reqRow, error: rErr } = await supabase
      .from('funding_requests')
      .select('id, company_id, status')
      .eq('id', requestId)
      .eq('company_id', orgId)
      .single();
    if (rErr || !reqRow) return NextResponse.json({ ok: false, error: rErr?.message || 'not_found' }, { status: 404 });

    // Marcar como funded
    const { error: upErr } = await supabase
      .from('funding_requests')
      .update({ status: 'funded' })
      .eq('id', requestId)
      .eq('company_id', orgId);
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

    try {
      const { notifyClientFunded } = await import("@/lib/notifications");
      await notifyClientFunded(orgId, requestId);
    } catch {}

    try {
      const { logAudit } = await import("@/lib/audit");
      await logAudit({ company_id: orgId, actor_id: session.user.id, entity: 'request', entity_id: requestId, action: 'funded' });
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
