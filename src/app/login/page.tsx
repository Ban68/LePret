"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const redirectTo = search.get("redirectTo") ?? "/select-org";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"password" | "magic" | "reset">("password");
  const [showPw, setShowPw] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const validEmail = useMemo(() => /.+@.+\..+/.test(email), [email]);

  useEffect(() => {
    const supabase = createClientComponentClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace(redirectTo);
      } else {
        setCheckingSession(false);
      }
    });
  }, [router, redirectTo]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClientComponentClient();
    try {
      if (mode === "password") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(redirectTo);
      } else if (mode === "magic") {
        if (!validEmail) throw new Error("Ingresa un email valido");
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/select-org` },
        });
        if (error) throw error;
      } else {
        if (!validEmail) throw new Error("Ingresa un email valido");
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) return null;

  return (
    <div className="py-20 sm:py-24">
      <div className="container mx-auto max-w-md px-4 sm:px-6 lg:px-8">
        <h1 className="font-colette text-3xl font-bold text-lp-primary-1">Iniciar sesión</h1>

        {/* Switch de modo */}
        <div className="mt-6 flex gap-3 text-sm">
          <button type="button" className={`underline ${mode==='password'?'font-semibold text-lp-primary-1':''}`} onClick={()=>setMode('password')}>Con contraseña</button>
          <span className="text-lp-sec-3">|</span>
          <button type="button" className={`underline ${mode==='magic'?'font-semibold text-lp-primary-1':''}`} onClick={()=>setMode('magic')}>Magic Link</button>
          <span className="text-lp-sec-3">|</span>
          <button type="button" className={`underline ${mode==='reset'?'font-semibold text-lp-primary-1':''}`} onClick={()=>setMode('reset')}>Olvidé mi contraseña</button>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-6">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {mode === 'password' && (
            <div>
              <Label htmlFor="password">Contraseña</Label>
              <div className="flex gap-2">
                <Input
                  id="password"
                  type={showPw? 'text':'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button type="button" variant="outline" onClick={()=>setShowPw(v=>!v)}>{showPw? 'Ocultar':'Ver'}</Button>
              </div>
            </div>
          )}
          {mode === 'magic' && (
            <p className="text-sm text-lp-sec-3">Te enviaremos un enlace de acceso a tu correo.</p>
          )}
          {mode === 'reset' && (
            <p className="text-sm text-lp-sec-3">Recibirás un enlace para restablecer tu contraseña.</p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={loading || (mode!=='password' && !validEmail)} className="bg-lp-primary-1 text-lp-primary-2 hover:opacity-90">
              {loading ? "Procesando..." : mode==='password' ? "Acceder" : mode==='magic' ? "Enviar enlace" : "Enviar recuperación"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="py-20 sm:py-24"><div className="container mx-auto max-w-md px-4 sm:px-6 lg:px-8"><p className="text-lp-sec-3">Cargando...</p></div></div>}>
      <LoginForm />
    </Suspense>
  );
}