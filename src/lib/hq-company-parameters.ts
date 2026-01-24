import { supabaseAdmin } from "@/lib/supabase";
import { getHqSettings, type HqParameterSettings } from "@/lib/hq-settings";

export type CompanyParameterOverrides = {
  company_id: string;
  discount_rate: number | null;
  operation_days: number | null;
  advance_pct: number | null;
  updated_at: string | null;
  updated_by: string | null;
};

export type ResolvedCompanyDefaults = {
  discountRate: number;
  operationDays: number;
  advancePct: number;
  source: "company_override" | "segment_default" | "global_default";
  settings: HqParameterSettings;
};

function clampNumber(value: unknown, { min, max }: { min?: number; max?: number }) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (typeof min === "number" && numeric < min) return min;
  if (typeof max === "number" && numeric > max) return max;
  return numeric;
}

export async function getCompanyParameterOverride(companyId: string): Promise<CompanyParameterOverrides | null> {
  const { data, error } = await supabaseAdmin
    .from("hq_company_parameters")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116" || error.code === "PGRST103") {
      return null;
    }
    throw new Error(error.message);
  }

  return data ?? null;
}

type ResolveOptions = {
  companyId: string;
  companyType?: string | null;
};

export async function resolveCompanyDefaults(options: ResolveOptions): Promise<ResolvedCompanyDefaults> {
  const { companyId, companyType } = options;
  const [{ settings }, override] = await Promise.all([getHqSettings(), getCompanyParameterOverride(companyId)]);

  const baseDiscount = clampNumber(override?.discount_rate, { min: 0, max: 200 });
  const baseAdvance = clampNumber(override?.advance_pct, { min: 0, max: 100 });
  const baseOperationDays = (() => {
    const numeric = Number(override?.operation_days);
    return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
  })();

  if (baseDiscount !== null || baseAdvance !== null || baseOperationDays !== null) {
    return {
      discountRate: baseDiscount ?? settings.discountRate ?? 24,
      operationDays: baseOperationDays ?? resolveTerm(settings, companyType),
      advancePct: baseAdvance ?? resolveAdvance(baseDiscount ?? settings.discountRate ?? 24),
      source: "company_override",
      settings,
    };
  }

  const resolvedTerm = resolveTerm(settings, companyType);
  const resolvedDiscount = settings.discountRate ?? 24;

  return {
    discountRate: resolvedDiscount,
    operationDays: resolvedTerm,
    advancePct: resolveAdvance(resolvedDiscount),
    source: companyType ? "segment_default" : "global_default",
    settings,
  };
}

function resolveTerm(settings: HqParameterSettings, companyType?: string | null): number {
  const segment = resolveCompanySegment(companyType);
  const value = settings.terms[segment] ?? settings.terms.default ?? 90;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 90;
  }
  return Math.round(numeric);
}

export function resolveCompanySegment(companyType: string | null | undefined): string {
  if (!companyType) return "default";
  const normalized = companyType.toLowerCase();
  if (normalized.includes("corp")) return "corporativo";
  if (normalized.includes("start")) return "startup";
  if (normalized.includes("pyme") || normalized.includes("sme")) return "pyme";
  return "default";
}

function resolveAdvance(discountRate: number): number {
  const bounded = clampNumber(discountRate, { min: 0, max: 200 }) ?? 24;
  const computed = 100 - bounded / 2;
  return Math.max(50, Math.min(95, Math.round(computed)));
}

type UpsertPayload = {
  discount_rate?: number | null;
  operation_days?: number | null;
  advance_pct?: number | null;
};

export async function upsertCompanyParameters(companyId: string, payload: UpsertPayload, actorId?: string | null) {
  const values: UpsertPayload & { updated_by: string | null } = {
    discount_rate: payload.discount_rate ?? null,
    operation_days: payload.operation_days ?? null,
    advance_pct: payload.advance_pct ?? null,
    updated_by: actorId ?? null,
  };

  const { error } = await supabaseAdmin
    .from("hq_company_parameters")
    .upsert(
      { company_id: companyId, ...values, updated_at: new Date().toISOString() },
      { onConflict: "company_id" },
    );

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteCompanyParameters(companyId: string) {
  const { error } = await supabaseAdmin.from("hq_company_parameters").delete().eq("company_id", companyId);
  if (error) {
    throw new Error(error.message);
  }
}
