import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { supabaseServer } from "@/lib/supabase-server";
import { InvestorNav } from "./InvestorNav";
import { fetchInvestorCompanyProfile, getDefaultInvestorCompanyId } from "@/lib/investors";

const NAV_ITEMS = [
  { href: "/inversionistas", label: "Resumen" },
  { href: "/inversionistas/positions", label: "Posiciones" },
  { href: "/inversionistas/documents", label: "Documentos" },
];

export const dynamic = "force-dynamic";

export default async function InvestorLayout({ children }: { children: ReactNode }) {
  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const redirectTarget = encodeURIComponent("/inversionistas");

  if (!session) {
    redirect(`/login?redirectTo=${redirectTarget}`);
  }

  const companyId = await getDefaultInvestorCompanyId(session.user?.id);

  if (!companyId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-white">
        <div className="max-w-md rounded-xl border border-red-100 bg-red-50 p-8 text-center text-sm text-red-700">
          <p className="font-medium">No tienes una cuenta de inversionista asociada.</p>
          <p className="mt-2 text-xs text-red-600/80">
            Contacta al equipo de soporte para activar tu acceso.
          </p>
        </div>
      </div>
    );
  }

  const company = await fetchInvestorCompanyProfile(supabase, companyId);
  const companyName = company?.name?.trim() || "Portafolio de inversión";

  return (
    <div className="min-h-screen bg-gradient-to-b from-lp-primary-1/5 via-white to-white">
      <header className="border-b border-lp-sec-5/40 bg-white/90 backdrop-blur">
        <div className="container mx-auto flex max-w-6xl flex-col gap-2 px-4 py-10">
          <span className="text-xs uppercase tracking-[0.2em] text-lp-sec-4">Portal de inversionistas</span>
          <h1 className="font-colette text-3xl font-semibold text-lp-primary-1">{companyName}</h1>
          <p className="max-w-2xl text-sm text-lp-sec-3">
            Visualiza el rendimiento de tus vehículos, descárgate estados financieros y consulta las últimas
            distribuciones en un solo lugar.
          </p>
        </div>
      </header>
      <InvestorNav items={NAV_ITEMS} />
      <main className="container mx-auto max-w-6xl px-4 py-10">{children}</main>
    </div>
  );
}
