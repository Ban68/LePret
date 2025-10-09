import { ReactNode } from "react";
import { supabaseServer } from "@/lib/supabase-server";
import { isBackofficeAllowed } from "@/lib/hq-auth";
import { Toaster } from "@/components/ui/sonner";
import { HqNavigation } from "./ui/HqNavigation";
import { NotificationCenter } from "@/components/ui/NotificationCenter";

export const dynamic = "force-dynamic";

interface HqLayoutProps {
  children: ReactNode;
}

export default async function HqLayout({ children }: HqLayoutProps) {
  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isAllowed = session ? await isBackofficeAllowed(session.user?.id, session.user?.email) : false;

  if (!isAllowed) {
    return (
      <div className="py-10">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            No tienes permiso para ver esta página.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-10">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-colette text-3xl font-bold text-lp-primary-1">Backoffice HQ</h1>
            <p className="mt-2 text-sm text-lp-sec-3">
              Panel de control con métricas, operaciones y gestión de usuarios.
            </p>
          </div>
          <NotificationCenter />
        </header>

        <HqNavigation />

        <main className="mt-8 space-y-8">{children}</main>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}
