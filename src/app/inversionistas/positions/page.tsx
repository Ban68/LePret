import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabaseServer } from "@/lib/supabase-server";
import { fetchInvestorDistributions, fetchInvestorPositions, getDefaultInvestorCompanyId } from "@/lib/investors";

function formatCurrency(value: number | string | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : value ?? 0;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(num) ? num : 0);
}

function formatPercent(value: number | string | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num === null || num === undefined || Number.isNaN(num)) {
    return "-";
  }
  return `${Number(num).toFixed(2)}%`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
}

export default async function InvestorPositionsPage() {
  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login?redirectTo=/inversionistas/positions");
  }

  const companyId = await getDefaultInvestorCompanyId(session.user?.id);
  if (!companyId) {
    redirect("/login?redirectTo=/inversionistas/positions");
  }

  const [positions, distributions] = await Promise.all([
    fetchInvestorPositions(supabase, companyId),
    fetchInvestorDistributions(supabase, companyId),
  ]);

  const distributionByVehicle = distributions.reduce<Record<string, number>>((acc, row) => {
    const key = row.vehicle_company_id ?? "__unknown";
    const previous = acc[key] ?? 0;
    const amount = typeof row.net_amount === "string" ? parseFloat(row.net_amount) : row.net_amount ?? 0;
    acc[key] = previous + (Number.isFinite(amount) ? amount : 0);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-lp-primary-1">Detalle de posiciones</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="min-w-full divide-y divide-lp-sec-5/60 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-lp-sec-4">
              <th className="px-4 py-3">Vehículo</th>
              <th className="px-4 py-3">Compromiso</th>
              <th className="px-4 py-3">Capital aportado</th>
              <th className="px-4 py-3">Distribuido</th>
              <th className="px-4 py-3">Valor actual</th>
              <th className="px-4 py-3">Participación</th>
              <th className="px-4 py-3">IRR</th>
              <th className="px-4 py-3">Última valoración</th>
              <th className="px-4 py-3">Actualizado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-lp-sec-5/40">
            {positions.map((position) => {
              const vehicleId = position.vehicle_company_id ?? "__unknown";
              const vehicleName = position.vehicles?.name?.trim() || "Sin asignar";
              const distributed = distributionByVehicle[vehicleId] ?? 0;
              return (
                <tr key={position.id}>
                  <td className="px-4 py-3 text-sm font-medium text-lp-primary-1">{vehicleName}</td>
                  <td className="px-4 py-3 text-sm text-lp-sec-3">{formatCurrency(position.commitment_amount)}</td>
                  <td className="px-4 py-3 text-sm text-lp-sec-3">{formatCurrency(position.capital_called)}</td>
                  <td className="px-4 py-3 text-sm text-lp-sec-3">{formatCurrency(distributed)}</td>
                  <td className="px-4 py-3 text-sm text-lp-sec-3">{formatCurrency(position.net_asset_value)}</td>
                  <td className="px-4 py-3 text-sm text-lp-sec-3">{formatPercent(position.ownership_percentage)}</td>
                  <td className="px-4 py-3 text-sm text-lp-sec-3">{formatPercent(position.irr)}</td>
                  <td className="px-4 py-3 text-sm text-lp-sec-3">{formatDate(position.last_valuation_date)}</td>
                  <td className="px-4 py-3 text-sm text-lp-sec-3">{formatDate(position.updated_at)}</td>
                </tr>
              );
            })}
            {!positions.length && (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-lp-sec-4" colSpan={9}>
                  No se han registrado posiciones aún.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
