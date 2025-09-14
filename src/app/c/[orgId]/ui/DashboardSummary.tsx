"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

type TimePoint = { date: string; value: number };
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
    if (!res.ok) setError(data.error || 'Error cargando');
    else setMetrics(data.metrics);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const Card = ({ title, value, href }: { title: string; value: number | string; href?: string }) => (
    <div className="rounded-lg border border-lp-sec-4/60 p-5">
      <div className="text-sm text-lp-sec-3">{title}</div>
      <div className="mt-2 text-3xl font-semibold text-lp-primary-1">
        {loading ? <Skeleton className="h-9 w-2/3" /> : value}
      </div>
      {href && (
        <div className="mt-3 text-sm">
          <Link href={href} className="underline">Ver detalle</Link>
        </div>
      )}
    </div>
  );

  const fmt = (n?: number) => new Intl.NumberFormat('es-CO').format(n || 0);

  return (
    <div className="space-y-6">
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card title="Facturas cargadas" value={`${fmt(metrics?.invoices)} | ${fmt(metrics?.invoicesAmountTotal)}`} href={`/c/${orgId}/invoices`} />
        <Card title="Solicitudes en curso" value={`${fmt(metrics?.requestsOpen)} | ${fmt(metrics?.requestsAmountOpen)}`} href={`/c/${orgId}/requests`} />
        <Card title="Desembolsos completados" value={`${fmt(metrics?.funded)} | ${fmt(metrics?.fundedAmountTotal)}`} href={`/c/${orgId}/invoices?status=funded`} />
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
      {/* Graficos simples (ultimos 30 dias) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-lp-sec-4/60 p-5">
          <div className="mb-2 text-sm text-lp-sec-3">Facturas creadas (30 dias)</div>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <Spark metrics={metrics} kind="invoicesDaily" />
          )}
        </div>
        <div className="rounded-lg border border-lp-sec-4/60 p-5">
          <div className="mb-2 text-sm text-lp-sec-3">Solicitudes creadas (30 dias)</div>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <Spark metrics={metrics} kind="requestsDaily" />
          )}
        </div>
      </div>
    </div>
  );
}

import { Sparkline } from "@/components/ui/sparkline";

function Spark({ metrics, kind }: { metrics: Metrics | null; kind: 'invoicesDaily' | 'requestsDaily' }) {
  const series = metrics?.series?.[kind] as TimePoint[] | undefined;
  const data = (series || []).sort((a,b)=>a.date.localeCompare(b.date)).map((d)=>d.value);
  if (!data.length) return <div className="text-sm text-lp-sec-3">Sin datos</div>;
  return (
    <div className="flex items-end gap-4">
      <Sparkline data={data} />
      <div className="text-sm text-lp-sec-3">Total: {new Intl.NumberFormat('es-CO').format(data.reduce((s,v)=>s+v,0))}</div>
    </div>
  );
}


