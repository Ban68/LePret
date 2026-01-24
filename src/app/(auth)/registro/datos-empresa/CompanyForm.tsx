"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OnboardingState } from "../_components/useOnboarding";
import { useOnboardingContext } from "../_components/OnboardingShell";

type CompanyFormValues = {
  legalName: string;
  taxId: string;
  contactEmail: string;
  contactPhone: string;
  billingEmail: string;
  bankAccount: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

type CompanyFormProps = {
  companyId: string;
};

function getDefaults(state: OnboardingState): CompanyFormValues {
  return {
    legalName: state.company?.legalName ?? "",
    taxId: state.company?.taxId ?? "",
    contactEmail: state.company?.contactEmail ?? "",
    contactPhone: state.company?.contactPhone ?? "",
    billingEmail: state.company?.billingEmail ?? "",
    bankAccount: state.company?.bankAccount ?? "",
    addressLine1: state.address?.line1 ?? "",
    addressLine2: state.address?.line2 ?? "",
    city: state.address?.city ?? "",
    state: state.address?.state ?? "",
    postalCode: state.address?.postalCode ?? "",
    country: state.address?.country ?? "Colombia",
  };
}

export function CompanyForm({ companyId }: CompanyFormProps) {
  const router = useRouter();
  const onboarding = useOnboardingContext();
  const { data, refresh } = onboarding;
  const defaults = useMemo(() => getDefaults(data), [data]);
  const form = useForm<CompanyFormValues>({ defaultValues: defaults });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    form.reset(defaults);
  }, [defaults, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/onboarding/${companyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "company",
          company: {
            legalName: values.legalName,
            taxId: values.taxId,
            contactEmail: values.contactEmail,
            contactPhone: values.contactPhone,
            billingEmail: values.billingEmail,
            bankAccount: values.bankAccount,
            address: {
              type: "LEGAL",
              line1: values.addressLine1,
              line2: values.addressLine2,
              city: values.city,
              state: values.state,
              postalCode: values.postalCode,
              country: values.country,
            },
          },
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = typeof payload?.error === "string" ? payload.error : "Error guardando datos";
        throw new Error(message);
      }
      toast.success("Datos de la empresa guardados");
      await refresh();
      router.push(`/registro/beneficiarios?orgId=${encodeURIComponent(companyId)}`);
    } catch (err) {
      console.error("company form error", err);
      setError(err instanceof Error ? err.message : "Error inesperado");
      toast.error("No pudimos guardar la información");
    } finally {
      setSaving(false);
    }
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-xl border border-lp-sec-4/40 bg-white p-6 shadow-sm">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <Label htmlFor="legalName">Razón social</Label>
            <Input id="legalName" autoComplete="organization" {...form.register("legalName")} />
          </div>
          <div>
            <Label htmlFor="taxId">NIT</Label>
            <Input id="taxId" autoComplete="off" {...form.register("taxId")} />
          </div>
          <div>
            <Label htmlFor="contactEmail">Email de contacto</Label>
            <Input id="contactEmail" type="email" autoComplete="email" {...form.register("contactEmail")} />
          </div>
          <div>
            <Label htmlFor="contactPhone">Teléfono de contacto</Label>
            <Input id="contactPhone" autoComplete="tel" {...form.register("contactPhone")} />
          </div>
          <div>
            <Label htmlFor="billingEmail">Email de facturación</Label>
            <Input id="billingEmail" type="email" autoComplete="email" {...form.register("billingEmail")} />
          </div>
          <div>
            <Label htmlFor="bankAccount">Cuenta bancaria</Label>
            <Input id="bankAccount" autoComplete="off" placeholder="Banco - Número de cuenta" {...form.register("bankAccount")} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-lp-sec-4/40 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-lp-primary-1">Dirección legal</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="addressLine1">Dirección</Label>
            <Input id="addressLine1" autoComplete="address-line1" {...form.register("addressLine1")} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="addressLine2">Complemento</Label>
            <Input id="addressLine2" autoComplete="address-line2" {...form.register("addressLine2")} />
          </div>
          <div>
            <Label htmlFor="city">Ciudad</Label>
            <Input id="city" autoComplete="address-level2" {...form.register("city")} />
          </div>
          <div>
            <Label htmlFor="state">Departamento</Label>
            <Input id="state" autoComplete="address-level1" {...form.register("state")} />
          </div>
          <div>
            <Label htmlFor="postalCode">Código postal</Label>
            <Input id="postalCode" autoComplete="postal-code" {...form.register("postalCode")} />
          </div>
          <div>
            <Label htmlFor="country">País</Label>
            <Input id="country" autoComplete="country-name" {...form.register("country")} />
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="submit" disabled={saving} className="w-full sm:w-auto">
          {saving ? "Guardando..." : "Guardar y continuar"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/select-org")} className="w-full sm:w-auto">
          Cancelar
        </Button>
      </div>
    </form>
  );
}






