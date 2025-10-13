import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getInvestorSummary } from "@/lib/investors";

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

function formatPerformance(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${(value * 100).toFixed(2)}%`;
}

export default async function InvestorDashboardPage({
  params,
}: {
  params: { orgId: string };
}) {
  const { orgId } = params;
  const summary = await getInvestorSummary(orgId);

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
            <p className="mt-2 text-sm text-lp-sec-3">{formatPercentage(summary.cumulativeReturn.percentage)} vs. capital invertido.</p>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-lp-sec-3">IRR</p>
                <p className="text-lg font-semibold text-lp-primary-1">{formatPerformance(summary.performance.irr)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-lp-sec-3">TWR</p>
                <p className="text-lg font-semibold text-lp-primary-1">{formatPerformance(summary.performance.twr)}</p>
              </div>
            </div>
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
                  {formatCurrency(summary.upcomingCashflows[0].amount, summary.upcomingCashflows[0].currency)}
                </p>
                <p className="text-sm text-lp-sec-3">{summary.upcomingCashflows[0].description}</p>
                <p className="text-xs text-lp-sec-3">
                  Fecha estimada: {new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(new Date(summary.upcomingCashflows[0].date))}
                </p>
              </div>
            ) : (
              <p className="text-sm text-lp-sec-3">Sin flujos de caja programados en las próximas semanas.</p>
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
                    <p className="text-xs text-lp-sec-3">
                      {new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(new Date(cashflow.date))}
                    </p>
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
