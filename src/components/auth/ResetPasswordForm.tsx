"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface ResetPasswordFormProps {
  code?: string;
}

type Status = "idle" | "verifying" | "ready" | "submitting" | "success" | "error";

export function ResetPasswordForm({ code }: ResetPasswordFormProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [status, setStatus] = useState<Status>(code ? "verifying" : "error");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    let isMounted = true;

    if (!code) {
      setMessage(
        "No pudimos validar el enlace de recuperación. Solicita uno nuevo desde el portal de clientes."
      );
      return;
    }

    const exchangeSession = async () => {
      setStatus("verifying");
      setMessage("Validando enlace de recuperación...");
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!isMounted) {
        return;
      }

      if (error) {
        setStatus("error");
        setMessage(
          "El enlace de recuperación no es válido o ya fue utilizado. Solicita uno nuevo desde el portal de clientes."
        );
        return;
      }

      setStatus("ready");
      setMessage("");
    };

    void exchangeSession();

    return () => {
      isMounted = false;
    };
  }, [code, supabase]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (status !== "ready" && status !== "submitting") {
      return;
    }

    if (!password || !confirmPassword) {
      setMessage("Debes ingresar y confirmar tu nueva contraseña.");
      setStatus("ready");
      return;
    }

    if (password.length < 8) {
      setMessage("La contraseña debe tener al menos 8 caracteres.");
      setStatus("ready");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Las contraseñas no coinciden.");
      setStatus("ready");
      return;
    }

    setStatus("submitting");
    setMessage("");

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      const isMissingSession = error.message === "Auth session missing";
      const humanMessage = isMissingSession
        ? "El enlace de recuperación expiró. Solicita uno nuevo desde el portal de clientes."
        : error.message;

      setStatus(isMissingSession ? "error" : "ready");
      setMessage(humanMessage);
      return;
    }

    setStatus("success");
    setMessage("Tu contraseña fue actualizada exitosamente.");
  };

  const isInputDisabled =
    status === "verifying" || status === "submitting" || status === "success" || status === "error";
  const isButtonDisabled = status === "verifying" || status === "submitting" || status === "success" || status === "error";

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-lp-sec-4/40 bg-white p-8 shadow-soft">
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-2 text-center">
          <h1 className="font-colette text-2xl font-bold text-lp-primary-1">Configura tu contraseña</h1>
          <p className="text-sm text-lp-sec-3">
            Define una nueva contraseña para ingresar al portal de clientes.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nueva contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isInputDisabled}
              minLength={8}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar contraseña</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={isInputDisabled}
              minLength={8}
              required
            />
          </div>
        </div>

        {message && (
          <p
            className={`text-sm ${status === "success" ? "text-emerald-600" : "text-destructive"}`}
            role={status === "success" ? "status" : "alert"}
          >
            {message}
          </p>
        )}

        <Button
          type="submit"
          className="w-full bg-lp-primary-2 text-lp-primary-1 hover:opacity-90"
          disabled={isButtonDisabled}
        >
          {status === "submitting" ? "Guardando..." : "Guardar"}
        </Button>
      </form>
    </div>
  );
}
