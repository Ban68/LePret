"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const SEGMENTS = [
  { key: "default", label: "General" },
  { key: "startup", label: "Startups" },
  { key: "pyme", label: "Pymes" },
  { key: "corporativo", label: "Corporativos" },
] as const;

type SettingsPayload = {
  discountRate: number;
  creditLimits: Record<string, number>;
  terms: Record<string, number>;
};

type SettingsResponse = {
  ok: boolean;
  settings?: SettingsPayload;
  updatedAt?: string | null;
  updatedBy?: { id: string | null; name: string | null; email?: string | null } | null;
  error?: string;
};

export function SettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SettingsPayload | null>(null);
  const [baseline, setBaseline] = useState<SettingsPayload | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [updatedBy, setUpdatedBy] = useState<{ id: string | null; name: string | null; email?: string | null } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/hq/settings", { cache: "no-store" });
      const payload: SettingsResponse = await response.json();
      if (!response.ok || !payload.ok || !payload.settings) {
        throw new Error(payload.error || "No se pudieron cargar los parámetros");
      }
      setForm({ ...payload.settings });
      setBaseline({ ...payload.settings });
      setUpdatedAt(payload.updatedAt ?? null);
      setUpdatedBy(payload.updatedBy ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => null);
  }, [load]);

  const hasChanges = useMemo(() => {
    if (!form || !baseline) return false;
    return JSON.stringify(form) !== JSON.stringify(baseline);
  }, [form, baseline]);

  const updateDiscount = (value: string) => {
    const parsed = Number(value);
    setForm((prev) => (prev ? { ...prev, discountRate: Number.isFinite(parsed) ? parsed : prev.discountRate } : prev));
  };

  const updateCreditLimit = (segment: string, value: string) => {
    const parsed = Number(value);
    setForm((prev) =>
      prev
        ? {
            ...prev,
            creditLimits: {
              ...prev.creditLimits,
              [segment]: Number.isFinite(parsed) ? parsed : prev.creditLimits[segment] ?? 0,
            },
          }
        : prev
    );
  };

  const updateTerm = (segment: string, value: string) => {
    const parsed = Number(value);
    setForm((prev) =>
      prev
        ? {
            ...prev,
            terms: {
              ...prev.terms,
              [segment]: Number.isFinite(parsed) ? parsed : prev.terms[segment] ?? 0,
            },
          }
        : prev
    );
  };

  const handleReset = () => {
    if (baseline) {
      setForm({ ...baseline });
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const response = await fetch("/api/hq/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload: SettingsResponse = await response.json().catch(() => ({ ok: false, error: "Respuesta inválida" }));
      if (!response.ok || !payload.ok || !payload.settings) {
        throw new Error(payload.error || "No se pudieron guardar los cambios");
      }
      setForm({ ...payload.settings });
      setBaseline({ ...payload.settings });
      setUpdatedAt(payload.updatedAt ?? null);
      setUpdatedBy(payload.updatedBy ?? null);
      toast.success("Parámetros actualizados");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-lp-sec-4/60 bg-white p-6 shadow-sm">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-4 h-16 w-full" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <strong>Error:</strong> {error}
      </div>
    );
  }

  if (!form) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="rounded-lg border border-lp-sec-4/60 bg-white p-6 shadow-sm">
        <header className="mb-4">
          <h3 className="text-lg font-semibold text-lp-primary-1">Tasa de descuento objetivo</h3>
          <p className="text-sm text-lp-sec-3">Define la tasa EA base para ofertas automáticas.</p>
        </header>
        <div className="max-w-xs space-y-2">
          <Label htmlFor="discount-rate">Tasa (% EA)</Label>
          <Input
            id="discount-rate"
            type="number"
            step="0.1"
            min="0"
            max="200"
            value={form.discountRate}
            onChange={(event) => updateDiscount(event.target.value)}
          />
        </div>
      </section>

      <section className="rounded-lg border border-lp-sec-4/60 bg-white p-6 shadow-sm">
        <header className="mb-4">
          <h3 className="text-lg font-semibold text-lp-primary-1">Límites de crédito por segmento</h3>
          <p className="text-sm text-lp-sec-3">Controla la exposición máxima por cliente según su perfil.</p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SEGMENTS.map((segment) => (
            <div key={segment.key} className="space-y-2">
              <Label htmlFor={`limit-${segment.key}`}>{segment.label}</Label>
              <Input
                id={`limit-${segment.key}`}
                type="number"
                min="0"
                step="1000000"
                value={form.creditLimits[segment.key] ?? 0}
                onChange={(event) => updateCreditLimit(segment.key, event.target.value)}
              />
              <p className="text-xs text-lp-sec-3">Monto máximo financiable en COP.</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-lp-sec-4/60 bg-white p-6 shadow-sm">
        <header className="mb-4">
          <h3 className="text-lg font-semibold text-lp-primary-1">Plazos objetivo</h3>
          <p className="text-sm text-lp-sec-3">Establece la duración máxima permitida para cada segmento.</p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SEGMENTS.map((segment) => (
            <div key={segment.key} className="space-y-2">
              <Label htmlFor={`term-${segment.key}`}>{segment.label}</Label>
              <Input
                id={`term-${segment.key}`}
                type="number"
                min="15"
                step="5"
                value={form.terms[segment.key] ?? 0}
                onChange={(event) => updateTerm(segment.key, event.target.value)}
              />
              <p className="text-xs text-lp-sec-3">Plazo máximo en días.</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs text-lp-sec-3">
          Última actualización: {updatedAt ? new Date(updatedAt).toLocaleString("es-CO") : "Sin registros"}
          {updatedBy?.name ? ` · ${updatedBy.name}` : updatedBy?.email ? ` · ${updatedBy.email}` : ""}
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" variant="secondary" disabled={!hasChanges || saving} onClick={handleReset}>
            Deshacer cambios
          </Button>
          <Button type="submit" disabled={!hasChanges || saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </footer>
    </form>
  );
}
