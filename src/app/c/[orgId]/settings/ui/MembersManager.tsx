"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ROLE_OPTIONS = [
  { value: "OWNER", label: "Owner" },
  { value: "ADMIN", label: "Admin" },
  { value: "OPERATOR", label: "Operador" },
  { value: "VIEWER", label: "Consulta" },
] as const;

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Activa" },
  { value: "INVITED", label: "Invitado" },
  { value: "DISABLED", label: "Suspendida" },
] as const;

type MemberItem = {
  user_id: string;
  full_name: string | null;
  role: string;
  status: string;
};

type MembersResponse = {
  ok: boolean;
  items?: MemberItem[];
  canEdit?: boolean;
  error?: string;
};

type MutationResponse = {
  ok: boolean;
  membership?: MemberItem;
  error?: string;
};

type MembersManagerProps = {
  orgId: string;
};

export function MembersManager({ orgId }: MembersManagerProps) {
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  const [adding, setAdding] = useState(false);
  const [newIdentifier, setNewIdentifier] = useState("");
  const [newRole, setNewRole] = useState<string>("VIEWER");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/c/${orgId}/memberships`);
      const data: MembersResponse = await res.json().catch(() => ({ ok: false, error: "No se pudo leer la respuesta" }));
      if (!res.ok || !data.ok || !Array.isArray(data.items)) {
        throw new Error(data.error || "No se pudieron cargar los miembros");
      }
      setMembers(data.items);
      setCanEdit(Boolean(data.canEdit));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load().catch(() => null);
  }, [load]);

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => a.full_name?.localeCompare(b.full_name ?? "") || a.role.localeCompare(b.role));
  }, [members]);

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      const res = await fetch(`/api/c/${orgId}/memberships`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, role }),
      });
      const data: MutationResponse = await res.json().catch(() => ({ ok: false, error: "No se pudo leer la respuesta" }));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo actualizar el rol");
      }
      toast.success("Rol actualizado");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      toast.error(message);
    }
  };

  const handleStatusChange = async (userId: string, status: string) => {
    try {
      const res = await fetch(`/api/c/${orgId}/memberships`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, status }),
      });
      const data: MutationResponse = await res.json().catch(() => ({ ok: false, error: "No se pudo leer la respuesta" }));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo actualizar el estado");
      }
      toast.success("Estado actualizado");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      toast.error(message);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm("¿Eliminar el acceso de este miembro?")) {
      return;
    }
    try {
      const res = await fetch(`/api/c/${orgId}/memberships`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json().catch(() => ({ ok: false, error: "No se pudo leer la respuesta" }));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo eliminar el miembro");
      }
      toast.success("Miembro eliminado");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      toast.error(message);
    }
  };

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newIdentifier.trim()) {
      toast.error("Ingresa un correo o identificador de usuario");
      return;
    }
    setAdding(true);
    try {
      const identifier = newIdentifier.trim();
      const body: Record<string, unknown> = { role: newRole };
      if (identifier.includes("@")) {
        body.email = identifier;
      } else {
        body.user_id = identifier;
      }
      const res = await fetch(`/api/c/${orgId}/memberships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: MutationResponse = await res.json().catch(() => ({ ok: false, error: "No se pudo leer la respuesta" }));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo agregar el miembro");
      }
      toast.success("Miembro agregado");
      setNewIdentifier("");
      setNewRole("VIEWER");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      toast.error(message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className="space-y-4 rounded-lg border border-lp-sec-4/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-lp-primary-1">Miembros y roles</h2>
          <p className="text-sm text-lp-sec-3">Gestiona quien puede acceder al portal y qué permisos tiene cada persona.</p>
        </div>
        {!canEdit && (
          <span className="text-xs font-medium uppercase text-lp-sec-3">Solo lectura</span>
        )}
      </div>

      {loading ? (
        <div className="rounded-md border border-dashed border-lp-sec-4/60 p-4 text-sm text-lp-sec-3">Cargando miembros...</div>
      ) : error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : sortedMembers.length === 0 ? (
        <div className="rounded-md border border-dashed border-lp-sec-4/60 p-4 text-sm text-lp-sec-3">
          Aún no hay miembros asignados a esta organización.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-lp-sec-4/80 text-sm">
            <thead className="bg-lp-sec-4/40 text-xs uppercase tracking-wide text-lp-sec-3">
              <tr>
                <th className="px-3 py-2 text-left">Miembro</th>
                <th className="px-3 py-2 text-left">Rol</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lp-sec-4/80">
              {sortedMembers.map((member) => (
                <tr key={member.user_id} className="bg-white">
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium text-lp-primary-1">{member.full_name || "Sin nombre"}</div>
                    <div className="text-xs text-lp-sec-3">ID: {member.user_id.slice(0, 8)}...</div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <select
                      className="w-full rounded-md border border-lp-sec-4/80 px-2 py-2 text-sm"
                      disabled={!canEdit}
                      value={member.role}
                      onChange={(event) => handleRoleChange(member.user_id, event.target.value)}
                    >
                      {ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <select
                      className="w-full rounded-md border border-lp-sec-4/80 px-2 py-2 text-sm"
                      disabled={!canEdit}
                      value={member.status}
                      onChange={(event) => handleStatusChange(member.user_id, event.target.value)}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleRemove(member.user_id)}
                      disabled={!canEdit}
                    >
                      Eliminar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && (
        <form className="space-y-3 rounded-md border border-dashed border-lp-sec-4/60 p-4" onSubmit={handleAdd}>
          <div>
            <h3 className="text-sm font-semibold text-lp-primary-1">Agregar miembro</h3>
            <p className="text-xs text-lp-sec-3">Ingresa el correo electrónico o identificador de un usuario existente para darle acceso.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="member-identifier">Correo o ID de usuario</Label>
              <Input
                id="member-identifier"
                value={newIdentifier}
                onChange={(event) => setNewIdentifier(event.target.value)}
                placeholder="persona@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-role">Rol</Label>
              <select
                id="member-role"
                className="w-full rounded-md border border-lp-sec-4/80 px-2 py-2 text-sm"
                value={newRole}
                onChange={(event) => setNewRole(event.target.value)}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={adding}>
              {adding ? "Agregando..." : "Agregar miembro"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
