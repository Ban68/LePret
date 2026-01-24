import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { isBackofficeAllowed } from "@/lib/hq-auth";
import {
  deleteCompanyParameters,
  getCompanyParameterOverride,
  upsertCompanyParameters,
  type CompanyParameterOverrides,
} from "@/lib/hq-company-parameters";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;

  const sessionClient = await supabaseServer();
  const {
    data: { session },
  } = await sessionClient.auth.getSession();

  if (!session) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const allowed = await isBackofficeAllowed(session.user?.id, session.user?.email);
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
  }

  try {
    const [companyRes, override] = await Promise.all([
      supabaseAdmin
        .from("companies")
        .select("id, name, type")
        .eq("id", companyId)
        .maybeSingle(),
      getCompanyParameterOverride(companyId),
    ]);

    if (companyRes.error) throw new Error(companyRes.error.message);

    if (!companyRes.data) {
      return NextResponse.json({ ok: false, error: "Cliente no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, company: companyRes.data, overrides: serializeOverride(override) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    console.error("[hq-settings:company] GET", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;

  const sessionClient = await supabaseServer();
  const {
    data: { session },
  } = await sessionClient.auth.getSession();

  if (!session) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const allowed = await isBackofficeAllowed(session.user?.id, session.user?.email);
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
  }

  try {
    const payload = await req.json().catch(() => ({}));
    if (payload?.clear === true) {
      await deleteCompanyParameters(companyId);
      return NextResponse.json({ ok: true, overrides: null });
    }

    const discountRate = normalizeNumber(payload?.discountRate, 0, 200);
    const advancePct = normalizeNumber(payload?.advancePct, 0, 100);
    const operationDays = normalizeInteger(payload?.operationDays, 1, 720);

    await upsertCompanyParameters(
      companyId,
      {
        discount_rate: discountRate,
        advance_pct: advancePct,
        operation_days: operationDays,
      },
      session.user?.id ?? null,
    );

    const override = await getCompanyParameterOverride(companyId);

    return NextResponse.json({ ok: true, overrides: serializeOverride(override) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    console.error("[hq-settings:company] PATCH", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function normalizeNumber(value: unknown, min: number, max: number): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  if (numeric < min) return min;
  if (numeric > max) return max;
  return numeric;
}

function normalizeInteger(value: unknown, min: number, max: number): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const rounded = Math.round(numeric);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

function serializeOverride(row: CompanyParameterOverrides | null) {
  if (!row) return null;
  return {
    discountRate: typeof row.discount_rate === "number" ? row.discount_rate : null,
    operationDays: typeof row.operation_days === "number" ? Math.round(row.operation_days) : null,
    advancePct: typeof row.advance_pct === "number" ? row.advance_pct : null,
    updatedAt: row.updated_at ?? null,
    updatedBy: row.updated_by ?? null,
  };
}
