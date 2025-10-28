"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { OrgCreator } from "./OrgCreator";

type Org = { id: string; name: string; type: string; role: string; status?: string; kycStatus?: string | null };

function formatKycStatus(status: string | null | undefined): string {
  if (!status) return "Sin iniciar";
  const upper = status.toUpperCase();
  switch (upper) {
    case "APPROVED":
      return "Aprobado";
    case "SUBMITTED":
      return "En revisión";
    case "IN_PROGRESS":
    case "PENDING":
      return "En progreso";
    case "REJECTED":
      return "Rechazado";
    default:
      return status;
  }
}

type Feedback = { type: "success" | "error"; text: string } | null;

function SelectOrgInner() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
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
        setError(null);
        const res = await fetch("/api/orgs");
        if (res.status === 401) {
          router.replace("/login?redirectTo=/select-org");
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error cargando organizaciones");
        setOrgs(data.orgs ?? []);
        setFeedback(null);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [search, router]);

  const handleRemove = async (org: Org) => {
    if (removingId && removingId !== org.id) return;
    if (!confirm(`¿Eliminar la organización "${org.name}"?`)) {
      return;
    }
    setRemovingId(org.id);
    setFeedback(null);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${org.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({ ok: false, error: "No se pudo leer la respuesta" }));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo eliminar la organización");
      }
      setOrgs((prev) => prev.filter((item) => item.id !== org.id));
      setFeedback({ type: "success", text: "Organización eliminada correctamente." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setFeedback({ type: "error", text: message });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="py-20 sm:py-24">
      <div className="container mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <h1 className="font-colette text-3xl font-bold text-lp-primary-1">Selecciona tu organización</h1>
        <p className="mt-4 text-lp-sec-3">Elige una organización o crea una nueva.</p>

        {loading && <p className="mt-8 text-lp-sec-3">Cargando...</p>}
        {error && <p className="mt-8 text-red-600">{error}</p>}
        {feedback && !error && (
          <p
            className={`mt-6 text-sm ${feedback.type === "success" ? "text-emerald-600" : "text-red-600"}`}
          >
            {feedback.text}
          </p>
        )}

        {!loading && !error && (
          <div className="mt-8 grid grid-cols-1 gap-4">
            {orgs.length === 0 && (
              <div className="rounded-md border border-lp-sec-4/60 p-4 text-lp-sec-3">
                Aún no perteneces a ninguna organización.
              </div>
            )}
            {orgs.map((o) => {
              const normalizedType = (o.type ?? "").toUpperCase();
              const isInvestor = normalizedType === "INVESTOR";
              const isActive = o.status === "ACTIVE" || !o.status;
              const isKycApproved = (o.kycStatus ?? "").toUpperCase() === "APPROVED";
              const portalHref = isInvestor ? `/i/${o.id}` : `/c/${o.id}`;
              return (
                <div key={o.id} className="flex flex-col gap-3 rounded-md border border-lp-sec-4/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-semibold text-lp-primary-1">{o.name}</div>
                    <div className="text-sm text-lp-sec-3">
                      {o.type} · Rol: {o.role} · Estado: {o.status || "ACTIVE"} · KYC: {formatKycStatus(o.kycStatus)}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {isActive ? (
                      isInvestor || isKycApproved ? (
                        <Link
                          href={portalHref}
                          className="rounded-md bg-lp-primary-1 px-4 py-2 text-sm font-medium text-lp-primary-2 hover:opacity-90"
                        >
                          Entrar
                        </Link>
                      ) : (
                        <Link
                          href={`/registro/datos-empresa?orgId=${o.id}`}
                          className="rounded-md border border-lp-primary-1 px-4 py-2 text-sm font-medium text-lp-primary-1 hover:bg-lp-primary-1/10"
                        >
                          Completar registro
                        </Link>
                      )
                    ) : (
                      <span className="text-sm text-lp-sec-3">Pendiente de habilitacion</span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemove(o)}
                      disabled={removingId === o.id}
                      className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {removingId === o.id ? "Eliminando..." : "Eliminar"}
                    </button>
                  </div>
                </div>
              );
            })}
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

export default function SelectOrgPage() {
  return (
    <Suspense fallback={<div className="py-20 sm:py-24"><div className="container mx-auto max-w-2xl px-4 sm:px-6 lg:px-8"><p className="text-lp-sec-3">Cargando...</p></div></div>}>
      <SelectOrgInner />
    </Suspense>
  );
}
