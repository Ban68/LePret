'use client';

import useSWR from 'swr';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';

type Request = {
  id: string;
  invoices_total: number;
  invoices_count: number;
  status: 'review' | 'approved' | 'rejected' | 'funded';
};

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function RequestsClient({ orgId }: { orgId: string }) {
  const { data, error, isLoading } = useSWR(`/api/c/${orgId}/requests`, fetcher);

  const requests = data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-colette text-2xl font-bold text-lp-primary-1">Solicitudes de Financiamiento</h1>
      </div>
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">Error al cargar las solicitudes.</div>}
      {isLoading ? (
        <TableSkeleton cols={4} />
      ) : requests.length === 0 ? (
        <EmptyState
          title="No hay solicitudes"
          description="Actualmente no tienes ninguna solicitud de financiamiento en curso."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Solicitud #</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Monto Total</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"># Facturas</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {requests.map((request: Request) => (
                <tr key={request.id}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">{request.id.substring(0, 8)}...</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(request.invoices_total)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{request.invoices_count}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    <StatusBadge status={request.status} />
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
