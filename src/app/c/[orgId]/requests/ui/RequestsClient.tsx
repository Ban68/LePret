"use client";

import { TableSkeleton } from "@/components/ui/table-skeleton";
import { useState } from "react";

export function RequestsClient({ orgId }: { orgId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-colette text-2xl font-bold text-lp-primary-1">Solicitudes de Financiamiento</h1>
      </div>
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="rounded-lg border border-lp-sec-4/60 p-8 text-center">
          <h3 className="text-lg font-semibold text-lp-primary-1">No hay solicitudes</h3>
          <p className="mt-2 text-sm text-lp-sec-3">Actualmente no tienes ninguna solicitud de financiamiento en curso.</p>
        </div>
      )}
    </div>
  );
}