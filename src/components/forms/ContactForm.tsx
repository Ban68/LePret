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
          <Label htmlFor="nombre">Nombre Completo</Label>
          <Input id="nombre" {...form.register("nombre")} />
          {form.formState.errors.nombre && <p className="text-red-500 text-sm mt-1">{form.formState.errors.nombre.message}</p>}
        </div>
        
        <div>
          <Label htmlFor="email">Email de Contacto</Label>
          <Input id="email" type="email" {...form.register("email")} />
          {form.formState.errors.email && <p className="text-red-500 text-sm mt-1">{form.formState.errors.email.message}</p>}
        </div>

        <div>
          <Label htmlFor="telefono">Teléfono (Opcional)</Label>
          <Input id="telefono" {...form.register("telefono")} />
        </div>

        <div>
          <Label htmlFor="mensaje">Mensaje</Label>
          <Textarea id="mensaje" rows={5} {...form.register("mensaje")} />
          {form.formState.errors.mensaje && <p className="text-red-500 text-sm mt-1">{form.formState.errors.mensaje.message}</p>}
        </div>

        <Button type="submit" disabled={isLoading} className="w-full" size="lg">
          {isLoading ? "Enviando..." : "Enviar Mensaje"}
        </Button>
      </form>
    </>
  );
}
