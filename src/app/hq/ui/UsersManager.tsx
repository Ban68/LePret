"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = {
  all: "Todos",
  staff: "Backoffice",
  client: "Clientes",
};

const ROLE_OPTIONS = [
  { value: "OWNER", label: "Owner" },
  { value: "ADMIN", label: "Admin" },
  { value: "OPERATOR", label: "Operator" },
  { value: "VIEWER", label: "Viewer" },
];

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Activa" },
  { value: "INVITED", label: "Invitado" },
  { value: "DISABLED", label: "Suspendida" },
];

type CompanyOption = {
  id: string;
  name: string;
  type: string;
};

type MembershipInfo = {
  company_id: string;
  company_name: string | null;
  role: string;
  status: string;
};

type UserEntry = {
  id: string;
  email: string | null;
  full_name: string | null;
  is_staff: boolean;
  created_at: string | null;
  last_sign_in_at: string | null;
  companies: MembershipInfo[];
};

type UsersManagerProps = {
  companies: CompanyOption[];
};

export function UsersManager({ companies }: UsersManagerProps) {
  const [items, setItems] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [selected, setSelected] = useState<UserEntry | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [creationOpen, setCreationOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (companyFilter !== "all") params.set("company", companyFilter);
    if (search.trim().length) params.set("search", search.trim());

    const qs = params.toString();

    try {
      const response = await fetch(`/api/hq/users${qs ? `?${qs}` : ""}`, {
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudieron obtener los usuarios");
      }
      const list = (payload?.users || []) as UserEntry[];
      setItems(list);
      setSelected((prev) => {
        if (!prev) return prev;
        const updated = list.find((user) => user.id === prev.id) || null;
        if (!updated) {
          setDrawerOpen(false);
        }
        return updated;
      });
    } catch (err) {
      if ((err as { name?: string } | null)?.name === "AbortError") {
        return;
      }
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, companyFilter, search]);

  useEffect(() => {
    load().catch(() => null);
    return () => {
      abortRef.current?.abort();
    };
  }, [load]);

  const summary = useMemo(() => {
    const total = items.length;
    const backoffice = items.filter((item) => item.is_staff).length;
    const clients = total - backoffice;
    return { total, backoffice, clients };
  }, [items]);

  const handleManage = (user: UserEntry) => {
    setSelected(user);
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setSelected(null);
  };

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return (
    <section className="rounded-lg border border-lp-sec-4/60 bg-white p-5 shadow-sm">
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-lp-primary-1">Usuarios y permisos</h2>
          <p className="text-sm text-lp-sec-3">
            Administra accesos de clientes y del equipo backoffice. Puedes crear usuarios, ajustar roles y revocar invitaciones desde aqui.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div className="flex gap-2 text-center text-xs">
            <div className="rounded-md border border-lp-sec-4/60 px-3 py-2">
              <div className="text-lp-sec-3">Total</div>
              <div className="text-base font-semibold text-lp-primary-1">{summary.total}</div>
            </div>
            <div className="rounded-md border border-lp-sec-4/60 px-3 py-2">
              <div className="text-lp-sec-3">Backoffice</div>
              <div className="text-base font-semibold text-lp-primary-1">{summary.backoffice}</div>
            </div>
            <div className="rounded-md border border-lp-sec-4/60 px-3 py-2">
              <div className="text-lp-sec-3">Clientes</div>
              <div className="text-base font-semibold text-lp-primary-1">{summary.clients}</div>
            </div>
          </div>
          <Button size="sm" onClick={() => setCreationOpen(true)}>
            Nuevo usuario
          </Button>
        </div>
      </header>

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-lp-sec-3">Tipo de usuario</label>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="w-full rounded-md border border-lp-sec-4/80 bg-white px-2 py-2 text-sm"
          >
            {Object.entries(TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-lp-sec-3">Organizacion</label>
          <select
            value={companyFilter}
            onChange={(event) => setCompanyFilter(event.target.value)}
            className="w-full rounded-md border border-lp-sec-4/80 bg-white px-2 py-2 text-sm"
          >
            <option value="all">Todas</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-lp-sec-3">Buscar</label>
          <Input
            placeholder="Nombre, email u organizacion"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>
      {loading ? (
        <div className="rounded-md border border-dashed border-lp-sec-4/60 p-4 text-sm text-lp-sec-3">
          Cargando usuarios...
        </div>
      ) : error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-lp-sec-4/60 p-4 text-sm text-lp-sec-3">
          No hay usuarios que coincidan con los filtros seleccionados.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-lp-sec-4/80 text-sm">
            <thead className="bg-lp-sec-4/40 text-xs uppercase tracking-wide text-lp-sec-3">
              <tr>
                <th className="px-3 py-2 text-left">Usuario</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Organizaciones</th>
                <th className="px-3 py-2 text-left">Ultimo acceso</th>
                <th className="px-3 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lp-sec-4/80">
              {items.map((user) => (
                <tr key={user.id} className="bg-white">
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium text-lp-primary-1">{user.full_name || "Sin nombre"}</div>
                    <div className="text-xs text-lp-sec-3">ID: {truncateId(user.id)}</div>
                  </td>
                  <td className="px-3 py-2 align-top text-lp-primary-1">{user.email || "-"}</td>
                  <td className="px-3 py-2 align-top">
                    <span
                      className={cn(
                        "rounded-full px-2 py-1 text-xs font-medium",
                        user.is_staff ? "bg-lp-primary-1/10 text-lp-primary-1" : "bg-amber-50 text-amber-700",
                      )}
                    >
                      {user.is_staff ? "Backoffice" : "Cliente"}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    {user.companies.length === 0 ? (
                      <span className="text-xs text-lp-sec-3">Sin asignacion</span>
                    ) : (
                      <ul className="space-y-1 text-xs text-lp-primary-1">
                        {user.companies.map((membership) => (
                          <li key={`${user.id}-${membership.company_id}`}>
                            <span className="font-medium">{membership.company_name || membership.company_id}</span>
                            <span className="text-lp-sec-3"> | {membership.role.toLowerCase()} ({membership.status.toLowerCase()})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-lp-sec-3">
                    {formatDateTime(user.last_sign_in_at) || formatDateTime(user.created_at) || "-"}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleManage(user)}
                    >
                      Gestionar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ManageUserDrawer
        open={drawerOpen && !!selected}
        user={selected}
        companies={companies}
        onClose={handleDrawerClose}
        onUpdated={refresh}
        onRemoved={refresh}
      />

      <CreateUserDialog
        open={creationOpen}
        companies={companies}
        onClose={() => setCreationOpen(false)}
        onCreated={async () => {
          await refresh();
          setCreationOpen(false);
        }}
      />
    </section>
  );
}

type ManageUserDrawerProps = {
  open: boolean;
  user: UserEntry | null;
  companies: CompanyOption[];
  onClose: () => void;
  onUpdated: () => Promise<void> | void;
  onRemoved: () => Promise<void> | void;
};

function ManageUserDrawer({ open, user, companies, onClose, onUpdated, onRemoved }: ManageUserDrawerProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState<string>(user?.full_name || "");
  const [showAdd, setShowAdd] = useState(false);
  const [newMembership, setNewMembership] = useState<{ company_id: string; role: string; status: string } | null>(null);

  useEffect(() => {
    if (user) {
      setNameDraft(user.full_name || "");
      setShowAdd(false);
      setNewMembership(null);
    }
  }, [user]);

  const availableCompanies = useMemo(() => {
    if (!user) return companies;
    const assigned = new Set(user.companies.map((membership) => membership.company_id));
    return companies.filter((company) => !assigned.has(company.id));
  }, [companies, user]);

  if (!open || !user) {
    return null;
  }

  const runPatch = async (payload: Record<string, unknown>, actionKey: string) => {
    setBusy(actionKey);
    try {
      const response = await fetch("/api/hq/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, ...payload }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo actualizar el usuario");
      }
      toast.success("Cambios guardados");
      await onUpdated();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const handleToggleStaff = async () => {
    const nextValue = !user.is_staff;
    if (nextValue && user.companies.length > 0) {
      const confirmed = confirm("Al convertir este usuario en backoffice se eliminaran sus organizaciones asignadas. Continuar?");
      if (!confirmed) {
        return;
      }
    }
    await runPatch({ is_staff: nextValue }, "staff");
  };

  const handleResendInvite = async () => {
    await runPatch({ invite: true }, "invite");
  };

  const handleNameBlur = async () => {
    if ((user.full_name || "") === nameDraft.trim()) {
      return;
    }
    await runPatch({ full_name: nameDraft.trim() || null }, "name");
  };

  const handleMembershipUpdate = async (membership: MembershipInfo, next: { role?: string; status?: string }) => {
    const role = next.role ?? membership.role;
    const status = next.status ?? membership.status;
    await runPatch({ companies: [{ company_id: membership.company_id, role, status }] }, `membership-${membership.company_id}`);
  };

  const handleMembershipRemove = async (companyId: string) => {
    if (!confirm("Eliminar la membresia de esta organizacion?")) {
      return;
    }
    await runPatch({ remove: [companyId] }, `remove-${companyId}`);
    await onRemoved();
  };

  const handleDelete = async () => {
    if (!confirm("Eliminar este usuario? La accion no se puede deshacer.")) {
      return;
    }
    setBusy("delete");
    try {
      const response = await fetch(`/api/hq/users?id=${user.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, hard_delete: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo eliminar al usuario");
      }
      toast.success("Usuario eliminado");
      await onRemoved();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const handleAddMembership = async () => {
    if (!newMembership || !newMembership.company_id) {
      toast.error("Selecciona una organizacion");
      return;
    }
    await runPatch({ companies: [newMembership] }, "add-membership");
    setShowAdd(false);
    setNewMembership(null);
  };

  return (
    <div className="fixed inset-0 z-60 flex justify-end bg-black/40 px-4 py-6" role="dialog" aria-modal="true">
      <div
        className="h-full w-full max-w-md overflow-y-auto rounded-lg bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-lp-sec-4/60 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-lp-primary-1">Gestionar usuario</h3>
            <p className="text-xs text-lp-sec-3">ID {truncateId(user.id)}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>

        <div className="space-y-6 px-6 py-5 text-sm">
          <section className="space-y-3">
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-lp-sec-3">Nombre</label>
              <Input
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={handleNameBlur}
                placeholder="Nombre completo"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-lp-sec-3">Correo</label>
              <div className="font-medium text-lp-primary-1">{user.email || "Sin email"}</div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" variant="outline" disabled={busy === "staff"} onClick={handleToggleStaff}>
                {user.is_staff ? "Marcar como cliente" : "Marcar como backoffice"}
              </Button>
              <Button size="sm" variant="outline" disabled={busy === "invite"} onClick={handleResendInvite}>
                Reenviar invitacion
              </Button>
              <span className="text-xs text-lp-sec-3">
                Ultimo acceso: {formatDateTime(user.last_sign_in_at) || "-"}
              </span>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-lp-primary-1">Organizaciones</h4>
              {!user.is_staff && !showAdd && availableCompanies.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowAdd(true);
                    setNewMembership({
                      company_id: availableCompanies[0]?.id || "",
                      role: "VIEWER",
                      status: "INVITED",
                    });
                  }}
                >
                  Anadir
                </Button>
              )}
            </div>

            {user.is_staff ? (
              <p className="text-xs text-lp-sec-3">
                Los usuarios backoffice no pueden tener organizaciones asignadas.
              </p>
            ) : (
              <Fragment>
                {user.companies.length === 0 && (
                  <p className="text-xs text-lp-sec-3">Sin asignacion activa.</p>
                )}

                {user.companies.map((membership) => (
                  <div key={membership.company_id} className="rounded-md border border-lp-sec-4/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium text-lp-primary-1">
                        {membership.company_name || membership.company_id}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          disabled={busy?.startsWith("remove-")}
                          onClick={() => handleMembershipRemove(membership.company_id)}
                        >
                          Quitar
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wide text-lp-sec-3">Rol</label>
                        <select
                          className="mt-1 w-full rounded-md border border-lp-sec-4/80 px-2 py-2 text-sm"
                          value={membership.role}
                          onChange={(event) =>
                            handleMembershipUpdate(membership, { role: event.target.value })
                          }
                        >
                          {ROLE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wide text-lp-sec-3">Estado</label>
                        <select
                          className="mt-1 w-full rounded-md border border-lp-sec-4/80 px-2 py-2 text-sm"
                          value={membership.status}
                          onChange={(event) =>
                            handleMembershipUpdate(membership, { status: event.target.value })
                          }
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}

                {showAdd && newMembership && (
                  <div className="rounded-md border border-dashed border-lp-sec-4/60 p-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-lp-sec-3">Organizacion</label>
                        <select
                          className="mt-1 w-full rounded-md border border-lp-sec-4/80 px-2 py-2 text-sm"
                          value={newMembership.company_id}
                          onChange={(event) =>
                            setNewMembership((prev) =>
                              prev ? { ...prev, company_id: event.target.value } : prev,
                            )
                          }
                        >
                          {availableCompanies.length === 0 && <option value="">Sin opciones</option>}
                          {availableCompanies.map((company) => (
                            <option key={company.id} value={company.id}>
                              {company.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wide text-lp-sec-3">Rol</label>
                        <select
                          className="mt-1 w-full rounded-md border border-lp-sec-4/80 px-2 py-2 text-sm"
                          value={newMembership.role}
                          onChange={(event) =>
                            setNewMembership((prev) =>
                              prev ? { ...prev, role: event.target.value } : prev,
                            )
                          }
                        >
                          {ROLE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-lp-sec-3">Estado</label>
                        <select
                          className="mt-1 w-full rounded-md border border-lp-sec-4/80 px-2 py-2 text-sm"
                          value={newMembership.status}
                          onChange={(event) =>
                            setNewMembership((prev) =>
                              prev ? { ...prev, status: event.target.value } : prev,
                            )
                          }
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-end gap-2">
                        <Button size="sm" onClick={handleAddMembership} disabled={busy === "add-membership"}>
                          Guardar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </Fragment>
            )}
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-red-600">Acciones peligrosas</h4>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDelete}
              disabled={busy === "delete"}
            >
              Eliminar usuario
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}

type CreateUserDialogProps = {
  open: boolean;
  companies: CompanyOption[];
  onClose: () => void;
  onCreated: () => Promise<void> | void;
};

type MembershipDraft = { company_id: string; role: string; status: string };

function CreateUserDialog({ open, companies, onClose, onCreated }: CreateUserDialogProps) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [type, setType] = useState("client");
  const [memberships, setMemberships] = useState<MembershipDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setFullName("");
      setType("client");
      setMemberships([]);
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (type === "staff" && memberships.length > 0) {
      setMemberships([]);
    }
  }, [type, memberships.length]);

  if (!open) {
    return null;
  }

  const addMembership = () => {
    const existing = new Set(memberships.map((membership) => membership.company_id));
    const available = companies.find((company) => !existing.has(company.id));
    if (!available) {
      toast.error("No quedan organizaciones disponibles");
      return;
    }
    setMemberships((prev) => [
      ...prev,
      { company_id: available.id, role: "VIEWER", status: "INVITED" },
    ]);
  };

  const updateMembership = (index: number, patch: Partial<MembershipDraft>) => {
    setMemberships((prev) =>
      prev.map((membership, position) => (position === index ? { ...membership, ...patch } : membership)),
    );
  };

  const removeMembership = (index: number) => {
    setMemberships((prev) => prev.filter((_, position) => position !== index));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      toast.error("El correo es obligatorio");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/hq/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          full_name: fullName.trim() || undefined,
          type,
          invite: true,
          companies: type === "staff" ? [] : memberships,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo crear el usuario");
      }
      toast.success("Usuario creado y invitado");
      await onCreated();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg space-y-5 rounded-lg bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-lp-primary-1">Nuevo usuario</h3>
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>
            Cerrar
          </Button>
        </div>

        <div className="grid gap-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-lp-sec-3">Correo</label>
            <Input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nombre@empresa.com"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-lp-sec-3">Nombre completo</label>
            <Input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-lp-sec-3">Tipo de usuario</label>
            <div className="mt-2 flex gap-4 text-sm">
              <label className="flex cursor-pointer items-center gap-2 text-lp-primary-1">
                <input
                  type="radio"
                  name="user-type"
                  value="client"
                  checked={type === "client"}
                  onChange={(event) => setType(event.target.value)}
                />
                Cliente
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-lp-primary-1">
                <input
                  type="radio"
                  name="user-type"
                  value="staff"
                  checked={type === "staff"}
                  onChange={(event) => setType(event.target.value)}
                />
                Backoffice
              </label>
            </div>
          </div>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-lp-primary-1">Organizaciones</h4>
            {type !== "staff" && (
              <Button type="button" size="sm" variant="outline" onClick={addMembership}>
                Anadir organizacion
              </Button>
            )}
          </div>
          {type === "staff" ? (
            <p className="text-xs text-lp-sec-3">
              Los usuarios backoffice no pueden tener organizaciones asignadas.
            </p>
          ) : (
            <Fragment>
              {memberships.length === 0 && (
                <p className="text-xs text-lp-sec-3">Opcional. Puedes asignar organizaciones despues.</p>
              )}
              <div className="space-y-3">
                {memberships.map((membership, index) => (
                  <div key={membership.company_id + index} className="rounded-md border border-lp-sec-4/60 p-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-lp-sec-3">Organizacion</label>
                        <select
                          className="mt-1 w-full rounded-md border border-lp-sec-4/80 px-2 py-2 text-sm"
                          value={membership.company_id}
                          onChange={(event) => updateMembership(index, { company_id: event.target.value })}
                        >
                          {companies.map((company) => (
                            <option key={company.id} value={company.id}>
                              {company.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wide text-lp-sec-3">Rol</label>
                        <select
                          className="mt-1 w-full rounded-md border border-lp-sec-4/80 px-2 py-2 text-sm"
                          value={membership.role}
                          onChange={(event) => updateMembership(index, { role: event.target.value })}
                        >
                          {ROLE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wide text-lp-sec-3">Estado</label>
                        <select
                          className="mt-1 w-full rounded-md border border-lp-sec-4/80 px-2 py-2 text-sm"
                          value={membership.status}
                          onChange={(event) => updateMembership(index, { status: event.target.value })}
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="mt-3 text-right">
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeMembership(index)}>
                        Quitar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Fragment>
          )}
        </section>

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creando..." : "Crear e invitar"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function truncateId(value: string): string {
  if (value.length <= 8) {
    return value;
  }
  return `${value.slice(0, 4)}...${value.slice(-3)}`;
}

function formatDateTime(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

