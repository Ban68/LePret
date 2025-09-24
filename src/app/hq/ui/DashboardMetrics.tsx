"use client";

import { useEffect, useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

// Types for our metrics data
type Metrics = {
  totalRequests: number;
  totalAmount: number;
  requestsByStatus: Record<string, number>;
  requestsByMonth: Record<string, number>;
};

// Status labels for display
const STATUS_LABEL: Record<string, string> = {
  review: "En revisión",
  offered: "Ofertada",
  accepted: "Aceptada",
  signed: "Firmada",
  funded: "Desembolsada",
  cancelled: "Cancelada",
};

// Helper to format currency
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value || 0);
}

// StatCard component for individual metrics
function StatCard({ title, value, isLoading }: { title: string; value: string | number; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-lp-sec-4/60 bg-white p-4 shadow-sm">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-2 h-8 w-1/2" />
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-lp-sec-4/60 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-medium text-lp-sec-3">{title}</h3>
      <p className="text-2xl font-semibold text-lp-primary-1">{value}</p>
    </div>
  );
}

export function DashboardMetrics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/hq/metrics");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Error al cargar las métricas");
        }
        setMetrics(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error inesperado";
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    fetchMetrics();
  }, []);

  const chartData = useMemo(() => {
    if (!metrics) return [];
    return Object.entries(metrics.requestsByMonth)
      .map(([month, count]) => ({
        name: new Date(`${month}-02`).toLocaleString("es-CO", { month: "short", year: "2-digit" }),
        Solicitudes: count,
      }))
      .sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
  }, [metrics]);

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <strong>Error:</strong> {error}
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Solicitudes" value={metrics?.totalRequests ?? 0} isLoading={loading} />
        <StatCard title="Monto Total Solicitado" value={formatCurrency(metrics?.totalAmount ?? 0)} isLoading={loading} />
        <StatCard
          title="Pendientes de Revisión"
          value={metrics?.requestsByStatus?.review ?? 0}
          isLoading={loading}
        />
        <StatCard title="Fondedas" value={metrics?.requestsByStatus?.funded ?? 0} isLoading={loading} />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-lp-sec-4/60 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-lp-primary-1">Solicitudes por Mes</h3>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #ddd",
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "0.875rem" }} />
                <Bar dataKey="Solicitudes" fill="#003352" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="rounded-lg border border-lp-sec-4/60 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-lp-primary-1">Solicitudes por Estado</h3>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="space-y-3 pt-2">
              {metrics?.requestsByStatus && Object.entries(metrics.requestsByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-sm">
                  <span className="text-lp-sec-3">{STATUS_LABEL[status] || status}</span>
                  <span className="font-semibold text-lp-primary-1">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
