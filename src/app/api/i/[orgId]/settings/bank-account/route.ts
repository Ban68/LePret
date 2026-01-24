import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { PostgrestError } from "@supabase/supabase-js";

import { getSupabaseAdminClient } from "@/lib/supabase";

const BANK_ACCOUNT_FIELDS =
  "id,label,bank_name,account_type,account_number,account_holder_name,account_holder_id,is_default,created_at,updated_at";

type RouteContext = { params: Promise<{ orgId: string }> };

type SessionContext = {
  sessionUserId: string | null;
  isStaff: boolean;
  membership: { status?: string | null } | null;
};

type BankAccountRow = {
  id: string;
  label: string | null;
  bank_name: string;
  account_type: string;
  account_number: string;
  account_holder_name: string;
  account_holder_id: string | null;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
};

type TableConfig = { table: string; orgColumn: string };

const BANK_ACCOUNT_TABLES: TableConfig[] = [
  { table: "investor_bank_accounts", orgColumn: "investor_org_id" },
  { table: "bank_accounts", orgColumn: "company_id" },
];

function isMissingTableError(error: PostgrestError | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST110" || error.code === "PGRST302";
}

async function resolveSession(orgId: string): Promise<SessionContext> {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { sessionUserId: null, isStaff: false, membership: null };
  }

  const userId = session.user.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_staff")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: membership } = await supabase
    .from("memberships")
    .select("status")
    .eq("company_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  return {
    sessionUserId: userId,
    isStaff: Boolean(profile?.is_staff),
    membership,
  };
}

function canAccess(context: SessionContext): boolean {
  if (!context.sessionUserId) return false;
  if (context.isStaff) return true;
  return (context.membership?.status ?? "").toUpperCase() === "ACTIVE";
}

function sanitize(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function selectCurrentAccount(orgId: string) {
  const supabaseAdmin = getSupabaseAdminClient();
  let lastConfig: TableConfig | null = null;

  for (const config of BANK_ACCOUNT_TABLES) {
    const { data, error } = await supabaseAdmin
      .from(config.table)
      .select(BANK_ACCOUNT_FIELDS)
      .eq(config.orgColumn, orgId)
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<BankAccountRow>();

    if (error) {
      if (isMissingTableError(error)) {
        continue;
      }
      throw error;
    }

    lastConfig = config;

    if (data) {
      return { config, record: data };
    }
  }

  return lastConfig ? { config: lastConfig, record: null } : null;
}

function buildCreatePayload(orgId: string, config: TableConfig, body: Record<string, unknown>) {
  const bankName = sanitize(body.bank_name);
  const accountType = sanitize(body.account_type);
  const accountNumber = sanitize(body.account_number);
  const holderName = sanitize(body.account_holder_name);

  if (!bankName) {
    throw new Error("El nombre del banco es obligatorio");
  }
  if (!accountType) {
    throw new Error("Selecciona el tipo de cuenta");
  }
  if (!accountNumber) {
    throw new Error("El número de cuenta es obligatorio");
  }
  if (!holderName) {
    throw new Error("El titular de la cuenta es obligatorio");
  }

  const payload: Record<string, unknown> = {
    [config.orgColumn]: orgId,
    bank_name: bankName,
    account_type: accountType,
    account_number: accountNumber,
    account_holder_name: holderName,
    is_default: true,
  };

  if ("label" in body) {
    const rawLabel = body.label;
    payload.label = rawLabel === null ? null : sanitize(rawLabel);
  }

  if ("account_holder_id" in body) {
    const rawHolderId = body.account_holder_id;
    payload.account_holder_id = rawHolderId === null ? null : sanitize(rawHolderId);
  }

  return payload;
}

function buildUpdatePayload(orgId: string, config: TableConfig, body: Record<string, unknown>) {
  const payload: Record<string, unknown> = { [config.orgColumn]: orgId };

  if ("bank_name" in body) {
    const bankName = sanitize(body.bank_name);
    if (!bankName) {
      throw new Error("El nombre del banco es obligatorio");
    }
    payload.bank_name = bankName;
  }

  if ("account_type" in body) {
    const accountType = sanitize(body.account_type);
    if (!accountType) {
      throw new Error("Selecciona el tipo de cuenta");
    }
    payload.account_type = accountType;
  }

  if ("account_number" in body) {
    const accountNumber = sanitize(body.account_number);
    if (!accountNumber) {
      throw new Error("El número de cuenta es obligatorio");
    }
    payload.account_number = accountNumber;
  }

  if ("account_holder_name" in body) {
    const holderName = sanitize(body.account_holder_name);
    if (!holderName) {
      throw new Error("El titular de la cuenta es obligatorio");
    }
    payload.account_holder_name = holderName;
  }

  if ("label" in body) {
    const rawLabel = body.label;
    payload.label = rawLabel === null ? null : sanitize(rawLabel);
  }

  if ("account_holder_id" in body) {
    const rawHolderId = body.account_holder_id;
    payload.account_holder_id = rawHolderId === null ? null : sanitize(rawHolderId);
  }

  if (Object.keys(payload).length === 1) {
    throw new Error("No hay cambios para guardar");
  }

  return payload;
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { orgId } = await params;
    const context = await resolveSession(orgId);

    if (!context.sessionUserId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!canAccess(context)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const result = await selectCurrentAccount(orgId);

    if (!result) {
      return NextResponse.json({ ok: true, account: null });
    }

    return NextResponse.json({ ok: true, account: result.record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function handleUpsert(
  req: Request,
  params: RouteContext["params"],
  method: "POST" | "PATCH",
) {
  const { orgId } = await params;
  const context = await resolveSession(orgId);

  if (!context.sessionUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccess(context)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const accountId = typeof body.id === "string" ? body.id.trim() : "";
  const requiresId = method === "PATCH";

  if (requiresId && !accountId) {
    return NextResponse.json({ ok: false, error: "Falta el identificador de la cuenta" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdminClient();
  let lastError: PostgrestError | null = null;

  for (const config of BANK_ACCOUNT_TABLES) {
    let payload: Record<string, unknown>;
    try {
      payload = accountId
        ? buildUpdatePayload(orgId, config, body)
        : buildCreatePayload(orgId, config, body);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Datos inválidos";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }

    if (method === "PATCH" && accountId) {
      payload.updated_at = new Date().toISOString();
    }

    const query = supabaseAdmin.from(config.table);

    const response = accountId
      ? await query
          .update(payload)
          .eq("id", accountId)
          .select(BANK_ACCOUNT_FIELDS)
          .maybeSingle<BankAccountRow>()
      : await query
          .insert(payload)
          .select(BANK_ACCOUNT_FIELDS)
          .maybeSingle<BankAccountRow>();

    if (response.error) {
      if (isMissingTableError(response.error)) {
        lastError = response.error;
        continue;
      }
      return NextResponse.json({ ok: false, error: response.error.message }, { status: 400 });
    }

    if (!response.data) {
      if (accountId) {
        return NextResponse.json({ ok: false, error: "Cuenta no encontrada" }, { status: 404 });
      }
      return NextResponse.json({ ok: false, error: "No se pudo guardar la cuenta" }, { status: 500 });
    }

    const status = accountId ? 200 : 201;
    return NextResponse.json({ ok: true, account: response.data }, { status });
  }

  if (lastError && isMissingTableError(lastError)) {
    return NextResponse.json(
      { ok: false, error: "No hay tabla configurada para cuentas bancarias" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: false, error: "No se pudo guardar la cuenta" }, { status: 500 });
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    return await handleUpsert(req, params, "POST");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    return await handleUpsert(req, params, "PATCH");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
