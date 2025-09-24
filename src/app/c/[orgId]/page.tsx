import { DashboardSummary } from "./ui/DashboardSummary";

export default async function ClientDashboardPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  return (
    <div className="space-y-6">
      <h1 className="font-colette text-2xl font-bold text-lp-primary-1">Resumen</h1>
      <p className="text-lp-sec-3">
        Bienvenido al portal de clientes. Esta es una vista de resumen para la organización <span className="font-semibold">{orgId}</span>.
      </p>
      <div className="mt-2">
        <a
          href={`/c/${orgId}/invoices`}
          className="inline-flex rounded-md border border-lp-sec-4/60 bg-lp-primary-1 px-4 py-2 text-lp-primary-2 hover:opacity-90"
        >
          Crear Factura
        </a>
      </div>

      <DashboardSummary orgId={orgId} />
    </div>
  );
}

