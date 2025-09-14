'use client';

import { TableSkeleton } from '@/components/ui/table-skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { InvoiceUploadForm } from './InvoiceUploadForm';

export function InvoicesClient({ orgId }: { orgId: string }) {
  // TODO: Implement data fetching
  const loading = false;
  const error = null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-colette text-2xl font-bold text-lp-primary-1">Facturas</h1>
        <Dialog>
          <DialogTrigger asChild>
            <button className="rounded-md bg-lp-primary-1 px-4 py-2 text-sm font-semibold text-lp-primary-2 hover:bg-lp-primary-1/90">
              Cargar Factura
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Cargar Nueva Factura</DialogTitle>
              <DialogDescription>
                Ingresa los detalles de la factura y sube el archivo.
              </DialogDescription>
            </DialogHeader>
            <InvoiceUploadForm orgId={orgId} />
          </DialogContent>
        </Dialog>
      </div>
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? (
        <TableSkeleton cols={5} />
      ) : (
        <div className="rounded-lg border border-lp-sec-4/60 p-8 text-center">
          <h3 className="text-lg font-semibold text-lp-primary-1">No hay facturas</h3>
          <p className="mt-2 text-sm text-lp-sec-3">
            Aún no has cargado ninguna factura. Haz clic en el botón para empezar.
          </p>
        </div>
      )}
    </div>
  );
}
