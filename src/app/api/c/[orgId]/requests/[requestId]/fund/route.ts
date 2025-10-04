import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { isStaffUser } from "@/lib/staff";
import { logStatusChange } from "@/lib/audit";

export async function POST(
  _req: Request,
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

    const allowed = await isStaffUser(supabase, session.user.id);
    if (!allowed) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const { data: reqRow, error: rErr } = await supabase
      .from('funding_requests')
      .select('id, company_id, status')
      .eq('id', requestId)
      .eq('company_id', orgId)
      .single();
    if (rErr || !reqRow) {
      return NextResponse.json({ ok: false, error: rErr?.message || 'not_found' }, { status: 404 });
    }

    const { error: upErr } = await supabase
      .from('funding_requests')
      .update({ status: 'funded' })
      .eq('id', requestId)
      .eq('company_id', orgId);
    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    }

    await logStatusChange({
      company_id: orgId,
      actor_id: session.user.id,
      entity_id: requestId,
      from_status: reqRow.status,
      to_status: 'funded',
    });

    try {
      const { notifyClientFunded } = await import("@/lib/notifications");
      await notifyClientFunded(orgId, requestId);
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
