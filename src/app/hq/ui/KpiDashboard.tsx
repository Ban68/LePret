"use client";

import { useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Skeleton } from "@/components/ui/skeleton";
import { useHqMetrics } from "./useHqMetrics";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value || 0);
}

function formatHoursToLabel(hours: number | null | undefined): string {
  if (!hours || Number.isNaN(hours)) return "-";
  if (hours >= 24) {
    const days = hours / 24;
    return `${Number(days.toFixed(1))} días`;
  }
  return `${Number(hours.toFixed(1))} h`;
}

function SummaryCard({ title, value, loading }: { title: string; value: string; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-lg border border-lp-sec-4/60 bg-white p-4 shadow-sm">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="mt-2 h-8 w-2/3" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-lp-sec-4/60 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-lp-sec-3">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-lp-primary-1">{value}</p>
    </div>
  );
}

export function KpiDashboard() {
  const { metrics, loading, error } = useHqMetrics();

  const monthlyFunding = useMemo(() => {
    if (!metrics?.monthlyFundingVolumes) return [];
    return Object.entries(metrics.monthlyFundingVolumes)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [metrics]);

  const approvalsTrend = useMemo(() => {
    if (!metrics?.requestsByMonth) return [];
    return Object.entries(metrics.requestsByMonth)
      .map(([month, requests]) => ({ month, requests }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [metrics]);

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <strong>Error:</strong> {error}
      </div>
    );
  }

  const fundedAmountLabel = metrics?.fundedAmount != null ? formatCurrency(metrics.fundedAmount) : formatCurrency(0);
  const fundedRequestsLabel = metrics?.fundedRequests != null ? `${metrics.fundedRequests}` : "0";
  const averageYieldLabel = metrics?.averageYieldPct != null ? `${Number(metrics.averageYieldPct.toFixed(2))}%` : "-";
  const averageAdvanceLabel = metrics?.averageAdvancePct != null ? `${Number(metrics.averageAdvancePct.toFixed(1))}%` : "-";
  const approvalTimeLabel = formatHoursToLabel(metrics?.averageApprovalHours ?? null);
  const disbursementTimeLabel = formatHoursToLabel(metrics?.averageDisbursementHours ?? null);

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <SummaryCard title="Volumen financiado" value={fundedAmountLabel} loading={loading} />
        <SummaryCard title="Operaciones financiadas" value={fundedRequestsLabel} loading={loading} />
        <SummaryCard title="Yield promedio" value={averageYieldLabel} loading={loading} />
        <SummaryCard title="Anticipo promedio" value={averageAdvanceLabel} loading={loading} />
        <SummaryCard title="Tiempo aprobación" value={approvalTimeLabel} loading={loading} />
        <SummaryCard title="Tiempo desembolso" value={disbursementTimeLabel} loading={loading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-lp-sec-4/60 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-lp-primary-1">Volumen financiado por mes</h3>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : monthlyFunding.length ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={monthlyFunding}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value: number) => `${Math.round(value / 1_000_000)}M`} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: "#fff", border: "1px solid #ddd", borderRadius: "0.5rem", fontSize: "0.875rem" }}
                />
                <Legend wrapperStyle={{ fontSize: "0.875rem" }} />
                <Bar dataKey="amount" name="Financiado" fill="#027373" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-lp-sec-3">Sin desembolsos registrados.</p>
          )}
        </div>

        <div className="rounded-lg border border-lp-sec-4/60 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-lp-primary-1">Originaciones vs solicitudes</h3>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : approvalsTrend.length ? (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={approvalsTrend}>
                <defs>
                  <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#003352" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#003352" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => `${value} solicitudes`}
                  contentStyle={{ backgroundColor: "#fff", border: "1px solid #ddd", borderRadius: "0.5rem", fontSize: "0.875rem" }}
                />
                <Area type="monotone" dataKey="requests" name="Solicitudes" stroke="#003352" fillOpacity={1} fill="url(#colorReq)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-lp-sec-3">Sin información para graficar.</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-lp-sec-4/60 bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-lp-primary-1">Indicadores adicionales</h3>
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-lp-sec-3">Aprobación → Firma (promedio)</dt>
              <dd className="font-semibold text-lp-primary-1">
                {formatHoursToLabel(metrics?.stageDurations?.['accepted->signed']?.averageHours ?? null)}
              </dd>
            </div>
            <div>
              <dt className="text-lp-sec-3">Firma → Desembolso (promedio)</dt>
              <dd className="font-semibold text-lp-primary-1">
                {formatHoursToLabel(metrics?.stageDurations?.['signed->funded']?.averageHours ?? null)}
              </dd>
            </div>
            <div>
              <dt className="text-lp-sec-3">Tasa de aprobación global</dt>
              <dd className="font-semibold text-lp-primary-1">{metrics?.approvalRate != null ? `${metrics.approvalRate}%` : '-'}</dd>
            </div>
          </dl>
        )}
      </div>
    </section>
  );
}
