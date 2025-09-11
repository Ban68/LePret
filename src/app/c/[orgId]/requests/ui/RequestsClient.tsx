"use client";

import { useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster, toast } from "sonner";
import { StatusBadge } from "@/components/ui/status-badge";

type RequestItem = {
  id: string;
  invoice_id: string | null;
  requested_amount: number;
  status: string;
  created_at: string;
  file_path?: string | null;
  created_by?: string;
};

type Invoice = { id: string; issue_date: string; due_date: string; amount: number };

export function RequestsClient({ orgId }: { orgId: string }) {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState<string>("");
  const [invoiceId, setInvoiceId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [withInvoice, setWithInvoice] = useState<string>('all');
  const [sort, setSort] = useState<string>('created_at.desc');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [total, setTotal] = useState<number>(0);

  const load = async () => {
    setLoading(true);
    setError(null);
    const p = new URLSearchParams();
    if (statusFilter && statusFilter !== 'all') p.set('status', statusFilter);
    if (startDate) p.set('start', startDate);
    if (endDate) p.set('end', endDate);
    if (minAmount) p.set('minAmount', String(parseCurrency(minAmount)));
    if (maxAmount) p.set('maxAmount', String(parseCurrency(maxAmount)));
    if (withInvoice && withInvoice !== 'all') p.set('withInvoice', withInvoice);
    p.set('sort', sort);
    p.set('limit', String(pageSize));
    p.set('page', String(page));
    const qs = p.toString();
    const [r1, r2] = await Promise.all([
      fetch(`/api/c/${orgId}/requests${qs ? `?${qs}` : ''}`),
      fetch(`/api/c/${orgId}/invoices`),
    ]);
    const d1 = await r1.json();
    const d2 = await r2.json();
    if (!r1.ok) setError(d1.error || "Error cargando solicitudes"); else { setItems(d1.items || []); setTotal(d1.total ?? 0); }
    if (r2.ok) setInvoices(d2.items || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [orgId, statusFilter, startDate, endDate, minAmount, maxAmount, withInvoice, sort, page, pageSize]);

  const parseCurrency = (s: string) => Number((s || '').replace(/[^0-9]/g, ''));
  const formatCurrency = (n: string) => {
    const digits = (n || '').replace(/[^0-9]/g, '');
    if (!digits) return '';
    return new Intl.NumberFormat('es-CO').format(Number(digits));
  };

  const canSubmit = useMemo(() => {
    const amtOk = amount !== "" && !isNaN(parseCurrency(amount)) && parseCurrency(amount) > 0;
    return amtOk && !saving;
  }, [amount, saving]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    let uploadedPath: string | null = null;
    try {
      if (file) {
        const supabase = createClientComponentClient();
        const ext = file.name.split('.').pop();
        const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : Math.random().toString(36).slice(2);
        const key = `${orgId}/${id}.${ext ?? 'bin'}`;
        const { error: upErr } = await supabase.storage.from('requests').upload(key, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        uploadedPath = key;
      }
    } catch (e: any) {
      setSaving(false); setError(e?.message || 'Error subiendo archivo'); toast.error(e?.message || 'Error subiendo archivo'); return;
    }

    const payload: any = { requested_amount: parseCurrency(amount) };
    if (invoiceId) payload.invoice_id = invoiceId;
    if (uploadedPath) payload.file_path = uploadedPath;
    const res = await fetch(`/api/c/${orgId}/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error || "Error creando solicitud";
      setError(msg); toast.error(msg);
    } else {
      setAmount(""); setInvoiceId(""); setFile(null);
      await load(); toast.success('Solicitud creada');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="font-colette text-2xl font-bold text-lp-primary-1">Solicitudes</h1>

      <Toaster richColors />
      {/* Filtros */}
      <div className="rounded-md border border-lp-sec-4/60 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <Label className="mb-2">Estado</Label>
            <select className="w-full rounded-md border border-lp-sec-4/60 px-3 py-2" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">— Todos —</option>
              <option value="review">En revisión</option>
              <option value="offered">Ofertada</option>
              <option value="accepted">Aceptada</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-2">Desde</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-2">Hasta</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-2">Monto mínimo</Label>
            <Input placeholder="Ej: 500.000" value={minAmount} onChange={(e) => setMinAmount(formatCurrency(e.target.value))} />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-2">Monto máximo</Label>
            <Input placeholder="Ej: 50.000.000" value={maxAmount} onChange={(e) => setMaxAmount(formatCurrency(e.target.value))} />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-2">Con factura</Label>
            <select className="w-full rounded-md border border-lp-sec-4/60 px-3 py-2" value={withInvoice} onChange={(e) => setWithInvoice(e.target.value)}>
              <option value="all">— Todas —</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-2">Orden</Label>
            <select className="w-full rounded-md border border-lp-sec-4/60 px-3 py-2" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="created_at.desc">Recientes primero</option>
              <option value="created_at.asc">Antiguas primero</option>
              <option value="requested_amount.desc">Monto (mayor a menor)</option>
              <option value="requested_amount.asc">Monto (menor a mayor)</option>
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
          <button
            type="button"
            className="underline"
            onClick={() => { setStatusFilter('all'); setStartDate(''); setEndDate(''); setMinAmount(''); setMaxAmount(''); setWithInvoice('all'); setSort('created_at.desc'); setPage(1); setPageSize(10); }}
          >
            Limpiar filtros
          </button>
        </div>
      </div>
      <form onSubmit={onCreate} className="grid grid-cols-1 gap-4 sm:grid-cols-6">
        <div className="sm:col-span-3">
          <Label className="mb-2">Monto solicitado (COP)</Label>
          <Input placeholder="Ej: 8.000.000" value={amount} onChange={(e) => setAmount(formatCurrency(e.target.value))} />
        </div>
        <div className="sm:col-span-3">
          <Label className="mb-2">Factura asociada (opcional)</Label>
          <select className="w-full rounded-md border border-lp-sec-4/60 px-3 py-2" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
            <option value="">— Ninguna —</option>
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.issue_date} · vence {inv.due_date} · ${Intl.NumberFormat('es-CO').format(inv.amount)}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-6">
          <Label className="mb-2">Documento soporte (opcional)</Label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); }}
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
            {saving ? "Creando..." : "Crear solicitud"}
          </Button>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      </form>

      <div className="rounded-lg border border-lp-sec-4/60">
        <table className="min-w-full divide-y divide-lp-sec-4/60">
          <thead className="bg-lp-sec-4/30">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Creada</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Monto</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Factura</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Soporte</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Estado</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-lp-sec-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-4 py-3 text-sm" colSpan={4}>Cargando...</td></tr>
            ) : items.length === 0 ? (
              <tr><td className="px-4 py-3 text-sm" colSpan={4}>No hay solicitudes todavía.</td></tr>
            ) : (
              items.map((it) => (
                <RequestRow key={it.id} orgId={orgId} req={it} onChanged={load} />
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

function RequestRow({ orgId, req, onChanged }: { orgId: string; req: RequestItem; onChanged: () => Promise<void> | void }) {
  const [editing, setEditing] = useState(false);
  const [amt, setAmt] = useState(new Intl.NumberFormat('es-CO').format(req.requested_amount));
  const [invId, setInvId] = useState(req.invoice_id || "");
  const [busy, setBusy] = useState(false);
  const supabase = createClientComponentClient();

  const parseCurrency = (s: string) => Number((s || '').replace(/[^0-9]/g, ''));
  const onSave = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/c/${orgId}/requests/${req.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requested_amount: parseCurrency(amt), invoice_id: invId || null }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar');
      toast.success('Solicitud actualizada');
      setEditing(false);
      await onChanged();
    } catch (e: any) {
      toast.error(e?.message || 'Error');
    } finally { setBusy(false); }
  };

  const onDelete = async () => {
    if (!confirm('¿Eliminar solicitud?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/c/${orgId}/requests/${req.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar');
      toast.success('Solicitud eliminada');
      await onChanged();
    } catch (e: any) {
      toast.error(e?.message || 'Error');
    } finally { setBusy(false); }
  };

  const onReplace = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const ext = file.name.split('.').pop();
      const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      const key = `${orgId}/${id}.${ext ?? 'bin'}`;
      const { error: upErr } = await supabase.storage.from('requests').upload(key, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const res = await fetch(`/api/c/${orgId}/requests/${req.id}/file`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file_path: key }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar archivo');
      toast.success('Archivo actualizado');
      await onChanged();
    } catch (e: any) {
      toast.error(e?.message || 'Error');
    } finally { setBusy(false); }
  };

  const onDeleteFile = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/c/${orgId}/requests/${req.id}/file`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar archivo');
      toast.success('Archivo eliminado');
      await onChanged();
    } catch (e: any) {
      toast.error(e?.message || 'Error');
    } finally { setBusy(false); }
  };

  return (
    <tr className="border-t border-lp-sec-4/60">
      <td className="px-4 py-2 text-sm">{new Date(req.created_at).toLocaleDateString()}</td>
      <td className="px-4 py-2 text-sm">${Intl.NumberFormat('es-CO').format(req.requested_amount)}</td>
      <td className="px-4 py-2 text-sm">{req.invoice_id || '—'}</td>
      <td className="px-4 py-2 text-sm">{req.file_path ? basename(req.file_path) : '—'}</td>
      <td className="px-4 py-2 text-sm"><StatusBadge kind="request" status={req.status} /></td>
      <td className="px-4 py-2 text-sm">
        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input className="w-36" value={amt} onChange={(e) => setAmt(e.target.value)} />
            <Input className="w-48" placeholder="Factura (ID) opcional" value={invId} onChange={(e) => setInvId(e.target.value)} />
            <Button size="sm" onClick={onSave} disabled={busy}>Guardar</Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={busy}>Cancelar</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button className="underline" onClick={() => setEditing(true)}>Editar</button>
            <span className="text-lp-sec-3">|</span>
            <button className="text-red-700 underline" onClick={onDelete} disabled={busy}>Eliminar</button>
            <span className="text-lp-sec-3">|</span>
            <label className="underline cursor-pointer">
              {req.file_path ? 'Reemplazar soporte' : 'Subir soporte'}
              <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => onReplace(e.target.files?.[0] ?? null)} />
            </label>
            {req.file_path && (
              <>
                <span className="text-lp-sec-3">|</span>
                <button className="text-red-700 underline" onClick={onDeleteFile} disabled={busy}>Eliminar soporte</button>
              </>
            )}
            <span className="text-lp-sec-3">|</span>
            <OfferActions orgId={orgId} requestId={req.id} status={req.status} onChanged={onChanged} />
          </div>
        )}
      </td>
    </tr>
  );
}

function basename(path?: string | null) {
  if (!path) return '—';
  const parts = path.split('/');
  return parts[parts.length - 1] || '—';
}

function OfferActions({ orgId, requestId, status, onChanged }: { orgId: string; requestId: string; status: string; onChanged: () => Promise<void> | void }) {
  const [offer, setOffer] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const loadOffer = async () => {
    setLoading(true);
    const res = await fetch(`/api/c/${orgId}/requests/${requestId}/offer`);
    const data = await res.json();
    if (res.ok) setOffer(data.offer || null);
    setLoading(false);
  };

  useEffect(() => {
    loadOffer();
  }, [orgId, requestId]);

  const generate = async () => {
    setLoading(true);
    const res = await fetch(`/api/c/${orgId}/requests/${requestId}/offer`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'No se pudo generar oferta'); } else { setOffer(data.offer); toast.success('Oferta generada'); await onChanged(); }
    setLoading(false);
  };

  const accept = async () => {
    if (!offer) return;
    setLoading(true);
    const res = await fetch(`/api/offers/${offer.id}/accept`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'No se pudo aceptar'); } else { toast.success('Oferta aceptada'); await onChanged(); await loadOffer(); }
    setLoading(false);
  };

  if (loading) return <span>Cargando oferta…</span>;
  if (!offer) return <button className="underline" onClick={generate} disabled={loading || status === 'accepted'}>Generar oferta</button>;

  const rate = (offer.annual_rate * 100).toFixed(2);
  const adv = Number(offer.advance_pct).toFixed(0);
  const net = Intl.NumberFormat('es-CO').format(Number(offer.net_amount || 0));
  const expires = offer.valid_until ? new Date(offer.valid_until).toLocaleDateString() : '—';

  return (
    <>
      <span className="text-lp-sec-3">Oferta: {rate}% EA · Anticipo {adv}% · Neto ${net} · Vence {expires}</span>
      {offer.status === 'offered' && (
        <>
          <span className="text-lp-sec-3">|</span>
          <button className="underline" onClick={accept}>Aceptar</button>
        </>
      )}
    </>
  );
}
