"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

interface StatementApiItem {
  id: string;
  period?: string;
  period_label?: string;
  generatedAt?: string;
  generated_at?: string;
  downloadUrl?: string;
  download_url?: string;
}

interface StatementsResponse {
  items: StatementApiItem[];
}

interface InvestorStatement {
  id: string;
  periodLabel: string;
  generatedAt?: string;
  downloadUrl: string;
}

function formatPeriodLabel(statement: StatementApiItem): string {
  if (statement.period_label && statement.period_label.trim().length > 0) {
    return statement.period_label;
  }

  if (statement.period && statement.period.trim().length > 0) {
    return statement.period;
  }

  return "Período no disponible";
}

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(date);
}

function normalizeStatement(statement: StatementApiItem): InvestorStatement {
  return {
    id: statement.id,
    periodLabel: formatPeriodLabel(statement),
    generatedAt: statement.generatedAt ?? statement.generated_at,
    downloadUrl: statement.downloadUrl ?? statement.download_url ?? "",
  };
}

export default function InvestorStatementsPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId;
  const [statements, setStatements] = useState<InvestorStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) {
      return;
    }

    let isMounted = true;

    async function fetchStatements() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/i/${orgId}/statements`);

        if (!response.ok) {
          throw new Error("No se pudieron obtener los estados de cuenta");
        }

        const data = (await response.json()) as StatementsResponse;
        const normalizedStatements = (data.items ?? []).map(normalizeStatement);

        if (isMounted) {
          setStatements(normalizedStatements);
        }
      } catch {
        if (isMounted) {
          setError("Ocurrió un error al cargar los estados de cuenta.");
          setStatements([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void fetchStatements();

    return () => {
      isMounted = false;
    };
  }, [orgId]);

  const hasStatements = useMemo(() => statements.length > 0, [statements]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-lp-primary-1">Estados de cuenta</h1>
        <p className="mt-2 text-sm text-lp-sec-3">
          Consulta tus extractos generados y descárgalos para llevar un registro de tus inversiones.
        </p>
      </div>

      {loading ? (
        <div className="rounded-lg border border-lp-gray-200 p-6 text-sm text-lp-sec-3">
          Cargando estados de cuenta...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-600">{error}</div>
      ) : hasStatements ? (
        <div className="overflow-x-auto rounded-lg border border-lp-gray-200">
          <table className="min-w-full divide-y divide-lp-gray-100">
            <thead className="bg-lp-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-lp-sec-3">
                <th className="px-4 py-3">Período</th>
                <th className="px-4 py-3">Fecha de generación</th>
                <th className="px-4 py-3">Descarga</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lp-gray-100 bg-white text-sm text-lp-sec-3">
              {statements.map((statement) => (
                <tr key={statement.id} className="transition-colors hover:bg-lp-gray-50">
                  <td className="px-4 py-3 font-medium text-lp-primary-1">{statement.periodLabel}</td>
                  <td className="px-4 py-3">{formatDate(statement.generatedAt)}</td>
                  <td className="px-4 py-3">
                    {statement.downloadUrl ? (
                      <a
                        href={statement.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-lp-primary-1 hover:underline"
                      >
                        Descargar
                      </a>
                    ) : (
                      <span className="text-lp-sec-3">No disponible</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-lp-gray-200 p-6 text-sm text-lp-sec-3">
          No hay estados de cuenta disponibles por el momento.
        </div>
      )}
    </div>
  );
}
