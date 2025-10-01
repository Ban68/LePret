import Link from "next/link";
import { notFound } from "next/navigation";

import { TimelineFeed } from "@/components/app/timeline/TimelineFeed";
import { TimelineRealtimeBridge } from "@/components/app/timeline/TimelineRealtimeBridge";
import { TimelineNextSteps } from "@/components/app/timeline/TimelineNextSteps";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { isBackofficeAllowed } from "@/lib/hq-auth";
import { getCollectionCaseSummary, listCollectionActions } from "@/lib/collections";
import { computeClientNextSteps, getRequestTimeline } from "@/lib/request-timeline";

import { CaseUpdateForm } from "./ui/CaseUpdateForm";
import { CaseActionForm } from "./ui/CaseActionForm";
import { CaseMessageForm } from "./ui/CaseMessageForm";

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export const dynamic = "force-dynamic";

export default async function CollectionCasePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
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

  const summary = await getCollectionCaseSummary(supabaseAdmin, caseId);
  if (!summary) {
    notFound();
  }

  const [timeline, actions] = await Promise.all([
    getRequestTimeline(supabaseAdmin, summary.request_id),
    listCollectionActions(supabaseAdmin, caseId),
  ]);

  const nextSteps = computeClientNextSteps(summary.request_status, summary);

  return (
    <div className="py-10">
      <div className="container mx-auto max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-colette text-3xl font-bold text-lp-primary-1">Caso de cobranza</h1>
            <p className="mt-1 text-sm text-neutral-600">
              Seguimiento de recordatorios, promesas y comunicaciones asociadas.
            </p>
          </div>
          <Link href="/hq/collections" className="text-sm text-lp-primary-1 hover:underline">
            ← Volver al listado
          </Link>
        </div>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-semibold text-neutral-900">Resumen del caso</h2>
            <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Empresa</dt>
                <dd className="text-sm font-medium text-neutral-900">{summary.company_name || summary.company_id}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Solicitud</dt>
                <dd className="text-sm font-medium text-neutral-900">{summary.request_id}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Abierto</dt>
                <dd className="text-sm text-neutral-700">{formatDate(summary.opened_at)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Próxima acción</dt>
                <dd className="text-sm text-neutral-700">{formatDate(summary.next_action_at)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Promesa</dt>
                <dd className="text-sm text-neutral-700">{formatDate(summary.promise_date)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Estatus solicitud</dt>
                <dd className="text-sm text-neutral-700 capitalize">{summary.request_status}</dd>
              </div>
            </dl>
          </div>
          <TimelineNextSteps status={summary.request_status} nextSteps={nextSteps} />
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <CaseUpdateForm
              caseId={caseId}
              initialValues={{
                status: summary.status,
                next_action_at: summary.next_action_at ?? "",
                promise_date: summary.promise_date ?? "",
                promise_amount: summary.promise_amount ?? "",
                notes: summary.notes ?? "",
              }}
            />

            <CaseMessageForm caseId={caseId} requestId={summary.request_id} />

            <CaseActionForm caseId={caseId} />
          </div>

          <aside className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Acciones registradas</h2>
            {actions.length === 0 ? (
              <p className="mt-4 text-sm text-neutral-500">Todavía no hay acciones registradas.</p>
            ) : (
              <ul className="mt-4 space-y-3 text-sm text-neutral-700">
                {actions.map((action) => (
                  <li key={action.id} className="rounded-md border border-neutral-100 bg-neutral-50 p-3">
                    <p className="font-medium text-neutral-900">{action.action_type}</p>
                    {action.note ? <p className="text-sm text-neutral-600">{action.note}</p> : null}
                    <div className="mt-2 text-xs text-neutral-500">
                      <span>Creada: {formatDate(action.created_at)}</span>
                      {action.due_at ? <span className="block">Vence: {formatDate(action.due_at)}</span> : null}
                      {action.completed_at ? <span className="block">Completada: {formatDate(action.completed_at)}</span> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-neutral-900">Historial completo</h2>
          <TimelineFeed items={timeline} />
        </section>

        <TimelineRealtimeBridge requestId={summary.request_id} />
      </div>
    </div>
  );
}

