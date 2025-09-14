'use client';

import useSWR from 'swr';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { InvoiceUploadForm } from './InvoiceUploadForm';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';

type Invoice = {
  id: string;
  amount: number;
  due_date: string;
  status: 'uploaded' | 'validated' | 'rejected' | 'funded' | 'cancelled';
};

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function InvoicesClient({ orgId }: { orgId: string }) {
  const { data, error, isLoading, mutate } = useSWR(`/api/c/${orgId}/invoices`, fetcher);

  const invoices = data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-colette text-2xl font-bold text-lp-primary-1">Facturas</h1>
        <Dialog>
          <DialogTrigger asChild>
            <button id="dialog-trigger-invoice-upload" className="rounded-md bg-lp-primary-1 px-4 py-2 text-sm font-semibold text-lp-primary-2 hover:bg-lp-primary-1/90">
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
            <InvoiceUploadForm orgId={orgId} onSuccess={() => mutate()} />
          </DialogContent>
        </Dialog>
      </div>
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">Error al cargar las facturas.</div>}
      {isLoading ? (
        <TableSkeleton cols={5} />
      ) : invoices.length === 0 ? (
        <EmptyState
          title="No hay facturas"
          description="Aún no has cargado ninguna factura. Haz clic en el botón para empezar."
          action={{
            label: 'Cargar Factura',
            onClick: () => {
              document.getElementById('dialog-trigger-invoice-upload')?.click();
            },
          }}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Factura #</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Monto</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Vencimiento</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {invoices.map((invoice: Invoice) => (
                <tr key={invoice.id}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">{invoice.id.substring(0, 8)}...</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(invoice.amount)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {new Date(invoice.due_date).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    <StatusBadge status={invoice.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
