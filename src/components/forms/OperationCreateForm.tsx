"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase-browser";

const schema = z.object({
  requested_amount: z.coerce.number().min(1, "Monto requerido"),
  expected_due_date: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function OperationCreateForm() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setError(null);
    setLoading(true);
    const { data: insertData, error } = await supabase
      .from('operations')
      .insert({
        requested_amount: data.requested_amount,
        expected_due_date: data.expected_due_date || null,
        notes: data.notes || null,
      })
      .select('id')
      .single();
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace(`/app/operaciones/${insertData.id}`);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="requested_amount">Monto solicitado (COP)</Label>
        <Input id="requested_amount" type="number" step="1000" min="0" {...register("requested_amount")} aria-invalid={!!errors.requested_amount} />
        {errors.requested_amount && <p className="text-sm text-red-600">{errors.requested_amount.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="expected_due_date">Fecha estimada de pago</Label>
        <Input id="expected_due_date" type="date" {...register("expected_due_date")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notas</Label>
        <Input id="notes" placeholder="Información adicional" {...register("notes")} />
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <Button type="submit" disabled={loading}>{loading ? 'Creando...' : 'Crear operación'}</Button>
    </form>
  );
}

