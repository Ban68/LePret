import { NextResponse } from "next/server";

import { isBackofficeAllowed } from "@/lib/hq-auth";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { DEFAULT_HQ_SETTINGS, getHqSettings, normalizeHqSettings, type HqParameterSettings } from "@/lib/hq-settings";

export const dynamic = "force-dynamic";

async function requireSession() {
  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

function sanitizeSettings(input: unknown, current: HqParameterSettings): HqParameterSettings {
  const base = {
    discountRate: current.discountRate,
    creditLimits: { ...current.creditLimits },
    terms: { ...current.terms },
    autoApproval: current.autoApproval,
  } satisfies HqParameterSettings;

  if (!input || typeof input !== "object") {
    return base;
  }

  const next = input as Partial<{ discountRate: unknown; creditLimits: Record<string, unknown>; terms: Record<string, unknown> }>;

  const discount = Number(next.discountRate);
  if (Number.isFinite(discount) && discount >= 0 && discount <= 200) {
    base.discountRate = discount;
  }

  if (next.creditLimits && typeof next.creditLimits === "object") {
    for (const [segment, value] of Object.entries(next.creditLimits)) {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric >= 0) {
        base.creditLimits[segment] = numeric;
      }
    }
  }

  if (next.terms && typeof next.terms === "object") {
    for (const [segment, value] of Object.entries(next.terms)) {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric >= 0) {
        base.terms[segment] = numeric;
      }
    }
  }

  return normalizeHqSettings(base);
}

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const allowed = await isBackofficeAllowed(session.user?.id, session.user?.email);
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
  }

  try {
    const { record, settings } = await getHqSettings();
    let updatedBy: { id: string | null; name: string | null; email: string | null } | null = null;
    if (record?.updated_by) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('user_id, full_name')
        .eq('user_id', record.updated_by)
        .maybeSingle();
      if (profile) {
        updatedBy = {
          id: profile.user_id ?? record.updated_by,
          name: profile.full_name ?? null,
          email: null,
        };
      } else {
        updatedBy = { id: record.updated_by, name: null, email: null };
      }
    }

    return NextResponse.json({ ok: true, settings, updatedAt: record?.updated_at ?? null, updatedBy });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado";
    console.error("[hq-settings] GET", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const allowed = await isBackofficeAllowed(session.user?.id, session.user?.email);
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
  }

  try {
    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ ok: false, error: "Payload inválido" }, { status: 400 });
    }

    const currentSettings = (await getHqSettings()).settings ?? DEFAULT_HQ_SETTINGS;
    const sanitized = sanitizeSettings(payload, currentSettings);

    const upsertPayload = {
      key: 'lending_parameters',
      value: sanitized,
      updated_by: session.user?.id ?? null,
      updated_at: new Date().toISOString(),
    } as const;

    const { error } = await supabaseAdmin.from('hq_settings').upsert(upsertPayload, { onConflict: 'key' });
    if (error) {
      throw new Error(error.message);
    }

    const { record, settings } = await getHqSettings();
    let updatedBy: { id: string | null; name: string | null; email: string | null } | null = null;
    if (record?.updated_by) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('user_id, full_name')
        .eq('user_id', record.updated_by)
        .maybeSingle();
      if (profile) {
        updatedBy = {
          id: profile.user_id ?? record.updated_by,
          name: profile.full_name ?? null,
          email: null,
        };
      } else {
        updatedBy = { id: record.updated_by, name: null, email: null };
      }
    }

    return NextResponse.json({ ok: true, settings, updatedAt: record?.updated_at ?? upsertPayload.updated_at, updatedBy });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado";
    console.error("[hq-settings] PATCH", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
