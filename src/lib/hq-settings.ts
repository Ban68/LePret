import { supabaseAdmin } from "@/lib/supabase";

export type CustomerSegment = "default" | "startup" | "pyme" | "corporativo";

export type HqParameterSettings = {
  discountRate: number; // porcentaje EA
  creditLimits: Record<CustomerSegment | string, number>;
  terms: Record<CustomerSegment | string, number>; // días
  autoApproval?: {
    maxExposureRatio: number; // exposición acumulada vs límite
    maxTenorBufferDays: number; // días adicionales permitidos sobre el plazo configurado
    minRiskLevel?: "low" | "medium" | "high";
  };
};

export type HqSettingsRecord = {
  key: string;
  value: HqParameterSettings;
  updated_at: string | null;
  updated_by: string | null;
};

export const DEFAULT_HQ_SETTINGS: HqParameterSettings = {
  discountRate: 24,
  creditLimits: {
    default: 250_000_000,
    startup: 150_000_000,
    pyme: 300_000_000,
    corporativo: 600_000_000,
  },
  terms: {
    default: 90,
    startup: 75,
    pyme: 90,
    corporativo: 120,
  },
  autoApproval: {
    maxExposureRatio: 1,
    maxTenorBufferDays: 5,
    minRiskLevel: "medium",
  },
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/[,\s]/g, (match) => (match === "," ? "." : ""));
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function normalizeHqSettings(input: unknown): HqParameterSettings {
  const base: HqParameterSettings = JSON.parse(JSON.stringify(DEFAULT_HQ_SETTINGS));
  if (!input || typeof input !== "object") {
    return base;
  }

  const value = input as Partial<HqParameterSettings> & {
    discountRate?: unknown;
    creditLimits?: Record<string, unknown>;
    terms?: Record<string, unknown>;
    autoApproval?: Record<string, unknown>;
  };

  const discount = toNumber(value.discountRate);
  if (discount !== null) {
    base.discountRate = discount;
  }

  if (value.creditLimits && typeof value.creditLimits === "object") {
    for (const [segment, limit] of Object.entries(value.creditLimits)) {
      const numeric = toNumber(limit);
      if (numeric !== null) {
        base.creditLimits[segment] = numeric;
      }
    }
  }

  if (value.terms && typeof value.terms === "object") {
    for (const [segment, term] of Object.entries(value.terms)) {
      const numeric = toNumber(term);
      if (numeric !== null) {
        base.terms[segment] = numeric;
      }
    }
  }

  if (value.autoApproval && typeof value.autoApproval === "object") {
    const ratio = toNumber(value.autoApproval.maxExposureRatio);
    if (ratio !== null && ratio > 0) {
      base.autoApproval = {
        ...base.autoApproval,
        maxExposureRatio: ratio,
      };
    }
    const buffer = toNumber(value.autoApproval.maxTenorBufferDays);
    if (buffer !== null && buffer >= 0) {
      base.autoApproval = {
        ...base.autoApproval,
        maxTenorBufferDays: buffer,
      };
    }
    const minLevel = value.autoApproval.minRiskLevel;
    if (minLevel === "low" || minLevel === "medium" || minLevel === "high") {
      base.autoApproval = {
        ...base.autoApproval,
        minRiskLevel: minLevel,
      };
    }
  }

  return base;
}

export async function getHqSettings(): Promise<{ record: HqSettingsRecord | null; settings: HqParameterSettings }> {
  const { data, error } = await supabaseAdmin
    .from("hq_settings")
    .select("key, value, updated_at, updated_by")
    .eq("key", "lending_parameters")
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116" || error.code === "PGRST103" || error.code === "PGRST204") {
      return { record: null, settings: DEFAULT_HQ_SETTINGS };
    }
    throw new Error(error.message);
  }

  if (!data) {
    return { record: null, settings: DEFAULT_HQ_SETTINGS };
  }

  const settings = normalizeHqSettings(data.value);

  return {
    record: {
      key: data.key,
      value: settings,
      updated_at: data.updated_at ?? null,
      updated_by: data.updated_by ?? null,
    },
    settings,
  };
}
