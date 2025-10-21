import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { isBackofficeAllowed } from "@/lib/hq-auth";

type OverrideRow = {
  company_id: string;
  discount_rate: number | null;
  operation_days: number | null;
  advance_pct: number | null;
  updated_at: string | null;
  updated_by: string | null;
};

export async function GET(req: Request) {
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

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const withOverridesOnly = url.searchParams.get("withOverrides") === "true";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "25"), 1), 100);

  try {
    if (withOverridesOnly) {
      const { data: overrides, error: overridesError } = await supabaseAdmin
        .from<OverrideRow>("hq_company_parameters")
        .select("company_id, discount_rate, operation_days, advance_pct, updated_at, updated_by")
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (overridesError) throw new Error(overridesError.message);

      const companyIds = overrides?.map((row) => row.company_id) ?? [];
      const [companiesRes, profilesRes] = await Promise.all([
        companyIds.length
          ? supabaseAdmin.from("companies").select("id, name, type").in("id", companyIds)
          : Promise.resolve({ data: [] as Array<{ id: string; name: string; type: string | null }>, error: null }),
        overrides?.length
          ? supabaseAdmin
              .from("profiles")
              .select("user_id, full_name")
              .in(
                "user_id",
                overrides
                  .map((row) => row.updated_by)
                  .filter((value): value is string => typeof value === "string" && value.length > 0),
              )
          : Promise.resolve({ data: [] as Array<{ user_id: string; full_name: string | null }>, error: null }),
      ]);

      if (companiesRes.error) throw new Error(companiesRes.error.message);
      if (profilesRes.error) throw new Error(profilesRes.error.message);

      const companyMap = new Map(companiesRes.data?.map((company) => [company.id, company]));
      const profileMap = new Map(profilesRes.data?.map((profile) => [profile.user_id, profile.full_name ?? null]));

      const result = (overrides ?? []).map((row) => ({
        id: row.company_id,
        name: companyMap.get(row.company_id)?.name ?? "Sin nombre",
        type: companyMap.get(row.company_id)?.type ?? null,
        overrides: {
          discountRate: typeof row.discount_rate === "number" ? row.discount_rate : null,
          operationDays:
            typeof row.operation_days === "number" && Number.isFinite(row.operation_days)
              ? Math.round(row.operation_days)
              : null,
          advancePct: typeof row.advance_pct === "number" ? row.advance_pct : null,
        },
        updatedAt: row.updated_at ?? null,
        updatedBy: row.updated_by
          ? {
              id: row.updated_by,
              name: profileMap.get(row.updated_by) ?? null,
            }
          : null,
      }));

      return NextResponse.json({ ok: true, companies: result });
    }

    let query = supabaseAdmin
      .from("companies")
      .select("id, name, type")
      .order("name", { ascending: true })
      .limit(limit);

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    const { data: companies, error } = await query;
    if (error) throw new Error(error.message);

    const companyIds = companies?.map((company) => company.id) ?? [];
    const { data: overrides } = companyIds.length
      ? await supabaseAdmin
          .from<OverrideRow>("hq_company_parameters")
          .select("company_id, discount_rate, operation_days, advance_pct, updated_at, updated_by")
          .in("company_id", companyIds)
      : { data: [] as OverrideRow[] };

    const overridesMap = new Map(overrides?.map((row) => [row.company_id, row]));

    const result = (companies ?? []).map((company) => {
      const override = overridesMap.get(company.id);
      return {
        id: company.id,
        name: company.name,
        type: company.type ?? null,
        overrides: override
          ? {
              discountRate: typeof override.discount_rate === "number" ? override.discount_rate : null,
              operationDays:
                typeof override.operation_days === "number" && Number.isFinite(override.operation_days)
                  ? Math.round(override.operation_days)
                  : null,
              advancePct: typeof override.advance_pct === "number" ? override.advance_pct : null,
            }
          : null,
        updatedAt: override?.updated_at ?? null,
        updatedBy: override?.updated_by ?? null,
      };
    });

    return NextResponse.json({ ok: true, companies: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    console.error("[hq-settings:companies] GET", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
