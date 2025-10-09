import { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { InvestorNavigation } from "./ui/InvestorNavigation";
import { NotificationCenter } from "@/components/ui/NotificationCenter";

interface InvestorLayoutProps {
  children: ReactNode;
  params: Promise<{
    orgId: string;
  }>;
}

export default async function InvestorLayout({ children, params }: InvestorLayoutProps) {
  const { orgId } = await params;

  return (
    <div className="py-10">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <h1 className="font-colette text-3xl font-bold text-lp-primary-1">Portal de Inversionistas</h1>
            <p className="text-sm text-lp-sec-3">
              Visualiza tu portafolio, realiza seguimiento a rendimientos y mantente al día con los próximos flujos de caja.
            </p>
          </div>
          <NotificationCenter />
        </header>

        <InvestorNavigation orgId={orgId} />

        <main className="mt-8 space-y-8">{children}</main>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}
