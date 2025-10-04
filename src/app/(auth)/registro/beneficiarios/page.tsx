import { redirect } from "next/navigation";

import { OnboardingShell } from "../_components/OnboardingShell";
import { BeneficiariesForm } from "./BeneficiariesForm";

type SearchParams = Record<string, string | string[] | undefined>;

type BeneficiariosPageProps = {
  searchParams?: Promise<SearchParams>;
};

export default async function BeneficiariosPage({ searchParams }: BeneficiariosPageProps) {
  const params = (await searchParams) ?? {};
  const orgParam = params.orgId;
  const orgId = Array.isArray(orgParam) ? orgParam[0] : orgParam;
  if (!orgId) {
    redirect("/select-org?reason=missing-org");
  }

  return (
    <OnboardingShell companyId={orgId} currentStep={1} title="Beneficiarios finales">
      <BeneficiariesForm companyId={orgId} />
    </OnboardingShell>
  );
}

