import Link from "next/link";

export default function InvoicesPage({ params }: { params: { orgId: string } }) {
  const { orgId } = params;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-colette text-2xl font-bold text-lp-primary-1">Facturas</h1>
        <Link
          href={`/c/${orgId}/invoices/new`}
          className="rounded-md bg-lp-primary-1 px-4 py-2 text-sm font-medium text-lp-primary-2 hover:opacity-90"
        >
          Cargar factura
        </Link>
      </div>
      <p className="text-lp-sec-3">Listado de facturas (placeholder).</p>
      <div className="rounded-lg border border-lp-sec-4/60 p-4 text-sm text-lp-sec-3">
        Próximamente verás tus facturas cargadas aquí.
      </div>
    </div>
  );
}

