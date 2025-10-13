"use client";

import { FormEvent, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { InlineBanner } from "@/components/ui/inline-banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const DESTINATION_OPTIONS = [
  {
    value: "primary",
    label: "Cuenta bancaria principal registrada",
    helper: "Es la cuenta que usas habitualmente para recibir distribuciones.",
  },
  {
    value: "secondary",
    label: "Cuenta alternativa",
    helper: "Selecciona esta opción si tienes una cuenta adicional habilitada.",
  },
  {
    value: "other",
    label: "Otro destino (especificar)",
  },
] satisfies ReadonlyArray<{
  value: string;
  label: string;
  helper?: string;
}>;

const DEFAULT_CURRENCY = "COP";

type ApiResponse = {
  ok: boolean;
  transaction?: {
    id: string;
    status?: string | null;
  };
  error?: string;
};

type DestinationOption = (typeof DESTINATION_OPTIONS)[number];

type SubmissionStatus = {
  transactionId: string;
  status?: string | null;
} | null;

export default function InvestorWithdrawalsPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? "";

  const [amountDisplay, setAmountDisplay] = useState("");
  const [amountValue, setAmountValue] = useState(0);
  const [selectedDestination, setSelectedDestination] = useState<DestinationOption["value"]>(
    DESTINATION_OPTIONS[0]?.value ?? "other",
  );
  const [customDestination, setCustomDestination] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>(null);

  const destinationLabel = useMemo(() => {
    if (selectedDestination === "other") {
      return customDestination.trim();
    }
    const option = DESTINATION_OPTIONS.find((item) => item.value === selectedDestination);
    return option?.label ?? "";
  }, [customDestination, selectedDestination]);

  const helperText = useMemo(() => {
    const option = DESTINATION_OPTIONS.find((item) => item.value === selectedDestination);
    return option?.helper ?? undefined;
  }, [selectedDestination]);

  const resetForm = () => {
    setAmountDisplay("");
    setAmountValue(0);
    setSelectedDestination(DESTINATION_OPTIONS[0]?.value ?? "other");
    setCustomDestination("");
    setNotes("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) return;

    if (!orgId) {
      toast.error("No encontramos la organización asociada a tu sesión.");
      return;
    }

    if (!amountValue || amountValue <= 0) {
      toast.error("Ingresa un monto de retiro válido.");
      return;
    }

    const destination = destinationLabel;
    if (!destination) {
      toast.error("Selecciona o escribe el destino del retiro.");
      return;
    }

    setSubmitting(true);
    setSubmissionStatus(null);

    const descriptionParts = [`Destino: ${destination}`];
    if (notes.trim()) {
      descriptionParts.push(notes.trim());
    }

    const payload = {
      amount: amountValue,
      currency: DEFAULT_CURRENCY,
      description: descriptionParts.join(" | "),
    };

    try {
      const response = await fetch(`/api/i/${orgId}/withdrawals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data: ApiResponse = await response.json().catch(() => ({ ok: false }));

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo registrar la solicitud de retiro.");
      }

      toast.success("Solicitud de retiro enviada.");
      setSubmissionStatus({
        transactionId: data.transaction?.id ?? "",
        status: data.transaction?.status,
      });
      resetForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Solicitar retiro</CardTitle>
          <CardDescription>
            Crea una solicitud para retirar recursos de tu portafolio y recibirlos en tu cuenta bancaria.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <InlineBanner
            title="Verificaremos tu identidad antes de procesar el retiro."
            description="Si necesitas actualizar la cuenta destino, indícalo en las notas para que podamos contactarte."
          />

          {submissionStatus && submissionStatus.transactionId && (
            <InlineBanner
              tone="success"
              title="Solicitud registrada"
              description={`Código de seguimiento: ${submissionStatus.transactionId}${
                submissionStatus.status ? ` · Estado: ${submissionStatus.status}` : ""
              }`}
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="amount">Monto del retiro</Label>
              <CurrencyInput
                id="amount"
                name="amount"
                value={amountDisplay}
                onValueChange={(formatted, numericValue) => {
                  setAmountDisplay(formatted);
                  setAmountValue(numericValue);
                }}
                placeholder="0"
                helperText="Ingresa el valor total que deseas retirar en pesos colombianos."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="destination">Cuenta receptora</Label>
              <select
                id="destination"
                name="destination"
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-lp-primary-1 focus:outline-none focus:ring-1 focus:ring-lp-primary-1"
                value={selectedDestination}
                onChange={(event) => {
                  const value = event.target.value as DestinationOption["value"];
                  setSelectedDestination(value);
                  if (value !== "other") {
                    setCustomDestination("");
                  }
                }}
              >
                {DESTINATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {helperText && <p className="text-xs text-lp-sec-3">{helperText}</p>}
            </div>

            {selectedDestination === "other" && (
              <div className="space-y-2">
                <Label htmlFor="custom-destination">Especifica el destino</Label>
                <Input
                  id="custom-destination"
                  name="custom-destination"
                  value={customDestination}
                  onChange={(event) => setCustomDestination(event.target.value)}
                  placeholder="Ej. Nueva cuenta bancaria o fondo de inversión"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notas adicionales (opcional)</Label>
              <Textarea
                id="notes"
                name="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Indica datos relevantes como urgencia, referencia del banco o instrucciones especiales."
                rows={4}
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button type="submit" disabled={submitting} className="sm:w-auto">
                {submitting ? "Enviando solicitud..." : "Enviar solicitud"}
              </Button>
              <p className="text-xs text-lp-sec-3">
                Te notificaremos por correo y en el portal cuando el retiro haya sido programado.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="self-start">
        <CardHeader>
          <CardTitle>Antes de solicitar un retiro</CardTitle>
          <CardDescription>
            Asegúrate de contar con saldo disponible y de tener la información bancaria actualizada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4 text-sm text-lp-sec-3">
            <li>
              <span className="font-medium text-lp-primary-1">Validación de saldo:</span> confirmaremos que la
              posición cuente con fondos suficientes para el retiro solicitado.
            </li>
            <li>
              <span className="font-medium text-lp-primary-1">Tiempos de procesamiento:</span> los retiros pueden tomar
              entre 1 y 3 días hábiles dependiendo del banco receptor.
            </li>
            <li>
              <span className="font-medium text-lp-primary-1">Seguimiento personalizado:</span> si tu solicitud requiere
              coordinación adicional, nuestro equipo se pondrá en contacto contigo.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
