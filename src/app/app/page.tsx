import { redirect } from "next/navigation";

import { supabaseServer } from "@/lib/supabase-server";
import { normalizeKycStatus } from "@/lib/organizations";

type SearchParams = Record<string, string | string[] | undefined>;

type AppPageProps = {
  searchParams?: Promise<SearchParams>;
};

export default async function AppPage({ searchParams }: AppPageProps) {
  const params = (await searchParams) ?? {};
  const orgParam = params.orgId;
  const orgId = Array.isArray(orgParam) ? orgParam[0] : orgParam;

  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect(`/login?redirectTo=${encodeURIComponent("/app")}`);
  }

  if (!orgId) {
    redirect("/select-org");
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("status, companies ( id, name, kyc_status )")
    .eq("company_id", orgId)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!membership || membership.status !== "ACTIVE") {
    redirect("/select-org?reason=no-membership");
  }

  const company = Array.isArray(membership.companies) ? membership.companies[0] : membership.companies;
  const kycStatus = normalizeKycStatus(company?.kyc_status ?? null);

  if (kycStatus !== "APPROVED") {
    redirect(`/registro/datos-empresa?orgId=${encodeURIComponent(orgId)}`);
  }

  const companyName = typeof company?.name === "string" && company.name.trim() ? company.name : "Tu empresa";

  return (
    <div className="py-20 sm:py-24">
      <div className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="font-colette text-3xl font-bold tracking-tight text-lp-primary-1 sm:text-4xl">
          Bienvenido al portal
        </h1>
        <p className="mt-4 text-lg leading-8 text-lp-sec-3">
          {companyName} ya tiene un KYC aprobado. Pronto podrás gestionar facturas y operaciones desde este espacio.
        </p>
        <div className="mt-10">
          <p className="text-base text-lp-sec-3">
            Mientras activamos las funcionalidades principales, puedes volver al selector de organizaciones para explorar otras
            cuentas.
          </p>
        </div>
      </div>
    </div>
  );
}
