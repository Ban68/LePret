import { redirect } from "next/navigation";

import { OnboardingShell } from "../_components/OnboardingShell";
import { CompanyForm } from "./CompanyForm";

type SearchParams = Record<string, string | string[] | undefined>;

type DatosEmpresaPageProps = {
  searchParams?: Promise<SearchParams>;
};

export default async function DatosEmpresaPage({ searchParams }: DatosEmpresaPageProps) {
  const params = (await searchParams) ?? {};
  const orgParam = params.orgId;
  const orgId = Array.isArray(orgParam) ? orgParam[0] : orgParam;
  if (!orgId) {
    redirect("/select-org?reason=missing-org");
  }

  return (
    <OnboardingShell companyId={orgId} currentStep={0} title="Datos de la empresa">
      <CompanyForm companyId={orgId} />
    </OnboardingShell>
  );
}

