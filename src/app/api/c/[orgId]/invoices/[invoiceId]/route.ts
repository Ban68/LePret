import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; invoiceId: string }> }
) {
  try {
    const { orgId, invoiceId } = await params;
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    // Verificar membresía
    const { data: mem, error: mErr } = await supabase
      .from("memberships")
      .select("user_id")
      .eq("company_id", orgId)
      .limit(1);
    if (mErr || !mem || mem.length === 0) return NextResponse.json({ ok: false, error: "not_member" }, { status: 403 });

    // Leer factura (para remover archivo)
    const { data: inv, error: rErr } = await supabase
      .from("invoices")
      .select("id, company_id, file_path")
      .eq("id", invoiceId)
      .eq("company_id", orgId)
      .single();
    if (rErr || !inv) return NextResponse.json({ ok: false, error: rErr?.message ?? "Not found" }, { status: 404 });

    const { supabaseAdmin } = await import("@/lib/supabase");
    if (inv.file_path) {
      await supabaseAdmin.storage.from("invoices").remove([inv.file_path]);
    }
    const { error: delErr } = await supabaseAdmin
      .from("invoices")
      .delete()
      .eq("id", invoiceId)
      .eq("company_id", orgId);
    if (delErr) throw delErr;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? String(e) }, { status: 500 });
  }
}
