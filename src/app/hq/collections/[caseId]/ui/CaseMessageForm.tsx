"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  caseId: string;
  requestId: string;
};

export function CaseMessageForm({ caseId, requestId }: Props) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [visibility, setVisibility] = useState<"client" | "internal">("client");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) {
      toast.warning("Escribe un mensaje");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/collections/${caseId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "message",
          subject: subject || null,
          message,
          visibility,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Error" }));
        throw new Error(data.error || "No se pudo enviar el mensaje");
      }

      toast.success(visibility === "client" ? "Mensaje enviado al cliente" : "Nota interna registrada");
      setSubject("");
      setMessage("");
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
      <h2 className="text-lg font-semibold text-neutral-900">Enviar mensaje</h2>
      <p className="mt-1 text-xs text-neutral-500">
        El mensaje se asociará al historial de la solicitud <span className="font-mono">{requestId.slice(0, 8)}</span>.
      </p>
      <div className="mt-3 flex gap-3 text-xs">
        <button
          type="button"
          onClick={() => setVisibility("client")}
          className={`rounded-md border px-2 py-1 font-medium ${
            visibility === "client" ? "border-lp-primary-1 bg-lp-primary-1/10 text-lp-primary-1" : "border-neutral-200 text-neutral-500"
          }`}
        >
          Cliente
        </button>
        <button
          type="button"
          onClick={() => setVisibility("internal")}
          className={`rounded-md border px-2 py-1 font-medium ${
            visibility === "internal"
              ? "border-neutral-900 bg-neutral-900/10 text-neutral-900"
              : "border-neutral-200 text-neutral-500"
          }`}
        >
          Interno
        </button>
      </div>
      <div className="mt-4 space-y-3">
        <Input
          placeholder="Asunto (opcional)"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          disabled={loading}
        />
        <Textarea
          placeholder="Escribe tu mensaje"
          rows={4}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={loading}
        />
      </div>
      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? "Enviando..." : "Registrar"}
        </Button>
      </div>
    </form>
  );
}

