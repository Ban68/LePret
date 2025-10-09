import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { data: profile } = await supabase.from("profiles").select("is_staff").eq("user_id", userId).maybeSingle();
  const isStaff = Boolean(profile?.is_staff);

  const { data: membership } = await supabase
    .from("memberships")
    .select("status")
    .eq("company_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!isStaff && membership?.status !== "ACTIVE") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, request_id, status, amount, currency, due_date, paid_at, notes, created_at, updated_at, metadata"
    )
    .eq("company_id", orgId)
    .eq("direction", "inbound")
    .order("due_date", { ascending: true, nullsLast: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, items: data ?? [] });
}
