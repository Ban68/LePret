import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

async function ensureMembership(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("company_id", orgId)
    .limit(1);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("not_member");
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; invoiceId: string }> }
) {
  try {
    const { orgId, invoiceId } = await params;
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    await ensureMembership(supabase, orgId);

    const { data: inv, error: rErr } = await supabase
      .from("invoices")
      .select("id, company_id, file_path")
      .eq("id", invoiceId)
      .eq("company_id", orgId)
      .single();
    if (rErr || !inv) return NextResponse.json({ ok: false, error: rErr?.message ?? "Not found" }, { status: 404 });

    const { getSupabaseAdminClient } = await import("@/lib/supabase");
    const supabaseAdmin = getSupabaseAdminClient();
    if (inv.file_path) {
      await supabaseAdmin.storage.from("invoices").remove([inv.file_path]);
    }
    const { error: upErr } = await supabaseAdmin
      .from("invoices")
      .update({ file_path: null })
      .eq("id", invoiceId)
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
  { params }: { params: Promise<{ orgId: string; invoiceId: string }> }
) {
  try {
    const { orgId, invoiceId } = await params;
    const { file_path } = await req.json();
    if (!file_path) return NextResponse.json({ ok: false, error: "Missing file_path" }, { status: 400 });

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    await ensureMembership(supabase, orgId);

    const { data: inv, error: rErr } = await supabase
      .from("invoices")
      .select("id, company_id, file_path")
      .eq("id", invoiceId)
      .eq("company_id", orgId)
      .single();
    if (rErr || !inv) return NextResponse.json({ ok: false, error: rErr?.message ?? "Not found" }, { status: 404 });

    const { getSupabaseAdminClient } = await import("@/lib/supabase");
    const supabaseAdmin = getSupabaseAdminClient();
    const { error: upErr } = await supabaseAdmin
      .from("invoices")
      .update({ file_path })
      .eq("id", invoiceId)
      .eq("company_id", orgId);
    if (upErr) throw upErr;
    if (inv.file_path && inv.file_path !== file_path) {
      await supabaseAdmin.storage.from("invoices").remove([inv.file_path]);
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
