import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { PostgrestError } from "@supabase/supabase-js";

import { getSupabaseAdminClient } from "@/lib/supabase";

const NOTIFICATION_FREQUENCIES = new Set(["instant", "daily", "weekly", "monthly"]);

type RouteContext = { params: Promise<{ orgId: string }> };

type SessionContext = {
  sessionUserId: string | null;
  isStaff: boolean;
  membership: { status?: string | null } | null;
};

type NotificationPreference = {
  id: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  frequency: string;
  investor_org_id?: string | null;
  org_id?: string | null;
};

type TableConfig = {
  table: string;
  orgColumn: string;
  emailColumn: string;
  smsColumn: string;
  frequencyColumn: string;
};

const NOTIFICATION_TABLES: TableConfig[] = [
  {
    table: "investor_notification_preferences",
    orgColumn: "investor_org_id",
    emailColumn: "email_enabled",
    smsColumn: "sms_enabled",
    frequencyColumn: "frequency",
  },
  {
    table: "notification_preferences",
    orgColumn: "org_id",
    emailColumn: "email_enabled",
    smsColumn: "sms_enabled",
    frequencyColumn: "frequency",
  },
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

function normalizeFrequency(value: unknown): string {
  if (typeof value !== "string") {
    return "weekly";
  }
  const trimmed = value.trim().toLowerCase();
  return NOTIFICATION_FREQUENCIES.has(trimmed) ? trimmed : "weekly";
}

async function fetchPreference(orgId: string) {
  const supabaseAdmin = getSupabaseAdminClient();
  let lastConfig: TableConfig | null = null;

  for (const config of NOTIFICATION_TABLES) {
    const { data, error } = await supabaseAdmin
      .from(config.table)
      .select(
        `id,${config.emailColumn},${config.smsColumn},${config.frequencyColumn},${config.orgColumn}`,
      )
      .eq(config.orgColumn, orgId)
      .limit(1)
      .maybeSingle<NotificationPreference>();

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

function parseBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`El campo ${field} debe ser booleano`);
  }
  return value;
}

function parseFrequency(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("La frecuencia es obligatoria");
  }
  const trimmed = value.trim().toLowerCase();
  if (!NOTIFICATION_FREQUENCIES.has(trimmed)) {
    throw new Error("Frecuencia de notificación inválida");
  }
  return trimmed;
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

    const result = await fetchPreference(orgId);

    if (!result) {
      return NextResponse.json({
        ok: true,
        preference: {
          id: null,
          email: true,
          sms: false,
          frequency: "weekly",
        },
      });
    }

    const { record, config } = result;
    if (!record) {
      return NextResponse.json({
        ok: true,
        preference: {
          id: null,
          email: true,
          sms: false,
          frequency: "weekly",
        },
      });
    }

    const preference = {
      id: record.id,
      email: Boolean((record as Record<string, unknown>)[config.emailColumn]),
      sms: Boolean((record as Record<string, unknown>)[config.smsColumn]),
      frequency: normalizeFrequency((record as Record<string, unknown>)[config.frequencyColumn]),
    };

    return NextResponse.json({ ok: true, preference });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
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

    const preferenceId = typeof body.id === "string" ? body.id.trim() : "";
    let email: boolean;
    let sms: boolean;
    let frequency: string;

    try {
      email = parseBoolean(body.email, "email");
      sms = parseBoolean(body.sms, "sms");
      frequency = parseFrequency(body.frequency);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Datos inválidos";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdminClient();
    let lastError: PostgrestError | null = null;

    for (const config of NOTIFICATION_TABLES) {
      const payload: Record<string, unknown> = {
        [config.orgColumn]: orgId,
        [config.emailColumn]: email,
        [config.smsColumn]: sms,
        [config.frequencyColumn]: frequency,
      };

      const query = supabaseAdmin.from(config.table);

      const response = preferenceId
        ? await query
            .update(payload)
            .eq("id", preferenceId)
            .select(
              `id,${config.emailColumn},${config.smsColumn},${config.frequencyColumn},${config.orgColumn}`,
            )
            .maybeSingle<NotificationPreference>()
        : await query
            .upsert(payload, { onConflict: config.orgColumn })
            .select(
              `id,${config.emailColumn},${config.smsColumn},${config.frequencyColumn},${config.orgColumn}`,
            )
            .maybeSingle<NotificationPreference>();

      if (response.error) {
        if (isMissingTableError(response.error)) {
          lastError = response.error;
          continue;
        }
        return NextResponse.json({ ok: false, error: response.error.message }, { status: 400 });
      }

      const record = response.data;
      if (!record) {
        if (preferenceId) {
          return NextResponse.json({ ok: false, error: "Preferencia no encontrada" }, { status: 404 });
        }
        return NextResponse.json({ ok: false, error: "No se pudo guardar la preferencia" }, { status: 500 });
      }

      const preference = {
        id: record.id,
        email: Boolean((record as Record<string, unknown>)[config.emailColumn]),
        sms: Boolean((record as Record<string, unknown>)[config.smsColumn]),
        frequency: normalizeFrequency((record as Record<string, unknown>)[config.frequencyColumn]),
      };

      return NextResponse.json({ ok: true, preference });
    }

    if (lastError && isMissingTableError(lastError)) {
      return NextResponse.json(
        { ok: false, error: "No hay tabla configurada para preferencias" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: false, error: "No se pudo guardar la preferencia" }, { status: 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
