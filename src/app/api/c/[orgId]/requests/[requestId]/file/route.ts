export async function GET(
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
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { data: fr, error: rErr } = await supabase
      .from("funding_requests")
      .select("id, file_path")
      .eq("id", requestId)
      .eq("company_id", orgId)
      .single();

    if (rErr || !fr) {
      return NextResponse.json({ ok: false, error: rErr?.message ?? "not_found" }, { status: 404 });
    }

    if (!fr.file_path) {
      return NextResponse.json({ ok: false, error: "file_not_found" }, { status: 404 });
    }

    const { supabaseAdmin } = await import("@/lib/supabase");
    const { data: signed, error: signedErr } = await supabaseAdmin
      .storage
      .from("requests")
      .createSignedUrl(fr.file_path, 60, { download: true });

    if (signedErr || !signed?.signedUrl) {
      return NextResponse.json({ ok: false, error: signedErr?.message ?? "signed_url_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, url: signed.signedUrl });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}\r\nimport { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; requestId: string }> }
) {
  try {
    const { orgId, requestId } = await params;
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { data: fr, error: rErr } = await supabase
      .from("funding_requests")
      .select("id, file_path")
      .eq("id", requestId)
      .eq("company_id", orgId)
      .single();
    if (rErr || !fr) return NextResponse.json({ ok: false, error: rErr?.message ?? "Not found" }, { status: 404 });

    const { supabaseAdmin } = await import("@/lib/supabase");
    if (fr.file_path) await supabaseAdmin.storage.from("requests").remove([fr.file_path]);
    const { error: upErr } = await supabaseAdmin
      .from("funding_requests")
      .update({ file_path: null })
      .eq("id", requestId)
      .eq("company_id", orgId);
    if (upErr) throw upErr;
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ orgId: string; requestId: string }> }
) {
  try {
    const { orgId, requestId } = await params;
    const { file_path } = await req.json();
    if (!file_path) return NextResponse.json({ ok: false, error: "Missing file_path" }, { status: 400 });

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { data: fr, error: rErr } = await supabase
      .from("funding_requests")
      .select("id, file_path")
      .eq("id", requestId)
      .eq("company_id", orgId)
      .single();
    if (rErr || !fr) return NextResponse.json({ ok: false, error: rErr?.message ?? "Not found" }, { status: 404 });

    const { supabaseAdmin } = await import("@/lib/supabase");
    const { error: upErr } = await supabaseAdmin
      .from("funding_requests")
      .update({ file_path })
      .eq("id", requestId)
      .eq("company_id", orgId);
    if (upErr) throw upErr;
    if (fr.file_path && fr.file_path !== file_path) await supabaseAdmin.storage.from("requests").remove([fr.file_path]);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

