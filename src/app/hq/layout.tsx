import { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { HqNavigation } from "./ui/HqNavigation";
import { HqAccessGate } from "./ui/HqAccessGate";

export const dynamic = "force-dynamic";

interface HqLayoutProps {
  children: ReactNode;
}

export default function HqLayout({ children }: HqLayoutProps) {
  return (
    <HqAccessGate>
      <div className="py-10">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <header className="mb-8">
            <h1 className="font-colette text-3xl font-bold text-lp-primary-1">Backoffice HQ</h1>
            <p className="mt-2 text-sm text-lp-sec-3">
              Panel de control con métricas, operaciones y gestión de usuarios.
            </p>
          </header>

          <HqNavigation />

          <main className="mt-8 space-y-8">{children}</main>
        </div>
        <Toaster position="top-right" richColors />
      </div>
    </HqAccessGate>
  );
}
