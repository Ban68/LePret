import Link from "next/link";
import { notFound } from "next/navigation";

import { TimelineComposer } from "@/components/app/timeline/TimelineComposer";
import { TimelineFeed } from "@/components/app/timeline/TimelineFeed";
import { TimelineNextSteps } from "@/components/app/timeline/TimelineNextSteps";
import { TimelineRealtimeBridge } from "@/components/app/timeline/TimelineRealtimeBridge";
import { StatusBadge } from "@/components/ui/status-badge";
import { DisbursementPanel } from "./DisbursementPanel";
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

export default async function ClientRequestTimelinePage({
  params,
}: {
  params: Promise<{ orgId: string; requestId: string }>;
}) {
  const { orgId, requestId } = await params;
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

  const { data: request, error: requestError } = await supabase
    .from("funding_requests")
    .select(
      "id, company_id, status, requested_amount, currency, created_at, disbursement_account_id, disbursed_at"
    )
    .eq("id", requestId)
    .eq("company_id", orgId)
    .maybeSingle();

  if (requestError) {
    throw new Error(requestError.message);
  }

  if (!request) {
    notFound();
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("company_id", orgId)
    .eq("user_id", session.user.id)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (!membership) {
    notFound();
  }

  const timeline = await getRequestTimeline(supabase, requestId);

  const { data: bankAccounts } = await supabase
    .from("bank_accounts")
    .select(
      "id, label, bank_name, account_type, account_number, account_holder_name, account_holder_id, is_default, created_at"
    )
    .eq("company_id", orgId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: paymentRows } = await supabase
    .from("payments")
    .select(
      "id, request_id, status, amount, currency, due_date, paid_at, created_at, direction, bank_account_id, notes"
    )
    .eq("company_id", orgId)
    .eq("request_id", requestId)
    .order("created_at", { ascending: false });

  const disbursementPayment = (paymentRows || []).find((row) => row.direction === "outbound") ?? null;

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-colette text-2xl font-semibold text-lp-primary-1">Historial de la solicitud</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Consulta los hitos, mensajes y próximos pasos de tu operación.
            </p>
          </div>
          <Link
            href={`/c/${orgId}/requests`}
            className="text-sm font-medium text-lp-primary-1 underline hover:opacity-80"
          >
            Volver al listado
          </Link>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Solicitud</p>
              <p className="text-lg font-semibold text-neutral-900">#{request.id.slice(0, 8)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500">Estado</p>
                <StatusBadge status={request.status} kind="request" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500">Monto</p>
                <p className="text-base font-semibold text-neutral-900">
                  {formatCurrency(request.requested_amount, request.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500">Creada</p>
                <p className="text-base font-semibold text-neutral-900">
                  {new Date(request.created_at).toLocaleDateString("es-CO")}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DisbursementPanel
          orgId={orgId}
          requestId={requestId}
          status={request.status}
          amount={request.requested_amount}
          currency={request.currency}
          bankAccounts={bankAccounts ?? []}
          selectedAccountId={request.disbursement_account_id ?? null}
          disbursement={disbursementPayment ?? null}
        />

        <TimelineNextSteps status={request.status} nextSteps={nextSteps} />

        <TimelineComposer requestId={requestId} />

        <TimelineFeed items={timeline} />

        <TimelineRealtimeBridge requestId={requestId} />
      </div>
    </div>
  );
}
