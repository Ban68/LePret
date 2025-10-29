import { getSupabaseAdminClient } from "@/lib/supabase";

import { InvestorDataManager } from "../ui/InvestorDataManager";

export const dynamic = "force-dynamic";

export default async function HqInvestorsPage() {
  const supabaseAdmin = getSupabaseAdminClient();
  const { data: investorCompanies, error } = await supabaseAdmin
    .from("companies")
    .select("id, name, investor_kind, type")
    .eq("type", "INVESTOR")
    .order("name", { ascending: true });

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        No fue posible cargar las organizaciones de inversionistas: {error.message}
      </div>
    );
  }

  return <InvestorDataManager companies={investorCompanies ?? []} />;
}

