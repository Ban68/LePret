"use client";

import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import type { OnboardingOwner, UseOnboardingReturn } from "../_components/useOnboarding";

type OwnerFormValues = {
  fullName: string;
  documentType: string;
  documentNumber: string;
  email: string;
  ownershipPercentage: string;
};

type BeneficiariesFormValues = {
  owners: OwnerFormValues[];
};

type BeneficiariesFormProps = {
  companyId: string;
  onboarding: UseOnboardingReturn;
};

function getDefaultOwners(owners: OnboardingOwner[]): OwnerFormValues[] {
  if (!owners.length) {
    return [
      { fullName: "", documentType: "CC", documentNumber: "", email: "", ownershipPercentage: "" },
    ];
  }
  return owners.map((owner) => ({
    fullName: owner.fullName,
    documentType: owner.documentType || "CC",
    documentNumber: owner.documentNumber,
    email: owner.email,
    ownershipPercentage: owner.ownershipPercentage != null ? String(owner.ownershipPercentage) : "",
  }));
}

export function BeneficiariesForm({ companyId, onboarding }: BeneficiariesFormProps) {
  const router = useRouter();
  const defaults = useMemo(() => getDefaultOwners(onboarding.data.owners), [onboarding.data.owners]);
  const form = useForm<BeneficiariesFormValues>({ defaultValues: { owners: defaults } });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "owners" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    form.reset({ owners: defaults });
  }, [defaults, form]);

  const handleAddOwner = () => {
    append({ fullName: "", documentType: "CC", documentNumber: "", email: "", ownershipPercentage: "" });
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    setSaving(true);
    setError(null);
    try {
      const owners = values.owners.filter((owner) => owner.fullName.trim() && owner.documentNumber.trim());
      const response = await fetch(`/api/onboarding/${companyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "owners",
          owners: owners.map((owner) => ({
            fullName: owner.fullName,
            documentType: owner.documentType,
            documentNumber: owner.documentNumber,
            email: owner.email,
            ownershipPercentage: owner.ownershipPercentage ? Number(owner.ownershipPercentage) : null,
          })),
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = typeof payload?.error === "string" ? payload.error : "Error guardando beneficiarios";
        throw new Error(message);
      }
      toast.success("Beneficiarios guardados");
      await onboarding.refresh();
      router.push(`/registro/documentos?orgId=${encodeURIComponent(companyId)}`);
    } catch (err) {
      console.error("beneficiaries form error", err);
      setError(err instanceof Error ? err.message : "Error inesperado");
      toast.error("No pudimos guardar la información");
    } finally {
      setSaving(false);
    }
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        {fields.map((field, index) => (
          <div key={field.id} className="rounded-xl border border-lp-sec-4/40 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-6 md:grid md:grid-cols-2">
              <div>
                <Label htmlFor={`owners-${index}-fullName`}>Nombre completo</Label>
                <Input id={`owners-${index}-fullName`} {...form.register(`owners.${index}.fullName` as const)} />
              </div>
              <div>
                <Label htmlFor={`owners-${index}-documentType`}>Tipo de documento</Label>
                <Input id={`owners-${index}-documentType`} {...form.register(`owners.${index}.documentType` as const)} />
              </div>
              <div>
                <Label htmlFor={`owners-${index}-documentNumber`}>Número de documento</Label>
                <Input id={`owners-${index}-documentNumber`} {...form.register(`owners.${index}.documentNumber` as const)} />
              </div>
              <div>
                <Label htmlFor={`owners-${index}-email`}>Email</Label>
                <Input id={`owners-${index}-email`} type="email" {...form.register(`owners.${index}.email` as const)} />
              </div>
              <div>
                <Label htmlFor={`owners-${index}-ownershipPercentage`}>Porcentaje de participación</Label>
                <Input
                  id={`owners-${index}-ownershipPercentage`}
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  {...form.register(`owners.${index}.ownershipPercentage` as const)}
                />
              </div>
            </div>
            {fields.length > 1 ? (
              <div className="mt-4 text-right">
                <Button type="button" variant="ghost" onClick={() => remove(index)}>
                  Eliminar
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" onClick={handleAddOwner}>
        Añadir beneficiario
      </Button>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="ghost" onClick={() => router.push(`/registro/datos-empresa?orgId=${encodeURIComponent(companyId)}`)} className="w-full sm:w-auto">
          Volver
        </Button>
        <Button type="submit" disabled={saving} className="w-full sm:w-auto">
          {saving ? "Guardando..." : "Guardar y continuar"}
        </Button>
      </div>
    </form>
  );
}
