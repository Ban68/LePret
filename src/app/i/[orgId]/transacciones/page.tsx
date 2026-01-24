"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { Button } from "@/components/ui/button";

type InvestorTransaction = {
  id: string;
  type: "contribution" | "distribution" | "interest" | "fee";
  amount: number;
  currency: string;
  date: string;
  description: string;
  positionId?: string;
};

type TransactionsResponse = {
  items: InvestorTransaction[];
};

const TRANSACTION_TYPES: Array<{ value: "all" | InvestorTransaction["type"]; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "contribution", label: "Aportes" },
  { value: "distribution", label: "Distribuciones" },
  { value: "interest", label: "Intereses" },
  { value: "fee", label: "Comisiones" },
];

const PAGE_SIZE = 10;

function toIsoDate(value: string, mode: "start" | "end"): string {
  if (!value) {
    return "";
  }

  if (mode === "start") {
    return new Date(`${value}T00:00:00.000Z`).toISOString();
  }

  return new Date(`${value}T23:59:59.999Z`).toISOString();
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(date);
}

function getTypeLabel(type: InvestorTransaction["type"]): string {
  switch (type) {
    case "contribution":
      return "Aporte";
    case "distribution":
      return "Distribución";
    case "interest":
      return "Interés";
    case "fee":
      return "Comisión";
    default:
      return type;
  }
}

export default function InvestorTransactionsPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId;
  const [transactions, setTransactions] = useState<InvestorTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<(typeof TRANSACTION_TYPES)[number]["value"]>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf">("csv");

  const dateRangeInvalid = useMemo(() => {
    if (!startDate || !endDate) {
      return false;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    return start > end;
  }, [startDate, endDate]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, startDate, endDate, orgId]);

  useEffect(() => {
    if (!orgId) {
      return;
    }

    if (dateRangeInvalid) {
      setError("El rango de fechas seleccionado no es válido.");
      setTransactions([]);
      setLoading(false);
      setHasMore(false);
      return;
    }

    const controller = new AbortController();

    async function fetchTransactions() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("limit", PAGE_SIZE.toString());
        params.set("offset", ((page - 1) * PAGE_SIZE).toString());

        if (typeFilter !== "all") {
          params.append("type", typeFilter);
        }

        if (startDate) {
          params.set("from", toIsoDate(startDate, "start"));
        }

        if (endDate) {
          params.set("to", toIsoDate(endDate, "end"));
        }

        const query = params.toString();
        const response = await fetch(`/api/i/${orgId}/transactions${query ? `?${query}` : ""}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("No se pudieron obtener las transacciones");
        }

        const data = (await response.json()) as TransactionsResponse;
        const items = data.items ?? [];

        setTransactions(items);
        setHasMore(items.length === PAGE_SIZE);
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          return;
        }

        setTransactions([]);
        setHasMore(false);
        setError("Ocurrió un error al cargar las transacciones.");
      } finally {
        setLoading(false);
      }
    }

    fetchTransactions();

    return () => {
      controller.abort();
    };
  }, [orgId, typeFilter, startDate, endDate, page, dateRangeInvalid]);

  const handleResetFilters = () => {
    setTypeFilter("all");
    setStartDate("");
    setEndDate("");
  };

  const handleExport = (format: "csv" | "pdf") => {
    if (!transactions.length) {
      return;
    }

    const headers = ["Fecha", "Tipo", "Descripción", "Posición", "Monto"];
    const rows = transactions.map((transaction) => [
      formatDate(transaction.date),
      getTypeLabel(transaction.type),
      transaction.description || "-",
      transaction.positionId ?? "-",
      formatCurrency(transaction.amount, transaction.currency),
    ]);

    if (format === "csv") {
      const csvContent = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `transacciones-${orgId}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }

    const tableRows = rows
      .map(
        (row) =>
          `<tr>${row
            .map((cell) => `<td style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">${cell}</td>`)
            .join("")}</tr>`,
      )
      .join("");

    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px;">
        <thead>
          <tr>
            ${headers
              .map(
                (header) =>
                  `<th style="background-color: #f3f4f6; border: 1px solid #d1d5db; padding: 8px; text-align: left;">${header}</th>`,
              )
              .join("")}
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    `;

    const documentContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charSet="utf-8" />
          <title>Historial de transacciones</title>
        </head>
        <body>
          <h1 style="font-family: Arial, sans-serif;">Historial de transacciones</h1>
          ${tableHtml}
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      return;
    }

    printWindow.document.write(documentContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-lp-primary-1">Transacciones</h1>
          <p className="mt-2 text-sm text-lp-sec-3">
            Consulta el historial de movimientos y exporta tus registros.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={exportFormat}
            onChange={(event) => setExportFormat(event.target.value as "csv" | "pdf")}
            className="rounded-md border border-lp-gray-200 px-3 py-2 text-sm text-lp-sec-3 focus:outline-none focus:ring-2 focus:ring-lp-primary-1"
          >
            <option value="csv">CSV</option>
            <option value="pdf">PDF</option>
          </select>
          <Button onClick={() => handleExport(exportFormat)} disabled={!transactions.length} variant="outline">
            Exportar
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-lp-gray-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-lp-sec-3">Tipo</label>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as (typeof TRANSACTION_TYPES)[number]["value"])}
              className="w-full rounded-md border border-lp-gray-200 px-3 py-2 text-sm text-lp-sec-3 focus:outline-none focus:ring-2 focus:ring-lp-primary-1"
            >
              {TRANSACTION_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-lp-sec-3">Desde</label>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-md border border-lp-gray-200 px-3 py-2 text-sm text-lp-sec-3 focus:outline-none focus:ring-2 focus:ring-lp-primary-1"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-lp-sec-3">Hasta</label>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full rounded-md border border-lp-gray-200 px-3 py-2 text-sm text-lp-sec-3 focus:outline-none focus:ring-2 focus:ring-lp-primary-1"
            />
          </div>

          <div className="flex items-end">
            <Button type="button" variant="ghost" onClick={handleResetFilters} className="w-full border border-transparent">
              Limpiar filtros
            </Button>
          </div>
        </div>
        {dateRangeInvalid ? (
          <p className="mt-4 text-sm text-red-600">El rango de fechas seleccionado no es válido.</p>
        ) : null}
      </div>

      {loading ? (
        <div className="rounded-lg border border-lp-gray-200 p-6 text-sm text-lp-sec-3">Cargando transacciones...</div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-600">{error}</div>
      ) : transactions.length > 0 ? (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-lp-gray-200">
            <table className="min-w-full divide-y divide-lp-gray-100">
              <thead className="bg-lp-gray-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-lp-sec-3">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Descripción</th>
                  <th className="px-4 py-3">Posición</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lp-gray-100 bg-white text-sm text-lp-sec-3">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="transition-colors hover:bg-lp-gray-50">
                    <td className="px-4 py-3">{formatDate(transaction.date)}</td>
                    <td className="px-4 py-3 font-medium text-lp-primary-1">{getTypeLabel(transaction.type)}</td>
                    <td className="px-4 py-3">{transaction.description || "-"}</td>
                    <td className="px-4 py-3">{transaction.positionId ?? "-"}</td>
                    <td className="px-4 py-3 text-right font-medium text-lp-primary-1">
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-lp-sec-3">
              Página {page}
              {transactions.length > 0 ? ` · Mostrando ${transactions.length} resultados` : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} variant="outline">
                Anterior
              </Button>
              <Button onClick={() => setPage((current) => current + 1)} disabled={!hasMore} variant="outline">
                Siguiente
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-lp-gray-200 p-6 text-sm text-lp-sec-3">
          No hay transacciones que coincidan con los filtros seleccionados.
        </div>
      )}
    </div>
  );
}
