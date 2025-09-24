"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

type Member = { user_id: string; full_name: string | null; email: string | null; role: string; status: string };

export default function CompanyMembersPage() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const res = await fetch(`/api/hq/companies/${companyId}/memberships`);
    const data = await res.json();
    if (!res.ok) setError(data.error || 'Error'); else setMembers(data.members || []);
    setLoading(false);
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const update = async (user_id: string, patch: Partial<Member>) => {
    const res = await fetch(`/api/hq/companies/${companyId}/memberships`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id, ...patch }) });
    const data = await res.json();
    if (!res.ok) alert(data.error || 'Error');
    else load();
  };

  return (
    <div className="py-10">
      <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <h1 className="font-colette text-3xl font-bold text-lp-primary-1">Backoffice — Miembros</h1>
        <p className="mt-2 text-lp-sec-3">Empresa (ID): {companyId}</p>
        <div className="mt-3 flex gap-3">
          <a href={`/c/${companyId}/requests`} className="rounded-md bg-lp-primary-1 px-3 py-2 text-sm font-medium text-lp-primary-2 hover:opacity-90">Abrir portal (Solicitudes)</a>
          <a href={`/c/${companyId}/invoices`} className="rounded-md border border-lp-sec-4/60 px-3 py-2 text-sm font-medium text-lp-primary-1 hover:bg-lp-primary-1 hover:text-lp-primary-2">Abrir portal (Facturas)</a>
        </div>

        {error && <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="mt-6 overflow-x-auto rounded-md border border-lp-sec-4/60">
          <table className="min-w-full divide-y divide-lp-sec-4/60">
            <thead className="bg-lp-sec-4/30">
              <tr>
                <th className="px-4 py-2 text-left text-sm">Usuario</th>
                <th className="px-4 py-2 text-left text-sm">Email</th>
                <th className="px-4 py-2 text-left text-sm">Rol</th>
                <th className="px-4 py-2 text-left text-sm">Estado</th>
                <th className="px-4 py-2 text-left text-sm">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-4 py-3 text-sm" colSpan={5}>Cargando...</td></tr>
              ) : members.length === 0 ? (
                <tr><td className="px-4 py-3 text-sm" colSpan={5}>Sin miembros</td></tr>
              ) : (
                members.map(m => (
                  <tr key={m.user_id} className="border-t border-lp-sec-4/60">
                    <td className="px-4 py-2 text-sm">{m.full_name || m.user_id.slice(0,8)}</td>
                    <td className="px-4 py-2 text-sm">{m.email || '-'}</td>
                    <td className="px-4 py-2 text-sm">
                      <select className="rounded-md border border-lp-sec-4/60 px-2 py-1 text-sm" value={m.role} onChange={(e)=>update(m.user_id, { role: e.target.value })}>
                        <option value="OWNER">OWNER</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="OPERATOR">OPERATOR</option>
                        <option value="VIEWER">VIEWER</option>
                        <option value="client">client</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <select className="rounded-md border border-lp-sec-4/60 px-2 py-1 text-sm" value={m.status} onChange={(e)=>update(m.user_id, { status: e.target.value })}>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="INVITED">INVITED</option>
                        <option value="DISABLED">DISABLED</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <button className="underline" onClick={()=>update(m.user_id, { status: 'ACTIVE' })}>Habilitar</button>
                      <span className="mx-2 text-lp-sec-3">|</span>
                      <button className="underline" onClick={()=>update(m.user_id, { status: 'DISABLED' })}>Deshabilitar</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
