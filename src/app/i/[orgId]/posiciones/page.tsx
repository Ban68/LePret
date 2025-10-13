"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

interface InvestorPosition {
  id: string;
  name: string;
  strategy: string;
  investedAmount: number;
  currentValue: number;
  currency: string;
  irr?: number;
  updatedAt: string;
}

interface PositionsResponse {
  items: InvestorPosition[];
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatIrr(irr?: number) {
  if (irr === null || irr === undefined) {
    return "-";
  }

  return `${irr.toFixed(2)}%`;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(date);
}

export default function InvestorPositionsPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId;
  const [positions, setPositions] = useState<InvestorPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) {
      return;
    }

    let isMounted = true;

    async function fetchPositions() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/i/${orgId}/positions`);

        if (!response.ok) {
          throw new Error("No se pudieron obtener las posiciones");
        }

        const data = (await response.json()) as PositionsResponse;

        if (isMounted) {
          setPositions(data.items ?? []);
        }
      } catch {
        if (isMounted) {
          setError("Ocurrió un error al cargar las posiciones.");
          setPositions([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchPositions();

    return () => {
      isMounted = false;
    };
  }, [orgId]);

  const hasPositions = useMemo(() => positions.length > 0, [positions]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-lp-primary-1">Posiciones</h1>
        <p className="mt-2 text-sm text-lp-sec-3">
          Consulta el desempeño de cada una de tus inversiones y revisa los detalles principales.
        </p>
      </div>

      {loading ? (
        <div className="rounded-lg border border-lp-gray-200 p-6 text-sm text-lp-sec-3">
          Cargando posiciones...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-600">{error}</div>
      ) : hasPositions ? (
        <div className="overflow-x-auto rounded-lg border border-lp-gray-200">
          <table className="min-w-full divide-y divide-lp-gray-100">
            <thead className="bg-lp-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-lp-sec-3">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Estrategia</th>
                <th className="px-4 py-3">Monto invertido</th>
                <th className="px-4 py-3">Valor actual</th>
                <th className="px-4 py-3">Moneda</th>
                <th className="px-4 py-3">IRR</th>
                <th className="px-4 py-3">Actualizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lp-gray-100 bg-white text-sm text-lp-sec-3">
              {positions.map((position) => (
                <tr key={position.id} className="transition-colors hover:bg-lp-gray-50">
                  <td className="px-4 py-3 font-medium text-lp-primary-1">{position.name}</td>
                  <td className="px-4 py-3">{position.strategy}</td>
                  <td className="px-4 py-3 font-medium text-lp-primary-1">
                    {formatCurrency(position.investedAmount, position.currency)}
                  </td>
                  <td className="px-4 py-3 font-medium text-lp-primary-1">
                    {formatCurrency(position.currentValue, position.currency)}
                  </td>
                  <td className="px-4 py-3 uppercase">{position.currency}</td>
                  <td className="px-4 py-3">{formatIrr(position.irr)}</td>
                  <td className="px-4 py-3">{formatDate(position.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-lp-gray-200 p-6 text-sm text-lp-sec-3">
          No tienes posiciones activas por el momento.
        </div>
      )}
    </div>
  );
}
