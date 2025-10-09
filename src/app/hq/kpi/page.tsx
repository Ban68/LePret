import { KpiDashboard } from "../ui/KpiDashboard";

export const metadata = {
  title: "KPIs | Headquarters",
};

export default function HqKpiPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-lp-primary-1">Indicadores clave</h2>
        <p className="text-sm text-lp-sec-3">
          Seguimiento de originaciones, yields y tiempos operativos para el portafolio de factoring.
        </p>
      </div>
      <KpiDashboard />
    </div>
  );
}
