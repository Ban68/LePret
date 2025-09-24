"use client";

import { useForm, type Resolver, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PreapprovalValidator, type PreapprovalFormValues } from "@/lib/validators/preapproval";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Toaster, toast } from "sonner";
import { useState } from "react";
import type { JSX } from "react";
import { format } from 'd3-format';
import { FormError } from "./FormError";

type GenerationMode = "selection" | "guided" | "automatic";

type GuidedStep = {
  id: string;
  title: string;
  description?: string;
  fields: (keyof PreapprovalFormValues)[];
  render: () => JSX.Element;
};

export function PreApprovalForm() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ cupoEstimado: number; message: string; nextSteps: string } | null>(null);
  const [mode, setMode] = useState<GenerationMode>("selection");
  const [currentStep, setCurrentStep] = useState<number>(0);

  const formatCurrency = (value: number | string) => {
    if (value === null || value === undefined) return '';
    const numValue = typeof value === 'string' ? parseCurrency(value) : value;
    if (isNaN(numValue) || numValue === 0) {
      return '';
    }
    return `$${new Intl.NumberFormat('es-CO').format(numValue)}`;
  };

  const parseCurrency = (value: string) => {
    return Number(value.replace(/[^0-9]/g, ''));
  };

  const form = useForm<PreapprovalFormValues>({
    resolver: zodResolver(PreapprovalValidator) as Resolver<PreapprovalFormValues>,
    defaultValues: {
      nit: "",
      razonSocial: "",
      ventasAnuales: 0,
      facturasMes: 0,
      ticketPromedio: 0,
      email: "",
      telefono: "",
      consent: false,
    },
  });

  const onSubmit = async (data: PreapprovalFormValues) => {
    setError(null);
    setResult(null);

    if (data.ventasAnuales < 1 || data.facturasMes < 0 || data.ticketPromedio < 1) {
      setError('Por favor ingresa valores válidos.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/preaprobacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || 'Ocurrió un error al enviar la solicitud.');
      }

      setResult(responseData);
      toast.success('¡Solicitud enviada con éxito!');
      form.reset();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const guidedSteps: GuidedStep[] = [
    {
      id: "nit",
      title: "¿Cuál es el NIT de tu empresa?",
      description: "Ingresa el NIT sin dígito de verificación.",
      fields: ["nit"],
      render: () => (
        <div className="space-y-4">
          <Input id="nit" autoComplete="off" {...form.register("nit")} />
          <FormError
            message={form.formState.errors.nit?.message}
            className="mt-1"
          />
        </div>
      ),
    },
    {
      id: "razonSocial",
      title: "¿Cómo se llama tu empresa?",
      description: "Cuéntanos la razón social registrada.",
      fields: ["razonSocial"],
      render: () => (
        <div className="space-y-2">
          <Input
            id="razonSocial"
            autoComplete="organization"
            {...form.register("razonSocial")}
          />
        </div>
      ),
    },
    {
      id: "ventasAnuales",
      title: "¿Cuáles son tus ventas anuales aproximadas?",
      description: "Responde en pesos colombianos.",
      fields: ["ventasAnuales"],
      render: () => (
        <div className="space-y-4">
          <Controller
            name="ventasAnuales"
            control={form.control}
            render={({ field }) => (
              <Input
                id="ventasAnuales"
                autoComplete="off"
                value={formatCurrency(field.value)}
                onChange={(e) => {
                  field.onChange(parseCurrency(e.target.value));
                }}
              />
            )}
          />
          <FormError
            message={form.formState.errors.ventasAnuales?.message}
            className="mt-1"
          />
        </div>
      ),
    },
    {
      id: "facturasMes",
      title: "¿Cuántas facturas gestionas al mes?",
      description: "Incluye únicamente las facturas que deseas anticipar.",
      fields: ["facturasMes"],
      render: () => (
        <div className="space-y-4">
          <Input
            id="facturasMes"
            type="number"
            min={0}
            autoComplete="off"
            {...form.register("facturasMes")}
          />
          <FormError
            message={form.formState.errors.facturasMes?.message}
            className="mt-1"
          />
        </div>
      ),
    },
    {
      id: "ticketPromedio",
      title: "¿Cuál es el valor promedio por factura?",
      description: "Responde en pesos colombianos.",
      fields: ["ticketPromedio"],
      render: () => (
        <div className="space-y-4">
          <Controller
            name="ticketPromedio"
            control={form.control}
            render={({ field }) => (
              <Input
                id="ticketPromedio"
                autoComplete="off"
                value={formatCurrency(field.value)}
                onChange={(e) => {
                  field.onChange(parseCurrency(e.target.value));
                }}
              />
            )}
          />
          <FormError
            message={form.formState.errors.ticketPromedio?.message}
            className="mt-1"
          />
        </div>
      ),
    },
    {
      id: "email",
      title: "¿Cuál es tu correo de contacto?",
      description: "Te enviaremos la propuesta a este email.",
      fields: ["email"],
      render: () => (
        <div className="space-y-4">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            {...form.register("email")}
          />
          <FormError
            message={form.formState.errors.email?.message}
            className="mt-1"
          />
        </div>
      ),
    },
    {
      id: "telefono",
      title: "Déjanos un teléfono para contactarte",
      description: "Opcional, pero nos ayuda a agilizar la atención.",
      fields: ["telefono"],
      render: () => (
        <div className="space-y-2">
          <Input id="telefono" autoComplete="tel" {...form.register("telefono")} />
        </div>
      ),
    },
    {
      id: "consent",
      title: "¿Nos autorizas el tratamiento de datos?",
      description: "Necesitamos tu aprobación para continuar.",
      fields: ["consent"],
      render: () => (
        <div className="space-y-4">
          <Controller
            name="consent"
            control={form.control}
            render={({ field }) => (
              <div className="flex items-start space-x-3 rounded-lg border border-lp-sec-4/60 bg-white p-4">
                <Checkbox
                  id="consent"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
                <Label htmlFor="consent" className="text-sm font-normal">
                  Acepto la <a href="/legal/privacidad" target="_blank" className="underline">política de tratamiento de datos</a>.
                </Label>
              </div>
            )}
          />
          <FormError message={form.formState.errors.consent?.message} />
        </div>
      ),
    },
    {
      id: "summary",
      title: "Revisa tu información",
      description: "Confirma que todos los datos sean correctos antes de generar tu oferta.",
      fields: [],
      render: () => {
        const values = form.getValues();
        const formatOrDash = (value: number | string) => {
          if (typeof value === "number" && value <= 0) return "—";
          if (typeof value === "string" && value.trim() === "") return "—";
          if (typeof value === "number") {
            return formatCurrency(value) || "—";
          }
          return value;
        };

        return (
          <div className="space-y-4">
            <div className="rounded-lg border border-lp-sec-4/60 bg-white p-4 shadow-sm">
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-lp-sec-3">NIT</dt>
                  <dd className="font-medium text-lp-primary-1">{values.nit || "—"}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-lp-sec-3">Razón social</dt>
                  <dd className="font-medium text-lp-primary-1">{values.razonSocial || "—"}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-lp-sec-3">Ventas anuales</dt>
                  <dd className="font-medium text-lp-primary-1">{formatOrDash(values.ventasAnuales)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-lp-sec-3">Facturas al mes</dt>
                  <dd className="font-medium text-lp-primary-1">{values.facturasMes || "—"}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-lp-sec-3">Ticket promedio</dt>
                  <dd className="font-medium text-lp-primary-1">{formatOrDash(values.ticketPromedio)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-lp-sec-3">Correo</dt>
                  <dd className="font-medium text-lp-primary-1">{values.email || "—"}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-lp-sec-3">Teléfono</dt>
                  <dd className="font-medium text-lp-primary-1">{values.telefono || "—"}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-lp-sec-3">Consentimiento</dt>
                  <dd className="font-medium text-lp-primary-1">{values.consent ? "Aceptado" : "Pendiente"}</dd>
                </div>
              </dl>
            </div>
          </div>
        );
      },
    },
  ];

  const activeStep = guidedSteps[currentStep] ?? guidedSteps[0];
  const totalSteps = guidedSteps.length;
  const isLastStep = currentStep === totalSteps - 1;
  const progress = Math.round(((currentStep + 1) / totalSteps) * 100);

  const resetFlow = () => {
    setMode("selection");
    setCurrentStep(0);
    setError(null);
  };

  const handleRestart = () => {
    setResult(null);
    resetFlow();
    form.reset();
  };

  const handlePrevious = () => {
    if (isLoading) return;
    if (currentStep === 0) {
      resetFlow();
      return;
    }
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleNext = async () => {
    if (!activeStep || isLoading) return;

    if (isLastStep) {
      form.handleSubmit(onSubmit)();
      return;
    }

    const fields = activeStep.fields;

    if (fields.length > 0) {
      const isValid = await form.trigger(fields);
      if (!isValid) {
        return;
      }
    }

    setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
  };

  const SelectionView = () => (
    <div className="rounded-2xl border border-lp-sec-4/50 bg-white p-8 shadow-xl">
      <h3 className="text-2xl font-semibold text-lp-primary-1">
        ¿Cómo quieres generar tu oferta?
      </h3>
      <p className="mt-3 text-base text-lp-sec-3">
        Elige si prefieres responder preguntas una a una para personalizar tu oferta o si deseas usar la generación automática.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Button
          type="button"
          className="h-auto rounded-xl bg-lp-primary-1 py-4 text-lg text-lp-primary-2 hover:opacity-90"
          onClick={() => {
            setMode("guided");
            setCurrentStep(0);
            setError(null);
          }}
        >
          Generar oferta personalizada
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-auto rounded-xl py-4 text-lg"
          onClick={() => {
            setMode("automatic");
            setError(null);
          }}
        >
          Generar automáticamente
        </Button>
      </div>
    </div>
  );

  const AutomaticForm = () => (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            if (!isLoading) {
              resetFlow();
            }
          }}
        >
          ← Volver
        </Button>
        <Button
          type="button"
          variant="link"
          onClick={() => {
            if (!isLoading) {
              setMode("guided");
              setCurrentStep(0);
              setError(null);
            }
          }}
        >
          Quiero personalizar mi oferta
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2">
        <div>
          <Label htmlFor="nit" className="mb-2">NIT</Label>
          <Input id="nit" autoComplete="off" {...form.register("nit")} />
          <FormError
            message={form.formState.errors.nit?.message}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="razonSocial" className="mb-2">Razón Social</Label>
          <Input id="razonSocial" autoComplete="organization" {...form.register("razonSocial")} />
        </div>
      </div>

      <div>
        <Label htmlFor="ventasAnuales" className="mb-2">Ventas Anuales (COP)</Label>
        <Controller
          name="ventasAnuales"
          control={form.control}
          render={({ field }) => (
            <Input
              id="ventasAnuales"
              autoComplete="off"
              value={formatCurrency(field.value)}
              onChange={(e) => {
                field.onChange(parseCurrency(e.target.value));
              }}
            />
          )}
        />
        <FormError
          message={form.formState.errors.ventasAnuales?.message}
          className="mt-1"
        />
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2">
        <div>
          <Label htmlFor="facturasMes" className="mb-2"># Facturas/Mes</Label>
          <Input id="facturasMes" type="number" min={0} autoComplete="off" {...form.register("facturasMes")} />
          <FormError
            message={form.formState.errors.facturasMes?.message}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="ticketPromedio" className="mb-2">Ticket Promedio Factura (COP)</Label>
          <Controller
            name="ticketPromedio"
            control={form.control}
            render={({ field }) => (
              <Input
                id="ticketPromedio"
                autoComplete="off"
                value={formatCurrency(field.value)}
                onChange={(e) => {
                  field.onChange(parseCurrency(e.target.value));
                }}
              />
            )}
          />
          <FormError
            message={form.formState.errors.ticketPromedio?.message}
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="email" className="mb-2">Email de Contacto</Label>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
        <FormError
          message={form.formState.errors.email?.message}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="telefono" className="mb-2">Teléfono de Contacto</Label>
        <Input id="telefono" autoComplete="tel" {...form.register("telefono")} />
      </div>

      <Controller
        name="consent"
        control={form.control}
        render={({ field }) => (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="consent"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
            <Label htmlFor="consent" className="text-sm font-normal">
              Acepto la <a href="/legal/privacidad" target="_blank" className="underline">política de tratamiento de datos</a>.
            </Label>
          </div>
        )}
      />
      <FormError message={form.formState.errors.consent?.message} />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full bg-lp-primary-1 text-lp-primary-2 hover:opacity-90"
        size="lg"
      >
        {isLoading ? "Generando..." : "Generar oferta automáticamente"}
      </Button>
    </form>
  );

  const GuidedForm = () => (
    <div className="space-y-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm text-lp-sec-3">
          <button
            type="button"
            onClick={handlePrevious}
            className="text-left text-lp-primary-1 hover:underline"
          >
            {currentStep === 0 ? "← Volver" : "← Atrás"}
          </button>
          <span>
            Paso {currentStep + 1} de {totalSteps}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-lp-sec-4/40">
          <div
            className="h-2 rounded-full bg-lp-primary-1 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-lp-sec-4/60 bg-white p-8 shadow-xl">
        <h3 className="text-2xl font-semibold text-lp-primary-1">{activeStep.title}</h3>
        {activeStep.description && (
          <p className="mt-2 text-base text-lp-sec-3">{activeStep.description}</p>
        )}
        <div className="mt-6">{activeStep.render()}</div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={handlePrevious}
          disabled={isLoading}
        >
          {currentStep === 0 ? "Cancelar" : "Atrás"}
        </Button>
        <Button
          type="button"
          className="bg-lp-primary-1 text-lp-primary-2 hover:opacity-90"
          onClick={handleNext}
          disabled={isLoading}
        >
          {isLastStep ? (isLoading ? "Generando..." : "Generar oferta") : "Continuar"}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <Toaster richColors />
      {result ? (
        <Alert>
          <AlertTitle className="font-colette text-xl">{result.message}</AlertTitle>
          <AlertDescription className="mt-4 space-y-4">
            <div>
              <p className="text-lg">Tu cupo de factoring preaprobado es de:</p>
              <p className="my-4 font-colette text-4xl font-bold text-lp-primary-1">
                ${format(",.0f")(result.cupoEstimado).replace(/,/g, '.')}
              </p>
              <p className="text-base">{result.nextSteps}</p>
            </div>
            <Button
              type="button"
              className="bg-lp-primary-1 text-lp-primary-2 hover:opacity-90"
              onClick={handleRestart}
            >
              Generar otra oferta
            </Button>
          </AlertDescription>
        </Alert>
      ) : mode === "selection" ? (
        <SelectionView />
      ) : mode === "automatic" ? (
        <AutomaticForm />
      ) : (
        <GuidedForm />
      )}
    </>
  );
}