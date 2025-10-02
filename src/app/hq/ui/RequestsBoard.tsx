"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Link from "next/link";

import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, string> = {
  review: "En revision",
  offered: "Ofertada",
  accepted: "Aceptada",
  signed: "Firmada",
  funded: "Desembolsada",
  cancelled: "Cancelada",
};

const STATUS_ORDER: Record<string, number> = {
  review: 0,
  offered: 1,
  accepted: 2,
  signed: 3,
  funded: 4,
  cancelled: 5,
};

type RequestItem = {
  id: string;
  company_id: string;
  company_name: string;
  company_type: string | null;
  status: string;
  requested_amount: number;
  currency: string;
  created_at: string;
  created_by_id: string | null;
  created_by_name: string | null;
  invoices_count: number;
  invoices_total: number;
  payers: Array<{ name: string; identifier: string | null }>;
  needs_action: boolean;
  next_action: string;
  pending_documents: string[];
  documents: Array<{ type: string; status: string; created_at: string }>;
  archived_at: string | null;
  offer: { id: string; status: string; summary: string } | null;
  force_sign_enabled: boolean;
};

type GroupValue = "needs" | "client" | "payer" | "status" | "month" | "none";

type GroupedBlock = {
  key: string;
  label: string;
  order: number;
  items: RequestItem[];
  totals: {
    amount: number;
    invoices: number;
    pending: number;
  };
};

type DrawerAction = "offer" | "contract" | "force-sign" | "fund" | "deny" | "archive";

type CustomOfferValues = {
  annualRate: number;
  advancePct: number;
  processingFee: number;
  wireFee: number;
  validForDays: number;
};

export function RequestsBoard() {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [needsOnly, setNeedsOnly] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [groupBy, setGroupBy] = useState<GroupValue>("needs");
  const [companiesIndex, setCompaniesIndex] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<RequestItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<DrawerAction | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (companyFilter !== "all") params.set("company", companyFilter);
      if (needsOnly) params.set("needsAction", "true");
      if (startDate) params.set("start", startDate);
      if (endDate) params.set("end", endDate);
      const qs = params.toString();
      const response = await fetch(`/api/hq/requests${qs ? `?${qs}` : ""}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Error obteniendo solicitudes");
      }
      const list = (payload.items || []) as RequestItem[];
      setItems(list);
      setCompaniesIndex((prev) => {
        const next = { ...prev };
        for (const item of list) {
          next[item.company_id] = item.company_name;
        }
        return next;
      });
      return list;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
      setItems([]);
      return [] as RequestItem[];
    } finally {
      setLoading(false);
    }
  }, [statusFilter, companyFilter, needsOnly, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!drawerOpen) {
      setSelected(null);
    }
  }, [drawerOpen]);

  const searchTerm = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }
      if (companyFilter !== "all" && item.company_id !== companyFilter) {
        return false;
      }
      if (needsOnly && !item.needs_action) {
        return false;
      }
      if (!searchTerm) {
        return true;
      }
      const haystack = [
        item.id,
        item.company_name,
        item.status,
        item.next_action,
        item.created_by_name ?? "",
        item.payers.map((payer) => payer.name).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [items, statusFilter, companyFilter, needsOnly, searchTerm]);

  const groupedBlocks = useMemo(() => {
    const map = new Map<string, GroupedBlock>();
    for (const item of filtered) {
      const meta = resolveGroup(item, groupBy);
      const current = map.get(meta.key);
      if (current) {
        current.items.push(item);
        current.totals.amount += item.requested_amount;
        current.totals.invoices += item.invoices_count;
        current.totals.pending += item.needs_action ? 1 : 0;
      } else {
        map.set(meta.key, {
          key: meta.key,
          label: meta.label,
          order: meta.order,
          items: [item],
          totals: {
            amount: item.requested_amount,
            invoices: item.invoices_count,
            pending: item.needs_action ? 1 : 0,
          },
        });
      }
    }

    return Array.from(map.values())
      .map((block) => ({
        ...block,
        items: [...block.items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      }))
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.label.localeCompare(b.label);
      });
  }, [filtered, groupBy]);

  const summary = useMemo(() => {
    const total = filtered.length;
    const pending = filtered.filter((item) => item.needs_action).length;
    const amount = filtered.reduce((acc, item) => acc + item.requested_amount, 0);
    return { total, pending, amount };
  }, [filtered]);

  const companyOptions = useMemo(() => {
    return Object.entries(companiesIndex)
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [companiesIndex]);

  const handleRowDetail = useCallback((item: RequestItem) => {
    setSelected(item);
    setDrawerOpen(true);
  }, []);

  const refreshSelection = useCallback(async () => {
    const list = await fetchData();
    if (!selected) {
      return;
    }
    const updated = list.find((entry) => entry.id === selected.id) || null;
    setSelected(updated);
    if (!updated) {
      setDrawerOpen(false);
    }
  }, [fetchData, selected]);

  const handleAction = useCallback(
    async (action: DrawerAction, payload?: unknown) => {
      if (!selected) return false;
      if (action === 'deny' && !confirm('Seguro que quieres denegar la solicitud?')) {
        return false;
      }
      if (action === 'archive' && !confirm('Archivar esta solicitud?')) {
        return false;
      }
      setActionLoading(action);
      let success = false;
      try {
        let endpoint = '';
        let successMessage = '';
        if (action === 'offer') {
          endpoint = `/api/c/${selected.company_id}/requests/${selected.id}/offer`;
          successMessage = 'Oferta generada';
        } else if (action === 'force-sign') {
          endpoint = `/api/c/${selected.company_id}/requests/${selected.id}/force-signed`;
          successMessage = 'Solicitud marcada como firmada';
        } else if (action === 'contract') {
          endpoint = `/api/c/${selected.company_id}/requests/${selected.id}/contract`;
          successMessage = 'Contrato generado';
        } else if (action === 'fund') {
          endpoint = `/api/c/${selected.company_id}/requests/${selected.id}/fund`;
          successMessage = 'Solicitud marcada como desembolsada';
        } else if (action === 'deny') {
          endpoint = `/api/c/${selected.company_id}/requests/${selected.id}/deny`;
          successMessage = 'Solicitud denegada';
        } else if (action === 'archive') {
          endpoint = `/api/c/${selected.company_id}/requests/${selected.id}/archive`;
          successMessage = 'Solicitud archivada';
        }

        if (!endpoint) {
          throw new Error('Accion no soportada');
        }

        const requestInit: RequestInit = { method: 'POST' };
        if (action === 'offer' && payload && typeof payload === 'object') {
          requestInit.body = JSON.stringify(payload);
          requestInit.headers = { 'Content-Type': 'application/json' };
        }

        const response = await fetch(endpoint, requestInit);
        const responsePayload = await response.json().catch(() => ({})) as { error?: string; code?: string };
        if (!response.ok) {
          if (responsePayload.code === 'force_sign_disabled' || responsePayload.error === 'force_sign_disabled') {
            throw new Error('Marcar como firmada esta deshabilitada en este ambiente.');
          }
          throw new Error(responsePayload.error || 'No se pudo completar la accion');
        }
        toast.success(successMessage);
        await refreshSelection();
        success = true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error inesperado';
        toast.error(message);
      } finally {
        setActionLoading(null);
      }
      return success;
    },
    [selected, refreshSelection]
  );

  return (
    <section className="rounded-lg border border-lp-sec-4/60 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-lp-primary-1">Operaciones en curso</h2>
        <p className="text-sm text-lp-sec-3">
          Agrupa y prioriza solicitudes para avanzar aprobaciones, documentacion, contratos y desembolsos.
        </p>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <SummaryCard label="Solicitudes" value={formatNumber(summary.total)} subtitle="Totales filtradas" />
        <SummaryCard label="Pendientes" value={formatNumber(summary.pending)} subtitle="Necesitan accion" highlight />
        <SummaryCard label="Monto solicitado" value={`$${formatCurrency(summary.amount)}`} subtitle="Suma en COP" />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-4">
        <FilterField label="Estado">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="w-full rounded-md border border-lp-sec-4/80 bg-white px-2 py-2 text-sm"
          >
            <option value="all">Todos</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Cliente">
          <select
            value={companyFilter}
            onChange={(event) => setCompanyFilter(event.target.value)}
            className="w-full rounded-md border border-lp-sec-4/80 bg-white px-2 py-2 text-sm"
          >
            <option value="all">Todos</option>
            {companyOptions.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Desde">
          <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </FilterField>

        <FilterField label="Hasta">
          <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </FilterField>

        <FilterField label="Buscar" className="lg:col-span-2">
          <Input
            placeholder="ID, cliente, pagador, analista..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </FilterField>

        <FilterField label="Mostrar">
          <div className="flex items-center gap-2 rounded-md border border-lp-sec-4/80 bg-lp-sec-4/20 px-2 py-2">
            <Checkbox
              id="needs-only"
              checked={needsOnly}
              onCheckedChange={(value) => setNeedsOnly(Boolean(value))}
            />
            <label htmlFor="needs-only" className="text-sm text-lp-primary-1">
              Solo pendientes
            </label>
          </div>
        </FilterField>

        <FilterField label="Agrupar por" className="lg:col-span-2">
          <div className="flex flex-wrap gap-2">
            <GroupButton label="Pendientes" active={groupBy === "needs"} onClick={() => setGroupBy("needs")} />
            <GroupButton label="Cliente" active={groupBy === "client"} onClick={() => setGroupBy("client")} />
            <GroupButton label="Pagador" active={groupBy === "payer"} onClick={() => setGroupBy("payer")} />
            <GroupButton label="Estado" active={groupBy === "status"} onClick={() => setGroupBy("status")} />
            <GroupButton label="Mes" active={groupBy === "month"} onClick={() => setGroupBy("month")} />
            <GroupButton label="Sin agrupar" active={groupBy === "none"} onClick={() => setGroupBy("none")} />
          </div>
        </FilterField>
      </div>

      {loading ? (
        <div className="rounded-md border border-dashed border-lp-sec-4/80 p-6 text-sm text-lp-sec-3">
          Cargando solicitudes...
        </div>
      ) : error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : groupedBlocks.length === 0 ? (
        <div className="rounded-md border border-dashed border-lp-sec-4/80 p-6 text-sm text-lp-sec-3">
          No hay solicitudes para los filtros seleccionados.
        </div>
      ) : (
        <div className="space-y-6">
          {groupedBlocks.map((group) => (
            <GroupSection key={group.key} block={group} onOpenDetail={handleRowDetail} />
          ))}
        </div>
      )}

      <RequestDetailDrawer
        open={drawerOpen && !!selected}
        request={selected}
        onClose={() => setDrawerOpen(false)}
        onAction={handleAction}
        actionLoading={actionLoading}
      />
    </section>
  );
}

type SummaryCardProps = {
  label: string;
  value: string;
  subtitle: string;
  highlight?: boolean;
};

function SummaryCard({ label, value, subtitle, highlight }: SummaryCardProps) {
  return (
    <div
      className={`rounded-md border px-4 py-3 shadow-sm ${
        highlight ? "border-amber-300 bg-amber-50" : "border-lp-sec-4/80 bg-white"
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-lp-sec-3">{label}</div>
      <div className="text-2xl font-semibold text-lp-primary-1">{value}</div>
      <div className="text-xs text-lp-sec-3">{subtitle}</div>
    </div>
  );
}

type FilterFieldProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

function FilterField({ label, children, className }: FilterFieldProps) {
  return (
    <div className={className}>
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-lp-sec-3">{label}</div>
      {children}
    </div>
  );
}

type GroupButtonProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

function GroupButton({ label, active, onClick }: GroupButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? "border-lp-primary-1 bg-lp-primary-1 text-lp-primary-2"
          : "border-lp-sec-4/80 bg-white text-lp-primary-1 hover:bg-lp-sec-4/40"
      }`}
    >
      {label}
    </button>
  );
}

type GroupSectionProps = {
  block: GroupedBlock;
  onOpenDetail: (item: RequestItem) => void;
};

function GroupSection({ block, onOpenDetail }: GroupSectionProps) {
  return (
    <div className="rounded-lg border border-lp-sec-4/80">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-lp-sec-4/60 bg-lp-sec-4/30 px-4 py-2">
        <div className="text-sm font-semibold text-lp-primary-1">{block.label}</div>
        <div className="text-xs text-lp-sec-3">
          {`${block.items.length} solicitudes`} | {`Pendientes: ${block.totals.pending}`} | {`Monto: $${formatCurrency(block.totals.amount)}`}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-lp-sec-4/80 text-left text-sm">
          <thead className="bg-lp-primary-2">
            <tr>
              <th className="px-3 py-2 font-medium text-lp-sec-3">Solicitud</th>
              <th className="px-3 py-2 font-medium text-lp-sec-3">Cliente</th>
              <th className="px-3 py-2 font-medium text-lp-sec-3">Pagador</th>
              <th className="px-3 py-2 font-medium text-lp-sec-3">Monto</th>
              <th className="px-3 py-2 font-medium text-lp-sec-3">Estado</th>
              <th className="px-3 py-2 font-medium text-lp-sec-3">Proximo paso</th>
              <th className="px-3 py-2 font-medium text-lp-sec-3">Pendientes</th>
              <th className="px-3 py-2 font-medium text-lp-sec-3">Creada</th>
              <th className="px-3 py-2 font-medium text-lp-sec-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-lp-sec-4/80">
            {block.items.map((item) => (
              <tr key={item.id} className={item.archived_at ? "bg-lp-sec-4/40" : item.needs_action ? "bg-amber-50/40" : "bg-white"}>
                <td className="px-3 py-2 align-top">
                  <div className="font-mono text-xs text-lp-primary-1">{truncateId(item.id)}</div>
                  <div className="text-xs text-lp-sec-3">Facturas: {item.invoices_count}</div>
                  {item.offer ? <div className="text-[11px] text-lp-sec-3">Oferta: {item.offer.summary}</div> : null}
                </td>
                <td className="px-3 py-2 align-top text-sm">
                  <div className="font-medium text-lp-primary-1">{item.company_name}</div>
                  {item.created_by_name && (
                    <div className="text-xs text-lp-sec-3">Analista: {item.created_by_name}</div>
                  )}
                </td>
                <td className="px-3 py-2 align-top text-sm">
                  <div className="text-lp-primary-1">{resolvePayerLabel(item.payers)}</div>
                  {renderIdentifiers(item.payers)}
                </td>
                <td className="px-3 py-2 align-top text-sm">
                  <div className="font-semibold text-lp-primary-1">${formatCurrency(item.requested_amount)}</div>
                  <div className="text-xs text-lp-sec-3">{item.currency} | Facturas ${formatCurrency(item.invoices_total)}</div>
                </td>
                <td className="px-3 py-2 align-top text-sm">
                  <StatusBadge status={item.status} kind="request" />
                </td>
                <td className="px-3 py-2 align-top text-sm text-lp-primary-1">{item.next_action}</td>
                <td className="px-3 py-2 align-top text-xs text-lp-sec-3">
                  {item.pending_documents.length === 0 ? "Sin pendientes" : item.pending_documents.join(", ")}
                </td>
                <td className="px-3 py-2 align-top text-xs text-lp-sec-3">
                  <div>{formatDate(item.created_at)}</div>
                  <div>{formatAge(item.created_at)}</div>
                </td>
                <td className="px-3 py-2 align-top text-xs">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      className="text-lp-primary-1 underline hover:opacity-80"
                      onClick={() => onOpenDetail(item)}
                    >
                      Ver detalle
                    </button>
                    <Link href={`/hq/companies/${item.company_id}`} className="text-lp-primary-1 underline hover:opacity-80">
                      Ver cliente
                    </Link>
                    <Link
                      href={`/c/${item.company_id}/requests`}
                      className="text-lp-sec-3 underline hover:opacity-80"
                      target="_blank"
                    >
                      Abrir portal
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type RequestDetailDrawerProps = {
  open: boolean;
  request: RequestItem | null;
  onClose: () => void;
  onAction: (action: DrawerAction, payload?: unknown) => Promise<boolean> | boolean;
  actionLoading: DrawerAction | null;
};

function RequestDetailDrawer({ open, request, onClose, onAction, actionLoading }: RequestDetailDrawerProps) {
  const [offerWizardOpen, setOfferWizardOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setOfferWizardOpen(false);
    }
  }, [open]);

  if (!open || !request) {
    return null;
  }

  const statusIndex = STATUS_ORDER[request.status] ?? 0;
  const statusFlow = ['review', 'offered', 'accepted', 'signed', 'funded'];
  const isArchived = Boolean(request.archived_at);
  const canGenerateOffer = !isArchived && request.status === 'review';
  const hasContract = request.documents.some((doc) => doc.type === 'CONTRATO_MARCO');
  const canGenerateContract = !isArchived && (request.status === 'accepted' || request.status === 'offered') && !hasContract;
  const allowForceSign = Boolean(request.force_sign_enabled);
  const canForceSign = allowForceSign && !isArchived && (request.status === 'accepted' || request.status === 'offered');
  const canFund = !isArchived && request.status === 'signed';
  const canDeny = !isArchived && (request.status === 'review' || request.status === 'offered');
  const canArchive = !isArchived;
  const archiveLabel = isArchived ? 'Solicitud archivada' : 'Archivar solicitud';

  const handleOfferWizardOpen = () => {
    if (!canGenerateOffer || actionLoading === 'offer') {
      return;
    }
    setOfferWizardOpen(true);
  };

  const handleOfferWizardClose = () => {
    setOfferWizardOpen(false);
  };

  const handleAutoOffer = () => {
    return onAction('offer');
  };

  const handleManualOffer = (values: CustomOfferValues) => {
    return onAction('offer', { mode: 'manual', values });
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-lp-sec-4/60 px-6 py-4">
          <div>
            <div className="text-sm font-medium text-lp-sec-3">Solicitud</div>
            <h3 className="text-lg font-semibold text-lp-primary-1">#{truncateId(request.id)}</h3>
          </div>
          <button type="button" className="text-sm text-lp-sec-3 underline" onClick={onClose}>
            Cerrar
          </button>
        </header>
        <div className="flex-1 space-y-6 px-6 py-6">
          <section>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <StatusBadge status={request.status} kind="request" />
              <div className="text-xs text-lp-sec-3">
                Creada {formatDate(request.created_at)} | {formatAge(request.created_at)} en curso
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-lp-sec-3">
              <div>
                <div className="text-xs uppercase">Cliente</div>
                <div className="font-medium text-lp-primary-1">{request.company_name}</div>
              </div>
              <div>
                <div className="text-xs uppercase">Monto solicitado</div>
                <div className="font-medium text-lp-primary-1">${formatCurrency(request.requested_amount)}</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-xs uppercase text-lp-sec-3">Progreso</div>
              <ul className="mt-2 flex flex-wrap gap-2 text-xs">
                {statusFlow.map((status) => {
                  const reached = (STATUS_ORDER[status] ?? 0) <= statusIndex;
                  return (
                    <li
                      key={status}
                      className={`rounded-full px-3 py-1 ${
                        reached ? 'bg-lp-primary-1 text-lp-primary-2' : 'bg-lp-sec-4/60 text-lp-primary-1'
                      }`}
                    >
                      {STATUS_LABEL[status] ?? status}
                    </li>
                  );
                })}
              </ul>
              {isArchived && (
                <div className="mt-3 rounded-md border border-dashed border-lp-sec-4/60 bg-lp-sec-4/40 px-3 py-2 text-xs text-lp-sec-3">
                  Archivada {request.archived_at ? formatDate(request.archived_at) : 'Sin fecha'}
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="text-xs uppercase text-lp-sec-3">Proximo paso sugerido</div>
            <p className="mt-2 text-sm text-lp-primary-1">{request.next_action}</p>
            {request.pending_documents.length > 0 && (
              <p className="mt-2 text-xs text-lp-sec-3">Pendientes: {request.pending_documents.join(', ')}</p>
            )}
          </section>

          <section>
            <div className="text-xs uppercase text-lp-sec-3">Pagadores</div>
            <ul className="mt-2 space-y-1 text-sm text-lp-primary-1">
              {request.payers.map((payer) => (
                <li key={`${payer.name}-${payer.identifier || 'anon'}`}>
                  {payer.name}
                  {payer.identifier ? <span className="text-xs text-lp-sec-3"> | {payer.identifier}</span> : null}
                </li>
              ))}
              {request.payers.length === 0 && <li className="text-sm text-lp-sec-3">Sin pagador declarado</li>}
            </ul>
          </section>

          <section>
            <div className="text-xs uppercase text-lp-sec-3">Documentos</div>
            {request.documents.length === 0 ? (
              <div className="mt-2 text-sm text-lp-sec-3">Sin documentos registrados.</div>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {request.documents.map((doc) => (
                  <li key={`${doc.type}-${doc.created_at}`} className="flex items-center justify-between gap-4">
                    <span className="text-lp-primary-1">{doc.type}</span>
                    <span className="text-xs text-lp-sec-3">{doc.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <div className="text-xs uppercase text-lp-sec-3">Acciones rapidas</div>
            <div className="flex flex-wrap gap-2">
              <ActionButton
                label="Generar oferta"
                disabled={!canGenerateOffer}
                loading={actionLoading === 'offer'}
                onClick={handleOfferWizardOpen}
              />
              <ActionButton
                label="Generar contrato"
                disabled={!canGenerateContract}
                loading={actionLoading === 'contract'}
                onClick={() => onAction('contract')}
              />
              <ActionButton
                label="Marcar como firmada"
                disabled={!canForceSign}
                loading={actionLoading === 'force-sign'}
                onClick={() => onAction('force-sign')}
              />
              {!allowForceSign && !isArchived && (request.status === 'accepted' || request.status === 'offered') ? (
                <p className="mt-1 text-xs text-lp-sec-3">Disponible solo en ambientes autorizados.</p>
              ) : null}
              <ActionButton
                label="Marcar desembolso"
                disabled={!canFund}
                loading={actionLoading === 'fund'}
                onClick={() => onAction('fund')}
              />
              <ActionButton
                label="Denegar solicitud"
                disabled={!canDeny}
                loading={actionLoading === 'deny'}
                onClick={() => onAction('deny')}
                variant="danger"
              />
              <ActionButton
                label={archiveLabel}
                disabled={!canArchive}
                loading={actionLoading === 'archive'}
                onClick={() => onAction('archive')}
                variant="secondary"
              />
            </div>
          </section>
        </div>
      </aside>
      {offerWizardOpen ? (
        <OfferWizard
          request={request}
          onClose={handleOfferWizardClose}
          onAuto={handleAutoOffer}
          onSubmit={handleManualOffer}
          loading={actionLoading === 'offer'}
        />
      ) : null}
    </>
  );
}

type OfferWizardProps = {
  request: RequestItem;
  onClose: () => void;
  onAuto: () => Promise<boolean> | boolean;
  onSubmit: (values: CustomOfferValues) => Promise<boolean> | boolean;
  loading: boolean;
};

type OfferWizardFormState = {
  annualRate: string;
  advancePct: string;
  processingFee: string;
  wireFee: string;
  validForDays: string;
};

type OfferWizardStep = {
  key: keyof OfferWizardFormState;
  title: string;
  description: string;
  unit: string;
  min: number;
  max?: number;
  isCurrency?: boolean;
};

function OfferWizard({ request, onClose, onAuto, onSubmit, loading }: OfferWizardProps) {
  const requestedAmount = Number(request.requested_amount) || 0;
  const defaultProcessing = useMemo(
    () => Math.round(Math.max(50000, Math.min(200000, requestedAmount * 0.005))),
    [requestedAmount]
  );
  const steps: OfferWizardStep[] = useMemo(
    () => [
      {
        key: 'annualRate',
        title: '¿Cuál es la tasa anual efectiva (EA)?',
        description: 'Define el porcentaje anual que esperas aplicar a la operación.',
        unit: '% EA',
        min: 0,
        max: 200,
      },
      {
        key: 'advancePct',
        title: '¿Qué porcentaje de anticipo deseas ofrecer?',
        description: 'Establece el aforo máximo respecto al valor solicitado por el cliente.',
        unit: '% de anticipo',
        min: 0,
        max: 100,
      },
      {
        key: 'processingFee',
        title: 'Tarifa de procesamiento',
        description: 'Incluye los costos administrativos únicos que se descontarán del anticipo.',
        unit: 'COP',
        min: 0,
        isCurrency: true,
      },
      {
        key: 'wireFee',
        title: 'Costo de transferencia',
        description: 'Define los gastos asociados al envío de los recursos al cliente.',
        unit: 'COP',
        min: 0,
        isCurrency: true,
      },
      {
        key: 'validForDays',
        title: '¿Cuántos días estará vigente la oferta?',
        description: 'Una vez cumplido el plazo la oferta expirará automáticamente.',
        unit: 'días',
        min: 1,
        max: 90,
      },
    ],
    []
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [inputTouched, setInputTouched] = useState(false);
  const [flowLoading, setFlowLoading] = useState<null | 'auto' | 'manual'>(null);
  const [formValues, setFormValues] = useState<OfferWizardFormState>(() => ({
    annualRate: '30',
    advancePct: '85',
    processingFee: String(defaultProcessing),
    wireFee: '5000',
    validForDays: '7',
  }));

  useEffect(() => {
    setStepIndex(0);
    setInputTouched(false);
    setFormValues({
      annualRate: '30',
      advancePct: '85',
      processingFee: String(defaultProcessing),
      wireFee: '5000',
      validForDays: '7',
    });
  }, [request.id, defaultProcessing]);

  useEffect(() => {
    if (!loading) {
      setFlowLoading(null);
    }
  }, [loading]);

  useEffect(() => {
    setInputTouched(false);
  }, [stepIndex]);

  const parseNumber = useCallback((value: string) => {
    if (typeof value !== 'string') return Number.NaN;
    const sanitized = value.replace(/[\s,]/g, (match) => (match === ',' ? '.' : ''));
    const parsed = Number(sanitized);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }, []);

  const resolvedValues = useMemo<CustomOfferValues>(() => {
    const annualRate = parseNumber(formValues.annualRate);
    const advancePct = parseNumber(formValues.advancePct);
    const processingFee = parseNumber(formValues.processingFee);
    const wireFee = parseNumber(formValues.wireFee);
    const validForDays = parseNumber(formValues.validForDays);

    const normalizedAnnual = Number.isFinite(annualRate) ? Math.max(0, Math.min(200, annualRate)) : 30;
    const normalizedAdvance = Number.isFinite(advancePct) ? Math.max(0, Math.min(100, advancePct)) : 85;
    const normalizedProcessing = Number.isFinite(processingFee) ? Math.max(0, Math.round(processingFee)) : defaultProcessing;
    const normalizedWire = Number.isFinite(wireFee) ? Math.max(0, Math.round(wireFee)) : 5000;
    const normalizedValid = Number.isFinite(validForDays) ? Math.max(1, Math.min(90, Math.round(validForDays))) : 7;

    return {
      annualRate: normalizedAnnual,
      advancePct: normalizedAdvance,
      processingFee: normalizedProcessing,
      wireFee: normalizedWire,
      validForDays: normalizedValid,
    };
  }, [defaultProcessing, formValues, parseNumber]);

  const summary = useMemo(() => {
    const advanceAmount = requestedAmount * (resolvedValues.advancePct / 100);
    const netAmount = Math.max(0, Math.round(advanceAmount - resolvedValues.processingFee - resolvedValues.wireFee));
    const validUntil = new Date(Date.now() + resolvedValues.validForDays * 24 * 60 * 60 * 1000);
    const validUntilLabel = validUntil.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    return {
      advanceAmount,
      netAmount,
      validUntil,
      validUntilLabel,
    };
  }, [requestedAmount, resolvedValues]);

  const isSummary = stepIndex >= steps.length;
  const currentStep = !isSummary ? steps[stepIndex] : steps[steps.length - 1];
  const currentValue = formValues[currentStep.key];
  const currentNumber = parseNumber(currentValue);
  const isCurrentValid =
    isSummary ||
    (Number.isFinite(currentNumber) &&
      currentNumber >= currentStep.min &&
      (typeof currentStep.max === 'number' ? currentNumber <= currentStep.max : true));
  const progress = ((Math.min(stepIndex, steps.length) + 1) / (steps.length + 1)) * 100;
  const busy = flowLoading !== null || loading;

  const handleChange = useCallback(
    (key: keyof OfferWizardFormState, value: string) => {
      setFormValues((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleBack = useCallback(() => {
    if (stepIndex === 0) {
      onClose();
      return;
    }
    setStepIndex((prev) => Math.max(0, prev - 1));
  }, [onClose, stepIndex]);

  const handleNextStep = useCallback(() => {
    if (!isCurrentValid) {
      setInputTouched(true);
      return;
    }
    setStepIndex((prev) => Math.min(steps.length, prev + 1));
  }, [isCurrentValid, steps.length]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isSummary) {
        if (busy) return;
        setFlowLoading('manual');
        try {
          const ok = await onSubmit(resolvedValues);
          if (ok) {
            onClose();
          }
        } finally {
          setFlowLoading(null);
        }
        return;
      }
      handleNextStep();
    },
    [busy, handleNextStep, isSummary, onClose, onSubmit, resolvedValues]
  );

  const handleAuto = useCallback(async () => {
    if (busy) return;
    setFlowLoading('auto');
    try {
      const ok = await onAuto();
      if (ok) {
        onClose();
      }
    } finally {
      setFlowLoading(null);
    }
  }, [busy, onAuto, onClose]);

  const fieldLabel = isSummary ? 'Resumen de la oferta personalizada' : currentStep.title;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
      <div className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl">
        <div className="flex flex-col gap-4 bg-gradient-to-br from-lp-primary-1 to-lp-primary-3 p-8 text-white md:flex-row md:items-start md:justify-between">
          <div className="max-w-xl space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-white/70">Generar oferta</p>
            <h2 className="text-3xl font-semibold leading-tight">Personaliza la propuesta para {request.company_name}</h2>
            <p className="text-sm text-white/80">
              Responde algunas preguntas para ajustar las variables claves y crear una oferta hecha a la medida.
              También puedes generar la propuesta con la fórmula estándar si lo prefieres.
            </p>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1 text-xs font-medium">
              <span className="uppercase tracking-wide text-white/80">Solicitud</span>
              <span className="text-white">${formatCurrency(requestedAmount)}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 text-right text-sm">
            <button
              type="button"
              onClick={handleAuto}
              disabled={busy}
              className="rounded-full border border-white/70 px-4 py-2 font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:border-white/40 disabled:text-white/60"
            >
              {busy && flowLoading === 'auto' ? 'Procesando...' : 'Generar automáticamente'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="text-xs font-medium text-white/80 underline underline-offset-2 transition hover:text-white disabled:cursor-not-allowed disabled:text-white/50"
            >
              Cerrar
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-8 p-8">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-lp-sec-3">
              <span>Paso {Math.min(stepIndex + 1, steps.length + 1)} de {steps.length + 1}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-lp-sec-4/30">
              <div className="h-full rounded-full bg-lp-primary-1 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-semibold text-lp-primary-1">{fieldLabel}</h3>
              {!isSummary ? (
                <p className="mt-2 text-sm text-lp-sec-3">{currentStep.description}</p>
              ) : (
                <p className="mt-2 text-sm text-lp-sec-3">
                  Repasa los valores clave antes de crear la oferta personalizada.
                </p>
              )}
            </div>

            {!isSummary ? (
              <div className="flex flex-col gap-4">
                <label className="text-sm font-medium text-lp-primary-1" htmlFor={`offer-${currentStep.key}`}>
                  {currentStep.title}
                </label>
                <div className="flex flex-wrap items-end gap-4">
                  {currentStep.isCurrency ? (
                    <span className="text-4xl font-semibold text-lp-primary-1">$</span>
                  ) : null}
                  <input
                    id={`offer-${currentStep.key}`}
                    type="number"
                    inputMode="decimal"
                    step={currentStep.isCurrency ? 1000 : 0.01}
                    min={currentStep.min}
                    max={currentStep.max}
                    value={currentValue}
                    onChange={(event) => handleChange(currentStep.key, event.target.value)}
                    onFocus={() => setInputTouched(false)}
                    className="w-full max-w-xs rounded-2xl border border-lp-sec-4/60 bg-white px-6 py-4 text-3xl font-semibold text-lp-primary-1 focus:border-lp-primary-1 focus:outline-none focus:ring-2 focus:ring-lp-primary-1/40"
                    placeholder={currentStep.isCurrency ? '0' : '0.0'}
                  />
                  <span className="text-lg font-medium text-lp-sec-3">{currentStep.unit}</span>
                </div>
                {!isCurrentValid && inputTouched ? (
                  <p className="text-sm text-red-600">
                    Ingresa un valor entre {currentStep.min}
                    {typeof currentStep.max === 'number' ? ` y ${currentStep.max}` : ''}.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <SummaryItem label="Tasa efectiva" value={`${resolvedValues.annualRate.toFixed(2)}% EA`} />
                <SummaryItem label="Aforo propuesto" value={`${resolvedValues.advancePct.toFixed(0)}%`} />
                <SummaryItem label="Anticipo estimado" value={`$${formatCurrency(Math.round(summary.advanceAmount))}`} />
                <SummaryItem label="Neto a desembolsar" value={`$${formatCurrency(summary.netAmount)}`} highlight />
                <SummaryItem label="Tarifa de procesamiento" value={`$${formatCurrency(resolvedValues.processingFee)}`} />
                <SummaryItem label="Costo de transferencia" value={`$${formatCurrency(resolvedValues.wireFee)}`} />
                <SummaryItem label="Vigencia" value={`${resolvedValues.validForDays} día(s) · Hasta ${summary.validUntilLabel}`} />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleBack}
              disabled={busy}
              className="rounded-full border border-lp-sec-4/80 px-4 py-2 text-sm font-medium text-lp-sec-3 transition hover:bg-lp-sec-4/40 disabled:cursor-not-allowed disabled:border-lp-sec-4/60 disabled:text-lp-sec-3/70"
            >
              {stepIndex === 0 ? 'Cancelar' : 'Atrás'}
            </button>
            <button
              type="submit"
              disabled={busy || (!isSummary && !isCurrentValid)}
              className="rounded-full bg-lp-primary-1 px-6 py-2 text-sm font-semibold text-lp-primary-2 transition hover:bg-lp-primary-1/90 disabled:cursor-not-allowed disabled:bg-lp-sec-4/60 disabled:text-lp-sec-3"
            >
              {isSummary ? (busy && flowLoading === 'manual' ? 'Generando...' : 'Crear oferta personalizada') : 'Siguiente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type SummaryItemProps = {
  label: string;
  value: string;
  highlight?: boolean;
};

function SummaryItem({ label, value, highlight }: SummaryItemProps) {
  return (
    <div
      className={`rounded-2xl border px-4 py-4 ${
        highlight ? 'border-lp-primary-1 bg-lp-primary-1/5 text-lp-primary-1' : 'border-lp-sec-4/60 bg-white text-lp-primary-1'
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-lp-sec-3">{label}</div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
    </div>
  );
}

type CustomFundValues = {
  netAmount: number;
  disbursementDate: string;
  transactionId: string;
  notes: string;
};

function FundWizard({
  request,
  onClose,
  onSubmit,
  loading,
}: {
  request: RequestItem;
  onClose: () => void;
  onSubmit: (values: CustomFundValues) => Promise<boolean> | boolean;
  loading: boolean;
}) {
  const [formValues, setFormValues] = useState({
    netAmount: request.requested_amount.toString(),
    disbursementDate: new Date().toISOString().slice(0, 10),
    transactionId: "",
    notes: "",
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    const netAmount = Number(formValues.netAmount.replace(/[^0-9]/g, ""));
    if (!netAmount || netAmount <= 0) {
      toast.error("El monto a desembolsar debe ser mayor a cero.");
      return;
    }
    const ok = await onSubmit({
      netAmount,
      disbursementDate: formValues.disbursementDate,
      transactionId: formValues.transactionId,
      notes: formValues.notes,
    });
    if (ok) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
      <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl">
        <div className="p-8">
          <h2 className="text-2xl font-semibold text-lp-primary-1">Registrar Desembolso</h2>
          <p className="mt-2 text-sm text-lp-sec-3">
            Confirma los detalles del desembolso para la solicitud #{truncateId(request.id)}.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-8 pb-8">
          <div className="space-y-2">
            <label htmlFor="fund-amount" className="text-sm font-medium text-lp-primary-1">Monto Neto a Desembolsar (COP)</label>
            <Input
              id="fund-amount"
              value={formValues.netAmount}
              onChange={(e) => setFormValues(prev => ({...prev, netAmount: e.target.value}))}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="fund-date" className="text-sm font-medium text-lp-primary-1">Fecha de Desembolso</label>
            <Input
              id="fund-date"
              type="date"
              value={formValues.disbursementDate}
              onChange={(e) => setFormValues(prev => ({...prev, disbursementDate: e.target.value}))}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="fund-tx" className="text-sm font-medium text-lp-primary-1">ID de Transacción / Comprobante</label>
            <Input
              id="fund-tx"
              value={formValues.transactionId}
              onChange={(e) => setFormValues(prev => ({...prev, transactionId: e.target.value}))}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="fund-notes" className="text-sm font-medium text-lp-primary-1">Notas (Opcional)</label>
            <Input
              id="fund-notes"
              value={formValues.notes}
              onChange={(e) => setFormValues(prev => ({...prev, notes: e.target.value}))}
            />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <button type="button" onClick={onClose} disabled={loading} className="text-sm font-medium text-lp-sec-3 underline">Cancelar</button>
            <button type="submit" disabled={loading} className="rounded-full bg-lp-primary-1 px-6 py-2 text-sm font-semibold text-lp-primary-2">
              {loading ? "Registrando..." : "Confirmar Desembolso"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type ActionButtonProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
};

function ActionButton({ label, onClick, disabled, loading, variant = 'primary' }: ActionButtonProps) {
  const baseClass = 'rounded-md border px-3 py-1 text-xs font-medium transition';
  const disabledClass = 'cursor-not-allowed border-lp-sec-4/80 bg-lp-sec-4/40 text-lp-sec-3';
  const variantClass = (() => {
    if (variant === 'danger') {
      return 'border-red-600 text-red-700 hover:bg-red-600 hover:text-white';
    }
    if (variant === 'secondary') {
      return 'border-lp-sec-4/80 text-lp-primary-1 hover:bg-lp-sec-4/40';
    }
    return 'border-lp-primary-1 text-lp-primary-1 hover:bg-lp-primary-1 hover:text-lp-primary-2';
  })();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClass} ${disabled || loading ? disabledClass : variantClass}`}
    >
      {loading ? 'Procesando...' : label}
    </button>
  );
}

function resolveGroup(item: RequestItem, groupBy: GroupValue): { key: string; label: string; order: number } {
  if (groupBy === "client") {
    return { key: item.company_id, label: item.company_name, order: item.company_name.toLowerCase().charCodeAt(0) };
  }
  if (groupBy === "payer") {
    if (item.payers.length === 0) {
      return { key: "_payer_none", label: "Sin pagador", order: 2 };
    }
    if (item.payers.length > 1) {
      return { key: "_payer_multi", label: "Varios pagadores", order: 1 };
    }
    return { key: `payer_${item.payers[0].name}`, label: item.payers[0].name, order: 0 };
  }
  if (groupBy === "status") {
    const key = item.status;
    const order = STATUS_ORDER[key] ?? 9;
    return { key: `status_${key}`, label: STATUS_LABEL[key] ?? key, order };
  }
  if (groupBy === "month") {
    const monthKey = item.created_at.slice(0, 7);
    return { key: `month_${monthKey}`, label: formatMonth(monthKey), order: parseInt(monthKey.replace("-", ""), 10) };
  }
  if (groupBy === "needs") {
    return item.needs_action
      ? { key: "needs_pending", label: "Pendientes", order: 0 }
      : { key: "needs_cleared", label: "Sin pendientes", order: 1 };
  }
  return { key: "all", label: "Solicitudes", order: 0 };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-CO").format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

function formatAge(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  const diff = Date.now() - date.getTime();
  const days = Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
  return `${days} d`;
}

function formatMonth(key: string): string {
  const date = new Date(`${key}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return key;
  }
  return date.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
}

function truncateId(value: string): string {
  if (value.length <= 8) {
    return value;
  }
  return `${value.slice(0, 4)}...${value.slice(-3)}`;
}

function resolvePayerLabel(payers: Array<{ name: string }>): string {
  if (payers.length === 0) {
    return "Sin pagador";
  }
  if (payers.length === 1) {
    return payers[0].name;
  }
  return "Varios pagadores";
}

function renderIdentifiers(payers: Array<{ name: string; identifier: string | null }>) {
  const list = payers
    .map((payer) => payer.identifier)
    .filter((identifier): identifier is string => Boolean(identifier));
  if (!list.length) {
    return null;
  }
  return <div className="text-[10px] text-lp-sec-3">{list.join(", ")}</div>;
}
