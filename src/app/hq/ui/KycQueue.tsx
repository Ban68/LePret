"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { KycStatus } from "@/lib/organizations";

const STATUS_LABEL: Record<KycStatus | "UNKNOWN" | "NONE", string> = {
  NOT_STARTED: "Sin iniciar",
  IN_PROGRESS: "En progreso",
  SUBMITTED: "En revisión",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  UNKNOWN: "Desconocido",
  NONE: "Sin estado",
};

type KycListItem = {
  id: string;
  name: string | null;
  type: string | null;
  status: KycStatus | null;
  rawStatus: string | null;
  submittedAt: string | null;
  updatedAt: string | null;
};

type KycDetail = {
  company: {
    id: string;
    name: string | null;
    type: string | null;
    legalName: string | null;
    taxId: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    billingEmail: string | null;
    bankAccount: string | null;
    status: KycStatus | null;
    rawStatus: string | null;
    submittedAt: string | null;
    approvedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
    updatedAt: string | null;
  } | null;
  owners: Array<{
    id: string;
    name: string | null;
    documentType: string | null;
    documentNumber: string | null;
    email: string | null;
    ownershipPercentage: number | null;
  }>;
  documents: Array<{
    name: string;
    path: string;
    createdAt: string | null;
    updatedAt: string | null;
    size: number | null;
    downloadUrl: string | null;
  }>;
};

type StatusFilter = "pending" | "all" | "approved" | "rejected";

type StatusUpdate = "APPROVED" | "IN_PROGRESS" | "REJECTED";

export function KycQueue() {
  const [items, setItems] = useState<KycListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectionLoading, setSelectionLoading] = useState(false);
  const [detail, setDetail] = useState<KycDetail | null>(null);
  const [updating, setUpdating] = useState<StatusUpdate | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter === "pending") {
        params.set("status", "SUBMITTED,IN_PROGRESS");
      } else if (statusFilter === "approved") {
        params.set("status", "APPROVED");
      } else if (statusFilter === "rejected") {
        params.set("status", "REJECTED");
      }
      const qs = params.toString();
      const response = await fetch(`/api/hq/kyc${qs ? `?${qs}` : ""}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Error obteniendo verificaciones");
      }
      const list = Array.isArray(payload.items) ? (payload.items as KycListItem[]) : [];
      setItems(list);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const loadDetail = useCallback(async (companyId: string) => {
    setSelectedId(companyId);
    setDetail(null);
    setSelectionLoading(true);
    try {
      const response = await fetch(`/api/hq/kyc/${companyId}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Error obteniendo detalle");
      }
      setDetail(payload as KycDetail);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      toast.error(message);
    } finally {
      setSelectionLoading(false);
    }
  }, []);

  const handleStatusChange = useCallback(
    async (next: StatusUpdate) => {
      if (!selectedId) return;
      let note: string | undefined;
      if (next !== "APPROVED") {
        const input = window.prompt("Describe brevemente lo que falta (se enviará al cliente):", "");
        if (input === null) {
          return;
        }
        note = input.trim() ? input.trim() : undefined;
      }
      setUpdating(next);
      try {
        const body: Record<string, unknown> = { status: next };
        if (note) body.note = note;
        const response = await fetch(`/api/hq/kyc/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || "No pudimos actualizar el estado");
        }
        toast.success(next === "APPROVED" ? "KYC aprobado" : "Actualizamos el estado del KYC");
        await fetchList();
        await loadDetail(selectedId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error inesperado";
        toast.error(message);
      } finally {
        setUpdating(null);
      }
    },
    [fetchList, loadDetail, selectedId]
  );

  const filteredItems = useMemo(() => {
    if (statusFilter === "all") return items;
    if (statusFilter === "pending") {
      return items.filter((item) => item.status === "SUBMITTED" || item.status === "IN_PROGRESS");
    }
    if (statusFilter === "approved") {
      return items.filter((item) => item.status === "APPROVED");
    }
    if (statusFilter === "rejected") {
      return items.filter((item) => item.status === "REJECTED");
    }
    return items;
  }, [items, statusFilter]);

  return (
    <section className="rounded-xl border border-lp-sec-4/60 bg-white p-6 shadow-sm">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-lp-primary-1">Verificaciones KYC</h2>
          <p className="text-sm text-lp-sec-3">Casos presentados por los clientes para revisión.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-lp-sec-3">
            Estado:
            <select
              className="ml-2 rounded-md border border-lp-sec-4/60 px-2 py-1 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="pending">Pendientes</option>
              <option value="all">Todos</option>
              <option value="approved">Aprobados</option>
              <option value="rejected">Rechazados</option>
            </select>
          </label>
          <Button type="button" variant="outline" onClick={fetchList} disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar"}
          </Button>
        </div>
      </header>

      {error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-lp-sec-4/60">
          <thead className="bg-lp-sec-4/30">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-2">Empresa</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-2">Estado</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-2">Enviado</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-2">Actualizado</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-sm text-lp-sec-3">
                  Cargando verificaciones...
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-sm text-lp-sec-3">
                  No encontramos verificaciones para este filtro.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr
                  key={item.id}
                  className={`border-t border-lp-sec-4/60 ${selectedId === item.id ? "bg-lp-primary-1/5" : ""}`}
                >
                  <td className="px-4 py-3 text-sm text-lp-primary-1">
                    <div className="font-medium">{item.name ?? "Sin nombre"}</div>
                    <div className="text-xs uppercase text-lp-sec-3">{item.type ?? "Sin tipo"}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-lp-sec-3">{formatStatus(item.status, item.rawStatus)}</td>
                  <td className="px-4 py-3 text-sm text-lp-sec-3">{formatDate(item.submittedAt)}</td>
                  <td className="px-4 py-3 text-sm text-lp-sec-3">{formatDate(item.updatedAt)}</td>
                  <td className="px-4 py-3 text-sm">
                    <Button type="button" variant="secondary" onClick={() => loadDetail(item.id)} disabled={selectionLoading && selectedId === item.id}>
                      {selectionLoading && selectedId === item.id ? "Abriendo..." : "Revisar"}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedId && detail ? (
        <DetailPanel
          detail={detail}
          updating={updating}
          onApprove={() => handleStatusChange("APPROVED")}
          onNeedDocs={() => handleStatusChange("IN_PROGRESS")}
          onReject={() => handleStatusChange("REJECTED")}
        />
      ) : null}
    </section>
  );
}

type DetailPanelProps = {
  detail: KycDetail;
  updating: StatusUpdate | null;
  onApprove: () => void;
  onNeedDocs: () => void;
  onReject: () => void;
};

function DetailPanel({ detail, updating, onApprove, onNeedDocs, onReject }: DetailPanelProps) {
  const { company, address, owners, documents } = detail;
  const statusLabel = formatStatus(company.status, company.rawStatus);

  return (
    <div className="mt-6 rounded-lg border border-lp-sec-4/60 bg-lp-sec-4/10 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-lp-primary-1">{company.name ?? company.id}</h3>
          <p className="text-sm text-lp-sec-3">
            Estado: <span className="font-medium text-lp-primary-1">{statusLabel}</span>
          </p>
          {company.submittedAt ? (
            <p className="text-xs text-lp-sec-3">Enviado: {formatDate(company.submittedAt, true)}</p>
          ) : null}
          {company.approvedAt ? (
            <p className="text-xs text-lp-sec-3">Aprobado: {formatDate(company.approvedAt, true)}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onNeedDocs} disabled={updating === "IN_PROGRESS"}>
            {updating === "IN_PROGRESS" ? "Enviando..." : "Solicitar ajustes"}
          </Button>
          <Button type="button" variant="destructive" onClick={onReject} disabled={updating === "REJECTED"}>
            {updating === "REJECTED" ? "Procesando..." : "Rechazar"}
          </Button>
          <Button type="button" onClick={onApprove} disabled={updating === "APPROVED"}>
            {updating === "APPROVED" ? "Aprobando..." : "Aprobar KYC"}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <InfoCard title="Datos legales">
          <InfoRow label="Razón social" value={company.legalName} />
          <InfoRow label="NIT" value={company.taxId} />
          <InfoRow label="Tipo" value={company.type} />
        </InfoCard>
        <InfoCard title="Contacto">
          <InfoRow label="Email" value={company.contactEmail} />
          <InfoRow label="Teléfono" value={company.contactPhone} />
          <InfoRow label="Email de facturación" value={company.billingEmail} />
          <InfoRow label="Cuenta bancaria" value={company.bankAccount} />
        </InfoCard>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <InfoCard title="Dirección registrada">
          {address ? (
            <>
              <InfoRow label="Línea 1" value={address.line1} />
              <InfoRow label="Línea 2" value={address.line2} />
              <InfoRow label="Ciudad" value={address.city} />
              <InfoRow label="Departamento" value={address.state} />
              <InfoRow label="Código postal" value={address.postalCode} />
              <InfoRow label="País" value={address.country} />
            </>
          ) : (
            <p className="text-sm text-lp-sec-3">Sin dirección registrada.</p>
          )}
        </InfoCard>
        <InfoCard title="Beneficiarios finales">
          {owners.length === 0 ? (
            <p className="text-sm text-lp-sec-3">No se cargaron beneficiarios.</p>
          ) : (
            <ul className="space-y-2">
              {owners.map((owner) => (
                <li key={owner.id} className="rounded-md border bg-white p-3 text-sm">
                  <p className="font-medium text-lp-primary-1">{owner.name ?? "Sin nombre"}</p>
                  <p className="text-xs text-lp-sec-3">Documento: {owner.documentType ?? "?"} {owner.documentNumber ?? ""}</p>
                  {owner.email ? <p className="text-xs text-lp-sec-3">Email: {owner.email}</p> : null}
                  {typeof owner.ownershipPercentage === "number" ? (
                    <p className="text-xs text-lp-sec-3">Participación: {owner.ownershipPercentage.toFixed(1)}%</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </InfoCard>
      </div>

      <InfoCard title="Documentos" className="mt-4">
        {documents.length === 0 ? (
          <p className="text-sm text-lp-sec-3">No hay documentos cargados.</p>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li key={doc.path} className="flex flex-col gap-1 rounded-md border border-lp-sec-4/60 bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-lp-primary-1">{doc.name}</p>
                  <p className="text-xs text-lp-sec-3">
                    {doc.createdAt ? `Subido: ${formatDate(doc.createdAt, true)}` : "Sin fecha"}
                    {typeof doc.size === "number" ? ` | ${formatBytes(doc.size)}` : ""}
                  </p>
                </div>
                {doc.downloadUrl ? (
                  <a
                    href={doc.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-lp-primary-1 underline decoration-dotted hover:opacity-80"
                  >
                    Ver documento
                  </a>
                ) : (
                  <span className="text-xs text-red-600">No pudimos generar enlace</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </InfoCard>
    </div>
  );
}

type InfoCardProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

function InfoCard({ title, children, className = "" }: InfoCardProps) {
  return (
    <div className={`rounded-lg border border-lp-sec-4/60 bg-white p-4 ${className}`}>
      <h4 className="text-sm font-semibold uppercase tracking-wide text-lp-sec-2">{title}</h4>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

type InfoRowProps = {
  label: string;
  value: string | null;
};

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex flex-col text-sm">
      <span className="text-xs uppercase text-lp-sec-3">{label}</span>
      <span className="text-lp-primary-1">{value ?? "-"}</span>
    </div>
  );
}

function formatStatus(status: KycStatus | null, fallback: string | null): string {
  if (status) {
    return STATUS_LABEL[status] ?? STATUS_LABEL.UNKNOWN;
  }
  if (fallback) {
    const normalized = fallback.toUpperCase();
    return STATUS_LABEL[normalized as keyof typeof STATUS_LABEL] ?? fallback;
  }
  return STATUS_LABEL.NONE;
}

function formatDate(value: string | null, includeTime = false): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return includeTime
    ? date.toLocaleString("es-CO")
    : date.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}