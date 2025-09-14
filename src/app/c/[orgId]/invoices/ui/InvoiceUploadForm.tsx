'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  InvoiceUploadValidator,
  InvoiceUploadRequest,
  InvoiceUploadInput,
} from '@/lib/validators/invoice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormError } from '@/components/forms/FormError';
import { toast } from 'sonner';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';

export function InvoiceUploadForm({ orgId, onSuccess }: { orgId: string, onSuccess?: () => void }) {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const form = useForm<InvoiceUploadInput, unknown, InvoiceUploadRequest>({
    resolver: zodResolver(InvoiceUploadValidator),
    defaultValues: {
      invoiceNumber: '',
      amount: undefined,
      dueDate: undefined,
    },
  });

  const onSubmit = async (data: InvoiceUploadRequest) => {
    setIsLoading(true);
    let filePath = '';

    try {
      if (data.file) {
        const file = data.file;
        const fileName = `${orgId}/${Date.now()}-${file.name}`;
        const { data: uploadData, error: uploadError } = await supabaseBrowser
          .storage
          .from('invoices')
          .upload(fileName, file);

        if (uploadError) throw new Error(`Error al subir archivo: ${uploadError.message}`);
        filePath = uploadData.path;
      }

      const response = await fetch(`/api/c/${orgId}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          file_path: filePath,
          // TODO: El issue_date debería venir del XML de la factura
          issue_date: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear la factura.');
      }

      toast.success('Factura cargada con éxito!');
      form.reset();
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ocurrió un error inesperado.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="invoiceNumber" className="mb-2">Número de Factura</Label>
        <Input id="invoiceNumber" {...form.register('invoiceNumber')} />
        <FormError message={form.formState.errors.invoiceNumber?.message} className="mt-1" />
      </div>

      <div>
        <Label htmlFor="amount" className="mb-2">Monto</Label>
        <Input id="amount" type="number" step="0.01" {...form.register('amount', { valueAsNumber: true })} />
        <FormError message={form.formState.errors.amount?.message} className="mt-1" />
      </div>

      <div>
        <Label htmlFor="dueDate" className="mb-2">Fecha de Vencimiento</Label>
        <Input id="dueDate" type="date" {...form.register('dueDate', { valueAsDate: true })} />
        <FormError message={form.formState.errors.dueDate?.message} className="mt-1" />
      </div>

      <div>
        <Label htmlFor="file" className="mb-2">Archivo de Factura (PDF, XML, JPG, PNG)</Label>
        <Input
          id="file"
          type="file"
          accept="application/pdf,application/xml,image/jpeg,image/png"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              form.setValue('file', file, { shouldValidate: true });
            }
          }}
        />
        <FormError message={form.formState.errors.file?.message} className="mt-1" />
      </div>

      <Button type="submit" disabled={isLoading} className="w-full bg-lp-primary-1 text-lp-primary-2 hover:opacity-90">
        {isLoading ? 'Cargando...' : 'Cargar Factura'}
      </Button>
    </form>
  );
}
