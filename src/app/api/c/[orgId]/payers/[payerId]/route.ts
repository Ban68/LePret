import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

const sanitizeStatus = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const upper = value.toUpperCase();
  if (["ACTIVE", "BLOCKED", "ARCHIVED"].includes(upper)) {
    return upper;
  }
  return undefined;
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orgId: string; payerId: string }> }
) {
  const { orgId, payerId } = await params;
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body?.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) {
      return NextResponse.json({ ok: false, error: "Name cannot be empty" }, { status: 400 });
    }
    update.name = trimmed;
  }

  if (body?.tax_id !== undefined) {
    update.tax_id = typeof body.tax_id === "string" && body.tax_id.trim().length ? body.tax_id.trim() : null;
  }

  if (body?.contact_email !== undefined) {
    update.contact_email =
      typeof body.contact_email === "string" && body.contact_email.trim().length ? body.contact_email.trim() : null;
  }

  if (body?.contact_phone !== undefined) {
    update.contact_phone =
      typeof body.contact_phone === "string" && body.contact_phone.trim().length ? body.contact_phone.trim() : null;
  }

  if (body?.sector !== undefined) {
    update.sector = typeof body.sector === "string" && body.sector.trim().length ? body.sector.trim() : null;
  }

  if (body?.credit_limit !== undefined) {
    const value = Number(body.credit_limit);
    update.credit_limit = Number.isFinite(value) && value > 0 ? value : null;
  }

  if (body?.risk_rating !== undefined) {
    update.risk_rating =
      typeof body.risk_rating === "string" && body.risk_rating.trim().length ? body.risk_rating.trim() : null;
  }

  if (body?.notes !== undefined) {
    update.notes = typeof body.notes === "string" && body.notes.trim().length ? body.notes.trim() : null;
  }

  const normalizedStatus = sanitizeStatus(body?.status);
  if (normalizedStatus) {
    update.status = normalizedStatus;
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ ok: false, error: "No changes provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("payers")
    .update(update)
    .eq("id", payerId)
    .eq("company_id", orgId)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, payer: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; payerId: string }> }
) {
  const { orgId, payerId } = await params;
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("payers")
    .update({ status: "ARCHIVED", updated_at: new Date().toISOString() })
    .eq("id", payerId)
    .eq("company_id", orgId)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
