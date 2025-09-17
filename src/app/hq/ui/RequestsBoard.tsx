"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/ui/status-badge";

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
  offer: { id: string; status: string; summary: string } | null;
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

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
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
        if (!cancelled) {
          setItems(payload.items || []);
          setCompaniesIndex((prev) => {
            const next = { ...prev };
            for (const item of payload.items || []) {
              next[item.company_id] = item.company_name;
            }
            return next;
          });
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Error inesperado";
          setError(message);
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [statusFilter, companyFilter, needsOnly, startDate, endDate]);

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
            <GroupSection key={group.key} block={group} />
          ))}
        </div>
      )}
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
  children: React.ReactNode;
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
};

function GroupSection({ block }: GroupSectionProps) {
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
              <tr key={item.id} className={item.needs_action ? "bg-amber-50/40" : "bg-white"}>
                <td className="px-3 py-2 align-top">
                  <div className="font-mono text-xs text-lp-primary-1">{truncateId(item.id)}</div>
                  <div className="text-xs text-lp-sec-3">Facturas: {item.invoices_count}</div>
                  {item.offer ? (
                    <div className="text-[11px] text-lp-sec-3">Oferta: {item.offer.summary}</div>
                  ) : null}
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
                    <Link
                      href={`/hq/companies/${item.company_id}`}
                      className="text-lp-primary-1 underline hover:opacity-80"
                    >
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


