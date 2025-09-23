import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { isBackofficeAllowed } from "@/lib/hq-auth";
import { RequestsBoard } from "./ui/RequestsBoard";
import { UsersManager } from "./ui/UsersManager";
import { DashboardMetrics } from "./ui/DashboardMetrics";

export const dynamic = "force-dynamic";

export default async function HqPage() {
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
            <p>
              No tienes permiso para ver esta página. {" "}
              <Link href="/login?redirectTo=/hq" className="underline">
                Inicia sesión con una cuenta autorizada
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Companies are still needed for the UsersManager dropdown
  const { data: companies } = await supabaseAdmin
    .from("companies")
    .select("id, name, type")
    .order("name", { ascending: true });

  return (
    <div className="py-10">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="font-colette text-3xl font-bold text-lp-primary-1">Backoffice HQ</h1>
          <p className="mt-2 text-sm text-lp-sec-3">
            Panel de control con métricas, operaciones y gestión de usuarios.
          </p>
        </header>

        <div className="space-y-8">
          <DashboardMetrics />
          <RequestsBoard />
          <UsersManager companies={companies ?? []} />
        </div>
      </div>
    </div>
  );
}
