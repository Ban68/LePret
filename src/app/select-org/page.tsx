"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { OrgCreator } from "./OrgCreator";

type Org = { id: string; name: string; type: string; role: string; status?: string };

export default function SelectOrgPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const search = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Intercambio de código (si llega desde Magic Link)
    const code = search.get("code");
    if (code) {
      const supabase = createClientComponentClient();
      supabase.auth.exchangeCodeForSession(code).finally(() => router.replace("/select-org"));
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/orgs");
        if (res.status === 401) { router.replace("/login?redirectTo=/select-org"); return; }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error cargando organizaciones");
        setOrgs(data.orgs ?? []);
      } catch (e: any) {
        setError(e.message ?? String(e));
      } finally { setLoading(false); }
    };
    load();
  }, [search, router]);

  return (
    <div className="py-20 sm:py-24">
      <div className="container mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <h1 className="font-colette text-3xl font-bold text-lp-primary-1">Selecciona tu organización</h1>
        <p className="mt-4 text-lp-sec-3">Elige una organización o crea una nueva.</p>

        {loading && <p className="mt-8 text-lp-sec-3">Cargando...</p>}
        {error && <p className="mt-8 text-red-600">{error}</p>}

        {!loading && !error && (
          <div className="mt-8 grid grid-cols-1 gap-4">
            {orgs.length === 0 && (
              <div className="rounded-md border border-lp-sec-4/60 p-4 text-lp-sec-3">
                Aún no perteneces a ninguna organización.
              </div>
            )}
            {orgs.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-md border border-lp-sec-4/60 p-4">
                <div>
                  <div className="font-semibold text-lp-primary-1">{o.name}</div>
                  <div className="text-sm text-lp-sec-3">{o.type} · Rol: {o.role} · Estado: {o.status || 'ACTIVE'}</div>
                </div>
                {o.status === 'ACTIVE' || !o.status ? (
                  <Link href={`/c/${o.id}`} className="rounded-md bg-lp-primary-1 px-4 py-2 text-sm font-medium text-lp-primary-2 hover:opacity-90">Entrar</Link>
                ) : (
                  <span className="text-sm text-lp-sec-3">Pendiente de habilitación</span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-10">
          <h2 className="font-colette text-xl font-bold text-lp-primary-1">Crear organización</h2>
          <OrgCreator />
        </div>
      </div>
    </div>
  );
}

