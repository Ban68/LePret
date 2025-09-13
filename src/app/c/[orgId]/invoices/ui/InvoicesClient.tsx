"use client";

import { useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster, toast } from "sonner";
import { StatusBadge } from "@/components/ui/status-badge";

type Invoice = {
  id: string;
  amount: number;
  issue_date: string;
  due_date: string;
  status: string;
  file_path?: string | null;
  created_by?: string;
};

export function InvoicesClient({ orgId }: { orgId: string }) {
  const [items, setItems] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const [amount, setAmount] = useState<string>("");
  const [issueDate, setIssueDate] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [sort, setSort] = useState<string>('created_at.desc');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [total, setTotal] = useState<number>(0);

  // Helpers de moneda (declaradas antes de usarlas)
  function parseCurrency(s: string): number {
    return Number((s || '').replace(/[^0-9]/g, ''));
  }
  function formatCurrency(n: string): string {
    const digits = (n || '').replace(/[^0-9]/g, '');
    if (!digits) return '';
    return new Intl.NumberFormat('es-CO').format(Number(digits));
  }

  const canSubmit = useMemo(() => {
    const amtOk = parseCurrency(amount) > 0;
    const d1 = !!issueDate && !isNaN(Date.parse(issueDate));
    const d2 = !!dueDate && !isNaN(Date.parse(dueDate));
    const orderOk = d1 && d2 ? new Date(issueDate) <= new Date(dueDate) : false;
    return amtOk && d1 && d2 && orderOk && !saving;
  }, [amount, issueDate, dueDate, saving]);

  const load = async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    if (startDate) params.set('start', startDate);
    if (endDate) params.set('end', endDate);
    if (minAmount) params.set('minAmount', String(parseCurrency(minAmount)));
    if (maxAmount) params.set('maxAmount', String(parseCurrency(maxAmount)));
    params.set('sort', sort);
    params.set('limit', String(pageSize));
    params.set('page', String(page));
    const qs = params.toString();
    const res = await fetch(`/api/c/${orgId}/invoices${qs ? `?${qs}` : ''}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Error cargando facturas");
    } else {
      setItems(data.items || []);
      setSelected((prev) => {
        const next: Record<string, boolean> = {};
        for (const it of data.items || []) if (prev[it.id]) next[it.id] = true;
        return next;
      });
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [orgId, statusFilter, startDate, endDate, minAmount, maxAmount, sort, page, pageSize]);

  

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    let uploadedPath: string | null = null;

    // Validación por si acaso
    if (!issueDate || !dueDate) {
      setSaving(false);
      setError('Completa las fechas');
      toast.error('Completa las fechas');
      return;
    }
    if (new Date(issueDate) > new Date(dueDate)) {
      setSaving(false);
      setError('La fecha de vencimiento debe ser posterior a la de emisión');
      toast.error('La fecha de vencimiento debe ser posterior a la de emisión');
      return;
    }

    try {
      if (file) {
        const supabase = createClientComponentClient();
        const ext = file.name.split('.').pop();
        const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
        const key = `${orgId}/${id}.${ext ?? 'bin'}`;
        const { error: upErr } = await supabase.storage
          .from('invoices')
          .upload(key, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        uploadedPath = key;
      }
    } catch (err: unknown) {
      setSaving(false);
      const msg = err instanceof Error ? err.message : 'Error subiendo archivo';
      setError(msg);
      toast.error(msg);
      return;
    }

    const payload = {
      amount: parseCurrency(amount),
      issue_date: issueDate,
      due_date: dueDate,
      file_path: uploadedPath,
    };
    const res = await fetch(`/api/c/${orgId}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error || "Error creando factura";
      setError(msg);
      toast.error(msg);
    } else {
      setAmount("");
      setIssueDate("");
      setDueDate("");
      await load();
      setFile(null);
      toast.success("Factura creada");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="font-colette text-2xl font-bold text-lp-primary-1">Facturas</h1>

      <Toaster richColors />
      {/* Filtros */}
      <div className="rounded-md border border-lp-sec-4/60 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <Label className="mb-2">Estado</Label>
            <select className="w-full rounded-md border border-lp-sec-4/60 px-3 py-2" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">— Todos —</option>
              <option value="uploaded">Cargada</option>
              <option value="funded">Desembolsada</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-2">Emisión desde</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-2">Emisión hasta</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="sm:col-span-3">
            <Label className="mb-2">Monto mínimo</Label>
            <Input placeholder="Ej: 1.000.000" value={minAmount} onChange={(e) => setMinAmount(formatCurrency(e.target.value))} />
          </div>
          <div className="sm:col-span-3">
            <Label className="mb-2">Monto máximo</Label>
            <Input placeholder="Ej: 50.000.000" value={maxAmount} onChange={(e) => setMaxAmount(formatCurrency(e.target.value))} />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-2">Orden</Label>
            <select className="w-full rounded-md border border-lp-sec-4/60 px-3 py-2" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="created_at.desc">Recientes primero</option>
              <option value="created_at.asc">Antiguas primero</option>
              <option value="amount.desc">Monto (mayor a menor)</option>
              <option value="amount.asc">Monto (menor a mayor)</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-2">Tamaño de página</Label>
            <select className="w-full rounded-md border border-lp-sec-4/60 px-3 py-2" value={pageSize} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <div className="text-lp-sec-3">Resultados: {total}</div>
          <button type="button" className="underline" onClick={() => { setStatusFilter('all'); setStartDate(''); setEndDate(''); setMinAmount(''); setMaxAmount(''); setSort('created_at.desc'); setPage(1); setPageSize(10); }}>Limpiar filtros</button>
        </div>
      </div>
      <form onSubmit={onCreate} className="grid grid-cols-1 gap-4 sm:grid-cols-6">
        <div className="sm:col-span-2">
          <Label className="mb-2">Monto (COP)</Label>
          <Input placeholder="Ej: 1.500.000" value={amount} onChange={(e) => setAmount(formatCurrency(e.target.value))} />
        </div>
        <div className="sm:col-span-2">
          <Label className="mb-2">Fecha de emisión</Label>
          <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label className="mb-2">Fecha de vencimiento</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="sm:col-span-3">
          <Label className="mb-2">Archivo (PDF/imagen, opcional)</Label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) setFile(f);
            }}
            className={`rounded-md border border-dashed px-4 py-6 text-sm ${dragOver ? 'border-lp-primary-1 bg-lp-sec-4/50' : 'border-lp-sec-4/60'}`}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                {file ? (
                  <>
                    <div className="font-medium text-lp-primary-1">{file.name}</div>
                    <div className="text-xs text-lp-sec-3">{(file.size/1024/1024).toFixed(2)} MB · {file.type || 'archivo'}</div>
                  </>
                ) : (
                  <>
                    <div className="text-lp-primary-1">Arrastra un archivo aquí o haz clic para seleccionar</div>
                    <div className="text-xs text-lp-sec-3">PDF, JPG, PNG · hasta 10 MB</div>
                  </>
                )}
              </div>
              <label className="cursor-pointer rounded-md bg-lp-primary-1 px-3 py-2 text-xs font-medium text-lp-primary-2 hover:opacity-90">
                Seleccionar
                <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          </div>
        </div>
        <div className="sm:col-span-6">
          <Button type="submit" disabled={!canSubmit} className="bg-lp-primary-1 text-lp-primary-2 hover:opacity-90">
            {saving ? "Creando..." : "Crear factura"}
          </Button>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      </form>

      <CreateRequestFromInvoices orgId={orgId} items={items} selected={selected} setSelected={setSelected} onCreated={async () => { setSelected({}); toast.success('Solicitud creada'); }} />

      <div className="rounded-lg border border-lp-sec-4/60">
        <table className="min-w-full divide-y divide-lp-sec-4/60">
          <thead className="bg-lp-sec-4/30">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">
                <input type="checkbox" aria-label="Seleccionar todas" onChange={(e)=>{ const v=e.target.checked; const next: Record<string, boolean>={}; items.forEach(it=> next[it.id]=v); setSelected(next); }} />
              </th>
              <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Fecha</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Vencimiento</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Monto</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Estado</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Nombre</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Archivo</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-4 py-3 text-sm" colSpan={7}>Cargando...</td></tr>
            ) : items.length === 0 ? (
              <tr><td className="px-4 py-3 text-sm" colSpan={7}>No hay facturas todavía.</td></tr>
            ) : (
              items.map((it) => (
                <tr key={it.id} className="border-t border-lp-sec-4/60">
                  <td className="px-4 py-2 text-sm">
                    <input type="checkbox" checked={!!selected[it.id]} onChange={(e)=> setSelected(prev=>({ ...prev, [it.id]: e.target.checked }))} />
                  </td>
                  <td className="px-4 py-2 text-sm">{it.issue_date}</td>
                  <td className="px-4 py-2 text-sm">{it.due_date}</td>
                  <td className="px-4 py-2 text-sm">${Intl.NumberFormat('es-CO').format(it.amount)}</td>
                  <td className="px-4 py-2 text-sm"><StatusBadge kind="invoice" status={it.status} /></td>
                  <td className="px-4 py-2 text-sm">{basename(it.file_path)}</td>
                  <td className="px-4 py-2 text-sm">
                    <FileLink path={it.file_path ?? null} />
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <RowActions orgId={orgId} invoice={it} onChanged={load} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* Paginación */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-lp-sec-3">Página {page} de {Math.max(1, Math.ceil(total / pageSize))}</div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
          <Button type="button" variant="outline" disabled={page >= Math.ceil(total / pageSize)} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
        </div>
      </div>
    </div>
  );
}

function FileLink({ path }: { path?: string | null }) {
  const [href, setHref] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!path) return;
      const supabase = createClientComponentClient();
      const { data, error } = await supabase.storage.from('invoices').createSignedUrl(path, 60);
      if (!error && mounted) setHref(data?.signedUrl ?? null);
    };
    run();
    return () => { mounted = false; };
  }, [path]);
  if (!path) return <span>—</span>;
  if (!href) return <span>Generando…</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-lp-primary-1 underline">
      Ver
    </a>
  );
}

function basename(path?: string | null) {
  if (!path) return '—';
  const parts = path.split('/');
  return parts[parts.length - 1] || '—';
}

function CreateRequestFromInvoices({ orgId, items, selected, setSelected, onCreated }: { orgId: string; items: Invoice[]; selected: Record<string, boolean>; setSelected: (s: Record<string, boolean>) => void; onCreated: () => void }) {
  const selIds = items.filter(it => selected[it.id]).map(it => it.id);
  const total = items.filter(it => selected[it.id]).reduce((acc, it) => acc + Number(it.amount || 0), 0);
  const disabled = selIds.length === 0;
  const [busy, setBusy] = useState(false);

  const createFromSelected = async () => {
    if (disabled) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/c/${orgId}/requests/from-invoices`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoice_ids: selIds }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo crear solicitud');
      onCreated();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error';
      toast.error(msg);
    } finally { setBusy(false); }
  };

  return (
    <div className="mb-3 flex items-center justify-between rounded-md border border-dashed border-lp-sec-4/60 p-3 text-sm">
      <div className="text-lp-sec-3">
        Seleccionadas: <span className="font-medium text-lp-primary-1">{selIds.length}</span>
        {' '}· Monto total: <span className="font-medium text-lp-primary-1">${Intl.NumberFormat('es-CO').format(total)}</span>
      </div>
      <div className="space-x-2">
        <Button type="button" variant="outline" onClick={() => setSelected({})} disabled={busy || disabled}>Limpiar selección</Button>
        <Button type="button" onClick={createFromSelected} disabled={busy || disabled} className="bg-lp-primary-1 text-lp-primary-2 hover:opacity-90">
          {busy ? 'Creando...' : 'Crear solicitud con seleccionadas'}
        </Button>
      </div>
    </div>
  );
}

function RowActions({ orgId, invoice, onChanged }: { orgId: string; invoice: Invoice; onChanged: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onDelete = async () => {
    if (!invoice.file_path) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/c/${orgId}/invoices/${invoice.id}/file`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar archivo');
      toast.success('Archivo eliminado');
      await onChanged();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error eliminando archivo';
      setErr(msg); toast.error(msg);
    } finally { setBusy(false); }
  };

  const onDeleteInvoice = async () => {
    if (!confirm('¿Eliminar factura completa? Esta acción no se puede deshacer.')) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/c/${orgId}/invoices/${invoice.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar');
      toast.success('Factura eliminada');
      await onChanged();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error eliminando factura';
      setErr(msg); toast.error(msg);
    } finally { setBusy(false); }
  };

  const onReplace = async (file: File | null) => {
    if (!file) return;
    setBusy(true); setErr(null);
    try {
      const supabase = createClientComponentClient();
      // Subir nuevo
      const ext = file.name.split('.').pop();
      const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
      const key = `${orgId}/${id}.${ext ?? 'bin'}`;
      const { error: upErr1 } = await supabase.storage.from('invoices').upload(key, file, { upsert: false, contentType: file.type });
      if (upErr1) throw upErr1;
      // Actualizar fila en servidor (y borra anterior)
      const res = await fetch(`/api/c/${orgId}/invoices/${invoice.id}/file`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file_path: key }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar archivo');
      toast.success('Archivo actualizado');
      await onChanged();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error reemplazando archivo';
      setErr(msg); toast.error(msg);
    } finally { setBusy(false); }
  };

  const inputId = `file-${invoice.id}`;
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={inputId} className="cursor-pointer text-lp-primary-1 underline opacity-90 hover:opacity-100">
        {invoice.file_path ? 'Reemplazar' : 'Subir archivo'}
      </label>
      {invoice.file_path && (
        <button type="button" className="text-red-700 underline opacity-90 hover:opacity-100" onClick={onDelete} disabled={busy}>
          Eliminar archivo
        </button>
      )}
      <span className="text-lp-sec-3">|</span>
      <button type="button" className="text-red-700 underline opacity-90 hover:opacity-100" onClick={onDeleteInvoice} disabled={busy}>
        Eliminar factura
      </button>
      <input id={inputId} type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => onReplace(e.target.files?.[0] ?? null)} />
      {busy && <span className="text-xs text-lp-sec-3">Procesando…</span>}
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
