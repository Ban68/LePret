import { RiskDashboard } from "../ui/RiskDashboard";

export const metadata = {
  title: "Riesgo | Headquarters",
};

export default function HqRiskPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-lp-primary-1">Gestión de riesgo</h2>
        <p className="text-sm text-lp-sec-3">
          Visualiza concentración de cartera, alertas tempranas y métricas de morosidad para actuar a tiempo.
        </p>
      </div>
      <RiskDashboard />
    </div>
  );
}
