"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  caseId: string;
};

export function CaseActionForm({ caseId }: Props) {
  const router = useRouter();
  const [actionType, setActionType] = useState("");
  const [note, setNote] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [completedAt, setCompletedAt] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actionType.trim()) {
      toast.warning("Indica el tipo de acción");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/collections/${caseId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "action",
          actionType,
          note,
          dueAt: dueAt || null,
          completedAt: completedAt || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Error" }));
        throw new Error(data.error || "No se pudo registrar la acción");
      }

      toast.success("Acción registrada");
      setActionType("");
      setNote("");
      setDueAt("");
      setCompletedAt("");
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
      <h2 className="text-lg font-semibold text-neutral-900">Registrar acción</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">Tipo</span>
          <Input value={actionType} onChange={(event) => setActionType(event.target.value)} disabled={loading} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">Fecha recordatorio</span>
          <Input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} disabled={loading} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">Fecha completado</span>
          <Input type="datetime-local" value={completedAt} onChange={(event) => setCompletedAt(event.target.value)} disabled={loading} />
        </label>
      </div>
      <label className="mt-4 block text-sm">
        <span className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">Notas</span>
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} disabled={loading} />
      </label>
      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : "Registrar"}
        </Button>
      </div>
    </form>
  );
}

