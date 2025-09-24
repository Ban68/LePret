"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const GENERIC_ERROR_MESSAGE = "Error inesperado. Intenta de nuevo.";
const HQ_ACCESS_ERROR_MESSAGE =
  "Tu cuenta no tiene permisos para acceder a Headquarters. Comunícate con tu administrador.";

type SignInMode = "password" | "magic" | "reset";
type Audience = "customer" | "hq";

type AudienceConfig = {
  title: string;
  description?: string;
  defaultRedirect: string;
  allowMagicLink: boolean;
};

const AUDIENCE_CONFIG: Record<Audience, AudienceConfig> = {
  customer: {
    title: "Iniciar sesión",
    description: "Accede al portal de clientes para gestionar tu empresa.",
    defaultRedirect: "/select-org",
    allowMagicLink: true,
  },
  hq: {
    title: "Headquarters",
    description: "Solo para miembros del equipo LePret autorizados.",
    defaultRedirect: "/hq",
    allowMagicLink: false,
  },
};

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

const sanitizeRedirect = (value: string | null, fallback: string) => {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  return value;
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

type LoginFormProps = {
  audience: Audience;
};

export function LoginForm({ audience }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const config = AUDIENCE_CONFIG[audience];
  const redirectParam = searchParams.get("redirectTo");
  const reason = searchParams.get("reason");
  const redirectTo = useMemo(
    () => sanitizeRedirect(redirectParam, config.defaultRedirect),
    [redirectParam, config.defaultRedirect]
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [mode, setMode] = useState<SignInMode>("password");
  const [showPassword, setShowPassword] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const validEmail = useMemo(() => /.+@.+\..+/.test(email), [email]);

  const verifyBackofficeAccess = useCallback(async () => {
    if (audience !== "hq") {
      return true;
    }

    try {
      const response = await fetch("/api/hq/access", { cache: "no-store" });
      if (!response.ok) {
        return false;
      }
      const payload = await response.json().catch(() => null);
      return Boolean(payload?.allowed);
    } catch (err) {
      console.error("Failed to verify HQ access", err);
      return false;
    }
  }, [audience]);

  useEffect(() => {
    const supabase = createClientComponentClient();
    let isMounted = true;

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (session) {
        const hasAccess = await verifyBackofficeAccess();
        if (hasAccess) {
          router.replace(redirectTo);
          return;
        }

        if (audience === "hq") {
          await supabase.auth.signOut();
          if (isMounted) {
            setError(HQ_ACCESS_ERROR_MESSAGE);
          }
        }
      }

      if (isMounted) {
        setCheckingSession(false);
      }
    };

    checkSession().catch((err) => {
      console.error("Failed to check session", err);
      if (isMounted) {
        setCheckingSession(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [router, redirectTo, audience, verifyBackofficeAccess]);

  useEffect(() => {
    if (!config.allowMagicLink && mode === "magic") {
      setMode("password");
    }
  }, [config.allowMagicLink, mode]);

  useEffect(() => {
    if (audience === "hq" && reason === "forbidden") {
      setError(HQ_ACCESS_ERROR_MESSAGE);
    }
  }, [audience, reason]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const supabase = createClientComponentClient();

    try {
      if (mode === "password") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          throw signInError;
        }

        const hasAccess = await verifyBackofficeAccess();
        if (!hasAccess) {
          await supabase.auth.signOut();
          throw new Error(HQ_ACCESS_ERROR_MESSAGE);
        }

        router.replace(redirectTo);
        return;
      }

      if (mode === "magic") {
        if (!validEmail) {
          throw new Error("Ingresa un email válido");
        }

        const { error: magicError } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}${config.defaultRedirect}`,
          },
        });

        if (magicError) {
          throw magicError;
        }

        setSuccess(true);
        return;
      }

      if (!validEmail) {
        throw new Error("Ingresa un email válido");
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        throw resetError;
      }

      setSuccess(true);
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

  const modeButtons: Array<{ key: SignInMode; label: string }> = [
    { key: "password", label: "Con contraseña" },
  ];

  if (config.allowMagicLink) {
    modeButtons.push({ key: "magic", label: "Magic Link" });
  }

  modeButtons.push({ key: "reset", label: "Olvidé mi contraseña" });

  const actionLabel = (() => {
    if (loading) {
      return "Procesando...";
    }

    if (mode === "password") {
      return "Acceder";
    }

    if (success) {
      return "Reenviar";
    }

    return mode === "magic" ? "Enviar enlace" : "Enviar recuperación";
  })();

  return (
    <div className="py-20 sm:py-24">
      <div className="container mx-auto max-w-md px-4 sm:px-6 lg:px-8">
        <h1 className="font-colette text-3xl font-bold text-lp-primary-1">{config.title}</h1>
        {config.description && <p className="mt-2 text-sm text-lp-sec-3">{config.description}</p>}

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          {modeButtons.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setSuccess(false);
                setMode(key);
              }}
              className={`underline ${mode === key ? "font-semibold text-lp-primary-1" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          {mode === "password" && (
            <div>
              <Label htmlFor="password">Contraseña</Label>
              <div className="flex gap-2">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                </Button>
              </div>
            </div>
          )}

          {mode === "magic" && (
            <p className="text-sm text-lp-sec-3">Te enviaremos un enlace de acceso a tu correo.</p>
          )}

          {mode === "reset" && (
            <p className="text-sm text-lp-sec-3">Recibirás un enlace para restablecer tu contraseña.</p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-col gap-2">
            <Button
              type="submit"
              disabled={
                loading ||
                (mode !== "password" && !validEmail) ||
                (mode === "password" && password.trim().length === 0)
              }
              className="bg-lp-primary-1 text-lp-primary-2 hover:opacity-90"
            >
              {actionLabel}
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
