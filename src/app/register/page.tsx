"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const schema = z.object({
  full_name: z.string().min(2, "Mínimo 2 caracteres"),
  company_name: z.string().min(2, "Mínimo 2 caracteres"),
  nit: z.string().min(3, "NIT inválido"),
  email: z.string().email(),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});
type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setError(null);
    setLoading(true);
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.full_name,
          company_name: data.company_name,
          nit: data.nit,
        },
        emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/app` : undefined,
      }
    });
    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    // Try to upsert profile
    const userId = signUpData.user?.id;
    if (userId) {
      await supabase.from('profiles').upsert({
        id: userId,
        full_name: data.full_name,
        company_name: data.company_name,
        nit: data.nit,
      });
    }

    setLoading(false);
    router.replace("/app");
  };

  return (
    <div className="py-12">
      <div className="container mx-auto max-w-md px-4">
        <h1 className="font-colette text-2xl font-bold text-lp-primary-1">Crear cuenta</h1>
        <p className="mt-2 text-sm text-lp-sec-3">Regístrate para gestionar tus operaciones.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nombre completo</Label>
            <Input id="full_name" {...register("full_name")} aria-invalid={!!errors.full_name} />
            {errors.full_name && <p className="text-sm text-red-600">{errors.full_name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="company_name">Empresa</Label>
            <Input id="company_name" {...register("company_name")} aria-invalid={!!errors.company_name} />
            {errors.company_name && <p className="text-sm text-red-600">{errors.company_name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="nit">NIT</Label>
            <Input id="nit" {...register("nit")} aria-invalid={!!errors.nit} />
            {errors.nit && <p className="text-sm text-red-600">{errors.nit.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" type="email" {...register("email")} aria-invalid={!!errors.email} />
            {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" {...register("password")} aria-invalid={!!errors.password} />
            {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={loading}>{loading ? "Creando..." : "Crear cuenta"}</Button>
            <Button type="button" variant="link" onClick={() => router.push("/login")}>Ya tengo una cuenta</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

