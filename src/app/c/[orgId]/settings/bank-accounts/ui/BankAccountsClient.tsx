"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineBanner } from "@/components/ui/inline-banner";

const ACCOUNT_TYPES: Array<{ value: string; label: string }> = [
  { value: "checking", label: "Cuenta corriente" },
  { value: "savings", label: "Cuenta de ahorros" },
  { value: "deposit", label: "Cuenta de depósitos" },
  { value: "other", label: "Otra" },
];

type BankAccount = {
  id: string;
  label: string | null;
  bank_name: string;
  account_type: string;
  account_number: string;
  account_holder_name: string;
  account_holder_id: string | null;
  is_default: boolean;
  created_at: string;
};

type ApiListResponse = {
  ok: boolean;
  items?: BankAccount[];
  error?: string;
};

type ApiCreateResponse = {
  ok: boolean;
  account?: BankAccount;
  error?: string;
};

type FormState = {
  label: string;
  bank_name: string;
  account_type: string;
  account_number: string;
  account_holder_name: string;
  account_holder_id: string;
  is_default: boolean;
};

const INITIAL_FORM: FormState = {
  label: "",
  bank_name: "",
  account_type: "",
  account_number: "",
  account_holder_name: "",
  account_holder_id: "",
  is_default: false,
};

function maskAccountNumber(value: string) {
  const trimmed = value.replace(/\s+/g, "");
  if (trimmed.length <= 4) return trimmed;
  const last4 = trimmed.slice(-4);
  return `•••• ${last4}`;
}

export function BankAccountsClient({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/c/${orgId}/bank-accounts`, { cache: "no-store" });
      const data: ApiListResponse = await res
        .json()
        .catch(() => ({ ok: false, error: "No se pudo leer la respuesta del servidor" }));
      if (!res.ok || !data.ok || !data.items) {
        throw new Error(data.error || "No se pudieron cargar las cuentas");
      }
      setItems(data.items);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load().catch(() => null);
  }, [load]);

  const hasAccounts = useMemo(() => items.length > 0, [items]);

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => setForm(INITIAL_FORM);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (!form.bank_name.trim()) {
      toast.error("El nombre del banco es obligatorio");
      return;
    }
    if (!form.account_type) {
      toast.error("Selecciona el tipo de cuenta");
      return;
    }
    if (!form.account_number.trim()) {
      toast.error("El número de cuenta es obligatorio");
      return;
    }
    if (!form.account_holder_name.trim()) {
      toast.error("Indica el titular de la cuenta");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        label: form.label.trim() || null,
        bank_name: form.bank_name.trim(),
        account_type: form.account_type,
        account_number: form.account_number.trim(),
        account_holder_name: form.account_holder_name.trim(),
        account_holder_id: form.account_holder_id.trim() || null,
        is_default: form.is_default,
      };
      const res = await fetch(`/api/c/${orgId}/bank-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: ApiCreateResponse = await res
        .json()
        .catch(() => ({ ok: false, error: "No se pudo leer la respuesta del servidor" }));
      if (!res.ok || !data.ok || !data.account) {
        throw new Error(data.error || "No se pudo guardar la cuenta");
      }
      setItems((prev) => {
        const next = form.is_default
          ? prev.map((item) => ({ ...item, is_default: false }))
          : prev.slice();
        return [data.account, ...next];
      });
      resetForm();
      toast.success("Cuenta bancaria guardada");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="py-10">
      <Toaster richColors position="top-center" />
      <div className="container mx-auto max-w-4xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div>
          <h1 className="font-colette text-2xl font-semibold text-lp-primary-1">Cuentas bancarias</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Registra la cuenta donde recibirás los desembolsos de LePrêt.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nueva cuenta</CardTitle>
            <CardDescription>Completa los datos para agregar una cuenta receptora.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bank-name">Banco</Label>
                  <Input
                    id="bank-name"
                    value={form.bank_name}
                    onChange={(event) => updateField("bank_name", event.target.value)}
                    placeholder="Bancolombia"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-type">Tipo de cuenta</Label>
                  <select
                    id="account-type"
                    className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-lp-primary-1 focus:outline-none focus:ring-1 focus:ring-lp-primary-1"
                    value={form.account_type}
                    onChange={(event) => updateField("account_type", event.target.value)}
                    required
                  >
                    <option value="">Selecciona una opción</option>
                    {ACCOUNT_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-number">Número de cuenta</Label>
                  <Input
                    id="account-number"
                    value={form.account_number}
                    onChange={(event) => updateField("account_number", event.target.value)}
                    placeholder="000123456789"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="label">Alias (opcional)</Label>
                  <Input
                    id="label"
                    value={form.label}
                    onChange={(event) => updateField("label", event.target.value)}
                    placeholder="Cuenta principal"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="holder-name">Titular</Label>
                  <Input
                    id="holder-name"
                    value={form.account_holder_name}
                    onChange={(event) => updateField("account_holder_name", event.target.value)}
                    placeholder="Empresa S.A.S."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="holder-id">Documento del titular (opcional)</Label>
                  <Input
                    id="holder-id"
                    value={form.account_holder_id}
                    onChange={(event) => updateField("account_holder_id", event.target.value)}
                    placeholder="NIT o cédula"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is-default"
                  checked={form.is_default}
                  onCheckedChange={(value) => updateField("is_default", value === true)}
                />
                <Label htmlFor="is-default" className="text-sm text-neutral-700">
                  Marcar como cuenta principal para desembolsos
                </Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm} disabled={submitting}>
                  Limpiar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Guardando..." : "Guardar cuenta"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mis cuentas registradas</CardTitle>
            <CardDescription>Consulta y comparte los datos bancarios con tu equipo.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-neutral-500">Cargando cuentas...</p>
            ) : error ? (
              <InlineBanner tone="error" title="No se pudieron cargar las cuentas" description={error} />
            ) : hasAccounts ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-lp-sec-4/40 text-sm">
                  <thead>
                    <tr className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      <th className="px-4 py-2">Banco</th>
                      <th className="px-4 py-2">Alias</th>
                      <th className="px-4 py-2">Número</th>
                      <th className="px-4 py-2">Titular</th>
                      <th className="px-4 py-2">Documento</th>
                      <th className="px-4 py-2">Principal</th>
                      <th className="px-4 py-2">Creada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-lp-sec-4/30">
                    {items.map((account) => (
                      <tr key={account.id} className="bg-white">
                        <td className="px-4 py-3 font-medium text-neutral-900">{account.bank_name}</td>
                        <td className="px-4 py-3 text-neutral-700">{account.label || "-"}</td>
                        <td className="px-4 py-3 font-mono text-neutral-900">{maskAccountNumber(account.account_number)}</td>
                        <td className="px-4 py-3 text-neutral-700">{account.account_holder_name}</td>
                        <td className="px-4 py-3 text-neutral-700">{account.account_holder_id || "-"}</td>
                        <td className="px-4 py-3 text-neutral-700">{account.is_default ? "Sí" : "No"}</td>
                        <td className="px-4 py-3 text-neutral-700">
                          {new Date(account.created_at).toLocaleDateString("es-CO")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <InlineBanner
                tone="info"
                title="Aún no tienes cuentas registradas"
                description="Agrega una cuenta bancaria para recibir tus desembolsos."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
