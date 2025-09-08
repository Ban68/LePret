"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Operation = {
  id: string;
  created_at: string;
  status: string;
  requested_amount: number | null;
  currency: string;
};

export default function OperationsPage() {
  const supabase = supabaseBrowser();
  const [ops, setOps] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase
        .from('operations')
        .select('id, created_at, status, requested_amount, currency')
        .order('created_at', { ascending: false });
      if (!active) return;
      setOps(data || []);
      setLoading(false);
    }
    load();
    return () => { active = false };
  }, [supabase]);

  if (loading) {
    return <div className="container mx-auto px-4 py-10 text-sm text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Mis Operaciones</h2>
        <Link href="/app/operaciones/nueva" className="inline-flex rounded-md bg-lp-primary-1 px-4 py-2 text-sm font-medium text-white hover:bg-lp-primary-1/90">Nueva operación</Link>
      </div>
      {ops.length === 0 ? (
        <div className="text-sm text-muted-foreground">Aún no tienes operaciones.</div>
      ) : (
        <ul className="divide-y border rounded-md">
          {ops.map((op) => (
            <li key={op.id} className="flex items-center justify-between px-4 py-3">
              <div className="space-y-1">
                <div className="text-sm">#{op.id.slice(0, 8)} • {new Date(op.created_at).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Estado: {op.status}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm font-medium">
                  {op.requested_amount ? op.requested_amount.toLocaleString('es-CO') : '—'} {op.currency}
                </div>
                <Link href={`/app/operaciones/${op.id}`} className="text-sm underline">Ver</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

