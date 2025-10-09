"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineBanner } from "@/components/ui/inline-banner";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  in_collection: "En gestión",
  paid: "Pagada",
  overdue: "Vencida",
  cancelled: "Cancelada",
};

function formatCurrency(amount: number | null | undefined, currency?: string | null) {
  if (amount === null || amount === undefined) return "-";
  const value = Number(amount);
  if (!Number.isFinite(value)) return String(amount);
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: currency || "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

type CollectionItem = {
  id: string;
  request_id: string | null;
  status: keyof typeof STATUS_LABELS | string;
  amount: number;
  currency: string;
  due_date: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
};

type ListResponse = {
  ok: boolean;
  items?: CollectionItem[];
  error?: string;
};

type UpdateResponse = {
  ok: boolean;
  payment?: CollectionItem;
  error?: string;
};

const ACTIONS: Array<{ key: keyof typeof STATUS_LABELS; label: string; description: string }> = [
  { key: "paid", label: "Registrar pago", description: "Marcar como pagada" },
  { key: "in_collection", label: "En gestión", description: "Seguimiento con el pagador" },
  { key: "overdue", label: "Marcar vencida", description: "El pago está atrasado" },
  { key: "pending", label: "Reabrir", description: "Volver a pendiente" },
];

export function CollectionsClient({ orgId }: { orgId: string }) {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/c/${orgId}/collections`, { cache: "no-store" });
      const data: ListResponse = await res
        .json()
        .catch(() => ({ ok: false, error: "No se pudo leer la respuesta del servidor" }));
      if (!res.ok || !data.ok || !data.items) {
        throw new Error(data.error || "No se pudieron cargar los cobros");
      }
      setItems(data.items);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load().catch(() => null);
  }, [load]);

  const hasItems = useMemo(() => items.length > 0, [items]);

  const updateStatus = async (paymentId: string, status: keyof typeof STATUS_LABELS) => {
    setUpdating(paymentId);
    try {
      const payload: Record<string, unknown> = { status };
      if (status === "paid") {
        payload.paid_at = new Date().toISOString();
      }
      const res = await fetch(`/api/c/${orgId}/collections/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: UpdateResponse = await res
        .json()
        .catch(() => ({ ok: false, error: "No se pudo leer la respuesta del servidor" }));
      if (!res.ok || !data.ok || !data.payment) {
        throw new Error(data.error || "No se pudo actualizar el cobro");
      }
      setItems((prev) => prev.map((item) => (item.id === paymentId ? data.payment! : item)));
      toast.success("Estado actualizado");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      toast.error(message);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="py-10">
      <Toaster richColors position="top-center" />
      <div className="container mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-colette text-2xl font-semibold text-lp-primary-1">Cobranzas</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Haz seguimiento a los pagos esperados y registra las cobranzas recibidas.
            </p>
          </div>
          <Button variant="outline" onClick={() => load()} disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar"}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pagos de tus clientes</CardTitle>
            <CardDescription>Consulta el estado de cada factura y actualiza la gestión.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-neutral-500">Cargando información...</p>
            ) : error ? (
              <InlineBanner tone="error" title="No se pudieron cargar los cobros" description={error} />
            ) : hasItems ? (
              <div className="overflow-x-auto">
                <table className="min-w-[960px] w-full divide-y divide-lp-sec-4/60 text-sm">
                  <thead>
                    <tr className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      <th className="px-4 py-2">Solicitud</th>
                      <th className="px-4 py-2">Monto</th>
                      <th className="px-4 py-2">Vencimiento</th>
                      <th className="px-4 py-2">Estado</th>
                      <th className="px-4 py-2">Última actualización</th>
                      <th className="px-4 py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-lp-sec-4/40">
                    {items.map((item) => {
                      const statusLabel = STATUS_LABELS[item.status] ?? item.status;
                      const dueDate = item.due_date ? new Date(item.due_date).toLocaleDateString("es-CO") : "-";
                      const updatedAt = item.updated_at
                        ? new Date(item.updated_at).toLocaleString("es-CO")
                        : new Date(item.created_at).toLocaleString("es-CO");
                      return (
                        <tr key={item.id} className="bg-white">
                          <td className="px-4 py-3 text-neutral-700">
                            {item.request_id ? (
                              <Link
                                href={`/c/${orgId}/requests/${item.request_id}`}
                                className="font-medium text-lp-primary-1 underline"
                              >
                                #{item.request_id.slice(0, 8)}
                              </Link>
                            ) : (
                              <span className="text-neutral-500">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-semibold text-neutral-900">
                            {formatCurrency(item.amount, item.currency)}
                          </td>
                          <td className="px-4 py-3 text-neutral-700">{dueDate}</td>
                          <td className="px-4 py-3 text-neutral-700">{statusLabel}</td>
                          <td className="px-4 py-3 text-neutral-500">{updatedAt}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {ACTIONS.map((action) => (
                                <Button
                                  key={action.key}
                                  size="sm"
                                  variant={action.key === "paid" ? "default" : "outline"}
                                  onClick={() => updateStatus(item.id, action.key)}
                                  disabled={updating === item.id}
                                >
                                  {action.label}
                                </Button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <InlineBanner
                tone="info"
                title="Sin pagos registrados todavía"
                description="A medida que generes operaciones, podrás registrar y monitorear los pagos de tus clientes."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
