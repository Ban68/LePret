"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import Link from "next/link";

import { Stepper } from "@/components/ui/stepper";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useOnboarding } from "./useOnboarding";

const STEPS = [
  { title: "Datos de la empresa", description: "Informaci??n legal y de contacto" },
  { title: "Beneficiarios", description: "Personas con participaci??n significativa" },
  { title: "Documentos", description: "Adjunta la documentaci??n requerida" },
] as const;

const OnboardingContext = createContext<ReturnType<typeof useOnboarding> | null>(null);

export function useOnboardingContext() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboardingContext must be used within OnboardingShell");
  }
  return ctx;
}

export type OnboardingShellProps = {
  companyId: string;
  currentStep: number;
  title: string;
  description?: string;
  children: ReactNode;
};

export function OnboardingShell({ companyId, currentStep, title, description, children }: OnboardingShellProps) {
  const onboarding = useOnboarding(companyId);
  const { data, loading, error } = onboarding;
  const companyName = data.company?.legalName || data.company?.name || "Tu empresa";

  const stepper = useMemo(
    () => <Stepper steps={STEPS} current={Math.min(Math.max(currentStep, 0), STEPS.length - 1)} className="w-full" />,
    [currentStep],
  );

  const skeleton = (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );

  return (
    <OnboardingContext.Provider value={onboarding}>
      <div className="space-y-8">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-wider text-lp-sec-3">Registro</p>
          <h1 className="font-colette text-3xl font-bold text-lp-primary-1">{title}</h1>
          <p className="text-lp-sec-3">{description ?? `Organizaci??n: ${companyName}`}</p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4">
            <div className="rounded-xl border border-lp-sec-4/40 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-lp-primary-1">Progreso</h2>
              <div className="mt-4 space-y-3 text-sm text-lp-sec-3">{stepper}</div>
            </div>
            <div className="rounded-xl border border-lp-sec-4/40 bg-lp-primary-1/5 p-4 text-sm text-lp-sec-2">
              <p className="font-medium text-lp-primary-1">??Necesitas ayuda?</p>
              <p className="mt-2">Escr??benos a <a href="mailto:soporte@lepret.com" className="underline">soporte@lepret.com</a>.</p>
              <p className="mt-2">Tambi??ne puedes regresar al selector de organizaciones si lo necesitas.</p>
              <Button asChild variant="outline" className="mt-4 w-full">
                <Link href="/select-org">Volver a organizaciones</Link>
              </Button>
            </div>
          </aside>

          <section className="space-y-6">
            {error && !loading ? (
              <Alert variant="destructive">
                <AlertTitle>Error cargando informaci??n</AlertTitle>
                <AlertDescription>
                  {error === "Forbidden"
                    ? "No tienes permisos para editar esta empresa."
                    : "No pudimos cargar la informaci??n. Intenta nuevamente."}
                </AlertDescription>
              </Alert>
            ) : null}

            {loading ? skeleton : <>{children}</>}
          </section>
        </div>
      </div>
    </OnboardingContext.Provider>
  );
}

export { STEPS as ONBOARDING_STEPS };
