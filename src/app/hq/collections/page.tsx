import Link from "next/link";

import { supabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { isBackofficeAllowed } from "@/lib/hq-auth";
import type { CollectionCaseSummary } from "@/lib/request-timeline";

export const dynamic = "force-dynamic";

function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const options: Intl.DateTimeFormatOptions = withTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" };
  return new Intl.DateTimeFormat("es-CO", options).format(date);
}

function formatCurrency(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "-";
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) return String(value);
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

export default async function CollectionsPage() {
  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const allowed = session ? await isBackofficeAllowed(session.user?.id, session.user?.email) : false;

  if (!allowed) {
    return (
      <div className="py-10">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            No tienes permiso para ver esta sección.
          </div>
        </div>
      </div>
    );
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { data: cases, error } = await supabaseAdmin
    .from("collection_case_summaries")
    .select(
      "id, request_id, company_id, company_name, status, priority, opened_at, next_action_at, promise_date, promise_amount, actions_count, request_status"
    )
    .order("opened_at", { ascending: false })
    .limit(40);

  if (error) {
    throw new Error(error.message);
  }

  const items = (cases ?? []) as CollectionCaseSummary[];

  return (
    <div className="py-10">
      <div className="container mx-auto max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
        <header>
          <h1 className="font-colette text-3xl font-bold text-lp-primary-1">Casos de cobranza</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Gestiona recordatorios, compromisos de pago y el cierre de las operaciones en seguimiento.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {items.length === 0 ? (
            <div className="col-span-full rounded-lg border border-dashed border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500">
              No hay casos de cobranza activos.
            </div>
          ) : (
            items.map((item) => (
              <article key={item.id} className="flex h-full flex-col justify-between rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs uppercase tracking-wide text-neutral-500">
                    <span>#{item.request_id.slice(0, 8)}</span>
                    <span className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-700">
                      {item.status}
                    </span>
                  </div>
                  <h2 className="text-base font-semibold text-neutral-900">{item.company_name || item.company_id}</h2>
                  <dl className="grid grid-cols-2 gap-3 text-sm text-neutral-600">
                    <div>
                      <dt className="text-xs text-neutral-400">Próxima acción</dt>
                      <dd>{formatDate(item.next_action_at, true)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-neutral-400">Promesa de pago</dt>
                      <dd>{formatDate(item.promise_date)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-neutral-400">Monto</dt>
                      <dd>{formatCurrency(item.promise_amount)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-neutral-400">Acciones</dt>
                      <dd>{item.actions_count ?? 0}</dd>
                    </div>
                  </dl>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-neutral-500">Solicitud {item.request_status}</span>
                  <Link
                    href={`/hq/collections/${item.id}`}
                    className="inline-flex items-center rounded-md border border-lp-primary-1 px-3 py-1.5 text-sm font-medium text-lp-primary-1 transition-colors hover:bg-lp-primary-1/10"
                  >
                    Ver detalle
                  </Link>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

