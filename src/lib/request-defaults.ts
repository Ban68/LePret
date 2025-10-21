import { supabaseAdmin } from "@/lib/supabase";
import { resolveCompanyDefaults } from "@/lib/hq-company-parameters";

type ApplyDefaultsOptions = {
  requestId: string;
  companyId: string;
  companyType?: string | null;
};

export async function applyRequestDefaults(options: ApplyDefaultsOptions) {
  const { requestId, companyId } = options;
  const companyType = await resolveCompanyType(companyId, options.companyType);
  const resolved = await resolveCompanyDefaults({ companyId, companyType });

  const { error } = await supabaseAdmin
    .from("funding_requests")
    .update({
      default_discount_rate: resolved.discountRate,
      default_operation_days: resolved.operationDays,
      default_advance_pct: resolved.advancePct,
      default_settings_source: resolved.source,
    })
    .eq("id", requestId)
    .eq("company_id", companyId);

  if (error) {
    throw new Error(error.message);
  }

  return resolved;
}

async function resolveCompanyType(companyId: string, provided?: string | null) {
  if (typeof provided === "string") {
    return provided;
  }

  const { data, error } = await supabaseAdmin
    .from("companies")
    .select("type")
    .eq("id", companyId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.type ?? null;
}
