"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PreapprovalValidator, type PreapprovalFormValues } from "@/lib/validators/preapproval";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Toaster, toast } from "sonner";
import { useState } from "react";
import { format } from 'd3-format';

export function PreApprovalForm() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ cupoEstimado: number; message: string; nextSteps: string } | null>(null);

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
      const response = await fetch('/api/preapproval', {
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

  if (result) {
    return (
      <Alert>
        <AlertTitle className="font-colette text-xl">{result.message}</AlertTitle>
        <AlertDescription className="mt-4">
          <p className="text-lg">
            Tu cupo de factoring preaprobado es de:
          </p>
          <p className="font-colette text-4xl font-bold my-4 text-lp-primary-1">
            ${format(",.0f")(result.cupoEstimado).replace(/,/g, '.')}
          </p>
          <p className="text-base">{result.nextSteps}</p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <Toaster richColors />
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Form Fields */}
        <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2">
          <div>
            <Label htmlFor="nit">NIT</Label>
            <Input id="nit" {...form.register("nit")} />
            {form.formState.errors.nit && <p className="text-red-500 text-sm mt-1">{form.formState.errors.nit.message}</p>}
          </div>
          <div>
            <Label htmlFor="razonSocial">Razón Social</Label>
            <Input id="razonSocial" {...form.register("razonSocial")} />
          </div>
        </div>
        
        <div>
          <Label htmlFor="ventasAnuales">Ventas Anuales (COP)</Label>
          <Input id="ventasAnuales" type="number" min={1} {...form.register("ventasAnuales")} />
          {form.formState.errors.ventasAnuales && <p className="text-red-500 text-sm mt-1">{form.formState.errors.ventasAnuales.message}</p>}
        </div>

        <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2">
            <div>
                <Label htmlFor="facturasMes"># Facturas/Mes</Label>
                <Input id="facturasMes" type="number" min={0} {...form.register("facturasMes")} />
                {form.formState.errors.facturasMes && <p className="text-red-500 text-sm mt-1">{form.formState.errors.facturasMes.message}</p>}
            </div>
            <div>
                <Label htmlFor="ticketPromedio">Ticket Promedio Factura (COP)</Label>
                <Input id="ticketPromedio" type="number" min={1} {...form.register("ticketPromedio")} />
                {form.formState.errors.ticketPromedio && <p className="text-red-500 text-sm mt-1">{form.formState.errors.ticketPromedio.message}</p>}
            </div>
        </div>

        <div>
          <Label htmlFor="email">Email de Contacto</Label>
          <Input id="email" type="email" {...form.register("email")} />
          {form.formState.errors.email && <p className="text-red-500 text-sm mt-1">{form.formState.errors.email.message}</p>}
        </div>

        <div>
          <Label htmlFor="telefono">Teléfono de Contacto</Label>
          <Input id="telefono" {...form.register("telefono")} />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox id="consent" {...form.register("consent")} />
          <Label htmlFor="consent" className="text-sm font-normal">
            Acepto la <a href="/legal/privacidad" target="_blank" className="underline">política de tratamiento de datos</a>.
          </Label>
        </div>
        {form.formState.errors.consent && <p className="text-red-500 text-sm">{form.formState.errors.consent.message}</p>}

        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        <Button type="submit" disabled={isLoading} className="w-full" size="lg">
          {isLoading ? "Enviando..." : "Conocer mi cupo"}
        </Button>
      </form>
    </>
  );
}
