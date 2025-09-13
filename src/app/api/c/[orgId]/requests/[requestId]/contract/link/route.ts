import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createRecipientSession } from "@/lib/integrations/pandadoc";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; requestId: string }> }
) {
  try {
    const { orgId, requestId } = await params;
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { data: doc, error: dErr } = await supabase
      .from('documents')
      .select('id, provider, provider_envelope_id')
      .eq('company_id', orgId)
      .eq('request_id', requestId)
      .eq('provider', 'PANDADOC')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (dErr || !doc) return NextResponse.json({ ok: false, error: dErr?.message || 'document_not_found' }, { status: 404 });

    try {
      const link = await createRecipientSession(doc.provider_envelope_id, session.user.email || '');
      return NextResponse.json({ ok: true, url: link.url });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
