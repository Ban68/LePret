"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { StatusBadge } from "@/components/ui/status-badge";

type SummaryMetrics = {
  activeRequests: number;
  activeAmount: number;
  totalRequested: number;
  totalFunded: number;
  pendingInvoices: number;
};

type NextAction = {
  requestId: string;
  status: string | null;
  stage: number;
  label: string;
  description: string | null;
};

type TrendPoint = { label: string; requested: number; funded: number };

type TimelineEvent = {
  id: string;
  requestId: string;
  title: string;
  description: string | null;
  occurredAt: string | null;
  status: string | null;
  type: string | null;
};

type Notification = { type: string; message: string };

type SummaryResponse = {
  metrics: SummaryMetrics;
  nextActions: NextAction[];
  trend: TrendPoint[];
  events: TimelineEvent[];
  notifications: Notification[];
};

export function DashboardSummary({ orgId }: { orgId: string }) {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/c/${orgId}/summary`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al cargar el resumen");
        setSummary(null);
      } else {
        setSummary(data.summary as SummaryResponse);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const formatCurrency = useCallback((value?: number | null) => {
    const amount = Number(value || 0);
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount);
  }, []);

  const formatNumber = useCallback((value?: number | null) => {
    return new Intl.NumberFormat("es-CO").format(Number(value || 0));
  }, []);

  const trendData = useMemo(() => {
    return (summary?.trend || []).map((point) => ({
      ...point,
      month: formatMonth(point.label),
    }));
  }, [summary?.trend]);

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <div className="font-semibold">No pudimos cargar el tablero</div>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            className="mt-3 rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-700"
            onClick={load}
          >
            Reintentar
          </button>
        </div>
      )}

      {!!summary?.notifications?.length && (
        <div className="space-y-2">
          {summary.notifications.map((notification) => (
            <div
              key={`${notification.type}-${notification.message}`}
              className="flex items-start gap-3 rounded-md border border-lp-primary-1/20 bg-lp-primary-1/5 p-4 text-sm text-lp-primary-1"
            >
              <span className="mt-0.5 inline-flex h-2 w-2 shrink-0 rounded-full bg-lp-primary-1" aria-hidden />
              <span>{notification.message}</span>
            </div>
          ))}
        </div>
      )}

      <section>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Solicitudes activas"
            value={loading ? "-" : formatNumber(summary?.metrics.activeRequests)}
            hint={`Monto en curso: ${formatCurrency(summary?.metrics.activeAmount)}`}
          />
          <MetricCard
            title="Importe solicitado"
            value={loading ? "-" : formatCurrency(summary?.metrics.totalRequested)}
            hint="Histórico de solicitudes registradas"
          />
          <MetricCard
            title="Total desembolsado"
            value={loading ? "-" : formatCurrency(summary?.metrics.totalFunded)}
            hint="Importe acumulado de desembolsos"
          />
          <MetricCard
            title="Facturas por validar"
            value={loading ? "-" : formatNumber(summary?.metrics.pendingInvoices)}
            hint="Facturas cargadas en espera de revisión"
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <div className="rounded-lg border border-lp-sec-4/60 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-lp-primary-1">Siguiente acción</h2>
                <p className="text-sm text-lp-sec-3">
                  Recomendaciones basadas en el estado más avanzado de tus solicitudes activas.
                </p>
              </div>
              <Link href={`/c/${orgId}/requests`} className="text-sm font-medium text-lp-primary-1 underline">
                Ver todas
              </Link>
            </div>

            {loading ? (
              <div className="mt-4 rounded-md border border-dashed border-lp-sec-4/60 p-4 text-sm text-lp-sec-3">
                Cargando acciones sugeridas...
              </div>
            ) : summary?.nextActions?.length ? (
              <ul className="mt-4 space-y-3">
                {summary.nextActions.map((action) => (
                  <li key={action.requestId} className="rounded-md border border-lp-sec-4/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-lp-sec-3">
                      <span className="font-mono">#{truncateId(action.requestId)}</span>
                      <StatusBadge status={action.status} kind="request" />
                    </div>
                    <div className="mt-2 text-sm font-semibold text-lp-primary-1">{action.label}</div>
                    {action.description && <p className="mt-1 text-sm text-lp-sec-3">{action.description}</p>}
                    <div className="mt-3 text-xs text-lp-primary-1">
                      <Link href={`/c/${orgId}/requests`} className="underline">
                        Abrir solicitud
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4 rounded-md border border-lp-sec-4/60 p-4 text-sm text-lp-sec-3">
                No hay acciones pendientes por ahora.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border border-lp-sec-4/60 p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-lp-primary-1">Eventos recientes</h2>
                <p className="text-sm text-lp-sec-3">Últimas novedades registradas en tus solicitudes.</p>
              </div>
              <Link href={`/c/${orgId}/requests`} className="text-xs font-medium text-lp-primary-1 underline">
                Revisar
              </Link>
            </div>
            {loading ? (
              <div className="rounded-md border border-dashed border-lp-sec-4/60 p-4 text-sm text-lp-sec-3">
                Consultando actividad reciente...
              </div>
            ) : summary?.events?.length ? (
              <ul className="space-y-3 text-sm">
                {summary.events.map((event) => (
                  <li key={event.id} className="rounded-md border border-lp-sec-4/60 p-3">
                    <div className="flex items-center justify-between gap-2 text-xs text-lp-sec-3">
                      <span className="font-mono">#{truncateId(event.requestId)}</span>
                      {event.occurredAt && <span>{formatDate(event.occurredAt)}</span>}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-lp-primary-1">{event.title}</div>
                    {event.description && (
                      <p className="mt-1 text-sm text-lp-sec-3">{event.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-md border border-lp-sec-4/60 p-4 text-sm text-lp-sec-3">
                No registramos eventos recientes.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-lp-sec-4/60 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-lp-primary-1">Evolución de operaciones</h2>
            <p className="text-sm text-lp-sec-3">Solicitudes registradas vs. importes desembolsados en los últimos meses.</p>
          </div>
        </div>
        {loading ? (
          <div className="rounded-md border border-dashed border-lp-sec-4/60 p-4 text-sm text-lp-sec-3">
            Preparando gráfico...
          </div>
        ) : trendData.length ? (
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRequested" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1A56DB" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#1A56DB" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="colorFunded" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16A34A" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#16A34A" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" tickFormatter={(value) => formatYAxis(value)} width={90} />
                <Tooltip
                  formatter={(value: number, name: string) => [formatCurrency(value), name === "requested" ? "Solicitado" : "Desembolsado"]}
                  labelFormatter={(label: string) => label}
                />
                <Legend formatter={(value) => (value === "requested" ? "Solicitado" : "Desembolsado")} />
                <Area type="monotone" dataKey="requested" stroke="#1A56DB" fill="url(#colorRequested)" name="requested" />
                <Area type="monotone" dataKey="funded" stroke="#16A34A" fill="url(#colorFunded)" name="funded" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-md border border-lp-sec-4/60 p-4 text-sm text-lp-sec-3">
            Aún no contamos con datos suficientes para mostrar el gráfico.
          </div>
        )}
      </section>
    </div>
  );
}

type MetricCardProps = {
  title: string;
  value: string;
  hint?: string;
};

function MetricCard({ title, value, hint }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-lp-sec-4/60 p-5">
      <div className="text-sm text-lp-sec-3">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-lp-primary-1">{value}</div>
      {hint && <p className="mt-1 text-xs text-lp-sec-3">{hint}</p>}
    </div>
  );
}

function truncateId(value: string): string {
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}...${value.slice(-3)}`;
}

function formatMonth(label: string): string {
  const [year, month] = label.split("-");
  if (!year || !month) return label;
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return label;
  return date.toLocaleDateString("es-CO", { month: "short", year: "2-digit" });
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

function formatYAxis(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return `${Math.round(value)}`;
}
