"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Skeleton } from "@/components/ui/skeleton";

const RISK_COLORS: Record<string, string> = {
  alto: "bg-red-100 text-red-700 border-red-300",
  medio: "bg-amber-100 text-amber-800 border-amber-300",
  bajo: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value || 0);
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return `${Number(value.toFixed(2))}%`;
}

type RiskResponse = {
  delinquencyRate: number;
  delinquentAmount: number;
  outstandingAmount: number;
  paymentsInArrears: number;
  topPayers: Array<{ name: string; amount: number; share: number; riskRating?: string | null; creditLimit?: number | null }>;
  riskRatings: Array<{ rating: string; count: number }>;
  alerts: string[];
};

export function RiskDashboard() {
  const [data, setData] = useState<RiskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/hq/risk", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || "No se pudieron cargar las métricas de riesgo");
        }
        setData(payload as RiskResponse);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error inesperado";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    load().catch(() => null);
  }, []);

  const payerChart = useMemo(() => {
    if (!data?.topPayers) return [];
    return data.topPayers.map((item) => ({
      name: item.name,
      amount: item.amount,
      share: item.share,
    }));
  }, [data]);

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <strong>Error:</strong> {error}
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <RiskStat title="Tasa de morosidad" value={formatPercent(data?.delinquencyRate ?? 0)} loading={loading} />
        <RiskStat title="Cartera vencida" value={formatCurrency(data?.delinquentAmount ?? 0)} loading={loading} />
        <RiskStat title="Cartera activa" value={formatCurrency(data?.outstandingAmount ?? 0)} loading={loading} />
        <RiskStat title="Pagos en mora" value={`${data?.paymentsInArrears ?? 0}`} loading={loading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-lp-sec-4/60 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-lp-primary-1">Concentración de pagadores</h3>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : payerChart.length ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={payerChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value: number) => `${Number(value / 1_000_000).toFixed(0)}M`} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number, key) =>
                    key === "share" ? `${Number(value.toFixed(2))}%` : formatCurrency(Number(value))
                  }
                  contentStyle={{ backgroundColor: "#fff", border: "1px solid #ddd", borderRadius: "0.5rem", fontSize: "0.875rem" }}
                />
                <Bar dataKey="amount" name="Exposición" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-lp-sec-3">Sin datos de pagadores financiados.</p>
          )}
        </div>

        <div className="rounded-lg border border-lp-sec-4/60 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-lp-primary-1">Distribución de ratings</h3>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : data?.riskRatings?.length ? (
            <ul className="space-y-3 text-sm">
              {data.riskRatings.map((item) => (
                <li key={item.rating} className="flex items-center justify-between">
                  <span className="capitalize text-lp-sec-3">{item.rating}</span>
                  <span className="font-semibold text-lp-primary-1">{item.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-lp-sec-3">Sin calificaciones registradas.</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-lp-sec-4/60 bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-lp-primary-1">Top pagadores</h3>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : data?.topPayers?.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-lp-primary-2">
                <tr>
                  <th className="px-3 py-2 font-medium text-lp-sec-3">Pagador</th>
                  <th className="px-3 py-2 font-medium text-lp-sec-3">Exposición</th>
                  <th className="px-3 py-2 font-medium text-lp-sec-3">Participación</th>
                  <th className="px-3 py-2 font-medium text-lp-sec-3">Rating</th>
                  <th className="px-3 py-2 font-medium text-lp-sec-3">Límite crédito</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lp-sec-4/60">
                {data.topPayers.map((payer) => (
                  <tr key={payer.name}>
                    <td className="px-3 py-2 text-lp-primary-1">{payer.name}</td>
                    <td className="px-3 py-2 text-lp-primary-1">{formatCurrency(payer.amount)}</td>
                    <td className="px-3 py-2 text-lp-primary-1">{formatPercent(payer.share)}</td>
                    <td className="px-3 py-2">
                      {payer.riskRating ? (
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
                          RISK_COLORS[payer.riskRating.toLowerCase()] || "bg-lp-sec-4/40 text-lp-primary-1 border-lp-sec-4/60"
                        }`}>
                          {payer.riskRating.toLowerCase()}
                        </span>
                      ) : (
                        <span className="text-xs text-lp-sec-3">Sin rating</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-lp-primary-1">
                      {payer.creditLimit != null ? formatCurrency(payer.creditLimit) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-lp-sec-3">Sin información para mostrar.</p>
        )}
      </div>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-sm">
        <h3 className="mb-3 text-lg font-semibold text-amber-900">Alertas y recomendaciones</h3>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : data?.alerts?.length ? (
          <ul className="list-disc space-y-2 pl-5 text-sm text-amber-900">
            {data.alerts.map((alert, index) => (
              <li key={`${alert}-${index}`}>{alert}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-amber-900">Sin alertas relevantes al día de hoy.</p>
        )}
      </div>
    </section>
  );
}

function RiskStat({ title, value, loading }: { title: string; value: string; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-lg border border-lp-sec-4/60 bg-white p-4 shadow-sm">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="mt-2 h-8 w-3/4" />
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
