'use client';

import { TableSkeleton } from '@/components/ui/table-skeleton';
import { EmptyState } from '@/components/ui/empty-state';

export function RequestsClient({ orgId }: { orgId: string }) {
  console.log('orgId', orgId); // Use orgId to remove warning
  // TODO: Implement data fetching
  const loading = true; // Temporarily set to true to demonstrate skeleton
  const error = null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-colette text-2xl font-bold text-lp-primary-1">Solicitudes de Financiamiento</h1>
      </div>
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? (
        <TableSkeleton cols={4} />
      ) : (
        <EmptyState
          title="No hay solicitudes"
          description="Actualmente no tienes ninguna solicitud de financiamiento en curso."
        />
      )}
    </div>
  );
}
