import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orgId: string; requestId: string }> }
) {
  try {
    const { orgId, requestId } = await params;
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const patch: any = {};
    if (body.requested_amount !== undefined) patch.requested_amount = body.requested_amount;
    if (body.invoice_id !== undefined) patch.invoice_id = body.invoice_id;
    if (body.status !== undefined) patch.status = body.status;

    const { error } = await supabase
      .from("funding_requests")
      .update(patch)
      .eq("id", requestId)
      .eq("company_id", orgId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? String(e) }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; requestId: string }> }
) {
  try {
    const { orgId, requestId } = await params;
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    // obtener file_path para limpiar storage si aplica
    const { data: fr, error: rErr } = await supabase
      .from("funding_requests")
      .select("id, file_path")
      .eq("id", requestId)
      .eq("company_id", orgId)
      .single();
    if (rErr || !fr) return NextResponse.json({ ok: false, error: rErr?.message ?? "Not found" }, { status: 404 });

    const { supabaseAdmin } = await import("@/lib/supabase");
    if (fr.file_path) {
      await supabaseAdmin.storage.from("requests").remove([fr.file_path]);
    }
    const { error: delErr } = await supabaseAdmin
      .from("funding_requests")
      .delete()
      .eq("id", requestId)
      .eq("company_id", orgId);
    if (delErr) throw delErr;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? String(e) }, { status: 500 });
  }
}

