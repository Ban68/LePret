"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { StatusBadge } from "@/components/ui/status-badge";
import { Sparkline } from "@/components/ui/sparkline";

type TimePoint = { date: string; value: number };
type NextStep = {
  id: string;
  status: string;
  created_at: string | null;
  requested_amount: number;
  title: string;
  hint: string;
};
type Metrics = {
  invoices: number;
  funded: number;
  requestsOpen: number;
  offersOpen: number;
  lastActivity: string | null;
  invoicesAmountTotal?: number;
  fundedAmountTotal?: number;
  requestsAmountOpen?: number;
  series?: { invoicesDaily?: TimePoint[]; requestsDaily?: TimePoint[] };
  nextSteps?: NextStep[];
};

export function DashboardSummary({ orgId }: { orgId: string }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/c/${orgId}/summary`);
    const data = await res.json();
    if (!res.ok) setError(data.error || "Error cargando");
    else setMetrics(data.metrics);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const Card = ({ title, value, href }: { title: string; value: number | string; href?: string }) => (
    <div className="rounded-lg border border-lp-sec-4/60 p-5">
      <div className="text-sm text-lp-sec-3">{title}</div>
      <div className="mt-2 text-3xl font-semibold text-lp-primary-1">{loading ? "-" : value}</div>
      {href && (
        <div className="mt-3 text-sm">
          <Link href={href} className="underline">
            Ver detalle
          </Link>
        </div>
      )}
    </div>
  );

  const fmt = (n?: number) => new Intl.NumberFormat("es-CO").format(n || 0);

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card
          title="Facturas cargadas"
          value={`${fmt(metrics?.invoices)} | $${fmt(metrics?.invoicesAmountTotal)}`}
          href={`/c/${orgId}/invoices`}
        />
        <Card
          title="Solicitudes en curso"
          value={`${fmt(metrics?.requestsOpen)} | $${fmt(metrics?.requestsAmountOpen)}`}
          href={`/c/${orgId}/requests`}
        />
        <Card
          title="Desembolsos completados"
          value={`${fmt(metrics?.funded)} | $${fmt(metrics?.fundedAmountTotal)}`}
          href={`/c/${orgId}/invoices?status=funded`}
        />
      </div>
      <div className="text-sm text-lp-sec-3">
        {metrics?.offersOpen ? (
          <span>Tienes {metrics.offersOpen} oferta(s) para revisar.</span>
        ) : (
          <span>Sin ofertas pendientes.</span>
        )}
        {metrics?.lastActivity && (
          <span className="ml-2">Ultima actividad: {new Date(metrics.lastActivity).toLocaleDateString()}</span>
        )}
      </div>
      <NextStepsPanel steps={metrics?.nextSteps} loading={loading} orgId={orgId} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-lp-sec-4/60 p-5">
          <div className="mb-2 text-sm text-lp-sec-3">Facturas creadas (30 dias)</div>
          {loading ? <div className="text-sm text-lp-sec-3">Cargando...</div> : <Spark metrics={metrics} kind="invoicesDaily" />}
        </div>
        <div className="rounded-lg border border-lp-sec-4/60 p-5">
          <div className="mb-2 text-sm text-lp-sec-3">Solicitudes creadas (30 dias)</div>
          {loading ? <div className="text-sm text-lp-sec-3">Cargando...</div> : <Spark metrics={metrics} kind="requestsDaily" />}
        </div>
      </div>
    </div>
  );
}

function Spark({ metrics, kind }: { metrics: Metrics | null; kind: "invoicesDaily" | "requestsDaily" }) {
  const series = metrics?.series?.[kind] as TimePoint[] | undefined;
  const data = (series || []).sort((a, b) => a.date.localeCompare(b.date)).map((d) => d.value);
  if (!data.length) return <div className="text-sm text-lp-sec-3">Sin datos</div>;
  return (
    <div className="flex items-end gap-4">
      <Sparkline data={data} />
      <div className="text-sm text-lp-sec-3">
        Total: {new Intl.NumberFormat("es-CO").format(data.reduce((s, v) => s + v, 0))}
      </div>
    </div>
  );
}

function NextStepsPanel({ steps, loading, orgId }: { steps?: NextStep[] | null; loading: boolean; orgId: string }) {
  if (loading) {
    return (
      <div className="rounded-lg border border-dashed border-lp-sec-4/60 p-5 text-sm text-lp-sec-3">
        Cargando proximos pasos...
      </div>
    );
  }

  const list = steps || [];

  if (!list.length) {
    return (
      <div className="rounded-lg border border-lp-sec-4/60 p-5">
        <div className="text-lg font-semibold text-lp-primary-1">Proximos pasos</div>
        <p className="text-sm text-lp-sec-3">No tienes acciones pendientes por ahora.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-lp-sec-4/60 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-lp-primary-1">Proximos pasos</div>
          <p className="text-sm text-lp-sec-3">Acciones recomendadas para avanzar tus solicitudes activas.</p>
        </div>
        <Link href={`/c/${orgId}/requests`} className="text-sm font-medium text-lp-primary-1 underline hover:opacity-80">
          Ver solicitudes
        </Link>
      </div>
      <ul className="space-y-3">
        {list.map((step) => (
          <li key={step.id} className="rounded-md border border-lp-sec-4/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-mono text-xs text-lp-sec-3">#{truncateId(step.id)}</div>
              <StatusBadge status={step.status} kind="request" />
            </div>
            <div className="mt-2 text-sm font-semibold text-lp-primary-1">{step.title}</div>
            <p className="mt-1 text-sm text-lp-sec-3">{step.hint}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-lp-sec-3">
              <span>Monto solicitado: ${formatCurrency(step.requested_amount)}</span>
              {step.created_at && <span>Creada: {formatDate(step.created_at)}</span>}
            </div>
            <div className="mt-3">
              <Link href={`/c/${orgId}/requests`} className="text-xs font-medium text-lp-primary-1 underline hover:opacity-80">
                Abrir solicitud
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function truncateId(value: string): string {
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}...${value.slice(-3)}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}