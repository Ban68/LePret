"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export function OrgCreator() {
  const [name, setName] = useState("");
  const [type, setType] = useState<"CLIENT" | "INVESTOR">("CLIENT");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStaffBlocked, setIsStaffBlocked] = useState(false);

  // Sugerir nombre a partir del usuario
  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createClientComponentClient();
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email || '';
        const fullName = (session?.user as { user_metadata?: { full_name?: string } } | undefined)?.user_metadata?.full_name || '';
        if (!name) {
          const domain = email.split('@')[1]?.split('.')[0] || '';
          const suggestion = fullName || (domain ? domain.charAt(0).toUpperCase() + domain.slice(1) : 'Mi empresa');
          setName(suggestion);
        }
      } catch {}
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const isStaffError = data?.code === "HQ_STAFF";
        setIsStaffBlocked(isStaffError);
        setError(data.error ?? `Error creando organización (HTTP ${res.status})`);
        console.error("Create org error:", data);
        return;
      }
      setIsStaffBlocked(false);
      const data = await res.json();
      window.location.href = `/c/${data.org.id}`;
    } catch (err) {
      console.error(err);
      setError("No se pudo conectar con el servidor. Revisa tu conexión.");
    } finally {
      setLoading(false);
    }
  };

  const inputsDisabled = isStaffBlocked;
  const submitDisabled = loading || isStaffBlocked;

  return (
    <form onSubmit={onSubmit} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-6">
      <div className="sm:col-span-4">
        <label htmlFor="org-name" className="mb-2 block text-sm font-medium text-lp-primary-2">Nombre</label>
        <input
          id="org-name"
          className="w-full rounded-md border border-lp-sec-4/60 px-3 py-2"
          placeholder="Ej: Mi empresa"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={inputsDisabled}
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="org-type" className="mb-2 block text-sm font-medium text-lp-primary-2">Tipo</label>
        <select
          id="org-type"
          className="w-full rounded-md border border-lp-sec-4/60 px-3 py-2"
          value={type}
          onChange={(e) => setType(e.target.value as 'CLIENT' | 'INVESTOR')}
          disabled={inputsDisabled}
        >
          <option value="CLIENT">CLIENT</option>
          <option value="INVESTOR">INVESTOR</option>
        </select>
      </div>
      <div className="sm:col-span-6">
        <button
          type="submit"
          disabled={submitDisabled}
          className="rounded-md bg-lp-primary-1 px-4 py-2 text-sm font-medium text-lp-primary-2 hover:opacity-90"
        >
          {loading ? "Creando..." : "Crear y entrar"}
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </form>
  );
}
