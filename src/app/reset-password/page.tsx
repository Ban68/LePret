"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

function ResetForm() {
  const search = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  useEffect(() => {
    const code = search.get("code");
    if (!code) return;
    const run = async () => {
      const supabase = createClientComponentClient();
      try { await supabase.auth.exchangeCodeForSession(code); } catch {}
    };
    run();
  }, [search]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw1 || pw1 !== pw2) { setError("Las contraseñas no coinciden"); return; }
    setLoading(true);
    setError(null);
    const supabase = createClientComponentClient();
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      router.replace("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setLoading(false); }
  };

  return (
    <div className="py-20 sm:py-24">
      <div className="container mx-auto max-w-md px-4 sm:px-6 lg:px-8">
        <h1 className="font-colette text-3xl font-bold text-lp-primary-1">Restablecer contraseña</h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <Label>Nueva contraseña</Label>
            <Input type="password" value={pw1} onChange={(e)=>setPw1(e.target.value)} required />
          </div>
          <div>
            <Label>Confirmar contraseña</Label>
            <Input type="password" value={pw2} onChange={(e)=>setPw2(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading} className="bg-lp-primary-1 text-lp-primary-2 hover:opacity-90">{loading? 'Guardando...' : 'Guardar'}</Button>
        </form>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="py-20 sm:py-24"><div className="container mx-auto max-w-md px-4 sm:px-6 lg:px-8"><p className="text-lp-sec-3">Cargando...</p></div></div>}>
      <ResetForm />
    </Suspense>
  );
}

