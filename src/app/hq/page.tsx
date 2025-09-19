import Link from "next/link";

import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { isBackofficeAllowed } from "@/lib/hq-auth";
import { RequestsBoard } from "./ui/RequestsBoard";
import { UsersManager } from "./ui/UsersManager";

export const dynamic = "force-dynamic";

type CompanyRow = {
  id: string;
  name: string;
  type: string;
  created_at: string;
  invoices: number;
  requests: number;
};

export default async function HqPage() {
  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isAllowed = session ? await isBackofficeAllowed(session.user?.id, session.user?.email) : false;

  let companies: CompanyRow[] | null = null;
  if (session && isAllowed) {
    const { data: rows, error } = await supabaseAdmin
      .from("companies")
      .select("id, name, type, created_at")
      .order("created_at", { ascending: false });
    if (!error) {
      companies = [];
      for (const company of rows || []) {
        const [{ count: invoiceCount }, { count: requestCount }] = await Promise.all([
          supabaseAdmin.from("invoices").select("id", { count: "exact", head: true }).eq("company_id", company.id),
          supabaseAdmin.from("funding_requests").select("id", { count: "exact", head: true }).eq("company_id", company.id),
        ]);
        companies.push({ ...company, invoices: invoiceCount ?? 0, requests: requestCount ?? 0 });
      }
    }
  }

  return (
    <div className="py-10">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="font-colette text-3xl font-bold text-lp-primary-1">Backoffice HQ</h1>
          <p className="mt-2 text-sm text-lp-sec-3">
            Gestiona organizaciones y solicitudes desde un panel unificado para el equipo operativo.
          </p>
        </header>

        <div className="space-y-8">
          <section className="rounded-lg border border-lp-sec-4/60 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-lp-primary-1">Organizaciones</h2>
                <p className="text-sm text-lp-sec-3">Resumen rapido de empresas habilitadas en el portal.</p>
              </div>
              <span className="rounded-full bg-lp-sec-4/60 px-3 py-1 text-xs font-medium text-lp-primary-1">
                {companies ? companies.length : 0} registradas
              </span>
            </div>

            {!companies ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                No autorizado o error cargando datos.
              </div>
            ) : companies.length === 0 ? (
              <div className="rounded-md border border-dashed border-lp-sec-4/60 p-4 text-sm text-lp-sec-3">
                Aun no hay empresas registradas.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {companies.map((company) => (
                  <div
                    key={company.id}
                    className="flex items-center justify-between rounded-md border border-lp-sec-4/60 p-4"
                  >
                    <div>
                      <div className="font-semibold text-lp-primary-1">{company.name}</div>
                      <div className="text-xs text-lp-sec-3">
                        Tipo: {company.type} | Facturas: {company.invoices} | Solicitudes: {company.requests}
                      </div>
                    </div>
                    <Link
                      href={`/hq/companies/${company.id}`}
                      className="rounded-md bg-lp-primary-1 px-3 py-2 text-xs font-medium text-lp-primary-2 hover:opacity-90"
                    >
                      Ver detalle
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          <RequestsBoard />


          <UsersManager companies={companies ?? []} />
        </div>
      </div>
    </div>
  );
}
