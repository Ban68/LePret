import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

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

    const { data: doc, error } = await supabase
      .from('documents')
      .select('provider, provider_envelope_id')
      .eq('company_id', orgId)
      .eq('request_id', requestId)
      .eq('provider', 'PANDADOC')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !doc) return NextResponse.json({ ok: false, error: error?.message || 'document_not_found' }, { status: 404 });

    const appBase = process.env.PANDADOC_APP_URL || 'https://app.pandadoc.com/a/#/documents/';
    const url = `${appBase}${doc.provider_envelope_id}`;
    return NextResponse.json({ ok: true, url });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

