"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type InvestorCashflow = {
  id: string;
  date: string;
  amount: number;
  currency: string;
  description: string;
};

type PortfolioPoint = {
  date: string;
  investedCapital?: number;
  portfolioValue: number;
};

type StrategySlice = {
  strategy: string;
  value: number;
  percentage?: number;
};

type InvestorSummaryResponse = {
  investedCapital: number;
  cumulativeReturn: {
    value: number;
    percentage: number;
  };
  upcomingCashflows: InvestorCashflow[];
  currency: string;
  portfolioEvolution?: PortfolioPoint[];
  strategyDistribution?: StrategySlice[];
};

type InvestorDashboardProps = {
  orgId: string;
};

const STRATEGY_COLORS = ["#6A4C93", "#1984C5", "#22B573", "#FF7F50", "#FFC857"];

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercentage(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(new Date(value));
}

export default function InvestorDashboard({ orgId }: InvestorDashboardProps) {
  const [summary, setSummary] = useState<InvestorSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadSummary() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/i/${orgId}/summary`, { cache: "no-store" });

        if (!response.ok) {
          throw new Error("No fue posible obtener la información del inversor");
        }

        const payload = (await response.json()) as InvestorSummaryResponse;

        if (isActive) {
          setSummary(payload);
        }
      } catch (err) {
        if (isActive) {
          setError(err instanceof Error ? err.message : "Error desconocido");
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadSummary();

    return () => {
      isActive = false;
    };
  }, [orgId]);

  const portfolioEvolution = useMemo<Array<PortfolioPoint & { formattedDate: string }>>(() => {
    if (!summary?.portfolioEvolution?.length) {
      return [];
    }

    return summary.portfolioEvolution.map((point) => ({
      ...point,
      formattedDate: formatDate(point.date),
    }));
  }, [summary?.portfolioEvolution]);

  const strategyDistribution = useMemo<Array<StrategySlice & { percentage: number }>>(() => {
    const slices = summary?.strategyDistribution ?? [];

    if (!slices.length) {
      return [];
    }

    const total = slices.reduce((acc, slice) => acc + (slice.value ?? 0), 0);

    if (total <= 0) {
      return slices.map((slice) => ({
        ...slice,
        percentage: slice.percentage ?? 0,
      }));
    }

    return slices.map((slice) => ({
      ...slice,
      percentage: slice.percentage ?? Number(((slice.value ?? 0) / total) * 100),
    }));
  }, [summary?.strategyDistribution]);

  if (loading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-lp-sec-3">Cargando información del portafolio…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Capital invertido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-lp-primary-1">
              {formatCurrency(summary.investedCapital, summary.currency)}
            </p>
            <p className="mt-2 text-sm text-lp-sec-3">Saldo comprometido actualmente en tus estrategias.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rendimiento acumulado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-lp-primary-1">
              {formatCurrency(summary.cumulativeReturn.value, summary.currency)}
            </p>
            <p className="mt-2 text-sm text-lp-sec-3">
              {formatPercentage(summary.cumulativeReturn.percentage)} vs. capital invertido.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximo flujo de caja</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.upcomingCashflows.length > 0 ? (
              <div className="space-y-2">
                <p className="text-3xl font-semibold text-lp-primary-1">
                  {formatCurrency(
                    summary.upcomingCashflows[0].amount,
                    summary.upcomingCashflows[0].currency,
                  )}
                </p>
                <p className="text-sm text-lp-sec-3">{summary.upcomingCashflows[0].description}</p>
                <p className="text-xs text-lp-sec-3">
                  Fecha estimada: {formatDate(summary.upcomingCashflows[0].date)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-lp-sec-3">Sin flujos de caja programados en las próximas semanas.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Evolución del portafolio</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {portfolioEvolution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={portfolioEvolution} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6A4C93" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6A4C93" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-lp-gray-100" />
                  <XAxis dataKey="formattedDate" tickLine={false} axisLine={false} className="text-xs text-lp-sec-3" />
                  <YAxis tickLine={false} axisLine={false} className="text-xs text-lp-sec-3" />
                  <Tooltip
                    formatter={(value: number | string) =>
                      formatCurrency(typeof value === "number" ? value : Number(value), summary.currency)
                    }
                    labelFormatter={(label) => label}
                  />
                  <Area
                    type="monotone"
                    dataKey="portfolioValue"
                    stroke="#6A4C93"
                    fill="url(#colorValue)"
                    name="Valor del portafolio"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-lp-sec-3">Aún no hay datos históricos suficientes para graficar.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribución por estrategia</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {strategyDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={strategyDistribution}
                    dataKey="value"
                    nameKey="strategy"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    innerRadius={60}
                    paddingAngle={4}
                  >
                    {strategyDistribution.map((entry, index) => (
                      <Cell key={entry.strategy} fill={STRATEGY_COLORS[index % STRATEGY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number | string, _name, info) => {
                      const slice = info?.payload as StrategySlice & { percentage?: number };
                      const percentage = slice?.percentage ?? 0;
                      const numericValue = typeof value === "number" ? value : Number(value);

                      return [
                        `${formatCurrency(numericValue, summary.currency)} (${percentage.toFixed(1)}%)`,
                        slice?.strategy ?? "",
                      ];
                    }}
                    labelFormatter={(label) => label as string}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-lp-sec-3">Aún no hay distribución disponible.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Próximos flujos de caja</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.upcomingCashflows.length ? (
            <div className="space-y-4">
              {summary.upcomingCashflows.map((cashflow) => (
                <div key={cashflow.id} className="flex items-center justify-between rounded-lg border border-lp-gray-100 p-4">
                  <div>
                    <p className="text-sm font-semibold text-lp-primary-1">{cashflow.description}</p>
                    <p className="text-xs text-lp-sec-3">{formatDate(cashflow.date)}</p>
                  </div>
                  <p className="text-sm font-semibold text-lp-primary-1">
                    {formatCurrency(cashflow.amount, cashflow.currency)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-lp-sec-3">No hay flujos de caja planificados.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
