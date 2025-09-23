"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { isStaffUser } from "@/lib/staff";

const GENERIC_ERROR_MESSAGE = "Error inesperado. Intenta de nuevo.";

const SUPABASE_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Usuario o contraseña incorrectos.",
  invalid_grant: "Usuario o contraseña incorrectos.",
  email_not_confirmed: "Debes confirmar tu correo antes de iniciar sesión.",
  user_not_found: "No encontramos una cuenta con este correo.",
  email_address_invalid: "Ingresa un email válido.",
  over_email_send_rate_limit: "Has solicitado demasiados correos. Intenta nuevamente más tarde.",
  over_request_rate_limit: "Se superó el límite de intentos. Intenta nuevamente más tarde.",
  otp_disabled: "El acceso por enlace mágico está deshabilitado.",
  otp_expired: "El enlace expiró. Solicita uno nuevo.",
  weak_password: "La contraseña es demasiado débil.",
};

const getErrorMessage = (err: unknown) => {
  if (err instanceof Error) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === "string" && code.length > 0) {
      return SUPABASE_ERROR_MESSAGES[code] ?? GENERIC_ERROR_MESSAGE;
    }

    return err.message;
  }

  return GENERIC_ERROR_MESSAGE;
};

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const searchRedirect = search.get("redirectTo");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [mode, setMode] = useState<"password" | "magic" | "reset">("password");
  const [showPw, setShowPw] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const validEmail = useMemo(() => /.+@.+\..+/.test(email), [email]);

  useEffect(() => {
    const supabase = createClientComponentClient();
    let active = true;

    const resolveRedirect = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        let defaultDestination = "/select-org";
        if (session?.user?.id) {
          const staff = await isStaffUser(supabase, session.user.id);
          defaultDestination = staff ? "/hq" : "/select-org";
        }

        const destination = searchRedirect ?? defaultDestination;

        if (!active) return;

        if (session) {
          router.replace(destination);
        }
      } catch (err) {
        console.error("Failed to resolve login redirect", err);
        if (!active) return;
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    };

    resolveRedirect();

    return () => {
      active = false;
    };
  }, [router, searchRedirect]);

  const computePostAuthRedirect = async (supabaseClient: ReturnType<typeof createClientComponentClient>, userId?: string | null) => {
    if (searchRedirect) {
      return searchRedirect;
    }

    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      resolvedUserId = user?.id ?? null;
    }

    if (resolvedUserId) {
      const staff = await isStaffUser(supabaseClient, resolvedUserId);
      return staff ? "/hq" : "/select-org";
    }

    return "/select-org";
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    const supabase = createClientComponentClient();
    try {
      if (mode === "password") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const destination = await computePostAuthRedirect(supabase, data?.user?.id);
        router.replace(destination);
      } else if (mode === "magic") {
        if (!validEmail) throw new Error("Ingresa un email valido");
        const redirectUrl = new URL(`${window.location.origin}/auth/callback`);
        if (searchRedirect) {
          redirectUrl.searchParams.set("redirectTo", searchRedirect);
        }
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectUrl.toString() },
        });
        if (error) throw error;
        setSuccess(true);
      } else {
        if (!validEmail) throw new Error("Ingresa un email valido");
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSuccess(true);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="py-20 sm:py-24">
        <div className="container mx-auto max-w-md px-4 sm:px-6 lg:px-8">
          <p className="text-lp-sec-3">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-20 sm:py-24">
      <div className="container mx-auto max-w-md px-4 sm:px-6 lg:px-8">
        <h1 className="font-colette text-3xl font-bold text-lp-primary-1">Iniciar sesión</h1>

        {/* Switch de modo */}
        <div className="mt-6 flex gap-3 text-sm">
          <button
            type="button"
            className={`underline ${mode==='password'?'font-semibold text-lp-primary-1':''}`}
            onClick={() => {
              setSuccess(false);
              setMode('password');
            }}
          >
            Con contraseña
          </button>
          <span className="text-lp-sec-3">|</span>
          <button
            type="button"
            className={`underline ${mode==='magic'?'font-semibold text-lp-primary-1':''}`}
            onClick={() => {
              setSuccess(false);
              setMode('magic');
            }}
          >
            Magic Link
          </button>
          <span className="text-lp-sec-3">|</span>
          <button
            type="button"
            className={`underline ${mode==='reset'?'font-semibold text-lp-primary-1':''}`}
            onClick={() => {
              setSuccess(false);
              setMode('reset');
            }}
          >
            Olvidé mi contraseña
          </button>
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

                <Input id="password" type={showPw? 'text':'password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPw ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                </Button>

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
          <div className="flex flex-col gap-2">
            <Button
              type="submit"
              disabled={loading || (mode!=='password' && !validEmail)}
              className="bg-lp-primary-1 text-lp-primary-2 hover:opacity-90"
            >
              {loading
                ? "Procesando..."
                : mode==='password'
                ? "Acceder"
                : success
                ? "Reenviar"
                : mode==='magic'
                ? "Enviar enlace"
                : "Enviar recuperación"}
            </Button>
            {success && (
              <p className="text-sm text-lp-sec-3">Hemos enviado un enlace a tu correo.</p>
            )}
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