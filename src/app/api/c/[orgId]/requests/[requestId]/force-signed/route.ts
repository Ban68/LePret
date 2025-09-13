import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

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

    const allow = (process.env.PANDADOC_ALLOW_FORCE_SIGN || '').toLowerCase() === 'true' || process.env.NODE_ENV !== 'production';
    if (!allow) return NextResponse.json({ ok: false, error: 'forbidden_in_env' }, { status: 403 });

    const { data: doc } = await supabaseAdmin
      .from('documents')
      .select('id, company_id')
      .eq('company_id', orgId)
      .eq('request_id', requestId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (doc) {
      await supabaseAdmin
        .from('documents')
        .update({ status: 'signed' })
        .eq('id', doc.id);

      // Subir un PDF placeholder para demos si no existe file_path
      const path = `${doc.company_id}/${doc.id}.pdf`;
      try {
        const { data: existing } = await supabaseAdmin.storage.from('contracts').list(doc.company_id, { limit: 1, search: `${doc.id}.pdf` });
        const already = Array.isArray(existing) && existing.some((f: any) => f.name === `${doc.id}.pdf`);
        if (!already) {
          const placeholder = Buffer.from('%PDF-1.4\n% Placeholder PDF (demo)\n');
          await supabaseAdmin.storage.from('contracts').upload(path, placeholder, { contentType: 'application/pdf', upsert: true });
          await supabaseAdmin.from('documents').update({ file_path: path }).eq('id', doc.id);
        }
      } catch {}
    }

    await supabaseAdmin
      .from('funding_requests')
      .update({ status: 'signed' })
      .eq('id', requestId)
      .eq('company_id', orgId);

    try { await logAudit({ company_id: orgId, actor_id: session.user.id, entity: 'request', entity_id: requestId, action: 'status_changed', data: { status: 'signed', forced: true } }); } catch {}

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
