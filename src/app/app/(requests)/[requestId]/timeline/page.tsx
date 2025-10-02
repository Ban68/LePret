import { notFound } from "next/navigation";

import { TimelineComposer } from "@/components/app/timeline/TimelineComposer";
import { TimelineFeed } from "@/components/app/timeline/TimelineFeed";
import { TimelineNextSteps } from "@/components/app/timeline/TimelineNextSteps";
import { TimelineRealtimeBridge } from "@/components/app/timeline/TimelineRealtimeBridge";
import { computeClientNextSteps, getRequestTimeline } from "@/lib/request-timeline";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function formatCurrency(value: number | string | null | undefined, currency?: string | null) {
  if (value === null || value === undefined) return "-";
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) return String(value);
  const formatter = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: currency || "COP",
    maximumFractionDigits: 0,
  });
  return formatter.format(amount);
}

export default async function RequestTimelinePage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return (
      <div className="py-10">
        <div className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            Inicia sesión para consultar el historial de tu solicitud.
          </div>
        </div>
      </div>
    );
  }

  const { data: request, error } = await supabase
    .from("funding_requests")
    .select("id, company_id, status, requested_amount, currency, created_at")
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!request) {
    notFound();
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("company_id", request.company_id)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!membership) {
    notFound();
  }

  const timeline = await getRequestTimeline(supabase, requestId);

  const { data: collectionCase } = await supabase
    .from("collection_cases")
    .select("id, status, next_action_at, promise_amount, promise_date, closed_at")
    .eq("request_id", requestId)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSteps = computeClientNextSteps(request.status, collectionCase);

  return (
    <div className="py-10">
      <div className="container mx-auto max-w-4xl space-y-6 px-4 sm:px-6 lg:px-8">
        <header className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <h1 className="font-colette text-2xl font-semibold text-lp-primary-1">Historial de la solicitud</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Aquí encontrarás hitos, mensajes y recordatorios asociados a tu operación.
          </p>
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Monto</dt>
              <dd className="text-base font-semibold text-neutral-900">
                {formatCurrency(request.requested_amount, request.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Estatus</dt>
              <dd className="text-base font-semibold capitalize text-neutral-900">{request.status}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Creada</dt>
              <dd className="text-base font-semibold text-neutral-900">
                {new Date(request.created_at).toLocaleDateString("es-CO")}
              </dd>
            </div>
          </dl>
        </header>

        <TimelineNextSteps status={request.status} nextSteps={nextSteps} />

        <TimelineComposer requestId={requestId} />

        <TimelineFeed items={timeline} />

        <TimelineRealtimeBridge requestId={requestId} />
      </div>
    </div>
  );
}

