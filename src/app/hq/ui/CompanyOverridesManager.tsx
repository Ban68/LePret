'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type NumericOverrides = {
  discountRate: number | null;
  operationDays: number | null;
  advancePct: number | null;
};

type OverrideSummary = {
  id: string;
  name: string;
  type: string | null;
  overrides: NumericOverrides | null;
  updatedAt: string | null;
  updatedBy: string | null | { id: string | null; name: string | null };
};

type CompanyDetail = {
  id: string;
  name: string;
  type: string | null;
  overrides: (NumericOverrides & { updatedAt: string | null; updatedBy: string | null }) | null;
};

type FormState = {
  discountRate: string;
  operationDays: string;
  advancePct: string;
};

type SanitizedNumberResult = {
  value: number | null;
  error: string | null;
};

const INITIAL_FORM: FormState = {
  discountRate: "",
  operationDays: "",
  advancePct: "",
};

export function CompanyOverridesManager() {
  const [overrides, setOverrides] = useState<OverrideSummary[]>([]);
  const [loadingOverrides, setLoadingOverrides] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<OverrideSummary[]>([]);
  const [selected, setSelected] = useState<CompanyDetail | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  const loadOverrides = useCallback(async () => {
    setLoadingOverrides(true);
    try {
      const response = await fetch("/api/hq/settings/companies?withOverrides=true");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = payload?.error || "No se pudieron cargar las personalizaciones";
        throw new Error(error);
      }
      const items: OverrideSummary[] = Array.isArray(payload.companies) ? payload.companies : [];
      setOverrides(items);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado";
      toast.error(message);
      setOverrides([]);
    } finally {
      setLoadingOverrides(false);
    }
  }, []);

  useEffect(() => {
    loadOverrides().catch(() => null);
  }, [loadOverrides]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      setSearching(true);
      try {
        const query = new URLSearchParams({
          search: searchTerm.trim(),
          limit: "10",
        }).toString();
        const response = await fetch(`/api/hq/settings/companies?${query}`, { signal: controller.signal });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const error = payload?.error || "No se pudieron buscar clientes";
          throw new Error(error);
        }
        const items: OverrideSummary[] = Array.isArray(payload.companies) ? payload.companies : [];
        setSearchResults(items);
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "Error inesperado";
        toast.error(message);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [searchTerm]);

  const loadCompanyDetail = useCallback(async (companyId: string) => {
    try {
      const response = await fetch(`/api/hq/settings/companies/${companyId}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = payload?.error || "No se pudo cargar el cliente";
        throw new Error(error);
      }

      const detail: CompanyDetail = {
        id: payload.company.id,
        name: payload.company.name,
        type: payload.company.type ?? null,
        overrides: payload.overrides ?? null,
      };

      setSelected(detail);
      setForm({
        discountRate: detail.overrides?.discountRate != null ? String(detail.overrides.discountRate) : "",
        operationDays: detail.overrides?.operationDays != null ? String(detail.overrides.operationDays) : "",
        advancePct: detail.overrides?.advancePct != null ? String(detail.overrides.advancePct) : "",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado";
      toast.error(message);
    }
  }, []);

  const resetSelection = useCallback(() => {
    setSelected(null);
    setForm(INITIAL_FORM);
  }, []);

  const parsedForm = useMemo(() => {
    return {
      discountRate: sanitizeDecimal(form.discountRate, 0, 200),
      operationDays: sanitizeInteger(form.operationDays, 1, 720),
      advancePct: sanitizeDecimal(form.advancePct, 0, 100),
    };
  }, [form]);

  const hasChanges = useMemo(() => {
    if (!selected) return false;
    const current = selected.overrides;
    return (
      parsedForm.discountRate.value !== (current?.discountRate ?? null) ||
      parsedForm.operationDays.value !== (current?.operationDays ?? null) ||
      parsedForm.advancePct.value !== (current?.advancePct ?? null)
    );
  }, [parsedForm, selected]);

  const validateForm = useCallback(() => {
    const fields = [
      parsedForm.discountRate,
      parsedForm.operationDays,
      parsedForm.advancePct,
    ] as const;

    for (const field of fields) {
      if (field.error) {
        toast.error(field.error);
        return false;
      }
    }
    return true;
  }, [parsedForm]);

  const handleSave = useCallback(async () => {
    if (!selected) return;
    if (!validateForm()) return;

    setSaving(true);
    try {
      const body = {
        discountRate: parsedForm.discountRate.value,
        operationDays: parsedForm.operationDays.value,
        advancePct: parsedForm.advancePct.value,
      };

      const response = await fetch(`/api/hq/settings/companies/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = payload?.error || "No se pudieron guardar los cambios";
        throw new Error(error);
      }

      toast.success("Parámetros personalizados actualizados");
      await Promise.all([loadOverrides(), loadCompanyDetail(selected.id)]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [loadCompanyDetail, loadOverrides, parsedForm, selected, validateForm]);

  const handleClear = useCallback(async () => {
    if (!selected) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/hq/settings/companies/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clear: true }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = payload?.error || "No se pudo eliminar la personalización";
        throw new Error(error);
      }

      toast.success("Se restablecieron los valores predeterminados");
      resetSelection();
      await loadOverrides();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [loadOverrides, resetSelection, selected]);

  return (
    <section className="space-y-6">
      <header>
        <h3 className="text-lg font-semibold text-lp-primary-1">Personalización por cliente</h3>
        <p className="text-sm text-lp-sec-3">
          Define valores predeterminados para clientes específicos. Se aplican al crear nuevas solicitudes en el portal.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4 rounded-lg border border-lp-sec-4/60 bg-white p-4 shadow-sm">
          <div>
            <Label htmlFor="company-search">Buscar cliente</Label>
            <Input
              id="company-search"
              placeholder="Nombre del cliente"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            {searchTerm.trim().length > 0 ? (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-lp-sec-4/40 bg-white">
                {searching ? (
                  <div className="p-3 text-sm text-lp-sec-3">Buscando...</div>
                ) : searchResults.length === 0 ? (
                  <div className="p-3 text-sm text-lp-sec-3">Sin resultados.</div>
                ) : (
                  <ul>
                    {searchResults.map((company) => (
                      <li key={company.id}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm",
                            selected?.id === company.id ? "bg-lp-primary-1/10" : "hover:bg-lp-sec-4/40",
                          )}
                          onClick={() => loadCompanyDetail(company.id)}
                        >
                          <span className="font-medium text-lp-primary-1">{company.name}</span>
                          {company.overrides ? <span className="text-xs text-lp-sec-3">Personalizado</span> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          {selected ? (
            <div className="space-y-4">
              <div className="rounded-md border border-lp-sec-4/60 bg-lp-sec-4/20 p-3 text-sm">
                <p className="font-semibold text-lp-primary-1">{selected.name}</p>
                <p className="text-xs text-lp-sec-3">Segmento: {selected.type ?? "Sin definir"}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="override-discount">Tasa de descuento (% EA)</Label>
                  <Input
                    id="override-discount"
                    type="number"
                    min="0"
                    max="200"
                    step="0.1"
                    value={form.discountRate}
                    onChange={(event) => setForm((prev) => ({ ...prev, discountRate: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="override-days">Duración (días)</Label>
                  <Input
                    id="override-days"
                    type="number"
                    min="1"
                    max="720"
                    step="1"
                    value={form.operationDays}
                    onChange={(event) => setForm((prev) => ({ ...prev, operationDays: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="override-advance">% desembolso</Label>
                  <Input
                    id="override-advance"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={form.advancePct}
                    onChange={(event) => setForm((prev) => ({ ...prev, advancePct: event.target.value }))}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" disabled={!hasChanges || saving} onClick={handleSave}>
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
                <Button type="button" variant="secondary" disabled={!selected || saving} onClick={handleClear}>
                  Borrar personalización
                </Button>
                <Button type="button" variant="secondary" disabled={saving} onClick={resetSelection}>
                  Cerrar
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-lp-sec-3">Selecciona un cliente para editar sus parámetros.</p>
          )}
        </div>

        <aside className="space-y-3 rounded-lg border border-lp-sec-4/60 bg-white p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-lp-primary-1">Clientes personalizados</h4>
          {loadingOverrides ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : overrides.length === 0 ? (
            <p className="text-sm text-lp-sec-3">Aún no hay personalizaciones registradas.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {overrides.map((company) => (
                <li key={company.id} className="rounded-md border border-lp-sec-4/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-lp-primary-1">{company.name}</p>
                      <p className="text-xs text-lp-sec-3">{company.type ?? "Sin segmento"}</p>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-lp-primary-1 underline"
                      onClick={() => loadCompanyDetail(company.id)}
                    >
                      Editar
                    </button>
                  </div>
                  {company.overrides ? (
                    <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-lp-sec-3">
                      <div>
                        <dt>Tasa</dt>
                        <dd>{company.overrides.discountRate != null ? `${company.overrides.discountRate}%` : "-"}</dd>
                      </div>
                      <div>
                        <dt>Días</dt>
                        <dd>{company.overrides.operationDays ?? "-"}</dd>
                      </div>
                      <div>
                        <dt>% desembolso</dt>
                        <dd>{company.overrides.advancePct != null ? `${company.overrides.advancePct}%` : "-"}</dd>
                      </div>
                      <div>
                        <dt>Actualizado</dt>
                        <dd>{company.updatedAt ? new Date(company.updatedAt).toLocaleDateString("es-CO") : "-"}</dd>
                      </div>
                    </dl>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </section>
  );
}

function sanitizeDecimal(input: string, min: number, max: number): SanitizedNumberResult {
  const trimmed = input.trim();
  if (!trimmed) return { value: null, error: null };
  const normalized = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(normalized)) {
    return { value: null, error: "Ingresa un número válido." };
  }
  if (normalized < min || normalized > max) {
    return { value: null, error: `El valor debe estar entre ${min} y ${max}.` };
  }
  return { value: normalized, error: null };
}

function sanitizeInteger(input: string, min: number, max: number): SanitizedNumberResult {
  const trimmed = input.trim();
  if (!trimmed) return { value: null, error: null };
  const normalized = Number(trimmed);
  if (!Number.isFinite(normalized) || !Number.isInteger(normalized)) {
    return { value: null, error: "Ingresa un número entero válido." };
  }
  if (normalized < min || normalized > max) {
    return { value: null, error: `El valor debe estar entre ${min} y ${max}.` };
  }
  return { value: normalized, error: null };
}
