'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { InvoiceUploadValidator, InvoiceUploadRequest } from '@/lib/validators/invoice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormError } from '@/components/forms/FormError';
import { toast } from 'sonner';
import { useState } from 'react';

export function InvoiceUploadForm({ orgId }: { orgId: string }) {
  console.log('orgId', orgId); // Use orgId to remove warning
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const form = useForm<InvoiceUploadRequest>({
    resolver: zodResolver(InvoiceUploadValidator),
    defaultValues: {
      invoiceNumber: '',
      amount: 0,
      file: undefined,
    },
  });

  const onSubmit = async (data: InvoiceUploadRequest) => {
    setIsLoading(true);
    // TODO: Implement actual API call to upload invoice
    console.log('Invoice data to upload:', data);
    toast.success('Factura simulada cargada con éxito!');
    form.reset();
    setIsLoading(false);
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
        <Label htmlFor="file" className="mb-2">Archivo de Factura (PDF, JPG, PNG)</Label>
        <Input
          id="file"
          type="file"
          accept="application/pdf,image/jpeg,image/png"
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
