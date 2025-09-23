"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { OrgCreator } from "./OrgCreator";
import { isStaffUser } from "@/lib/staff";

type Org = { id: string; name: string; type: string; role: string; status?: string };

function SelectOrgInner() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allowOrgSelection, setAllowOrgSelection] = useState(false);
  const search = useSearchParams();
  const router = useRouter();
  const code = search.get("code");

  useEffect(() => {
    const supabase = createClientComponentClient();
    let active = true;

    const initialize = async () => {
      try {
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error("Failed to exchange magic link code", exchangeError);
            if (!active) return;
            setError("No se pudo validar el enlace. Intenta nuevamente.");
            setLoading(false);
            return;
          }

          const {
            data: { user },
          } = await supabase.auth.getUser();

          const destination = await resolveStaffRedirect(supabase, user?.id ?? null);
          if (!active) return;
          router.replace(destination);
          return;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user?.id) {
          const staff = await isStaffUser(supabase, user.id);
          if (!active) return;
          if (staff) {
            router.replace("/hq");
            return;
          }
        }

        if (!active) return;
        setAllowOrgSelection(true);
      } catch (err) {
        console.error("Failed to initialize organization selector", err);
        if (!active) return;
        setAllowOrgSelection(true);
      }
    };

    const resolveStaffRedirect = async (supabaseClient: ReturnType<typeof createClientComponentClient>, userId: string | null) => {
      if (!userId) {
        return "/select-org";
      }

      const staff = await isStaffUser(supabaseClient, userId);
      return staff ? "/hq" : "/select-org";
    };

    initialize();

    return () => {
      active = false;
    };
  }, [router, code]);

  useEffect(() => {
    if (!allowOrgSelection) return;

    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/orgs");
        if (res.status === 401) {
          if (active) {
            router.replace("/login?redirectTo=/select-org");
          }
          return;
        }

        const data = await res.json();
        if (!active) return;
        if (!res.ok) throw new Error(data.error || "Error cargando organizaciones");
        setOrgs(data.orgs ?? []);
      } catch (e: unknown) {
        if (!active) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [allowOrgSelection, router]);

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
                Aun no perteneces a ninguna organizacion.
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

        {allowOrgSelection && (
          <div className="mt-10">
            <h2 className="font-colette text-xl font-bold text-lp-primary-1">Crear organización</h2>
            <OrgCreator />
          </div>
        )}
      </div>
    </div>
  );
}

export default function SelectOrgPage() {
  return (
    <Suspense fallback={<div className="py-20 sm:py-24"><div className="container mx-auto max-w-2xl px-4 sm:px-6 lg:px-8"><p className="text-lp-sec-3">Cargando...</p></div></div>}>
      <SelectOrgInner />
    </Suspense>
  );
}
