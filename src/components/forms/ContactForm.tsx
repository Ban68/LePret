"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ContactValidator, ContactRequest } from "@/lib/validators/contact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Toaster, toast } from "sonner";
import { useState } from "react";
import { FormError } from "./FormError";

export function ContactForm() {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const form = useForm<ContactRequest>({
    resolver: zodResolver(ContactValidator),
    defaultValues: {
      nombre: "",
      email: "",
      telefono: "",
      mensaje: "",
    },
  });

  const onSubmit = async (data: ContactRequest) => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || 'Ocurrió un error al enviar el mensaje.');
      }

      toast.success(responseData.message);
      form.reset();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Toaster richColors />
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <Label htmlFor="nombre" className="mb-2">Nombre Completo</Label>
          <Input id="nombre" autoComplete="name" {...form.register("nombre")} />
          <FormError
            message={form.formState.errors.nombre?.message}
            className="mt-1"
          />
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
          <Label htmlFor="telefono" className="mb-2">Teléfono (Opcional)</Label>
          <Input id="telefono" autoComplete="tel" {...form.register("telefono")} />
        </div>

        <div>
          <Label htmlFor="mensaje" className="mb-2">Mensaje</Label>
          <Textarea id="mensaje" rows={5} {...form.register("mensaje")} />
          <FormError
            message={form.formState.errors.mensaje?.message}
            className="mt-1"
          />
        </div>

        <Button type="submit" variant="outline" disabled={isLoading} className="w-full" size="lg">
          {isLoading ? "Enviando..." : "Enviar Mensaje"}
        </Button>
      </form>
    </>
  );
}
