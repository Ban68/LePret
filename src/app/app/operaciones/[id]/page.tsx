"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import InvoiceUpload from "@/components/forms/InvoiceUpload";

type Operation = {
  id: string;
  created_at: string;
  status: string;
  requested_amount: number | null;
  currency: string;
  notes: string | null;
};

type Invoice = {
  id: string;
  invoice_number: string | null;
  amount: number | null;
  due_date: string | null;
};

export default function OperationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;
  const supabase = supabaseBrowser();
  const [op, setOp] = useState<Operation | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const [{ data: opData }, { data: invData }] = await Promise.all([
        supabase.from('operations').select('*').eq('id', id).single(),
        supabase.from('invoices').select('id, invoice_number, amount, due_date').eq('operation_id', id).order('created_at', { ascending: false })
      ]);
      if (!active) return;
      setOp(opData || null);
      setInvoices(invData || []);
      setLoading(false);
    }
    if (id) load();
    return () => { active = false };
  }, [id, supabase]);

  if (loading) {
    return <div className="container mx-auto px-4 py-10 text-sm text-muted-foreground">Cargando...</div>;
  }

  if (!op) {
    return <div className="container mx-auto px-4 py-10">No se encontró la operación.</div>;
  }

  return (
    <div className="container mx-auto px-4 py-10 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Operación #{op.id.slice(0,8)}</h2>
          <p className="text-sm text-muted-foreground">Estado: {op.status} • Monto: {op.requested_amount?.toLocaleString('es-CO')} {op.currency}</p>
        </div>
      </header>

      <section className="space-y-3">
        <h3 className="text-base font-medium">Facturas</h3>
        {invoices.length === 0 ? (
          <div className="text-sm text-muted-foreground">Aún no hay facturas registradas.</div>
        ) : (
          <ul className="divide-y rounded-md border">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <div>
                  <div>N° {inv.invoice_number ?? inv.id.slice(0,6)}</div>
                  <div className="text-xs text-muted-foreground">Vence: {inv.due_date ?? '—'}</div>
                </div>
                <div className="font-medium">{inv.amount ? inv.amount.toLocaleString('es-CO') : '—'}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <InvoiceUpload operationId={op.id} />
      </section>
    </div>
  );
}

