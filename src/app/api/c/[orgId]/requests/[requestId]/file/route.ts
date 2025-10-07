import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

type RouteContext = {
  params: Promise<{ orgId: string; requestId: string }>;
};

export async function GET(_req: Request, { params }: RouteContext) {
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

    const { data: fr, error: rErr } = await supabase
      .from("funding_requests")
      .select("id, file_path")
      .eq("id", requestId)
      .eq("company_id", orgId)
      .single();

    if (rErr || !fr) {
      const message = rErr?.message ?? "not_found";
      return NextResponse.json({ ok: false, error: message }, { status: 404 });
    }

    if (!fr.file_path) {
      return NextResponse.json({ ok: false, error: "file_not_found" }, { status: 404 });
    }

    const { getSupabaseAdminClient } = await import("@/lib/supabase");
    const supabaseAdmin = getSupabaseAdminClient();
    const { data: signed, error: signedErr } = await supabaseAdmin.storage
      .from("requests")
      .createSignedUrl(fr.file_path, 60, { download: true });

    if (signedErr || !signed?.signedUrl) {
      const message = signedErr?.message ?? "signed_url_failed";
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, url: signed.signedUrl });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
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

    const { data: fr, error: rErr } = await supabase
      .from("funding_requests")
      .select("id, file_path")
      .eq("id", requestId)
      .eq("company_id", orgId)
      .single();

    if (rErr || !fr) {
      const message = rErr?.message ?? "not_found";
      return NextResponse.json({ ok: false, error: message }, { status: 404 });
    }

    const { getSupabaseAdminClient } = await import("@/lib/supabase");
    const supabaseAdmin = getSupabaseAdminClient();

    if (fr.file_path) {
      await supabaseAdmin.storage.from("requests").remove([fr.file_path]);
    }

    const { error: upErr } = await supabaseAdmin
      .from("funding_requests")
      .update({ file_path: null })
      .eq("id", requestId)
      .eq("company_id", orgId);

    if (upErr) {
      throw upErr;
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: RouteContext) {
  try {
    const { orgId, requestId } = await params;
    const body = (await req.json().catch(() => ({}))) as { file_path?: string };
    const filePath = typeof body.file_path === "string" ? body.file_path : null;

    if (!filePath) {
      return NextResponse.json({ ok: false, error: "missing_file_path" }, { status: 400 });
    }

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: fr, error: rErr } = await supabase
      .from("funding_requests")
      .select("id, file_path")
      .eq("id", requestId)
      .eq("company_id", orgId)
      .single();

    if (rErr || !fr) {
      const message = rErr?.message ?? "not_found";
      return NextResponse.json({ ok: false, error: message }, { status: 404 });
    }

    const { getSupabaseAdminClient } = await import("@/lib/supabase");
    const supabaseAdmin = getSupabaseAdminClient();

    const { error: upErr } = await supabaseAdmin
      .from("funding_requests")
      .update({ file_path: filePath })
      .eq("id", requestId)
      .eq("company_id", orgId);

    if (upErr) {
      throw upErr;
    }

    if (fr.file_path && fr.file_path !== filePath) {
      await supabaseAdmin.storage.from("requests").remove([fr.file_path]);
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}