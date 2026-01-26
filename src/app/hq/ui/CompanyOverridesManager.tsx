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
  const [allCompanies, setAllCompanies] = useState<OverrideSummary[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const loadAllCompanies = useCallback(async () => {
    try {
      // Fetch a larger list to populate the dropdown (limit 100 for now)
      const response = await fetch("/api/hq/settings/companies?limit=100");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error("Failed to load companies list", payload.error);
        return;
      }
      const items: OverrideSummary[] = Array.isArray(payload.companies) ? payload.companies : [];
      setAllCompanies(items);
    } catch (error) {
      console.error("Error loading companies", error);
    }
  }, []);

  useEffect(() => {
    loadOverrides().catch(() => null);
    loadAllCompanies().catch(() => null);
  }, [loadOverrides, loadAllCompanies]);

  // Filter companies locally based on search term
  const filteredCompanies = useMemo(() => {
    if (!searchTerm.trim()) return allCompanies;
    const lower = searchTerm.toLowerCase();
    return allCompanies.filter((c) => c.name.toLowerCase().includes(lower));
  }, [allCompanies, searchTerm]);

  const handleSelectCompany = (company: OverrideSummary) => {
    loadCompanyDetail(company.id);
    setSearchTerm(""); // Clear search on select? or keep name? Let's clear for now or separate display.
    setIsDropdownOpen(false);
  };

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
          <div className="relative">
            <Label htmlFor="company-search">Seleccionar cliente</Label>
            <div className="relative mt-1">
              <Input
                id="company-search"
                placeholder="Buscar en la lista..."
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
              // We might want to handle blur, but typical combobox behavior is tricky with blur closing immediately
              />
              {isDropdownOpen && (
                <div className="absolute top-full z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-lp-sec-4/60 bg-white shadow-lg">
                  {filteredCompanies.length === 0 ? (
                    <div className="p-3 text-sm text-lp-sec-3">No se encontraron clientes.</div>
                  ) : (
                    <ul>
                      {filteredCompanies.map((company) => (
                        <li key={company.id}>
                          <button
                            type="button"
                            className={cn(
                              "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-lp-sec-4/40",
                              selected?.id === company.id ? "bg-lp-primary-1/10" : ""
                            )}
                            onClick={() => handleSelectCompany(company)}
                          >
                            <span className="font-medium text-lp-primary-1">{company.name}</span>
                            {company.overrides ? <span className="text-xs text-lp-sec-3">Personalizado</span> : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            {/* Overlay to close dropdown when clicking outside could be added here or handled via event listeners, 
                but for simplicity we leave it manual or rely on selection closing it. 
                A simple "backdrop" approach for mobile/desktop:
            */}
            {isDropdownOpen && (
              <div
                className="fixed inset-0 z-0 bg-transparent"
                onClick={() => setIsDropdownOpen(false)}
                aria-hidden="true"
              />
            )}
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
