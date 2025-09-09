export default function ClientDashboardPage({ params }: { params: { orgId: string } }) {
  return (
    <div className="space-y-6">
      <h1 className="font-colette text-2xl font-bold text-lp-primary-1">Resumen</h1>
      <p className="text-lp-sec-3">
        Bienvenido al portal de clientes. Esta es una vista de resumen para la organización <span className="font-semibold">{params.orgId}</span>.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-lp-sec-4/60 p-4">
          <div className="text-sm text-lp-sec-3">Facturas cargadas</div>
          <div className="mt-2 text-2xl font-bold">—</div>
        </div>
        <div className="rounded-lg border border-lp-sec-4/60 p-4">
          <div className="text-sm text-lp-sec-3">Solicitudes en curso</div>
          <div className="mt-2 text-2xl font-bold">—</div>
        </div>
        <div className="rounded-lg border border-lp-sec-4/60 p-4">
          <div className="text-sm text-lp-sec-3">Desembolsos completados</div>
          <div className="mt-2 text-2xl font-bold">—</div>
        </div>
      </div>
    </div>
  );
}

