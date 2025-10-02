import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabaseServer } from "@/lib/supabase-server";
import {
  fetchInvestorDistributions,
  fetchInvestorPositions,
  getDefaultInvestorCompanyId,
  summarizePortfolio,
} from "@/lib/investors";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: value >= 1_000_000 ? 0 : 2,
  }).format(value);
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }
  return `${(value * 100).toFixed(2)}%`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
}

export default async function InvestorDashboardPage() {
  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login?redirectTo=/inversionistas");
  }

  const companyId = await getDefaultInvestorCompanyId(session.user?.id);
  if (!companyId) {
    redirect("/login?redirectTo=/inversionistas");
  }

  const [positions, distributions] = await Promise.all([
    fetchInvestorPositions(supabase, companyId),
    fetchInvestorDistributions(supabase, companyId),
  ]);

  const summary = summarizePortfolio(positions, distributions);
  const latestDistribution = distributions[0] ?? null;

  return (
    <div className="space-y-10">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-wider text-lp-sec-4">Capital comprometido</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold text-lp-primary-1">
              {formatCurrency(summary.totalCommitment)}
            </p>
            <p className="text-xs text-lp-sec-3">Compromisos vigentes en vehículos de inversión</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-wider text-lp-sec-4">Capital aportado</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold text-lp-primary-1">
              {formatCurrency(summary.totalContributed)}
            </p>
            <p className="text-xs text-lp-sec-3">Total desembolsado a los vehículos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-wider text-lp-sec-4">Distribuciones netas</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold text-lp-primary-1">
              {formatCurrency(summary.totalDistributed)}
            </p>
            <p className="text-xs text-lp-sec-3">Incluye pagos y reinversiones acreditadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-wider text-lp-sec-4">Valorización actual</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold text-lp-primary-1">
              {formatCurrency(summary.totalNav)}
            </p>
            <p className="text-xs text-lp-sec-3">Última valoración reportada por los vehículos</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-lp-primary-1">Participaciones por vehículo</CardTitle>
            <p className="text-xs text-lp-sec-3">Compara tus aportes, distribuciones y valorización por vehículo</p>
          </div>
          <div className="text-right text-sm text-lp-sec-3">
            IRR ponderada
            <div className="text-xl font-semibold text-lp-primary-1">{formatPercent(summary.weightedIrr)}</div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full divide-y divide-lp-sec-5/60 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-lp-sec-4">
                <th className="px-4 py-3">Vehículo</th>
                <th className="px-4 py-3">Compromiso</th>
                <th className="px-4 py-3">Aportado</th>
                <th className="px-4 py-3">Distribuido</th>
                <th className="px-4 py-3">Valor actual</th>
                <th className="px-4 py-3">Participación</th>
                <th className="px-4 py-3">Retorno neto</th>
                <th className="px-4 py-3">IRR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lp-sec-5/40">
              {summary.vehicles.map((vehicle) => (
                <tr key={vehicle.vehicleId ?? vehicle.vehicleName}>
                  <td className="px-4 py-3 text-sm font-medium text-lp-primary-1">{vehicle.vehicleName}</td>
                  <td className="px-4 py-3 text-sm text-lp-sec-3">{formatCurrency(vehicle.commitment)}</td>
                  <td className="px-4 py-3 text-sm text-lp-sec-3">{formatCurrency(vehicle.contributed)}</td>
                  <td className="px-4 py-3 text-sm text-lp-sec-3">{formatCurrency(vehicle.distributions)}</td>
                  <td className="px-4 py-3 text-sm text-lp-sec-3">{formatCurrency(vehicle.nav)}</td>
                  <td className="px-4 py-3 text-sm text-lp-sec-3">{vehicle.ownership.toFixed(2)}%</td>
                  <td className="px-4 py-3 text-sm text-lp-sec-3">{formatCurrency(vehicle.netReturn)}</td>
                  <td className="px-4 py-3 text-sm text-lp-sec-3">{formatPercent(vehicle.irr ?? null)}</td>
                </tr>
              ))}
              {!summary.vehicles.length && (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-lp-sec-4" colSpan={8}>
                    No hay posiciones registradas todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-lp-primary-1">Histórico de distribuciones</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full divide-y divide-lp-sec-5/60 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-lp-sec-4">
                <th className="px-4 py-3">Periodo</th>
                <th className="px-4 py-3">Vehículo</th>
                <th className="px-4 py-3">Distribución neta</th>
                <th className="px-4 py-3">Reinvertido</th>
                <th className="px-4 py-3">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lp-sec-5/40">
              {distributions.slice(0, 6).map((distribution) => {
                const vehicle = summary.vehicles.find((item) => item.vehicleId === distribution.vehicle_company_id);
                return (
                  <tr key={distribution.id}>
                    <td className="px-4 py-3 text-sm text-lp-sec-3">
                      {distribution.period_start?.slice(0, 7) || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-lp-sec-3">{vehicle?.vehicleName ?? "-"}</td>
                    <td className="px-4 py-3 text-sm text-lp-sec-3">{formatCurrency(Number(distribution.net_amount || 0))}</td>
                    <td className="px-4 py-3 text-sm text-lp-sec-3">{formatCurrency(Number(distribution.reinvested_amount || 0))}</td>
                    <td className="px-4 py-3 text-sm text-lp-sec-3">{distribution.notes || "-"}</td>
                  </tr>
                );
              })}
              {!distributions.length && (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-lp-sec-4" colSpan={5}>
                    Aún no se registran distribuciones.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {latestDistribution && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-6 py-5 text-sm text-emerald-800">
          <div className="font-medium">Última distribución registrada</div>
          <div className="mt-1 text-xs uppercase tracking-wide text-emerald-700/80">
            {formatDate(latestDistribution.created_at)}
          </div>
          <p className="mt-2 text-sm">
            Recibiste {formatCurrency(Number(latestDistribution.net_amount || 0))} del vehículo {summary.vehicles.find((v) => v.vehicleId === latestDistribution.vehicle_company_id)?.vehicleName || "-"}.
          </p>
        </div>
      )}
    </div>
  );
}
