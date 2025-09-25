"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "ACTIVE", label: "Activos" },
  { value: "BLOCKED", label: "Bloqueados" },
  { value: "ARCHIVED", label: "Archivados" },
];

const INITIAL_FORM = {
  name: "",
  tax_id: "",
  contact_email: "",
  contact_phone: "",
  sector: "",
  credit_limit: "",
  risk_rating: "",
  notes: "",
  status: "ACTIVE" as "ACTIVE" | "BLOCKED" | "ARCHIVED",
};

type Payer = {
  id: string;
  name: string;
  tax_id: string | null;
  status: "ACTIVE" | "BLOCKED" | "ARCHIVED";
  contact_email: string | null;
  contact_phone: string | null;
  sector: string | null;
  credit_limit: number | null;
  risk_rating: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
};

type FormState = typeof INITIAL_FORM;

type PayersClientProps = {
  orgId: string;
};

const formatCurrency = (value: number | null | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
};

export function PayersClient({ orgId }: PayersClientProps) {
  const [items, setItems] = useState<Payer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const limit = 25;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("page", String(page));
      if (search.trim()) params.set("q", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      const response = await fetch(`/api/c/${orgId}/payers?${params.toString()}`);
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo cargar la lista de pagadores");
      }
      setItems((data.items ?? []) as Payer[]);
      setTotal(typeof data.total === "number" ? data.total : (data.items?.length ?? 0));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [limit, page, search, statusFilter, orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = useCallback(() => {
    setForm({ ...INITIAL_FORM });
    setFormMode("create");
    setEditingId(null);
  }, []);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        tax_id: form.tax_id.trim() || null,
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        sector: form.sector.trim() || null,
        credit_limit: form.credit_limit.trim() ? Number(form.credit_limit.replace(/[^0-9.]/g, "")) : null,
        risk_rating: form.risk_rating.trim() || null,
        notes: form.notes.trim() || null,
        status: form.status,
      };

      const url = formMode === "create"
        ? `/api/c/${orgId}/payers`
        : `/api/c/${orgId}/payers/${editingId}`;
      const method = formMode === "create" ? "POST" : "PATCH";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudieron guardar los cambios");
      }

      toast.success(formMode === "create" ? "Pagador creado" : "Pagador actualizado");
      resetForm();
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (payer: Payer) => {
    setFormMode("edit");
    setEditingId(payer.id);
    setForm({
      name: payer.name,
      tax_id: payer.tax_id ?? "",
      contact_email: payer.contact_email ?? "",
      contact_phone: payer.contact_phone ?? "",
      sector: payer.sector ?? "",
      credit_limit: payer.credit_limit ? String(payer.credit_limit) : "",
      risk_rating: payer.risk_rating ?? "",
      notes: payer.notes ?? "",
      status: payer.status,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onArchive = async (payer: Payer) => {
    if (!confirm(`¿Archivar a ${payer.name}?`)) return;
    try {
      const response = await fetch(`/api/c/${orgId}/payers/${payer.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo archivar el pagador");
      }
      toast.success("Pagador archivado");
      if (editingId === payer.id) {
        resetForm();
      }
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      toast.error(message);
    }
  };

  const onSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    load();
  };

  const paginatedLabel = useMemo(() => {
    if (!total) return "0 de 0";
    const start = (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);
    return `${start}-${end} de ${total}`;
  }, [page, limit, total]);

  const hasPrev = page > 1;
  const hasNext = page * limit < total;

  return (
    <div className="space-y-8">
      <Toaster position="top-right" closeButton richColors />

      <section className="rounded-lg border border-lp-sec-4/60 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-lp-primary-1">Pagadores</h1>
            <p className="text-sm text-lp-sec-3">
              Administra los pagadores vinculados a tu organización. Estos datos se usan al crear solicitudes y facturas.
            </p>
          </div>
          {formMode === "edit" ? (
            <Button type="button" variant="outline" onClick={resetForm}>
              Crear nuevo
            </Button>
          ) : null}
        </div>

        <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="payer-name">Nombre</Label>
            <Input
              id="payer-name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payer-tax-id">NIT / Identificador</Label>
            <Input
              id="payer-tax-id"
              value={form.tax_id}
              onChange={(event) => setForm((prev) => ({ ...prev, tax_id: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payer-email">Correo de contacto</Label>
            <Input
              id="payer-email"
              type="email"
              value={form.contact_email}
              onChange={(event) => setForm((prev) => ({ ...prev, contact_email: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payer-phone">Teléfono de contacto</Label>
            <Input
              id="payer-phone"
              value={form.contact_phone}
              onChange={(event) => setForm((prev) => ({ ...prev, contact_phone: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payer-sector">Sector</Label>
            <Input
              id="payer-sector"
              value={form.sector}
              onChange={(event) => setForm((prev) => ({ ...prev, sector: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payer-credit">Cupo sugerido</Label>
            <Input
              id="payer-credit"
              value={form.credit_limit}
              onChange={(event) => setForm((prev) => ({ ...prev, credit_limit: event.target.value }))}
              placeholder="Ej: 50000000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payer-rating">Calificación</Label>
            <Input
              id="payer-rating"
              value={form.risk_rating}
              onChange={(event) => setForm((prev) => ({ ...prev, risk_rating: event.target.value }))}
              placeholder="Ej: A, B, Observaciones"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payer-status">Estado</Label>
            <select
              id="payer-status"
              className="w-full rounded-md border border-lp-sec-4/60 px-3 py-2 text-sm"
              value={form.status}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, status: event.target.value as FormState["status"] }))
              }
            >
              <option value="ACTIVE">Activo</option>
              <option value="BLOCKED">Bloqueado</option>
              <option value="ARCHIVED">Archivado</option>
            </select>
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="payer-notes">Notas</Label>
            <Textarea
              id="payer-notes"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Observaciones internas o requisitos adicionales"
            />
          </div>
          <div className="md:col-span-2 flex flex-wrap items-center justify-end gap-3">
            {formMode === "edit" ? (
              <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                Cancelar edicion
              </Button>
            ) : null}
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : formMode === "create" ? "Crear pagador" : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-lp-sec-4/60 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <form className="flex flex-wrap items-center gap-3" onSubmit={onSearchSubmit}>
            <Input
              placeholder="Buscar por nombre o NIT"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-w-[220px]"
            />
            <Button type="submit" variant="outline">
              Buscar
            </Button>
          </form>
          <div className="flex items-center gap-3 text-sm text-lp-sec-3">
            <label className="flex items-center gap-2">
              <span className="text-xs uppercase">Estado</span>
              <select
                className="rounded-md border border-lp-sec-4/60 px-2 py-1.5 text-sm"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <span className="hidden text-xs sm:inline">{paginatedLabel}</span>
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={limit} columns={6} />
        ) : error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Sin pagadores"
            description="Crea tu primer pagador para asociarlo en las solicitudes y facturas."
            action={{ label: "Crear pagador", onClick: resetForm }}
          />
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-lp-sec-4/60 text-sm">
                <thead className="bg-lp-sec-4/40 text-xs uppercase tracking-wide text-lp-sec-3">
                  <tr>
                    <th className="px-4 py-2 text-left">Pagador</th>
                    <th className="px-4 py-2 text-left">Contacto</th>
                    <th className="px-4 py-2 text-left">Sector</th>
                    <th className="px-4 py-2 text-left">Cupo sugerido</th>
                    <th className="px-4 py-2 text-left">Estado</th>
                    <th className="px-4 py-2 text-left">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-lp-sec-4/60">
                  {items.map((payer) => (
                    <tr key={payer.id} className="bg-white">
                      <td className="px-4 py-2 align-top">
                        <div className="font-medium text-lp-primary-1">{payer.name}</div>
                        {payer.tax_id ? (
                          <div className="text-xs text-lp-sec-3">NIT: {payer.tax_id}</div>
                        ) : null}
                        <div className="mt-1 text-xs text-lp-sec-3">
                          Creado: {new Date(payer.created_at).toLocaleDateString("es-CO")}
                        </div>
                      </td>
                      <td className="px-4 py-2 align-top text-sm text-lp-sec-3">
                        {payer.contact_email ? <div>{payer.contact_email}</div> : <div>-</div>}
                        {payer.contact_phone ? <div>{payer.contact_phone}</div> : null}
                      </td>
                      <td className="px-4 py-2 align-top text-sm text-lp-sec-3">{payer.sector || "-"}</td>
                      <td className="px-4 py-2 align-top text-sm text-lp-sec-3">{formatCurrency(payer.credit_limit)}</td>
                      <td className="px-4 py-2 align-top text-sm">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            payer.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-700"
                              : payer.status === "BLOCKED"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-lp-sec-4/40 text-lp-sec-3"
                          }`}
                        >
                          {payer.status === "ACTIVE"
                            ? "Activo"
                            : payer.status === "BLOCKED"
                              ? "Bloqueado"
                              : "Archivado"}
                        </span>
                      </td>
                      <td className="px-4 py-2 align-top text-sm">
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => onEdit(payer)}>
                            Editar
                          </Button>
                          {payer.status !== "ARCHIVED" ? (
                            <Button type="button" size="sm" variant="ghost" onClick={() => onArchive(payer)}>
                              Archivar
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {total > limit ? (
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-lp-sec-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!hasPrev}
                  onClick={() => hasPrev && setPage((prev) => Math.max(1, prev - 1))}
                >
                  Anterior
                </Button>
                <span>{paginatedLabel}</span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!hasNext}
                  onClick={() => hasNext && setPage((prev) => prev + 1)}
                >
                  Siguiente
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

