import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orgId: string; requestId: string }> }
) {
  try {
    const { orgId, requestId } = await params;
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const patch: Partial<{ requested_amount: number; invoice_id: string | null; status: string }> = {};
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

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

    // obtener file_path para limpiar storage si aplica
    const { data: fr, error: rErr } = await supabase
      .from("funding_requests")
      .select("id, file_path")
      .eq("id", requestId)
      .eq("company_id", orgId)
      .single();
    if (rErr || !fr) return NextResponse.json({ ok: false, error: rErr?.message ?? "Not found" }, { status: 404 });

    const { getSupabaseAdminClient } = await import("@/lib/supabase");
    const supabaseAdmin = getSupabaseAdminClient();
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
