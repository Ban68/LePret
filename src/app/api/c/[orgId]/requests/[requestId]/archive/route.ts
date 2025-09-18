import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { isStaffUser } from "@/lib/staff";

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

    const archivePayload = {
      archived_at: new Date().toISOString(),
      archived_by: session.user.id,
    };

    const { error: updateError } = await supabase
      .from('funding_requests')
      .update(archivePayload)
      .eq('id', requestId)
      .eq('company_id', orgId);
    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    }

    try {
      const { logAudit } = await import("@/lib/audit");
      await logAudit({
        company_id: orgId,
        actor_id: session.user.id,
        entity: 'request',
        entity_id: requestId,
        action: 'archived',
      });
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
