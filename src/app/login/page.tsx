"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";


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
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const redirectTo = search.get("redirectTo") ?? "/select-org";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState(false);
  const [mode, setMode] = useState<"password" | "magic" | "reset">("password");

  const [showPw, setShowPw] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const validEmail = useMemo(() => /.+@.+\..+/.test(email), [email]);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusTab = (index: number) => {
    const node = tabRefs.current[index];
    if (node) {
      node.focus();
    }
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const lastIndex = AUTH_TABS.length - 1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = index === lastIndex ? 0 : index + 1;
      setMode(AUTH_TABS[nextIndex].value);
      focusTab(nextIndex);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      const prevIndex = index === 0 ? lastIndex : index - 1;
      setMode(AUTH_TABS[prevIndex].value);
      focusTab(prevIndex);
    } else if (event.key === "Home") {
      event.preventDefault();
      setMode(AUTH_TABS[0].value);
      focusTab(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setMode(AUTH_TABS[lastIndex].value);
      focusTab(lastIndex);
    }
  };

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
    setSuccess(false);
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

        <div className="mt-6">
          <div role="tablist" aria-label="Opciones de acceso" className="flex flex-wrap gap-2 text-sm font-medium">
            {AUTH_TABS.map((tab, index) => {
              const isActive = mode === tab.value;
              return (
                <button
                  key={tab.value}
                  ref={(node) => {
                    tabRefs.current[index] = node;
                  }}
                  id={`${tab.value}-tab`}
                  role="tab"
                  type="button"
                  aria-selected={isActive}
                  aria-controls={`${tab.value}-panel`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setMode(tab.value)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                  className={`rounded-md border px-3 py-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lp-primary-1 ${
                    isActive
                      ? "border-lp-primary-1 bg-lp-primary-1 text-lp-primary-2 shadow-sm"
                      : "border-transparent text-lp-sec-3 hover:border-lp-primary-1 hover:bg-lp-primary-2/10 hover:text-lp-primary-1"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

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
          <div
            role="tabpanel"
            id="password-panel"
            aria-labelledby="password-tab"
            hidden={mode !== "password"}
          >
            <div className="space-y-2">
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
          </div>
          <div
            role="tabpanel"
            id="magic-panel"
            aria-labelledby="magic-tab"
            hidden={mode !== "magic"}
          >
            <p className="text-sm text-lp-sec-3">Te enviaremos un enlace de acceso a tu correo.</p>
          </div>
          <div
            role="tabpanel"
            id="reset-panel"
            aria-labelledby="reset-tab"
            hidden={mode !== "reset"}
          >
            <p className="text-sm text-lp-sec-3">Recibirás un enlace para restablecer tu contraseña.</p>
          </div>
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