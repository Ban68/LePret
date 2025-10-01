import { redirect } from "next/navigation";

import { OnboardingShell } from "../_components/OnboardingShell";
import { DocumentsStep } from "./DocumentsStep";

type SearchParams = Record<string, string | string[] | undefined>;

type DocumentosPageProps = {
  searchParams?: Promise<SearchParams>;
};

export default async function DocumentosPage({ searchParams }: DocumentosPageProps) {
  const params = (await searchParams) ?? {};
  const orgParam = params.orgId;
  const orgId = Array.isArray(orgParam) ? orgParam[0] : orgParam;
  if (!orgId) {
    redirect("/select-org?reason=missing-org");
  }

  return (
    <OnboardingShell
      companyId={orgId}
      currentStep={2}
      title="Documentación"
      description="Adjunta los documentos y envíalos para revisión"
    >
      {(onboarding) => <DocumentsStep companyId={orgId} onboarding={onboarding} />}
    </OnboardingShell>
  );
}
