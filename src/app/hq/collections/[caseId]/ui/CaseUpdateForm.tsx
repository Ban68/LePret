"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "open", label: "Abierto" },
  { value: "in_follow_up", label: "Seguimiento" },
  { value: "promised", label: "Promesa" },
  { value: "closed", label: "Cerrado" },
];

type Props = {
  caseId: string;
  initialValues: {
    status: string;
    next_action_at: string;
    promise_date: string;
    promise_amount: string | number;
    notes: string;
  };
};

export function CaseUpdateForm({ caseId, initialValues }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(initialValues.status || "open");
  const [nextActionAt, setNextActionAt] = useState(initialValues.next_action_at);
  const [promiseDate, setPromiseDate] = useState(initialValues.promise_date);
  const [promiseAmount, setPromiseAmount] = useState(String(initialValues.promise_amount ?? ""));
  const [notes, setNotes] = useState(initialValues.notes);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setLoading(true);
      const response = await fetch(`/api/collections/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          next_action_at: nextActionAt || null,
          promise_date: promiseDate || null,
          promise_amount: promiseAmount ? Number(promiseAmount) : null,
          notes: notes || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Error" }));
        throw new Error(data.error || "No se pudo actualizar el caso");
      }

      toast.success("Caso actualizado");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-900">Actualizar estatus</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">Estatus</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-lp-primary-1 focus:outline-none"
            disabled={loading}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">Próxima acción</span>
          <Input
            type="datetime-local"
            value={nextActionAt}
            onChange={(event) => setNextActionAt(event.target.value)}
            disabled={loading}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">Fecha promesa</span>
          <Input type="date" value={promiseDate} onChange={(event) => setPromiseDate(event.target.value)} disabled={loading} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">Monto promesa</span>
          <Input
            type="number"
            min="0"
            step="10000"
            value={promiseAmount}
            onChange={(event) => setPromiseAmount(event.target.value)}
            disabled={loading}
          />
        </label>
      </div>
      <label className="mt-4 block text-sm">
        <span className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">Notas internas</span>
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} disabled={loading} />
      </label>
      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

