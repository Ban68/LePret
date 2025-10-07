import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { getSupabaseAdminClient } from "@/lib/supabase";

const COMPANY_COLUMNS = "id, name, legal_name, tax_id, contact_email, contact_phone, billing_email, bank_account, notification_email, notification_sms, notification_whatsapp, type, created_at, updated_at";
const EDITABLE_ROLES = new Set(["OWNER", "ADMIN"]);


function readOptionalString(payload: Record<string, unknown>, key: string): string | null | undefined {
  if (!(key in payload)) {
    return undefined;
  }
  const value = payload[key];
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  throw new Error(`Invalid value for ${key}`);
}

function readOptionalBoolean(payload: Record<string, unknown>, key: string): boolean | undefined {
  if (!(key in payload)) {
    return undefined;
  }
  const value = payload[key];
  if (typeof value === "boolean") {
    return value;
  }
  throw new Error(`Invalid value for ${key}`);
}

async function resolveContext(orgId: string, userId: string) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_staff")
    .eq("user_id", userId)
    .maybeSingle();
  const isStaff = Boolean(profile?.is_staff);

  const { data: membership } = await supabase
    .from("memberships")
    .select("role,status")
    .eq("company_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  const normalizedRole = membership?.role ? String(membership.role).toUpperCase() : null;
  const canAccess = isStaff || membership?.status === "ACTIVE";
  const canEdit = isStaff || (membership?.status === "ACTIVE" && normalizedRole ? EDITABLE_ROLES.has(normalizedRole) : false);

  return { supabase, isStaff, membership, canAccess, canEdit };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const context = await resolveContext(orgId, session.user.id);
    if (!context.canAccess) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { data: company, error } = await context.supabase
      .from("companies")
      .select(COMPANY_COLUMNS)
      .eq("id", orgId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!company) {
      return NextResponse.json({ ok: false, error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      company,
      membership: context.membership ?? null,
      isStaff: context.isStaff,
      canEdit: context.canEdit,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const context = await resolveContext(orgId, session.user.id);
    if (!context.canEdit) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    let payload: Record<string, unknown>;
    try {
      payload = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
    }

    const update: Record<string, unknown> = {};

    if ("name" in payload) {
      const value = payload.name;
      if (typeof value !== "string" || !value.trim()) {
        return NextResponse.json({ ok: false, error: "Invalid value for name" }, { status: 400 });
      }
      update.name = value.trim();
    }

    const stringFields: Array<[string, string]> = [
      ["legal_name", "legal_name"],
      ["tax_id", "tax_id"],
      ["contact_email", "contact_email"],
      ["contact_phone", "contact_phone"],
      ["billing_email", "billing_email"],
      ["bank_account", "bank_account"],
    ];

    try {
      for (const [key, column] of stringFields) {
        const value = readOptionalString(payload, key);
        if (value !== undefined) {
          update[column] = value;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid payload";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }

    const booleanFields: Array<[string, string]> = [
      ["notification_email", "notification_email"],
      ["notification_sms", "notification_sms"],
      ["notification_whatsapp", "notification_whatsapp"],
    ];

    try {
      for (const [key, column] of booleanFields) {
        const value = readOptionalBoolean(payload, key);
        if (value !== undefined) {
          update[column] = value;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid payload";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: false, error: "No changes provided" }, { status: 400 });
    }

    update.updated_at = new Date().toISOString();

    const supabaseAdmin = getSupabaseAdminClient();
    const { data: updated, error } = await supabaseAdmin
      .from("companies")
      .update(update)
      .eq("id", orgId)
      .select(COMPANY_COLUMNS)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ ok: false, error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, company: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
