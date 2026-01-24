import { supabaseServer } from "@/lib/supabase-server";
import { getOrganizationDisplayName } from "@/lib/organizations";

import { DashboardSummary } from "../ui/DashboardSummary";

export default async function ClientDashboardPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const orgName = await getOrganizationDisplayName(supabase, orgId, session?.user?.id ?? null);
  const displayOrg = orgName ?? orgId;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-colette text-3xl font-bold text-lp-primary-1">Dashboard</h1>
        <p className="text-lp-sec-3">
          Un resumen de tus operaciones y próximos pasos para la organización {" "}
          <span className="font-semibold text-lp-primary-1">{displayOrg}</span>.
        </p>
      </div>
      <DashboardSummary orgId={orgId} />
    </div>
  );
}
