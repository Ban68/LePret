"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  requestId: string;
  disabled?: boolean;
  onSent?: () => void | false | Promise<void | false>;
};

export function TimelineComposer({ requestId, disabled, onSent }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) {
      toast.warning("Escribe un mensaje para continuar");
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`/api/requests/${requestId}/timeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Error" }));
        throw new Error(data.error || "No pudimos enviar el mensaje");
      }

      setMessage("");
      toast.success("Mensaje enviado");
      const refreshResult = onSent ? await onSent() : undefined;
      if (refreshResult !== false) {
        router.refresh();
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "No se pudo enviar";
      toast.error(messageText);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-neutral-900">Comparte una actualización</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Este mensaje será enviado al equipo de soporte y quedará registrado en el historial.
      </p>
      <Textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Escribe tu mensaje"
        className="mt-3"
        rows={4}
        disabled={submitting || disabled}
      />
      <div className="mt-3 flex justify-end">
        <Button type="submit" disabled={submitting || disabled}>
          {submitting ? "Enviando..." : "Enviar mensaje"}
        </Button>
      </div>
    </form>
  );
}
