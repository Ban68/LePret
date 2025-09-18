"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/input";

const TYPE_LABEL: Record<string, string> = {
  all: "Todos",
  staff: "Backoffice",
  client: "Clientes",
};

type CompanyOption = {
  id: string;
  name: string;
  type: string;
};

type UserEntry = {
  id: string;
  email: string | null;
  full_name: string | null;
  is_staff: boolean;
  created_at: string | null;
  last_sign_in_at: string | null;
  companies: Array<{
    company_id: string;
    company_name: string | null;
    role: string;
    status: string;
  }>;
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
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
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

    async function load() {
      try {
        const response = await fetch(`/api/hq/users${qs ? `?${qs}` : ""}`, {
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || "No se pudieron obtener los usuarios");
        }
        setItems((payload?.users || []) as UserEntry[]);
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
    }

    load().catch(() => null);

    return () => {
      controller.abort();
    };
  }, [typeFilter, companyFilter, search]);

  const summary = useMemo(() => {
    const total = items.length;
    const backoffice = items.filter((item) => item.is_staff).length;
    const clients = total - backoffice;
    return { total, backoffice, clients };
  }, [items]);

  return (
    <section className="rounded-lg border border-lp-sec-4/60 bg-white p-5 shadow-sm">
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-lp-primary-1">Usuarios y permisos</h2>
          <p className="text-sm text-lp-sec-3">
            Administra accesos de clientes y equipo interno. Las acciones de gestion se habilitaran en la siguiente iteracion.
          </p>
        </div>
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
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        user.is_staff
                          ? "bg-lp-primary-1/10 text-lp-primary-1"
                          : "bg-amber-50 text-amber-700"
                      }`}
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
                    <button
                      type="button"
                      className="cursor-not-allowed rounded-md border border-lp-sec-4/60 px-3 py-1 text-xs text-lp-sec-3"
                      disabled
                    >
                      Gestionar (proximo)
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
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