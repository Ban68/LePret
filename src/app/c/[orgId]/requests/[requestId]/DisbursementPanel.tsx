"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineBanner } from "@/components/ui/inline-banner";

function formatCurrency(value: number | null | undefined, currency?: string | null) {
  if (value === null || value === undefined) return "-";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: currency || "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

type BankAccount = {
  id: string;
  label: string | null;
  bank_name: string;
  account_type: string;
  account_number: string;
  account_holder_name: string;
  account_holder_id: string | null;
  is_default: boolean;
};

type Payment = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  direction: string;
  bank_account_id: string | null;
  notes: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  in_collection: "En gestión",
  paid: "Pagada",
  overdue: "Vencida",
  cancelled: "Cancelada",
};

function describeAccount(account: BankAccount) {
  const alias = account.label ? `${account.label} • ` : "";
  const lastDigits = account.account_number.slice(-4);
  return `${alias}${account.bank_name} · ${account.account_holder_name} · ****${lastDigits}`;
}

export function DisbursementPanel({
  orgId,
  requestId,
  status,
  amount,
  currency,
  bankAccounts,
  selectedAccountId,
  disbursement,
}: {
  orgId: string;
  requestId: string;
  status: string;
  amount: number;
  currency?: string | null;
  bankAccounts: BankAccount[];
  selectedAccountId: string | null;
  disbursement: Payment | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState<string>(selectedAccountId ?? "");
  const [isPending, startTransition] = useTransition();

  const defaultOption = useMemo(() => {
    if (selectedAccountId) return selectedAccountId;
    const preferred = bankAccounts.find((account) => account.is_default);
    return preferred?.id ?? bankAccounts[0]?.id ?? "";
  }, [bankAccounts, selectedAccountId]);

  const accountId = value || defaultOption || "";

  const accountDescription = useMemo(() => {
    if (!accountId) return null;
    const account = bankAccounts.find((item) => item.id === accountId);
    return account ? describeAccount(account) : null;
  }, [accountId, bankAccounts]);

  const canRequestDisbursement = useMemo(() => {
    if (!accountId) return false;
    return ["accepted", "signed"].includes(String(status).toLowerCase());
  }, [accountId, status]);

  const disbursementStatus = disbursement ? STATUS_LABELS[disbursement.status] ?? disbursement.status : null;

  const handleSubmit = () => {
    if (!accountId) {
      toast.error("Debes seleccionar una cuenta bancaria");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(`/api/c/${orgId}/requests/${requestId}/disburse`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bank_account_id: accountId }),
        });
        const data = await res.json().catch(() => ({ ok: false, error: "No se pudo procesar el desembolso" }));
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "No se pudo solicitar el desembolso");
        }
        toast.success("Solicitud enviada. Nuestro equipo procesará el desembolso.");
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error inesperado";
        toast.error(message);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Desembolso</CardTitle>
        <CardDescription>
          Confirmar la cuenta destino nos permite programar la transferencia una vez se liberen los fondos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Monto a desembolsar</p>
            <p className="text-lg font-semibold text-neutral-900">{formatCurrency(amount, currency)}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Estado del desembolso</p>
            <p className="text-lg font-semibold text-neutral-900">
              {disbursementStatus ?? (disbursement ? disbursement.status : "Pendiente")}
            </p>
            {disbursement?.created_at ? (
              <p className="mt-1 text-xs text-neutral-500">
                Última actualización: {new Date(disbursement.created_at).toLocaleString("es-CO")}
              </p>
            ) : null}
          </div>
        </div>

        {bankAccounts.length === 0 ? (
          <InlineBanner
            tone="warning"
            title="Debes registrar una cuenta bancaria"
            description="Ve a Ajustes → Cuentas bancarias para agregar la cuenta donde deseas recibir el desembolso."
          />
        ) : (
          <div className="space-y-3">
            <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
              Selecciona la cuenta receptora
              <select
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-lp-primary-1 focus:outline-none focus:ring-1 focus:ring-lp-primary-1"
                value={accountId}
                onChange={(event) => setValue(event.target.value)}
              >
                <option value="">Selecciona una cuenta...</option>
                {bankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {describeAccount(account)}
                  </option>
                ))}
              </select>
            </label>
            {accountDescription ? (
              <p className="text-sm text-neutral-600">Usaremos: {accountDescription}</p>
            ) : null}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Button onClick={handleSubmit} disabled={!canRequestDisbursement || isPending}>
            {isPending ? "Enviando..." : "Solicitar desembolso"}
          </Button>
          {!canRequestDisbursement ? (
            <p className="text-xs text-neutral-500">
              Solo puedes solicitar el desembolso cuando la solicitud esté aceptada y se haya definido la cuenta destino.
            </p>
          ) : null}
          {disbursement && disbursement.status !== "paid" ? (
            <p className="text-xs text-neutral-500">
              Nuestro equipo de back-office te notificará cuando el pago esté confirmado.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
