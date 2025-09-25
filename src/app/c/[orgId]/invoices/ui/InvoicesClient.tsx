"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DateRangePicker, type DateRangeValue } from "@/components/ui/date-range-picker";
import { InlineBanner } from "@/components/ui/inline-banner";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Toaster, toast } from "sonner";
import { cn } from "@/lib/utils";
import { MoreVertical, Plus, Wand2 } from "lucide-react";

type Invoice = {
  id: string;
  amount: number;
  issue_date: string;
  due_date: string;
  status: string;
  file_path?: string | null;
  created_by?: string;
};

type BannerState = { tone: "success" | "info" | "warning" | "error"; title: string; description?: string };

type SavedFilter = {
  id: string;
  name: string;
  state: {
    status: string;
    dateRange: DateRangeValue;
    minAmount: string;
    maxAmount: string;
    sort: string;
  };
};

type SummaryMetrics = {
  invoices: number;
  invoicesAmountTotal: number;
  funded: number;
  fundedAmountTotal: number;
  requestsOpen: number;
  requestsAmountOpen: number;
};

export function InvoicesClient({ orgId }: { orgId: string }) {
  const [items, setItems] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const [amount, setAmount] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRangeValue>({ start: "", end: "" });
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [sort, setSort] = useState<string>("created_at.desc");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [total, setTotal] = useState<number>(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [metrics, setMetrics] = useState<SummaryMetrics | null>(null);
  const [banner, setBanner] = useState<BannerState | null>(null);

  // Helpers de moneda (declaradas antes de usarlas)
  function parseCurrency(s: string): number {
    return Number((s || "").replace(/[^0-9]/g, ""));
  }

  const canSubmit = useMemo(() => {
    const amtOk = parseCurrency(amount) > 0;
    const d1 = !!dateRange.start && !Number.isNaN(Date.parse(dateRange.start));
    const d2 = !!dateRange.end && !Number.isNaN(Date.parse(dateRange.end));
    const orderOk = d1 && d2 ? new Date(dateRange.start) <= new Date(dateRange.end) : false;
    return amtOk && d1 && d2 && orderOk && !saving;
  }, [amount, dateRange, saving]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
    if (dateRange.start) params.set("start", dateRange.start);
    if (dateRange.end) params.set("end", dateRange.end);
    if (minAmount) params.set("minAmount", String(parseCurrency(minAmount)));
    if (maxAmount) params.set("maxAmount", String(parseCurrency(maxAmount)));
    params.set("sort", sort);
    params.set("limit", String(pageSize));
    params.set("page", String(page));
    const qs = params.toString();
    const res = await fetch(`/api/c/${orgId}/invoices${qs ? `?${qs}` : ""}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Error cargando facturas");
    } else {
      setItems(data.items || []);
      setSelected((prev) => {
        const next: Record<string, boolean> = {};
        for (const it of data.items || []) if (prev[it.id]) next[it.id] = true;
        return next;
      });
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }, [orgId, statusFilter, dateRange, minAmount, maxAmount, sort, page, pageSize]);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch(`/api/c/${orgId}/summary`);
      const data = await res.json();
      if (res.ok && data.metrics) {
        setMetrics(data.metrics as SummaryMetrics);
      }
    } catch (err) {
      console.error(err);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(`invoices-filters-${orgId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedFilter[];
        setSavedFilters(parsed);
      }
    } catch {}
  }, [orgId]);

  const saveCurrentFilter = () => {
    const name = prompt("Nombre del filtro guardado");
    if (!name) return;
    const preset: SavedFilter = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2),
      name,
      state: { status: statusFilter, dateRange, minAmount, maxAmount, sort },
    };
    const next = [...savedFilters, preset];
    setSavedFilters(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`invoices-filters-${orgId}`, JSON.stringify(next));
    }
    toast.success("Filtro guardado");
  };

  const applyPreset = (preset: SavedFilter) => {
    setStatusFilter(preset.state.status);
    setDateRange(preset.state.dateRange);
    setMinAmount(preset.state.minAmount);
    setMaxAmount(preset.state.maxAmount);
    setSort(preset.state.sort);
  };

  const frequentFilters = [
    {
      key: "last30",
      label: "Últimos 30 días",
      onClick: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 30);
        setDateRange({ start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) });
      },
      active:
        dateRange.start === new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10) &&
        dateRange.end === new Date().toISOString().slice(0, 10),
    },
    {
      key: "review",
      label: "En revisión",
      onClick: () => setStatusFilter("uploaded"),
      active: statusFilter === "uploaded",
    },
    {
      key: "funded",
      label: "Desembolsadas",
      onClick: () => setStatusFilter("funded"),
      active: statusFilter === "funded",
    },
  ];

  const activeChips = useMemo(() => {
    const chips: string[] = [];
    if (statusFilter !== "all") chips.push(statusFilter === "uploaded" ? "En revisión" : statusFilter === "funded" ? "Desembolsada" : statusFilter);
    if (dateRange.start || dateRange.end) chips.push(`Fechas ${dateRange.start || ""} → ${dateRange.end || ""}`);
    if (minAmount) chips.push(`Monto ≥ ${minAmount}`);
    if (maxAmount) chips.push(`Monto ≤ ${maxAmount}`);
    return chips;
  }, [statusFilter, dateRange, minAmount, maxAmount]);

  const pendingTasks = useMemo(() => {
    return items
      .filter((invoice) => !invoice.file_path)
      .map((invoice) => ({
        id: invoice.id,
        title: `Factura ${invoice.id.slice(0, 6)} sin soporte`,
        hint: "Adjunta el PDF para completar la validación.",
      }));
  }, [items]);

  const totalSelected = useMemo(() => items.filter((it) => selected[it.id]).length, [items, selected]);
  const totalSelectedAmount = useMemo(
    () => items.filter((it) => selected[it.id]).reduce((acc, it) => acc + Number(it.amount || 0), 0),
    [items, selected],
  );

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setBanner(null);

    if (!dateRange.start || !dateRange.end) {
      setFormError("Completa la fecha de emisión y vencimiento");
      amountRef.current?.focus();
      setSaving(false);
      toast.error("Completa las fechas");
      return;
    }
    if (new Date(dateRange.start) > new Date(dateRange.end)) {
      setFormError("La fecha de vencimiento debe ser posterior a la de emisión");
      setSaving(false);
      toast.error("La fecha de vencimiento debe ser posterior a la de emisión");
      return;
    }

    let uploadedPath: string | null = null;

    try {
      if (file) {
        const MAX = 10 * 1024 * 1024; // 10MB
        if (file.size > MAX) {
          setFormError("El archivo supera 10MB");
          toast.error("El archivo supera 10MB");
          setSaving(false);
          return;
        }
        const type = (file.type || "").toLowerCase();
        const okType = /application\/pdf|image\/(jpeg|png)/.test(type);
        if (!okType) {
          setFormError("Formato no soportado (PDF, JPG, PNG)");
          toast.error("Formato no soportado (PDF, JPG, PNG)");
          setSaving(false);
          return;
        }
        const supabase = createClientComponentClient();
        const ext = file.name.split(".").pop();
        const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
        const key = `${orgId}/${id}.${ext ?? "bin"}`;
        const { error: upErr } = await supabase.storage
          .from("invoices")
          .upload(key, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        uploadedPath = key;
      }
    } catch (err: unknown) {
      setSaving(false);
      const msg = err instanceof Error ? err.message : "Error subiendo archivo";
      setFormError(msg);
      toast.error(msg);
      return;
    }

    const payload = {
      amount: parseCurrency(amount),
      issue_date: dateRange.start,
      due_date: dateRange.end,
      file_path: uploadedPath,
    };
    const res = await fetch(`/api/c/${orgId}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error || "Error creando factura";
      setFormError(msg);
      toast.error(msg);
    } else {
      setAmount("");
      setDateRange({ start: "", end: "" });
      await load();
      await loadSummary();
      setFile(null);
      setBanner({
        tone: "success",
        title: "Factura cargada con éxito",
        description: "Puedes generar una solicitud con esta factura o adjuntar más soportes.",
      });
      toast.success("Factura creada");
    }
    setSaving(false);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-colette text-3xl font-bold text-lp-primary-1">Gestión de facturas</h1>
          <p className="text-sm text-lp-sec-3">Carga nuevas facturas, consulta sus estados y mantenlas listas para solicitar financiación.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" asChild>
            <a href={`/api/c/${orgId}/invoices/export`} target="_blank" rel="noopener noreferrer">
              <Wand2 className="h-4 w-4" aria-hidden="true" /> Exportar CSV
            </a>
          </Button>
          <Button className="gap-2" asChild>
            <a href={`/c/${orgId}/requests`}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Crear solicitud
            </a>
          </Button>
        </div>
      </div>

      {metrics && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Facturas cargadas" value={metrics.invoices} subtitle="Total histórico en la plataforma" />
          <MetricCard
            title="Monto cargado"
            value={Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
              metrics.invoicesAmountTotal,
            )}
            subtitle="Suma de facturas registradas"
          />
          <MetricCard
            title="Solicitudes activas"
            value={metrics.requestsOpen}
            subtitle={`Por $${Intl.NumberFormat("es-CO").format(metrics.requestsAmountOpen)} en curso`}
          />
          <MetricCard
            title="Desembolsado"
            value={Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
              metrics.fundedAmountTotal,
            )}
            subtitle={`${metrics.funded} facturas desembolsadas`}
          />
        </div>
      )}

      {banner && (
        <InlineBanner
          tone={banner.tone}
          title={banner.title}
          description={banner.description}
          action={
            <Button variant="link" className="px-0 text-sm" onClick={() => setBanner(null)}>
              Ocultar
            </Button>
          }
        />
      )}

      {error && !loading && (
        <InlineBanner tone="error" title="No pudimos cargar las facturas" description={error} />
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className={cn("space-y-4", filtersOpen ? "block" : "hidden", "lg:block")}
          aria-label="Filtros avanzados">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filtros avanzados</CardTitle>
              <CardDescription>Refina la tabla según estado, fechas o montos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {frequentFilters.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={filter.onClick}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition",
                      filter.active ? "border-lp-primary-1 bg-lp-primary-1/10 text-lp-primary-1" : "border-lp-sec-4/60 text-lp-sec-3 hover:border-lp-primary-1 hover:text-lp-primary-1",
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="invoice-status">Estado</Label>
                  <select
                    id="invoice-status"
                    className="w-full rounded-md border border-lp-sec-4/60 px-3 py-2"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">Todos</option>
                    <option value="uploaded">En revisión</option>
                    <option value="funded">Desembolsada</option>
                  </select>
                </div>
                <DateRangePicker
                  id="invoice-range"
                  value={dateRange}
                  onChange={setDateRange}
                  required
                  helperText="Selecciona emisión y vencimiento."
                />
                <div className="space-y-1">
                  <Label htmlFor="invoice-min">Monto mínimo</Label>
                  <CurrencyInput
                    id="invoice-min"
                    value={minAmount}
                    onValueChange={(formatted) => setMinAmount(formatted)}
                    placeholder="Ej: 1.000.000"
                    helperText="Ingresa solo números."
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="invoice-max">Monto máximo</Label>
                  <CurrencyInput
                    id="invoice-max"
                    value={maxAmount}
                    onValueChange={(formatted) => setMaxAmount(formatted)}
                    placeholder="Ej: 50.000.000"
                    helperText="Ingresa solo números."
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="invoice-sort">Orden</Label>
                  <select
                    id="invoice-sort"
                    className="w-full rounded-md border border-lp-sec-4/60 px-3 py-2"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="created_at.desc">Recientes primero</option>
                    <option value="created_at.asc">Antiguas primero</option>
                    <option value="amount.desc">Monto (mayor a menor)</option>
                    <option value="amount.asc">Monto (menor a mayor)</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Button variant="outline" className="w-full" onClick={saveCurrentFilter}>
                  Guardar filtro
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-sm"
                  onClick={() => {
                    setStatusFilter("all");
                    setDateRange({ start: "", end: "" });
                    setMinAmount("");
                    setMaxAmount("");
                    setSort("created_at.desc");
                    setPage(1);
                    setPageSize(10);
                  }}
                >
                  Restablecer filtros
                </Button>
              </div>
              {savedFilters.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-lp-sec-3">Guardados</p>
                  <div className="space-y-2">
                    {savedFilters.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className="w-full rounded-md border border-lp-sec-4/60 px-3 py-2 text-left text-xs hover:border-lp-primary-1 hover:text-lp-primary-1"
                        onClick={() => applyPreset(preset)}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          {pendingTasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tareas pendientes</CardTitle>
                <CardDescription>Documentos o acciones necesarias para completar la revisión.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {pendingTasks.map((task) => (
                  <div key={task.id} className="rounded-md border border-amber-200 bg-amber-50 p-3">
                    <p className="font-medium text-amber-900">{task.title}</p>
                    <p className="text-xs text-amber-800">{task.hint}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </aside>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-lp-primary-1">Carga rápida</h2>
            <Button
              variant="ghost"
              className="lg:hidden"
              onClick={() => setFiltersOpen((prev) => !prev)}
            >
              {filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Registrar factura</CardTitle>
              <CardDescription>Completa los datos obligatorios. Guardamos tu progreso automáticamente al enviar.</CardDescription>
            </CardHeader>
            <CardContent>
              <form noValidate onSubmit={onCreate} className="grid grid-cols-1 gap-4 sm:grid-cols-6">
                <div className="sm:col-span-2 space-y-1">
                  <Label htmlFor="invoice-amount">
                    Monto (COP)
                    <span className="ml-1 text-xs text-lp-primary-1" aria-hidden="true">*</span>
                  </Label>
                  <CurrencyInput
                    id="invoice-amount"
                    ref={amountRef}
                    value={amount}
                    onValueChange={(formatted) => setAmount(formatted)}
                    placeholder="Ej: 1.500.000"
                    helperText="Escribe el valor tal como aparece en la factura."
                  />
                </div>
                <div className="sm:col-span-4">
                  <DateRangePicker
                    id="invoice-create-range"
                    value={dateRange}
                    onChange={setDateRange}
                    required
                    helperText="No permitimos vencimientos anteriores a la emisión."
                  />
                </div>
                <div className="sm:col-span-3">
                  <Label htmlFor="invoice-file">Archivo (PDF/imagen, opcional)</Label>
                  <div
                    id="invoice-file"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) setFile(f);
                    }}
                    className={cn(
                      "flex flex-col gap-2 rounded-md border border-dashed px-4 py-6 text-sm focus-within:border-lp-primary-1 focus-within:ring-2 focus-within:ring-lp-primary-1/40",
                      dragOver ? "border-lp-primary-1 bg-lp-primary-1/10" : "border-lp-sec-4/60",
                    )}
                    role="group"
                    aria-label="Zona de carga de archivos"
                  >
                    <p className="text-lp-primary-1">
                      {file ? file.name : "Arrastra un archivo o selecciona desde tu dispositivo"}
                    </p>
                    <p className="text-xs text-lp-sec-3">PDF, JPG o PNG • máximo 10 MB</p>
                    <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md bg-lp-primary-1 px-3 py-2 text-xs font-medium text-white shadow-sm hover:opacity-90">
                      Examinar archivos
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        className="sr-only"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    {file && (
                      <p className="text-xs text-lp-sec-3">
                        {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type || "tipo no detectado"}
                      </p>
                    )}
                  </div>
                </div>
                <div className="sm:col-span-6 space-y-2">
                  <Button type="submit" disabled={!canSubmit} className="bg-lp-primary-1 text-lp-primary-2 hover:opacity-90">
                    {saving ? "Creando..." : "Guardar factura"}
                  </Button>
                  <div aria-live="assertive" className="text-sm text-red-600">
                    {formError}
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          {activeChips.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              {activeChips.map((chip) => (
                <span key={chip} className="rounded-full border border-lp-sec-4/60 bg-lp-sec-4/20 px-3 py-1 text-lp-sec-3">
                  {chip}
                </span>
              ))}
            </div>
          )}

          <CreateRequestFromInvoices
            orgId={orgId}
            items={items}
            selected={selected}
            setSelected={setSelected}
            onCreated={async () => {
              setSelected({});
              await load();
              await loadSummary();
              setBanner({
                tone: "info",
                title: "Solicitud creada",
                description: "Revisa el resumen en la sección de solicitudes para completar los siguientes pasos.",
              });
            }}
          />

          <Card>
            <CardHeader>
              <CardTitle>Facturas cargadas</CardTitle>
              <CardDescription>Gestiona tus facturas y consulta los estados actualizados.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full overflow-x-auto rounded-lg border border-lp-sec-4/60">
                <table className="min-w-[960px] w-full divide-y divide-lp-sec-4/60">
                  <thead className="bg-lp-sec-4/30">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">
                        <input
                          type="checkbox"
                          aria-label="Seleccionar todas las facturas"
                          onChange={(e) => {
                            const v = e.target.checked;
                            const next: Record<string, boolean> = {};
                            items.forEach((it) => {
                              next[it.id] = v;
                            });
                            setSelected(next);
                          }}
                          checked={totalSelected > 0 && totalSelected === items.length}
                          ref={(el) => {
                            if (el) {
                              el.indeterminate = totalSelected > 0 && totalSelected < items.length;
                            }
                          }}
                        />
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Factura</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Emisión</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Vencimiento</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Monto</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Estado</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Archivo</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <TableSkeleton cols={8} />
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan={8}>
                          <EmptyState
                            title="No hay facturas"
                            description="Crea una nueva factura para empezar a operar."
                            action={{
                              label: "Agregar factura",
                              onClick: () => amountRef.current?.focus(),
                            }}
                          />
                        </td>
                      </tr>
                    ) : (
                      items.map((it) => (
                        <tr key={it.id} className="border-t border-lp-sec-4/60">
                          <td className="px-4 py-2 text-sm">
                            <input
                              type="checkbox"
                              checked={!!selected[it.id]}
                              onChange={(e) =>
                                setSelected((prev) => ({
                                  ...prev,
                                  [it.id]: e.target.checked,
                                }))
                              }
                              aria-label={`Seleccionar factura ${it.id}`}
                            />
                          </td>
                          <td className="px-4 py-2 text-sm font-medium text-lp-primary-1">{it.id.slice(0, 8)}</td>
                          <td className="px-4 py-2 text-sm">{it.issue_date}</td>
                          <td className="px-4 py-2 text-sm">{it.due_date}</td>
                          <td className="px-4 py-2 text-sm font-medium">
                            ${Intl.NumberFormat("es-CO").format(it.amount)}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <StatusBadge kind="invoice" status={it.status} />
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <FileLink path={it.file_path ?? null} />
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <RowActions orgId={orgId} invoice={it} onChanged={async () => {
                              await load();
                              await loadSummary();
                            }} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
            <div className="flex flex-col gap-3 px-6 pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-lp-sec-3">Página {page} de {totalPages}</div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente
                </Button>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPage(1);
                    setPageSize(Number(e.target.value));
                  }}
                  className="rounded-md border border-lp-sec-4/60 px-3 py-2 text-sm"
                  aria-label="Registros por página"
                >
                  <option value={10}>10 por página</option>
                  <option value={20}>20 por página</option>
                  <option value={50}>50 por página</option>
                </select>
              </div>
            </div>
          </Card>

          {totalSelected > 0 && (
            <div className="flex flex-col gap-3 rounded-lg border border-lp-primary-1 bg-lp-primary-1/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-lp-primary-1">
                  {totalSelected} factura{totalSelected > 1 ? "s" : ""} seleccionada{totalSelected > 1 ? "s" : ""}
                </p>
                <p className="text-xs text-lp-primary-1/80">
                  Monto total: ${Intl.NumberFormat("es-CO").format(totalSelectedAmount)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => setSelected({})}>
                  Limpiar selección
                </Button>
                <Button
                  onClick={async () => {
                    await createRequestFromSelected({
                      orgId,
                      invoiceIds: items.filter((it) => selected[it.id]).map((it) => it.id),
                      onSuccess: async () => {
                        setSelected({});
                        await load();
                        await loadSummary();
                        setBanner({
                          tone: "success",
                          title: "Solicitud generada con la selección",
                          description: "La encontrarás en la sección de solicitudes con el detalle de facturas asociadas.",
                        });
                      },
                    });
                  }}
                >
                  Generar solicitud
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Toaster richColors />
    </div>
  );
}

type MetricCardProps = { title: string; value: number | string; subtitle?: string };
function MetricCard({ title, value, subtitle }: MetricCardProps) {
  return (
    <Card className="border-lp-sec-4/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-lp-sec-3">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold text-lp-primary-1">{value}</p>
        {subtitle && <p className="text-xs text-lp-sec-3">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

async function createRequestFromSelected({
  orgId,
  invoiceIds,
  onSuccess,
}: {
  orgId: string;
  invoiceIds: string[];
  onSuccess: () => Promise<void> | void;
}) {
  if (!invoiceIds.length) return;
  try {
    const res = await fetch(`/api/c/${orgId}/requests/from-invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoice_ids: invoiceIds }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "No se pudo crear solicitud");
    toast.success("Solicitud creada");
    await onSuccess();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    toast.error(msg);
  }
}

function FileLink({ path }: { path?: string | null }) {
  const [href, setHref] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!path) return;
      const supabase = createClientComponentClient();
      const { data, error } = await supabase.storage.from("invoices").createSignedUrl(path, 60);
      if (!error && mounted) setHref(data?.signedUrl ?? null);
    };
    run();
    return () => {
      mounted = false;
    };
  }, [path]);
  if (!path) return <span className="text-xs text-lp-sec-3">Sin archivo</span>;
  if (!href) return <span className="text-xs text-lp-sec-3">Generando enlace…</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-sm text-lp-primary-1 underline">
      Ver archivo
    </a>
  );
}

function RowActions({ orgId, invoice, onChanged }: { orgId: string; invoice: Invoice; onChanged: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onDelete = async () => {
    if (!invoice.file_path) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/c/${orgId}/invoices/${invoice.id}/file`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo eliminar archivo");
      toast.success("Archivo eliminado");
      await onChanged();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error eliminando archivo";
      setErr(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const onDeleteInvoice = async () => {
    if (!confirm("¿Eliminar factura? Esta acción no se puede deshacer.")) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/c/${orgId}/invoices/${invoice.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo eliminar");
      toast.success("Factura eliminada");
      await onChanged();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error eliminando factura";
      setErr(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const onReplace = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const supabase = createClientComponentClient();
      const ext = file.name.split(".").pop();
      const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      const key = `${orgId}/${id}.${ext ?? "bin"}`;
      const { error: upErr1 } = await supabase.storage.from("invoices").upload(key, file, { upsert: false, contentType: file.type });
      if (upErr1) throw upErr1;
      const res = await fetch(`/api/c/${orgId}/invoices/${invoice.id}/file`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: key }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo actualizar archivo");
      toast.success("Archivo actualizado");
      await onChanged();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error reemplazando archivo";
      setErr(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="relative">
      <summary className="flex cursor-pointer items-center justify-center rounded-md border border-lp-sec-4/60 bg-white p-1 text-lp-sec-3 transition hover:border-lp-primary-1 hover:text-lp-primary-1">
        <span className="sr-only">Acciones de factura</span>
        <MoreVertical className="h-4 w-4" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 z-10 mt-2 w-56 rounded-md border border-lp-sec-4/60 bg-white p-2 text-sm shadow-lg" role="menu">
        <label
          htmlFor={`replace-${invoice.id}`}
          className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1 hover:bg-lp-sec-4/30"
        >
          {invoice.file_path ? "Reemplazar archivo" : "Subir archivo"}
          <input
            id={`replace-${invoice.id}`}
            type="file"
            accept=".pdf,image/*"
            className="hidden"
            onChange={(e) => onReplace(e.target.files?.[0] ?? null)}
          />
        </label>
        {invoice.file_path && (
          <button
            type="button"
            className="w-full rounded-md px-2 py-1 text-left text-red-700 hover:bg-red-50"
            onClick={onDelete}
            disabled={busy}
          >
            Eliminar archivo
          </button>
        )}
        <button
          type="button"
          className="mt-1 w-full rounded-md px-2 py-1 text-left text-red-700 hover:bg-red-50"
          onClick={onDeleteInvoice}
          disabled={busy}
        >
          Eliminar factura
        </button>
        {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
        {busy && <p className="mt-1 text-xs text-lp-sec-3">Procesando…</p>}
      </div>
    </details>
  );
}

function CreateRequestFromInvoices({
  orgId,
  items,
  selected,
  setSelected,
  onCreated,
}: {
  orgId: string;
  items: Invoice[];
  selected: Record<string, boolean>;
  setSelected: (s: Record<string, boolean>) => void;
  onCreated: () => void | Promise<void>;
}) {
  const selIds = items.filter((it) => selected[it.id]).map((it) => it.id);
  const total = items.filter((it) => selected[it.id]).reduce((acc, it) => acc + Number(it.amount || 0), 0);
  const disabled = selIds.length === 0;
  const [busy, setBusy] = useState(false);

  const createFromSelected = async () => {
    if (disabled) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/c/${orgId}/requests/from-invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_ids: selIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo crear solicitud");
      await onCreated();
      toast.success("Solicitud creada con facturas seleccionadas");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  if (!selIds.length) return null;

  return (
    <div className="rounded-md border border-dashed border-lp-sec-4/60 bg-white p-4 text-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="font-medium text-lp-primary-1">
            {selIds.length} factura{selIds.length > 1 ? "s" : ""} seleccionada{selIds.length > 1 ? "s" : ""}
          </p>
          <p className="text-xs text-lp-sec-3">
            Total: ${Intl.NumberFormat("es-CO").format(total)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setSelected({})} disabled={busy}>
            Limpiar selección
          </Button>
          <Button type="button" onClick={createFromSelected} disabled={busy}>
            {busy ? "Creando…" : "Crear solicitud"}
          </Button>
        </div>
      </div>
    </div>
  );
}
