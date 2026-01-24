"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineBanner } from "@/components/ui/inline-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { Toaster, toast } from "sonner";

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  created: { label: "Creado", className: "bg-amber-100 text-amber-800" },
  draft: { label: "Borrador", className: "bg-sky-100 text-sky-800" },
  sent: { label: "Enviado", className: "bg-indigo-100 text-indigo-800" },
  signed: { label: "Firmado", className: "bg-emerald-100 text-emerald-800" },
  completed: { label: "Completado", className: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "Cancelado", className: "bg-red-100 text-red-700" },
  failed: { label: "Fallido", className: "bg-red-100 text-red-700" },
};

const TYPE_LABELS: Record<string, string> = {
  CONTRATO_MARCO: "Contrato marco",
  RUT: "RUT",
  CAMARA_COMERCIO: "Cámara de Comercio",
  ESTADOS_FINANCIEROS: "Estados financieros",
  PAGARE: "Pagaré",
};

type DocumentItem = {
  id: string;
  type: string;
  status: string;
  created_at: string;
  request_id: string | null;
  public_url: string | null;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  items?: DocumentItem[];
};

function formatStatus(status: string | null | undefined) {
  const key = (status || "").toLowerCase();
  const meta = STATUS_STYLES[key] || { label: status || "-", className: "bg-neutral-100 text-neutral-700" };
  return meta;
}

function formatType(type: string | null | undefined) {
  if (!type) return "Documento";
  const normalized = type.toUpperCase();
  return TYPE_LABELS[normalized] || type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function DocumentsClient({ orgId }: { orgId: string }) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [resendingId, setResendingId] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/c/${orgId}/documents`, { cache: "no-store" });
      const payload = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || "No se pudieron cargar los documentos");
      }
      setDocuments(payload.items ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    documents.forEach((doc) => {
      if (doc.type) set.add(doc.type);
    });
    return ["all", ...Array.from(set).sort()];
  }, [documents]);

  const visibleDocuments = useMemo(() => {
    const filtered = documents.filter((doc) => typeFilter === "all" || doc.type === typeFilter);
    const sorted = [...filtered].sort((a, b) => {
      const left = new Date(a.created_at).getTime();
      const right = new Date(b.created_at).getTime();
      if (Number.isNaN(left) || Number.isNaN(right)) return 0;
      return sortOrder === "asc" ? left - right : right - left;
    });
    return sorted;
  }, [documents, sortOrder, typeFilter]);

  const handleResend = async (doc: DocumentItem) => {
    try {
      setResendingId(doc.id);
      const res = await fetch(`/api/c/${orgId}/documents/${doc.id}/resend`, {
        method: "POST",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || "No se pudo reenviar el contrato");
      }
      toast.success("Contrato reenviado correctamente");
      await fetchDocuments();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      toast.error(message);
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Toaster richColors closeButton position="top-right" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-lp-primary-1">Documentos</h1>
          <p className="text-sm text-lp-sec-3">
            Consulta, descarga y gestiona los documentos asociados a tus operaciones.
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchDocuments()} disabled={loading} className="inline-flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col text-sm">
          <span className="text-xs font-medium text-lp-sec-3">Filtrar por tipo</span>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="mt-1 w-48 rounded-md border border-lp-sec-4/60 bg-white px-3 py-2 text-sm shadow-sm focus:border-lp-primary-1 focus:outline-none"
          >
            {typeOptions.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "Todos" : formatType(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          <span className="text-xs font-medium text-lp-sec-3">Ordenar por fecha</span>
          <select
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value as "asc" | "desc")}
            className="mt-1 w-40 rounded-md border border-lp-sec-4/60 bg-white px-3 py-2 text-sm shadow-sm focus:border-lp-primary-1 focus:outline-none"
          >
            <option value="desc">Más recientes</option>
            <option value="asc">Más antiguos</option>
          </select>
        </label>
      </div>

      {error && (
        <InlineBanner
          tone="error"
          title="No pudimos cargar los documentos"
          description={error}
          action={
            <Button variant="link" onClick={() => fetchDocuments()} className="px-0 text-sm text-inherit">
              Reintentar
            </Button>
          }
        />
      )}

      {loading ? (
        <TableSkeleton cols={5} rows={5} />
      ) : visibleDocuments.length === 0 ? (
        <EmptyState
          title="Aún no hay documentos"
          description="Cuando generes solicitudes o cargues información, verás los documentos disponibles aquí."
          action={{ label: "Actualizar", onClick: () => fetchDocuments() }}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-lp-sec-4/40">
          <table className="min-w-full divide-y divide-lp-sec-4/40 text-sm">
            <thead className="bg-lp-primary-2">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-lp-sec-3">
                  Documento
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-lp-sec-3">
                  Estado
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-lp-sec-3">
                  Fecha creación
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-lp-sec-3">
                  Solicitud
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-lp-sec-3">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lp-sec-4/40 bg-white">
              {visibleDocuments.map((doc) => {
                const statusMeta = formatStatus(doc.status);
                const isContractDraft = doc.type === "CONTRATO_MARCO" && doc.status?.toLowerCase() === "created";
                return (
                  <tr key={doc.id} className="hover:bg-lp-primary-2/30">
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-lp-primary-1">{formatType(doc.type)}</div>
                      {doc.type === "CONTRATO_MARCO" && doc.request_id && (
                        <p className="text-xs text-lp-sec-3">Contrato de la solicitud {doc.request_id.slice(0, 8)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-lp-primary-1">{formatDate(doc.created_at)}</td>
                    <td className="px-4 py-3 align-top">
                      {doc.request_id ? (
                        <Link
                          href={`/c/${orgId}/requests/${doc.request_id}`}
                          className="text-sm text-lp-primary-1 underline-offset-2 hover:underline"
                        >
                          #{doc.request_id.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="text-xs text-lp-sec-3">No aplica</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        {doc.public_url ? (
                          <a
                            href={doc.public_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm font-medium text-lp-primary-1 hover:underline"
                          >
                            <Download className="h-4 w-4" />
                            Descargar
                          </a>
                        ) : (
                          <span className="text-xs text-lp-sec-3">No disponible</span>
                        )}
                        {isContractDraft && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={resendingId === doc.id}
                            onClick={() => handleResend(doc)}
                            className="inline-flex items-center gap-2"
                          >
                            {resendingId === doc.id ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" /> Reenviando
                              </>
                            ) : (
                              "Re-enviar para firma"
                            )}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
