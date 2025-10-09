import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

const ALLOWED_STATUSES = new Set(["pending", "in_collection", "paid", "overdue", "cancelled"]);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orgId: string; paymentId: string }> }
) {
  const { orgId, paymentId } = await params;
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

  let payload: Record<string, unknown> = {};
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (payload.status !== undefined) {
    if (typeof payload.status !== "string" || !ALLOWED_STATUSES.has(payload.status)) {
      return NextResponse.json({ ok: false, error: "Estado no válido" }, { status: 400 });
    }
    updates.status = payload.status;
    if (payload.status === "paid") {
      updates.paid_at = payload.paid_at && typeof payload.paid_at === "string" ? payload.paid_at : new Date().toISOString();
    } else if (payload.paid_at === null) {
      updates.paid_at = null;
    }
  }

  if (payload.notes !== undefined) {
    updates.notes = typeof payload.notes === "string" ? payload.notes.trim() || null : null;
  }

  if (payload.due_date !== undefined) {
    updates.due_date = typeof payload.due_date === "string" ? payload.due_date : null;
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ ok: false, error: "No se recibieron cambios" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("payments")
    .update(updates)
    .eq("id", paymentId)
    .eq("company_id", orgId)
    .eq("direction", "inbound")
    .select(
      "id, request_id, status, amount, currency, due_date, paid_at, notes, created_at, updated_at, metadata"
    )
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, payment: data });
}
