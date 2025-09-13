import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function HqPage() {
  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const allowed = (process.env.BACKOFFICE_ALLOWED_EMAILS || "")
    .split(/[ ,\n\t]+/)
    .filter(Boolean)
    .map((s) => s.toLowerCase());
  const email = session?.user?.email?.toLowerCase();

  type CompanyRow = { id: string; name: string; type: string; created_at: string; invoices: number; requests: number };
  let companies: CompanyRow[] | null = null;
  if (session && (!allowed.length || (email && allowed.includes(email)))) {
    const { data: rows, error } = await supabaseAdmin
      .from("companies")
      .select("id, name, type, created_at")
      .order("created_at", { ascending: false });
    if (!error) {
      companies = [];
      for (const c of rows || []) {
        const [{ count: invCount }, { count: reqCount }] = await Promise.all([
          supabaseAdmin
            .from("invoices")
            .select("id", { count: "exact", head: true })
            .eq("company_id", c.id),
          supabaseAdmin
            .from("funding_requests")
            .select("id", { count: "exact", head: true })
            .eq("company_id", c.id),
        ]);
        companies.push({ ...c, invoices: invCount ?? 0, requests: reqCount ?? 0 });
      }
    }
  }

  return (
    <div className="py-10">
      <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <h1 className="font-colette text-3xl font-bold text-lp-primary-1">Backoffice — Organizaciones</h1>
        <p className="mt-2 text-lp-sec-3">Lista de empresas y accesos. (Sólo visible para emails autorizados)</p>

        {!companies ? (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">No autorizado o error cargando datos.</div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4">
            {companies.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-md border border-lp-sec-4/60 p-4">
                <div>
                  <div className="font-semibold text-lp-primary-1">{c.name}</div>
                  <div className="text-sm text-lp-sec-3">{c.type} · Facturas: {c.invoices} · Solicitudes: {c.requests}</div>
                </div>
                <Link href={`/hq/companies/${c.id}`} className="rounded-md bg-lp-primary-1 px-3 py-2 text-sm font-medium text-lp-primary-2 hover:opacity-90">Ver</Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
