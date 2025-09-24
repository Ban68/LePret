"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { EmailOtpType } from "@supabase/supabase-js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const DEFAULT_REDIRECT_PATH = "/login";

const EMAIL_OTP_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

const isEmailOtpType = (value: string | null): value is EmailOtpType =>
  Boolean(value && EMAIL_OTP_TYPES.includes(value as EmailOtpType));

const sanitizeRedirect = (value: string | null, fallback: string) => {
  if (!value) {
    return fallback;
  }
  if (!value.startsWith("/")) {
    return fallback;
  }
  if (value.startsWith("//")) {
    return fallback;
  }
  return value;
};

function ResetForm() {
  const search = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const redirectParam = search.get("redirectTo");
  const redirectTo = useMemo(
    () => sanitizeRedirect(redirectParam, DEFAULT_REDIRECT_PATH),
    [redirectParam]
  );

  useEffect(() => {
    const code = search.get("code");
    const supabase = createClientComponentClient();

    const run = async () => {
      if (code) {
        try {
          await supabase.auth.exchangeCodeForSession(code);
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.delete("code");
            window.history.replaceState(window.history.state, "", url.toString());
          }
          return;
        } catch (err) {
          console.error("Failed to exchange code for session", err);
        }
      }

      const tokenHash = search.get("token_hash") ?? search.get("token");
      const typeParam = search.get("type");

      if (tokenHash && isEmailOtpType(typeParam)) {
        try {
          await supabase.auth.verifyOtp({
            type: typeParam,
            token_hash: tokenHash,
          });
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.delete("token_hash");
            url.searchParams.delete("token");
            url.searchParams.delete("type");
            window.history.replaceState(window.history.state, "", url.toString());
          }
          return;
        } catch (err) {
          console.error("Failed to verify Supabase token", err);
        }
      }

      if (typeof window === "undefined") {
        return;
      }

      const hash = window.location.hash;
      if (!hash || hash.length <= 1) {
        return;
      }

      const params = new URLSearchParams(hash.slice(1));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (!accessToken || !refreshToken) {
        return;
      }

      try {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          throw error;
        }
        const url = new URL(window.location.href);
        url.hash = "";
        window.history.replaceState(window.history.state, "", url.toString());
      } catch (err) {
        console.error("Failed to recover session from URL fragment", err);
      }
    };

    run();
  }, [search]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pw1 || pw1 !== pw2) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClientComponentClient();
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      router.replace(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setLoading(false); }
  };

  return (
    <div className="py-20 sm:py-24">
      <div className="container mx-auto max-w-md px-4 sm:px-6 lg:px-8">
        <h1 className="font-colette text-3xl font-bold text-lp-primary-1">Configura tu contraseña</h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <Label>Nueva contraseña</Label>
            <Input
              type="password"
              value={pw1}
              onChange={(event) => setPw1(event.target.value)}
              required
            />
          </div>
          <div>
            <Label>Confirmar contraseña</Label>
            <Input
              type="password"
              value={pw2}
              onChange={(event) => setPw2(event.target.value)}
              required
            />
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

