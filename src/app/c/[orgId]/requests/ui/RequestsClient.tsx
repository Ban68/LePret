"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { InlineBanner } from "@/components/ui/inline-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Stepper } from "@/components/ui/stepper";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Toaster, toast } from "sonner";
import { cn } from "@/lib/utils";
import { FileText, Filter, FolderOpen, MoreVertical, Plus } from "lucide-react";
import { DateRangePicker, type DateRangeValue } from "@/components/ui/date-range-picker";

type RequestItem = {
  id: string;
  invoice_id: string | null;
  requested_amount: number;
  status: string;
  created_at: string;
  file_path?: string | null;
  created_by?: string;
  invoice_ids?: string[];
  invoices_total?: number;
  invoices_count?: number;
  current_offer?: {
    id: string;
    status: string;
    annual_rate?: number | null;
    advance_pct?: number | null;
    net_amount?: number | null;
    valid_until?: string | null;
  } | null;
  contract_status?: string | null;
  next_step?: {
    label: string;
    hint?: string | null;
    cta?: {
      kind: string;
      label?: string | null;
      offer_id?: string;
    } | null;
  } | null;
};

type Invoice = {
  id: string;
  issue_date: string;
  due_date: string;
  amount: number;
  status?: string | null;
  payer?: string | null;
  forecast_payment_date?: string | null;
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
    withInvoice: string;
    sort: string;
  };
};

type SummaryMetrics = {
  requestsOpen: number;
  requestsAmountOpen: number;
  invoices: number;
  invoicesAmountTotal: number;
};

type WizardData = {
  selectedInvoiceIds: string[];
  amount: string;
  targetRate: string;
  expectedDate: string;
  notes: string;
  termsAccepted: boolean;
  documents: File[];
};

const INITIAL_WIZARD: WizardData = {
  selectedInvoiceIds: [],
  amount: "",
  targetRate: "",
  expectedDate: "",
  notes: "",
  termsAccepted: false,
  documents: [],
};

const STEPS = [
  { title: "Seleccionar facturas", description: "Elige las facturas que formarán parte de la solicitud." },
  { title: "Configurar condiciones", description: "Define el monto a solicitar y tu tasa objetivo." },
  { title: "Adjuntar soporte", description: "Carga los documentos requeridos o déjalos para después." },
  { title: "Revisar y confirmar", description: "Valida el resumen y acepta los términos." },
];

export function RequestsClient({ orgId }: { orgId: string }) {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [withInvoice, setWithInvoice] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRangeValue>({ start: "", end: "" });
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [sort, setSort] = useState<string>("created_at.desc");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [total, setTotal] = useState<number>(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [metrics, setMetrics] = useState<SummaryMetrics | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardData, setWizardData] = useState<WizardData>(INITIAL_WIZARD);
  const [wizardErrors, setWizardErrors] = useState<Record<string, string>>({});
  const [wizardBusy, setWizardBusy] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const draftKey = `request-wizard-${orgId}`;
  const amountInputRef = useRef<HTMLInputElement | null>(null);

  const parseCurrency = useCallback((s: string) => Number((s || "").replace(/[^0-9]/g, "")), []);
  const formatCurrency = useCallback((n: number) => new Intl.NumberFormat("es-CO").format(n), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
    if (dateRange.start) params.set("start", dateRange.start);
    if (dateRange.end) params.set("end", dateRange.end);
    if (minAmount) params.set("minAmount", String(parseCurrency(minAmount)));
    if (maxAmount) params.set("maxAmount", String(parseCurrency(maxAmount)));
    if (withInvoice && withInvoice !== "all") params.set("withInvoice", withInvoice);
    params.set("sort", sort);
    params.set("limit", String(pageSize));
    params.set("page", String(page));
    const qs = params.toString();
    const [r1, r2] = await Promise.all([
      fetch(`/api/c/${orgId}/requests${qs ? `?${qs}` : ""}`),
      fetch(`/api/c/${orgId}/invoices`),
    ]);
    const d1 = await r1.json();
    const d2 = await r2.json();
    if (!r1.ok) setError(d1.error || "Error cargando solicitudes"); else { setItems(d1.items || []); setTotal(d1.total ?? 0); }
    if (r2.ok) setInvoices(d2.items || []);
    setLoading(false);
  }, [orgId, statusFilter, dateRange, minAmount, maxAmount, withInvoice, sort, page, pageSize, parseCurrency]);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch(`/api/c/${orgId}/summary`);
      const data = await res.json();
      if (res.ok && data.metrics) {
        const m = data.metrics as SummaryMetrics;
        setMetrics({
          requestsOpen: m.requestsOpen,
          requestsAmountOpen: m.requestsAmountOpen,
          invoices: m.invoices,
          invoicesAmountTotal: m.invoicesAmountTotal,
        });
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
      const raw = window.localStorage.getItem(`requests-filters-${orgId}`);
      if (raw) {
        setSavedFilters(JSON.parse(raw) as SavedFilter[]);
      }
    } catch {}
  }, [orgId]);

  const saveCurrentFilter = () => {
    const name = prompt("Nombre del filtro");
    if (!name) return;
    const preset: SavedFilter = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2),
      name,
      state: { status: statusFilter, dateRange, minAmount, maxAmount, withInvoice, sort },
    };
    const next = [...savedFilters, preset];
    setSavedFilters(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`requests-filters-${orgId}`, JSON.stringify(next));
    }
    toast.success("Filtro guardado");
  };

  const applyPreset = (preset: SavedFilter) => {
    setStatusFilter(preset.state.status);
    setDateRange(preset.state.dateRange);
    setMinAmount(preset.state.minAmount);
    setMaxAmount(preset.state.maxAmount);
    setWithInvoice(preset.state.withInvoice);
    setSort(preset.state.sort);
  };

  const frequentFilters = [
    {
      key: "review",
      label: "En revisión",
      onClick: () => setStatusFilter("review"),
      active: statusFilter === "review",
    },
    {
      key: "offered",
      label: "Con oferta",
      onClick: () => setStatusFilter("offered"),
      active: statusFilter === "offered",
    },
    {
      key: "withInvoice",
      label: "Con factura asociada",
      onClick: () => setWithInvoice("true"),
      active: withInvoice === "true",
    },
  ];

  const activeChips = useMemo(() => {
    const chips: string[] = [];
    if (statusFilter !== "all") chips.push(`Estado: ${statusFilter}`);
    if (withInvoice !== "all") chips.push(withInvoice === "true" ? "Con factura" : "Sin factura");
    if (dateRange.start || dateRange.end) chips.push(`Rango ${dateRange.start || ""} → ${dateRange.end || ""}`);
    if (minAmount) chips.push(`≥ ${minAmount}`);
    if (maxAmount) chips.push(`≤ ${maxAmount}`);
    return chips;
  }, [statusFilter, withInvoice, dateRange, minAmount, maxAmount]);

  const pendingSteps = useMemo(() => {
    return items
      .map((item) => {
        const step = item.next_step;
        if (!step || !step.label) return null;
        return {
          id: item.id,
          title: step.label,
          hint: step.hint || "",
        };
      })
      .filter((entry): entry is { id: string; title: string; hint: string } => entry !== null);
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const filteredInvoices = useMemo(() => {
    if (!invoiceSearch) return invoices;
    const term = invoiceSearch.toLowerCase();
    return invoices.filter((inv) => {
      const base = `${inv.id} ${inv.issue_date} ${inv.due_date} ${inv.amount}`.toLowerCase();
      return base.includes(term);
    });
  }, [invoices, invoiceSearch]);

  const wizardSelectedTotal = useMemo(() => {
    return wizardData.selectedInvoiceIds
      .map((id) => invoices.find((inv) => inv.id === id))
      .filter(Boolean)
      .reduce((acc, inv) => acc + Number(inv?.amount || 0), 0);
  }, [wizardData.selectedInvoiceIds, invoices]);

  const openWizard = () => {
    setWizardOpen(true);
    setWizardStep(0);
    setWizardErrors({});
    setWizardBusy(false);
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(draftKey);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<WizardData>;
          setWizardData({ ...INITIAL_WIZARD, ...parsed, documents: [] });
          if (parsed.selectedInvoiceIds?.length && !parsed.amount) {
            const sum = parsed.selectedInvoiceIds
              .map((id) => invoices.find((inv) => inv.id === id))
              .filter(Boolean)
              .reduce((acc, inv) => acc + Number(inv?.amount || 0), 0);
            setWizardData((prev) => ({ ...prev, selectedInvoiceIds: parsed.selectedInvoiceIds || [], amount: formatCurrency(sum) }));
          }
        } else {
          setWizardData(INITIAL_WIZARD);
        }
      } catch {
        setWizardData(INITIAL_WIZARD);
      }
    }
  };

  const closeWizard = () => {
    setWizardOpen(false);
    setWizardData(INITIAL_WIZARD);
    setWizardErrors({});
  };

  useEffect(() => {
    if (!wizardOpen) return;
    const id = window.setInterval(() => {
      if (typeof window === "undefined") return;
      const { documents: _ignoredDocuments, ...rest } = wizardData;
      void _ignoredDocuments;
      window.localStorage.setItem(draftKey, JSON.stringify(rest));
    }, 30_000);
    return () => window.clearInterval(id);
  }, [wizardOpen, wizardData, draftKey]);

  useEffect(() => {
    if (!wizardOpen) return;
    const { documents: _ignoredDocuments, ...rest } = wizardData;
    void _ignoredDocuments;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(draftKey, JSON.stringify(rest));
    }
  }, [wizardData, wizardOpen, draftKey]);

  useEffect(() => {
    if (!wizardData.amount && wizardData.selectedInvoiceIds.length) {
      const sum = wizardData.selectedInvoiceIds
        .map((id) => invoices.find((inv) => inv.id === id))
        .filter(Boolean)
        .reduce((acc, inv) => acc + Number(inv?.amount || 0), 0);
      setWizardData((prev) => ({ ...prev, amount: sum ? formatCurrency(sum) : "" }));
    }
  }, [wizardData.selectedInvoiceIds, wizardData.amount, invoices, formatCurrency]);

  const handleWizardNext = () => {
    const step = wizardStep;
    if (step === 0 && wizardData.selectedInvoiceIds.length === 0) {
      setWizardErrors({ step0: "Selecciona al menos una factura" });
      return;
    }
    if (step === 1) {
      const amt = parseCurrency(wizardData.amount);
      if (!amt || Number.isNaN(amt)) {
        setWizardErrors({ amount: "Ingresa un monto válido" });
        amountInputRef.current?.focus();
        return;
      }
      if (wizardData.targetRate && Number(wizardData.targetRate) < 0) {
        setWizardErrors({ targetRate: "La tasa debe ser positiva" });
        return;
      }
    }
    setWizardErrors({});
    setWizardStep((prev) => Math.min(STEPS.length - 1, prev + 1));
  };

  const handleWizardPrev = () => {
    setWizardErrors({});
    setWizardStep((prev) => Math.max(0, prev - 1));
  };

  const handleWizardSubmit = async () => {
    const amt = parseCurrency(wizardData.amount);
    if (!wizardData.termsAccepted) {
      setWizardErrors({ terms: "Debes aceptar los términos" });
      return;
    }
    if (!wizardData.selectedInvoiceIds.length) {
      setWizardStep(0);
      setWizardErrors({ step0: "Selecciona al menos una factura" });
      return;
    }
    setWizardBusy(true);
    try {
      const res = await fetch(`/api/c/${orgId}/requests/from-invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_ids: wizardData.selectedInvoiceIds,
          requested_amount: amt > 0 ? amt : undefined,
        }),
      });
      const data = await res.json();
        if (!res.ok) {
          const errKey = data.error;
          if (errKey === "invoice_already_used") {
            throw new Error("Una o más facturas ya están asociadas a otra solicitud");
          }
          throw new Error(errKey || "No se pudo crear la solicitud");
        }
      const createdId: string | undefined = data?.request?.id;
      if (createdId && wizardData.documents[0]) {
        const file = wizardData.documents[0];
        const supabase = createClientComponentClient();
        const ext = file.name.split(".").pop();
        const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
        const key = `${orgId}/${id}.${ext ?? "bin"}`;
        const { error: upErr } = await supabase.storage
          .from("requests")
          .upload(key, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        await fetch(`/api/c/${orgId}/requests/${createdId}/file`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_path: key }),
        });
      }
      setBanner({
        tone: "success",
        title: "Solicitud creada",
        description: "La encontrarás en la tabla de solicitudes con el resumen actualizado.",
      });
      toast.success("Solicitud creada");
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(draftKey);
      }
      setWizardData(INITIAL_WIZARD);
      setWizardErrors({});
      setWizardOpen(false);
      await load();
      await loadSummary();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error creando solicitud";
      setWizardErrors({ submit: msg });
      toast.error(msg);
    } finally {
      setWizardBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-colette text-3xl font-bold text-lp-primary-1">Solicitudes de financiación</h1>
          <p className="text-sm text-lp-sec-3">Crea solicitudes paso a paso y haz seguimiento a su avance.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" asChild>
            <a href={`/c/${orgId}/invoices`}>
              <FolderOpen className="h-4 w-4" aria-hidden="true" /> Cargar factura
            </a>
          </Button>
          <Button className="gap-2" onClick={openWizard}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Crear solicitud
          </Button>
        </div>
      </div>

      {metrics && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Solicitudes activas" value={metrics.requestsOpen} subtitle="En revisión u oferta" />
          <MetricCard
            title="Monto en curso"
            value={Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
              metrics.requestsAmountOpen,
            )}
            subtitle="Equivalente de las solicitudes abiertas"
          />
          <MetricCard title="Facturas cargadas" value={metrics.invoices} subtitle="Disponibles para nuevas solicitudes" />
          <MetricCard
            title="Monto disponible"
            value={Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
              metrics.invoicesAmountTotal,
            )}
            subtitle="Suma de facturas disponibles"
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
        <InlineBanner tone="error" title="No pudimos cargar las solicitudes" description={error} />
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className={cn("space-y-4", filtersOpen ? "block" : "hidden", "lg:block")} aria-label="Filtros de solicitudes">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filtros guardados</CardTitle>
              <CardDescription>Aplica y guarda tus combinaciones frecuentes.</CardDescription>
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
                  <Label htmlFor="request-status">Estado</Label>
                  <select
                    id="request-status"
                    className="w-full rounded-md border border-lp-sec-4/60 px-3 py-2"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">Todos</option>
                    <option value="review">En revisión</option>
                    <option value="offered">Ofertada</option>
                    <option value="accepted">Aceptada</option>
                    <option value="funded">Desembolsada</option>
                  </select>
                </div>
                <DateRangePicker
                  id="request-range"
                  value={dateRange}
                  onChange={setDateRange}
                  helperText="Filtra por fecha de creación."
                />
                <div className="space-y-1">
                  <Label htmlFor="request-min">Monto mínimo</Label>
                  <CurrencyInput
                    id="request-min"
                    value={minAmount}
                    onValueChange={(formatted) => setMinAmount(formatted)}
                    placeholder="Ej: 5.000.000"
                    helperText="Solo números"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="request-max">Monto máximo</Label>
                  <CurrencyInput
                    id="request-max"
                    value={maxAmount}
                    onValueChange={(formatted) => setMaxAmount(formatted)}
                    placeholder="Ej: 50.000.000"
                    helperText="Solo números"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="request-with-invoice">Facturas asociadas</Label>
                  <select
                    id="request-with-invoice"
                    className="w-full rounded-md border border-lp-sec-4/60 px-3 py-2"
                    value={withInvoice}
                    onChange={(e) => setWithInvoice(e.target.value)}
                  >
                    <option value="all">Todas</option>
                    <option value="true">Con factura</option>
                    <option value="false">Sin factura</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="request-sort">Orden</Label>
                  <select
                    id="request-sort"
                    className="w-full rounded-md border border-lp-sec-4/60 px-3 py-2"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="created_at.desc">Recientes primero</option>
                    <option value="created_at.asc">Antiguas primero</option>
                    <option value="requested_amount.desc">Monto (mayor a menor)</option>
                    <option value="requested_amount.asc">Monto (menor a mayor)</option>
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
                    setWithInvoice("all");
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
          {pendingSteps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Próximos pasos</CardTitle>
                <CardDescription>Sugerencias según el estado actual de tus solicitudes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {pendingSteps.map((task) => (
                  <div key={task.id} className="rounded-md border border-lp-sec-4/60 bg-lp-sec-4/20 p-3">
                    <p className="font-medium text-lp-primary-1">{task.title}</p>
                    <p className="text-xs text-lp-sec-3">{task.hint}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </aside>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-lp-primary-1">Solicitudes registradas</h2>
            <Button variant="ghost" className="lg:hidden" onClick={() => setFiltersOpen((prev) => !prev)}>
              {filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}
            </Button>
          </div>

          {activeChips.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              {activeChips.map((chip) => (
                <span key={chip} className="rounded-full border border-lp-sec-4/60 bg-lp-sec-4/20 px-3 py-1 text-lp-sec-3">
                  {chip}
                </span>
              ))}
            </div>
          )}

          <div className="w-full overflow-x-auto rounded-lg border border-lp-sec-4/60">
            <table className="min-w-[960px] w-full divide-y divide-lp-sec-4/60">
              <thead className="bg-lp-sec-4/30">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Solicitud</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Monto solicitado</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Facturas asociadas</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Estado</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Creada</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Soporte</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Siguiente paso</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-3 text-sm" colSpan={8}>
                      Cargando...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td className="px-4 py-3 text-sm" colSpan={8}>
                      <EmptyState
                        title="No hay solicitudes"
                        description="Crea una nueva solicitud para avanzar con el factoring."
                        action={{ label: "Crear solicitud", onClick: openWizard }}
                      />
                    </td>
                  </tr>
                ) : (
                  items.map((it) => (
                    <RequestRow
                      key={it.id}
                      orgId={orgId}
                      req={it}
                      onChanged={async () => {
                        await load();
                        await loadSummary();
                      }}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        </div>
      </div>

      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40 p-0">
          <div
            role="dialog"
            aria-modal="true"
            className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-lp-sec-4/60 px-6 py-4">
              <div>
                <p className="text-xs font-medium text-lp-sec-3">Nueva solicitud</p>
                <h2 className="text-lg font-semibold text-lp-primary-1">Flujo guiado</h2>
              </div>
              <Button variant="ghost" onClick={closeWizard}>
                Cerrar
              </Button>
            </div>
            <div className="grid flex-1 grid-cols-1 gap-4 px-6 py-4 lg:grid-cols-[180px_1fr]">
              <Stepper steps={STEPS} current={wizardStep} className="hidden lg:flex" />
              <div className="space-y-4">
                {wizardStep === 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 rounded-md border border-lp-sec-4/60 px-3 py-2">
                      <Filter className="h-4 w-4 text-lp-sec-3" aria-hidden="true" />
                      <Input
                        value={invoiceSearch}
                        onChange={(e) => setInvoiceSearch(e.target.value)}
                        placeholder="Buscar por número, fecha o monto"
                      />
                    </div>
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-lp-primary-1">Facturas disponibles</p>
                      <div className="max-h-64 overflow-y-auto rounded-md border border-lp-sec-4/60">
                        <table className="w-full text-sm">
                          <thead className="bg-lp-sec-4/20">
                            <tr>
                              <th className="px-3 py-2 text-left">Seleccionar</th>
                              <th className="px-3 py-2 text-left">Factura</th>
                              <th className="px-3 py-2 text-left">Emisión</th>
                              <th className="px-3 py-2 text-left">Monto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredInvoices.length === 0 ? (
                              <tr>
                                <td className="px-3 py-2 text-sm" colSpan={4}>
                                  No encontramos facturas con ese criterio.
                                </td>
                              </tr>
                            ) : (
                              filteredInvoices.map((inv) => {
                                const checked = wizardData.selectedInvoiceIds.includes(inv.id);
                                return (
                                  <tr key={inv.id} className="border-t border-lp-sec-4/40">
                                    <td className="px-3 py-2">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) => {
                                          setWizardData((prev) => ({
                                            ...prev,
                                            selectedInvoiceIds: e.target.checked
                                              ? [...prev.selectedInvoiceIds, inv.id]
                                              : prev.selectedInvoiceIds.filter((id) => id !== inv.id),
                                          }));
                                        }}
                                        aria-label={`Seleccionar factura ${inv.id}`}
                                      />
                                    </td>
                                    <td className="px-3 py-2 font-medium text-lp-primary-1">{inv.id.slice(0, 8)}</td>
                                    <td className="px-3 py-2">{inv.issue_date}</td>
                                    <td className="px-3 py-2">${formatCurrency(Number(inv.amount || 0))}</td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div className="rounded-md border border-lp-primary-1/40 bg-lp-primary-1/10 p-3 text-xs text-lp-primary-1">
                        <p className="font-medium">
                          Seleccionadas: {wizardData.selectedInvoiceIds.length} • Total {formatCurrency(wizardSelectedTotal)} COP
                        </p>
                      </div>
                    </div>
                    {wizardErrors.step0 && <p className="text-xs text-red-600">{wizardErrors.step0}</p>}
                  </div>
                )}

                {wizardStep === 1 && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <Label htmlFor="wizard-amount">Monto solicitado (COP)</Label>
                      <CurrencyInput
                        id="wizard-amount"
                        ref={amountInputRef}
                        value={wizardData.amount}
                        onValueChange={(formatted) =>
                          setWizardData((prev) => ({ ...prev, amount: formatted }))
                        }
                        placeholder="Ej: 8.000.000"
                        helperText="Puedes ajustar el monto respecto al total de facturas seleccionadas."
                      />
                      {wizardErrors.amount && <p className="text-xs text-red-600">{wizardErrors.amount}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="wizard-rate">Tasa objetivo (% mensual)</Label>
                      <Input
                        id="wizard-rate"
                        type="number"
                        min={0}
                        step="0.1"
                        value={wizardData.targetRate}
                        onChange={(e) => setWizardData((prev) => ({ ...prev, targetRate: e.target.value }))}
                        placeholder="Ej: 1.5"
                      />
                      {wizardErrors.targetRate && <p className="text-xs text-red-600">{wizardErrors.targetRate}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="wizard-date">Fecha objetivo de desembolso</Label>
                      <Input
                        id="wizard-date"
                        type="date"
                        value={wizardData.expectedDate}
                        onChange={(e) => setWizardData((prev) => ({ ...prev, expectedDate: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="wizard-notes">Notas internas (opcional)</Label>
                      <Input
                        id="wizard-notes"
                        value={wizardData.notes}
                        onChange={(e) => setWizardData((prev) => ({ ...prev, notes: e.target.value }))}
                        placeholder="¿Hay condiciones especiales?"
                      />
                    </div>
                  </div>
                )}

                {wizardStep === 2 && (
                  <div className="space-y-4">
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const files = Array.from(e.dataTransfer.files || []);
                        if (files.length) {
                          setWizardData((prev) => ({ ...prev, documents: files }));
                        }
                      }}
                      className="rounded-md border border-dashed border-lp-sec-4/60 px-4 py-6 text-sm"
                    >
                      <p className="text-lp-primary-1">Arrastra tus documentos soporte</p>
                      <p className="text-xs text-lp-sec-3">PDF, JPG o PNG • hasta 10 MB cada uno</p>
                      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md bg-lp-primary-1 px-3 py-2 text-xs font-medium text-white">
                        Examinar archivos
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          className="sr-only"
                          onChange={(e) => setWizardData((prev) => ({ ...prev, documents: Array.from(e.target.files || []) }))}
                        />
                      </label>
                      {wizardData.documents.length > 0 && (
                        <ul className="mt-3 space-y-1 text-xs">
                          {wizardData.documents.map((doc) => (
                            <li key={doc.name} className="flex items-center justify-between rounded-md border border-lp-sec-4/40 px-2 py-1">
                              <span className="truncate" title={doc.name}>
                                {doc.name}
                              </span>
                              <span>{(doc.size / 1024 / 1024).toFixed(2)} MB</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="space-y-2 text-xs text-lp-sec-3">
                      <p className="font-medium text-lp-primary-1">Checklist recomendado</p>
                      <ul className="space-y-1">
                        <li className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-lp-sec-3" aria-hidden="true" />
                          Certificado cámara de comercio (reciente)
                        </li>
                        <li className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-lp-sec-3" aria-hidden="true" />
                          Estados financieros último trimestre
                        </li>
                        <li className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-lp-sec-3" aria-hidden="true" />
                          Documentos adicionales del pagador (si aplica)
                        </li>
                      </ul>
                    </div>
                  </div>
                )}

                {wizardStep === 3 && (
                  <div className="space-y-4 text-sm">
                    <div className="rounded-md border border-lp-sec-4/60 bg-lp-sec-4/20 p-3">
                      <p className="font-medium text-lp-primary-1">Resumen</p>
                      <ul className="mt-2 space-y-1">
                        <li>Facturas seleccionadas: {wizardData.selectedInvoiceIds.length}</li>
                        <li>Monto solicitado: ${wizardData.amount || formatCurrency(wizardSelectedTotal)}</li>
                        <li>Tasa objetivo: {wizardData.targetRate ? `${wizardData.targetRate}%` : "No especificada"}</li>
                        <li>Fecha objetivo: {wizardData.expectedDate || "No definida"}</li>
                      </ul>
                    </div>
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="wizard-terms"
                        checked={wizardData.termsAccepted}
                        onCheckedChange={(checked) =>
                          setWizardData((prev) => ({ ...prev, termsAccepted: Boolean(checked) }))
                        }
                      />
                      <Label htmlFor="wizard-terms" className="text-xs text-lp-sec-3">
                        Confirmo que la información es correcta y acepto los términos legales de LePrêt Capital.
                      </Label>
                    </div>
                    {wizardErrors.terms && <p className="text-xs text-red-600">{wizardErrors.terms}</p>}
                    {wizardErrors.submit && <p className="text-xs text-red-600">{wizardErrors.submit}</p>}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-lp-sec-4/60 px-6 py-4">
              <Button variant="outline" onClick={handleWizardPrev} disabled={wizardStep === 0 || wizardBusy}>
                Anterior
              </Button>
              {wizardStep === STEPS.length - 1 ? (
                <Button onClick={handleWizardSubmit} disabled={wizardBusy}>
                  {wizardBusy ? "Enviando…" : "Confirmar"}
                </Button>
              ) : (
                <Button onClick={handleWizardNext} disabled={wizardBusy}>
                  Continuar
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

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

function RequestRow({ orgId, req, onChanged }: { orgId: string; req: RequestItem; onChanged: () => Promise<void> | void }) {
  const [editing, setEditing] = useState(false);
  const [amt, setAmt] = useState(new Intl.NumberFormat("es-CO").format(req.requested_amount));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showInvoices, setShowInvoices] = useState(false);
  const supabase = createClientComponentClient();

  const parseCurrency = (s: string) => Number((s || "").replace(/[^0-9]/g, ""));
  const invoiceCount = req.invoices_count ?? (req.invoice_ids?.length || (req.invoice_id ? 1 : 0));
  const invoicesTotal = req.invoices_total ?? req.requested_amount;
  const nextStep = req.next_step ?? null;
  const currentOffer = req.current_offer ?? null;

  const onSave = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/c/${orgId}/requests/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requested_amount: parseCurrency(amt) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo actualizar");
      toast.success("Solicitud actualizada");
      setEditing(false);
      await onChanged();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!confirm("Eliminar solicitud?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/c/${orgId}/requests/${req.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo eliminar");
      toast.success("Solicitud eliminada");
      await onChanged();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error";
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
      const ext = file.name.split(".").pop();
      const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      const key = `${orgId}/${id}.${ext ?? "bin"}`;
      const { error: upErr } = await supabase.storage.from("requests").upload(key, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const res = await fetch(`/api/c/${orgId}/requests/${req.id}/file`, {
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

  const onDeleteFile = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/c/${orgId}/requests/${req.id}/file`, { method: "DELETE" });
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

  const onAcceptOffer = async (offerId: string) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/offers/${offerId}/accept`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo aceptar la oferta");
      toast.success("Oferta aceptada");
      await onChanged();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error aceptando oferta";
      setErr(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const formatCurrencyValue = (value: number | null | undefined) => {
    if (typeof value !== "number" || Number.isNaN(value)) return null;
    return new Intl.NumberFormat("es-CO").format(value);
  };

  return (
    <tr className="border-t border-lp-sec-4/60 text-sm">
      <td className="px-4 py-2">
        <div className="space-y-1">
          <p className="font-medium text-lp-primary-1">{req.id.slice(0, 8)}</p>
          <button
            type="button"
            className="text-xs text-lp-primary-1 underline"
            onClick={() => setShowInvoices((prev) => !prev)}
          >
            {showInvoices ? "Ocultar facturas" : "Ver facturas"}
          </button>
          {showInvoices && (
            <ul className="space-y-1 text-xs text-lp-sec-3">
              {(req.invoice_ids || (req.invoice_id ? [req.invoice_id] : [])).map((id) => (
                <li key={id}>Factura {id.slice(0, 8)}</li>
              ))}
            </ul>
          )}
        </div>
      </td>
      <td className="px-4 py-2">
        {editing ? (
          <Input value={amt} onChange={(e) => setAmt(e.target.value)} />
        ) : (
          <span className="font-medium">${new Intl.NumberFormat("es-CO").format(req.requested_amount)}</span>
        )}
      </td>
      <td className="px-4 py-2 text-xs text-lp-sec-3">
        {invoiceCount} factura{invoiceCount === 1 ? "" : "s"} | ${new Intl.NumberFormat("es-CO").format(invoicesTotal)}
      </td>
      <td className="px-4 py-2">
        <StatusBadge kind="request" status={req.status} />
      </td>
      <td className="px-4 py-2 text-xs text-lp-sec-3">{new Date(req.created_at).toLocaleDateString()}</td>
      <td className="px-4 py-2 text-xs text-lp-sec-3">
        {req.file_path ? <span className="text-lp-primary-1">Cargado</span> : "Pendiente"}
      </td>
      <td className="px-4 py-2 text-xs">
        {nextStep ? (
          <div className="space-y-2">
            <div>
              <p className="font-medium text-lp-primary-1">{nextStep.label}</p>
              {nextStep.hint ? <p className="text-xs text-lp-sec-3">{nextStep.hint}</p> : null}
            </div>
            {currentOffer && currentOffer.status === "offered" && (
              <p className="text-xs text-lp-sec-3">
                Anticipo {typeof currentOffer.advance_pct === "number" ? `${Math.round(currentOffer.advance_pct)}%` : "-"} | Neto ${formatCurrencyValue(currentOffer.net_amount) ?? "-"}
              </p>
            )}
            {nextStep.cta?.kind === "accept_offer" && nextStep.cta.offer_id ? (
              <Button
                type="button"
                size="sm"
                variant="primary"
                className="mt-1"
                onClick={() => onAcceptOffer(nextStep.cta!.offer_id!)}
                disabled={busy}
              >
                {nextStep.cta.label ?? "Aceptar oferta"}
              </Button>
            ) : null}
            {err && <p className="text-xs text-red-600">{err}</p>}
          </div>
        ) : (
          <span className="text-lp-sec-3">-</span>
        )}
      </td>
      <td className="px-4 py-2">
        <details className="relative">
          <summary className="flex cursor-pointer items-center justify-center rounded-md border border-lp-sec-4/60 bg-white p-1 text-lp-sec-3 transition hover:border-lp-primary-1 hover:text-lp-primary-1">
            <span className="sr-only">Abrir acciones</span>
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
          </summary>
          <div className="absolute right-0 z-10 mt-2 w-52 rounded-md border border-lp-sec-4/60 bg-white p-2 text-sm shadow-lg">
            {nextStep?.cta?.kind === "accept_offer" && nextStep.cta.offer_id ? (
              <button
                type="button"
                className="w-full rounded-md px-2 py-1 text-left text-lp-primary-1 hover:bg-lp-sec-4/30"
                onClick={() => onAcceptOffer(nextStep.cta!.offer_id!)}
                disabled={busy}
              >
                {nextStep.cta.label ?? "Aceptar oferta"}
              </button>
            ) : null}
            {editing ? (
              <button
                type="button"
                className="w-full rounded-md px-2 py-1 text-left hover:bg-lp-sec-4/30"
                onClick={onSave}
                disabled={busy}
              >
                Guardar cambios
              </button>
            ) : (
              <button
                type="button"
                className="w-full rounded-md px-2 py-1 text-left hover:bg-lp-sec-4/30"
                onClick={() => setEditing(true)}
                disabled={busy}
              >
                Editar monto
              </button>
            )}
            {req.file_path ? (
              <button
                type="button"
                className="mt-1 w-full rounded-md px-2 py-1 text-left hover:bg-lp-sec-4/30"
                onClick={onDeleteFile}
                disabled={busy}
              >
                Eliminar soporte
              </button>
            ) : null}
            <label
              htmlFor={`support-${req.id}`}
              className="mt-1 flex cursor-pointer items-center justify-between rounded-md px-2 py-1 hover:bg-lp-sec-4/30"
            >
              {req.file_path ? "Reemplazar soporte" : "Subir soporte"}
              <input
                id={`support-${req.id}`}
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={(e) => onReplace(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              type="button"
              className="mt-1 w-full rounded-md px-2 py-1 text-left text-red-700 hover:bg-red-50"
              onClick={onDelete}
              disabled={busy}
            >
              Eliminar solicitud
            </button>
            {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
            {busy && <p className="mt-1 text-xs text-lp-sec-3">Procesando...</p>}
          </div>
        </details>
      </td>
    </tr>
  );
}

