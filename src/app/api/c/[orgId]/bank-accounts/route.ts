import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

const EDITABLE_ROLES = new Set(["OWNER", "ADMIN"]);

async function resolveContext(orgId: string) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { supabase, sessionUserId: null, isStaff: false, membership: null } as const;
  }

  const userId = session.user.id;
  const { data: profile } = await supabase.from("profiles").select("is_staff").eq("user_id", userId).maybeSingle();
  const isStaff = Boolean(profile?.is_staff);

  const { data: membership } = await supabase
    .from("memberships")
    .select("role,status")
    .eq("company_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  return { supabase, sessionUserId: userId, isStaff, membership } as const;
}

function canRead(isStaff: boolean, membership: { status?: string | null } | null) {
  if (isStaff) return true;
  return membership?.status === "ACTIVE";
}

function canEdit(isStaff: boolean, membership: { status?: string | null; role?: string | null } | null) {
  if (isStaff) return true;
  if (!membership || membership.status !== "ACTIVE") return false;
  const role = membership.role ? String(membership.role).toUpperCase() : null;
  return role ? EDITABLE_ROLES.has(role) : false;
}

function sanitizeString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const context = await resolveContext(orgId);

  if (!context.sessionUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!canRead(context.isStaff, context.membership)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await context.supabase
    .from("bank_accounts")
    .select(
      "id, label, bank_name, account_type, account_number, account_holder_name, account_holder_id, is_default, created_at"
    )
    .eq("company_id", orgId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const context = await resolveContext(orgId);

  if (!context.sessionUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!canEdit(context.isStaff, context.membership)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const bankName = sanitizeString(body.bank_name);
  const accountNumber = sanitizeString(body.account_number);
  const accountType = sanitizeString(body.account_type);
  const holderName = sanitizeString(body.account_holder_name);
  const holderIdRaw = sanitizeString(body.account_holder_id);
  const label = sanitizeString(body.label);
  const isDefault = Boolean(body.is_default);

  if (!bankName) {
    return NextResponse.json({ ok: false, error: "El nombre del banco es obligatorio" }, { status: 400 });
  }
  if (!accountNumber) {
    return NextResponse.json({ ok: false, error: "El número de cuenta es obligatorio" }, { status: 400 });
  }
  if (!accountType) {
    return NextResponse.json({ ok: false, error: "Selecciona el tipo de cuenta" }, { status: 400 });
  }
  if (!holderName) {
    return NextResponse.json({ ok: false, error: "Indica el titular de la cuenta" }, { status: 400 });
  }

  const payload = {
    company_id: orgId,
    label: label || null,
    bank_name: bankName,
    account_type: accountType,
    account_number: accountNumber,
    account_holder_name: holderName,
    account_holder_id: holderIdRaw || null,
    is_default: isDefault,
  };

  const { data, error } = await context.supabase
    .from("bank_accounts")
    .insert(payload)
    .select(
      "id, label, bank_name, account_type, account_number, account_holder_name, account_holder_id, is_default, created_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  if (isDefault && data) {
    await context.supabase
      .from("bank_accounts")
      .update({ is_default: false })
      .eq("company_id", orgId)
      .neq("id", data.id);
  }

  return NextResponse.json({ ok: true, account: data }, { status: 201 });
}
