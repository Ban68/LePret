"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { PostgrestError } from "@supabase/supabase-js";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { InlineBanner } from "@/components/ui/inline-banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const TAB_OPTIONS = [
  { key: "bank", label: "Cuenta bancaria" },
  { key: "notifications", label: "Notificaciones" },
  { key: "users", label: "Usuarios autorizados" },
] as const;

const ACCOUNT_TYPES = [
  { value: "checking", label: "Cuenta corriente" },
  { value: "savings", label: "Cuenta de ahorros" },
  { value: "deposit", label: "Cuenta de depósitos" },
  { value: "other", label: "Otra" },
] as const;

type TabKey = (typeof TAB_OPTIONS)[number]["key"];

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

type BankAccountForm = {
  label: string;
  bank_name: string;
  account_type: string;
  account_number: string;
  account_holder_name: string;
  account_holder_id: string;
  is_default: boolean;
};

const INITIAL_BANK_FORM: BankAccountForm = {
  label: "",
  bank_name: "",
  account_type: "",
  account_number: "",
  account_holder_name: "",
  account_holder_id: "",
  is_default: false,
};

type BankAccountTableConfig = {
  table: string;
  orgColumn: string;
};

type NotificationPreference = {
  id: string | null;
  email: boolean;
  sms: boolean;
  frequency: "instant" | "daily" | "weekly" | "monthly";
};

type NotificationTableConfig = {
  table: string;
  orgColumn: string;
  emailColumn: string;
  smsColumn: string;
  frequencyColumn: string;
};

type MembershipItem = {
  user_id: string;
  role: string;
  status: string;
  full_name: string | null;
};

const NOTIFICATION_FREQUENCY_OPTIONS = [
  { value: "instant", label: "En cuanto ocurran" },
  { value: "daily", label: "Resumen diario" },
  { value: "weekly", label: "Resumen semanal" },
  { value: "monthly", label: "Resumen mensual" },
] as const;

type MembersResponse = {
  ok: boolean;
  items?: MembershipItem[];
  canEdit?: boolean;
  error?: string;
};

type MembershipMutationResponse = {
  ok: boolean;
  membership?: { user_id: string };
  error?: string;
};

type MembersDeleteResponse = {
  ok: boolean;
  error?: string;
};

function isMissingTableError(error: PostgrestError | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST110" || error.code === "PGRST302") return true;
  const message = error.message.toLowerCase();
  return message.includes("does not exist") || message.includes("unknown relationship") || message.includes("not exist");
}

function maskAccountNumber(value: string): string {
  const trimmed = value.replace(/\s+/g, "");
  if (trimmed.length <= 4) return trimmed;
  return `•••• ${trimmed.slice(-4)}`;
}

export function InvestorSettingsClient() {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId;
  const supabase = useMemo(() => createClientComponentClient(), []);

  const [activeTab, setActiveTab] = useState<TabKey>("bank");

  const [bankTable, setBankTable] = useState<BankAccountTableConfig | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [bankForm, setBankForm] = useState<BankAccountForm>(INITIAL_BANK_FORM);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSaving, setBankSaving] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);

  const [notificationTable, setNotificationTable] = useState<NotificationTableConfig | null>(null);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreference>({
    id: null,
    email: true,
    sms: false,
    frequency: "weekly",
  });
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);

  const [membersLoading, setMembersLoading] = useState(false);
  const [members, setMembers] = useState<MembershipItem[]>([]);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [membersCanEdit, setMembersCanEdit] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const selectedAccount = useMemo(
    () => bankAccounts.find((account) => account.id === selectedBankId) ?? null,
    [bankAccounts, selectedBankId],
  );

  useEffect(() => {
    if (!selectedAccount) {
      setBankForm(INITIAL_BANK_FORM);
      return;
    }
    setBankForm({
      label: selectedAccount.label ?? "",
      bank_name: selectedAccount.bank_name,
      account_type: selectedAccount.account_type,
      account_number: selectedAccount.account_number,
      account_holder_name: selectedAccount.account_holder_name,
      account_holder_id: selectedAccount.account_holder_id ?? "",
      is_default: selectedAccount.is_default,
    });
  }, [selectedAccount]);

  const loadBankAccounts = useCallback(async () => {
    if (!orgId) return;
    setBankLoading(true);
    setBankError(null);
    try {
      const candidates: BankAccountTableConfig[] = [
        { table: "investor_bank_accounts", orgColumn: "investor_org_id" },
        { table: "bank_accounts", orgColumn: "company_id" },
      ];

      let found: { config: BankAccountTableConfig; rows: BankAccount[] } | null = null;

      for (const candidate of candidates) {
        const { data, error } = await supabase
          .from(candidate.table)
          .select("id,label,bank_name,account_type,account_number,account_holder_name,account_holder_id,is_default")
          .eq(candidate.orgColumn, orgId)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false });

        if (error) {
          if (isMissingTableError(error)) {
            continue;
          }
          throw error;
        }

        found = { config: candidate, rows: data ?? [] };
        break;
      }

      if (!found) {
        setBankAccounts([]);
        setBankTable(null);
        return;
      }

      setBankTable(found.config);
      setBankAccounts(found.rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron cargar las cuentas";
      setBankError(message);
    } finally {
      setBankLoading(false);
    }
  }, [orgId, supabase]);

  const loadNotificationPreferences = useCallback(async () => {
    if (!orgId) return;
    setNotificationLoading(true);
    setNotificationError(null);
    try {
      const candidates: NotificationTableConfig[] = [
        {
          table: "investor_notification_preferences",
          orgColumn: "investor_org_id",
          emailColumn: "email_enabled",
          smsColumn: "sms_enabled",
          frequencyColumn: "frequency",
        },
        {
          table: "notification_preferences",
          orgColumn: "org_id",
          emailColumn: "email_enabled",
          smsColumn: "sms_enabled",
          frequencyColumn: "frequency",
        },
      ];

      let found: { config: NotificationTableConfig; row: NotificationPreference | null } | null = null;

      for (const candidate of candidates) {
        const { data, error } = await supabase
          .from(candidate.table)
          .select(`id,${candidate.emailColumn},${candidate.smsColumn},${candidate.frequencyColumn}`)
          .eq(candidate.orgColumn, orgId)
          .maybeSingle();

        if (error) {
          if (isMissingTableError(error)) {
            continue;
          }
          throw error;
        }

        if (data) {
          found = {
            config: candidate,
            row: {
              id: (data as { id: string | null }).id ?? null,
              email: Boolean((data as Record<string, unknown>)[candidate.emailColumn]),
              sms: Boolean((data as Record<string, unknown>)[candidate.smsColumn]),
              frequency:
                ((data as Record<string, unknown>)[candidate.frequencyColumn] as NotificationPreference["frequency"]) || "weekly",
            },
          };
        } else {
          found = { config: candidate, row: null };
        }
        break;
      }

      if (!found) {
        setNotificationTable(null);
        setNotificationPrefs({ id: null, email: true, sms: false, frequency: "weekly" });
        return;
      }

      setNotificationTable(found.config);
      setNotificationPrefs(
        found.row ?? {
          id: null,
          email: true,
          sms: false,
          frequency: "weekly",
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron cargar las preferencias";
      setNotificationError(message);
    } finally {
      setNotificationLoading(false);
    }
  }, [orgId, supabase]);

  const loadMembers = useCallback(async () => {
    if (!orgId) return;
    setMembersLoading(true);
    setMembersError(null);
    try {
      const response = await fetch(`/api/c/${orgId}/memberships`, { cache: "no-store" });
      const payload: MembersResponse = await response
        .json()
        .catch(() => ({ ok: false, error: "No se pudo leer la respuesta del servidor" }));

      if (!response.ok || !payload.ok || !Array.isArray(payload.items)) {
        throw new Error(payload.error || "No se pudieron cargar los usuarios");
      }

      setMembers(payload.items);
      setMembersCanEdit(Boolean(payload.canEdit));
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron cargar los usuarios";
      setMembersError(message);
    } finally {
      setMembersLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    loadBankAccounts();
    loadNotificationPreferences();
    loadMembers();
  }, [orgId, loadBankAccounts, loadNotificationPreferences, loadMembers]);

  const updateBankForm = <K extends keyof BankAccountForm>(field: K, value: BankAccountForm[K]) => {
    setBankForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetBankForm = () => {
    setSelectedBankId(null);
    setBankForm(INITIAL_BANK_FORM);
  };

  const handleBankSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!orgId) {
      toast.error("Organización no disponible");
      return;
    }
    if (!bankTable) {
      toast.error("No hay tabla configurada para cuentas bancarias");
      return;
    }
    if (bankSaving) return;

    if (!bankForm.bank_name.trim()) {
      toast.error("El nombre del banco es obligatorio");
      return;
    }
    if (!bankForm.account_type) {
      toast.error("Selecciona el tipo de cuenta");
      return;
    }
    if (!bankForm.account_number.trim()) {
      toast.error("El número de cuenta es obligatorio");
      return;
    }
    if (!bankForm.account_holder_name.trim()) {
      toast.error("El titular de la cuenta es obligatorio");
      return;
    }

    setBankSaving(true);
    try {
      const payload: Record<string, unknown> = {
        label: bankForm.label.trim() || null,
        bank_name: bankForm.bank_name.trim(),
        account_type: bankForm.account_type,
        account_number: bankForm.account_number.trim(),
        account_holder_name: bankForm.account_holder_name.trim(),
        account_holder_id: bankForm.account_holder_id.trim() || null,
        is_default: bankForm.is_default,
      };

      payload[bankTable.orgColumn] = orgId;

      const query = supabase.from(bankTable.table);

      const response = selectedBankId
        ? await query
            .update(payload)
            .eq("id", selectedBankId)
            .select("id,label,bank_name,account_type,account_number,account_holder_name,account_holder_id,is_default")
            .maybeSingle()
        : await query
            .insert(payload)
            .select("id,label,bank_name,account_type,account_number,account_holder_name,account_holder_id,is_default")
            .maybeSingle();

      if (response.error) {
        throw response.error;
      }

      const record = response.data as BankAccount | null;
      if (!record) {
        throw new Error("No se obtuvo la cuenta actualizada");
      }

      setBankAccounts((prev) => {
        const withoutCurrent = prev.filter((item) => item.id !== record.id);
        const next = [record, ...withoutCurrent];
        next.sort((a, b) => {
          if (a.is_default === b.is_default) return 0;
          return a.is_default ? -1 : 1;
        });
        return next;
      });

      if (!selectedBankId) {
        toast.success("Cuenta bancaria agregada");
        resetBankForm();
      } else {
        toast.success("Cuenta bancaria actualizada");
        setSelectedBankId(record.id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar la cuenta";
      toast.error(message);
    } finally {
      setBankSaving(false);
    }
  };

  const handleDeleteBankAccount = async (accountId: string) => {
    if (!orgId || !bankTable) return;
    const confirmDelete = window.confirm("¿Eliminar esta cuenta bancaria?");
    if (!confirmDelete) return;

    try {
      const { error } = await supabase.from(bankTable.table).delete().eq("id", accountId);
      if (error) {
        throw error;
      }
      setBankAccounts((prev) => prev.filter((item) => item.id !== accountId));
      if (selectedBankId === accountId) {
        resetBankForm();
      }
      toast.success("Cuenta bancaria eliminada");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo eliminar la cuenta";
      toast.error(message);
    }
  };

  const handleNotificationSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!orgId) {
      toast.error("Organización no disponible");
      return;
    }
    if (!notificationTable) {
      toast.error("No hay tabla configurada para notificaciones");
      return;
    }
    if (notificationSaving) return;

    setNotificationSaving(true);
    try {
      const payload: Record<string, unknown> = {
        [notificationTable.orgColumn]: orgId,
        [notificationTable.emailColumn]: notificationPrefs.email,
        [notificationTable.smsColumn]: notificationPrefs.sms,
        [notificationTable.frequencyColumn]: notificationPrefs.frequency,
      };

      const query = supabase.from(notificationTable.table);

      const response = notificationPrefs.id
        ? await query
            .update(payload)
            .eq("id", notificationPrefs.id)
            .select(`id,${notificationTable.emailColumn},${notificationTable.smsColumn},${notificationTable.frequencyColumn}`)
            .maybeSingle()
        : await query
            .insert(payload)
            .select(`id,${notificationTable.emailColumn},${notificationTable.smsColumn},${notificationTable.frequencyColumn}`)
            .maybeSingle();

      if (response.error) {
        throw response.error;
      }

      const data = response.data as Record<string, unknown> | null;
      if (data) {
        setNotificationPrefs({
          id: (data.id as string | null) ?? notificationPrefs.id,
          email: Boolean(data[notificationTable.emailColumn]),
          sms: Boolean(data[notificationTable.smsColumn]),
          frequency: (data[notificationTable.frequencyColumn] as NotificationPreference["frequency"]) || notificationPrefs.frequency,
        });
      }

      toast.success("Preferencias actualizadas");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron guardar las preferencias";
      toast.error(message);
    } finally {
      setNotificationSaving(false);
    }
  };

  const handleInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!orgId) return;
    if (!inviteEmail.trim()) {
      toast.error("Ingresa el correo del usuario a autorizar");
      return;
    }
    if (inviting) return;

    setInviting(true);
    try {
      const response = await fetch(`/api/c/${orgId}/memberships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: "INVESTOR", status: "ACTIVE" }),
      });
      const payload: MembershipMutationResponse = await response
        .json()
        .catch(() => ({ ok: false, error: "No se pudo leer la respuesta del servidor" }));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "No se pudo agregar al usuario");
      }
      toast.success("Usuario autorizado agregado");
      setInviteEmail("");
      await loadMembers();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo agregar al usuario";
      toast.error(message);
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!orgId) return;
    if (!window.confirm("¿Revocar acceso a este usuario?")) return;

    setRemovingUserId(userId);
    try {
      const response = await fetch(`/api/c/${orgId}/memberships`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const payload: MembersDeleteResponse = await response
        .json()
        .catch(() => ({ ok: false, error: "No se pudo leer la respuesta del servidor" }));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "No se pudo revocar el acceso");
      }
      toast.success("Acceso revocado");
      await loadMembers();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo revocar el acceso";
      toast.error(message);
    } finally {
      setRemovingUserId(null);
    }
  };

  if (!orgId) {
    return (
      <InlineBanner variant="warning" title="Organización no encontrada">
        No pudimos determinar la organización seleccionada. Vuelve a la lista e inténtalo de nuevo.
      </InlineBanner>
    );
  }

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2 rounded-lg bg-white p-2 shadow-sm ring-1 ring-lp-gray-200">
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition",
              activeTab === tab.key
                ? "bg-lp-primary-1 text-white shadow"
                : "text-lp-sec-3 hover:bg-lp-primary-1/10 hover:text-lp-primary-1",
            )}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "bank" && (
        <section className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-lp-primary-1">Cuenta bancaria de desembolsos</h3>
            <p className="text-sm text-lp-sec-3">
              Registra o actualiza la cuenta bancaria donde recibirás los pagos y distribuciones de tu portafolio.
            </p>
          </div>

          {bankError && <InlineBanner variant="error" title="No se pudieron cargar las cuentas">{bankError}</InlineBanner>}

          <Card className="border-lp-gray-200/70">
            <CardHeader>
              <CardTitle>{selectedBankId ? "Editar cuenta" : "Agregar cuenta"}</CardTitle>
              <CardDescription>
                Completa los datos requeridos para registrar tu cuenta bancaria. Solo los usuarios autorizados podrán verla.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleBankSubmit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bank-label">Alias</Label>
                    <Input
                      id="bank-label"
                      placeholder="Cuenta principal"
                      value={bankForm.label}
                      onChange={(event) => updateBankForm("label", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank-name">Banco</Label>
                    <Input
                      id="bank-name"
                      required
                      placeholder="Bancolombia"
                      value={bankForm.bank_name}
                      onChange={(event) => updateBankForm("bank_name", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account-type">Tipo de cuenta</Label>
                    <select
                      id="account-type"
                      required
                      className="w-full rounded-md border border-lp-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-lp-primary-1 focus:outline-none focus:ring-1 focus:ring-lp-primary-1"
                      value={bankForm.account_type}
                      onChange={(event) => updateBankForm("account_type", event.target.value)}
                    >
                      <option value="">Selecciona un tipo</option>
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
                      required
                      placeholder="000123456789"
                      value={bankForm.account_number}
                      onChange={(event) => updateBankForm("account_number", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account-holder-name">Titular de la cuenta</Label>
                    <Input
                      id="account-holder-name"
                      required
                      placeholder="Nombre del titular"
                      value={bankForm.account_holder_name}
                      onChange={(event) => updateBankForm("account_holder_name", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account-holder-id">Documento del titular</Label>
                    <Input
                      id="account-holder-id"
                      placeholder="CC 10.234.567"
                      value={bankForm.account_holder_id}
                      onChange={(event) => updateBankForm("account_holder_id", event.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="account-default"
                    checked={bankForm.is_default}
                    onCheckedChange={(checked) => updateBankForm("is_default", Boolean(checked))}
                  />
                  <Label htmlFor="account-default" className="text-sm text-lp-sec-3">
                    Establecer como cuenta predeterminada para desembolsos
                  </Label>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={bankSaving}>
                    {bankSaving ? "Guardando…" : selectedBankId ? "Guardar cambios" : "Agregar cuenta"}
                  </Button>
                  {selectedBankId && (
                    <Button type="button" variant="secondary" onClick={resetBankForm} disabled={bankSaving}>
                      Cancelar edición
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-lp-gray-200/70">
            <CardHeader>
              <CardTitle>Cuentas registradas</CardTitle>
              <CardDescription>Selecciona una cuenta para editarla o elimínala si ya no la utilizas.</CardDescription>
            </CardHeader>
            <CardContent>
              {bankLoading ? (
                <p className="text-sm text-lp-sec-3">Cargando cuentas…</p>
              ) : bankAccounts.length === 0 ? (
                <p className="text-sm text-lp-sec-3">Aún no has registrado cuentas bancarias.</p>
              ) : (
                <ul className="divide-y divide-lp-gray-200">
                  {bankAccounts.map((account) => (
                    <li key={account.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="text-left text-sm font-medium text-lp-primary-1 hover:underline"
                            onClick={() => setSelectedBankId(account.id)}
                          >
                            {account.label || account.bank_name}
                          </button>
                          {account.is_default && (
                            <span className="rounded-full bg-lp-primary-1/10 px-2 py-0.5 text-xs font-medium text-lp-primary-1">
                              Predeterminada
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-lp-sec-3">
                          {account.bank_name} · {maskAccountNumber(account.account_number)}
                        </p>
                        <p className="text-xs text-lp-sec-4">
                          Titular: {account.account_holder_name}
                          {account.account_holder_id ? ` · ${account.account_holder_id}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setSelectedBankId(account.id)}>
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDeleteBankAccount(account.id)}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {activeTab === "notifications" && (
        <section className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-lp-primary-1">Preferencias de notificación</h3>
            <p className="text-sm text-lp-sec-3">
              Elige cómo y con qué frecuencia deseas recibir notificaciones sobre tus inversiones y movimientos relevantes.
            </p>
          </div>

          {notificationError && (
            <InlineBanner variant="error" title="No se pudieron cargar las preferencias">
              {notificationError}
            </InlineBanner>
          )}

          <Card className="border-lp-gray-200/70">
            <CardHeader>
              <CardTitle>Canales y frecuencia</CardTitle>
              <CardDescription>
                Configura los canales de contacto habilitados para recibir avisos del portal y establece la frecuencia deseada.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {notificationLoading ? (
                <p className="text-sm text-lp-sec-3">Cargando preferencias…</p>
              ) : (
                <form className="space-y-6" onSubmit={handleNotificationSave}>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 rounded-lg border border-lp-gray-200/80 p-4">
                      <Checkbox
                        id="pref-email"
                        checked={notificationPrefs.email}
                        onCheckedChange={(checked) =>
                          setNotificationPrefs((prev) => ({ ...prev, email: Boolean(checked) }))
                        }
                      />
                      <div className="space-y-1">
                        <Label htmlFor="pref-email" className="font-medium text-lp-primary-1">
                          Correo electrónico
                        </Label>
                        <p className="text-xs text-lp-sec-4">
                          Recibe confirmaciones, extractos y avisos operativos en tu correo registrado.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border border-lp-gray-200/80 p-4">
                      <Checkbox
                        id="pref-sms"
                        checked={notificationPrefs.sms}
                        onCheckedChange={(checked) =>
                          setNotificationPrefs((prev) => ({ ...prev, sms: Boolean(checked) }))
                        }
                      />
                      <div className="space-y-1">
                        <Label htmlFor="pref-sms" className="font-medium text-lp-primary-1">
                          SMS
                        </Label>
                        <p className="text-xs text-lp-sec-4">
                          Recibe alertas clave directamente en tu celular (pueden aplicar costos del operador).
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pref-frequency">Frecuencia</Label>
                    <select
                      id="pref-frequency"
                      className="w-full rounded-md border border-lp-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-lp-primary-1 focus:outline-none focus:ring-1 focus:ring-lp-primary-1"
                      value={notificationPrefs.frequency}
                      onChange={(event) =>
                        setNotificationPrefs((prev) => ({ ...prev, frequency: event.target.value as NotificationPreference["frequency"] }))
                      }
                    >
                      {NOTIFICATION_FREQUENCY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" disabled={notificationSaving}>
                      {notificationSaving ? "Guardando…" : "Guardar preferencias"}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {activeTab === "users" && (
        <section className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-lp-primary-1">Usuarios autorizados</h3>
            <p className="text-sm text-lp-sec-3">
              Controla quién puede ingresar al portal de inversores con rol de INVESTOR y revoca el acceso cuando sea necesario.
            </p>
          </div>

          {membersError && (
            <InlineBanner variant="error" title="No se pudieron cargar los usuarios">
              {membersError}
            </InlineBanner>
          )}

          <Card className="border-lp-gray-200/70">
            <CardHeader>
              <CardTitle>Miembros activos</CardTitle>
              <CardDescription>
                Los usuarios listados a continuación tienen acceso al portal con los permisos asignados en la organización.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {membersLoading ? (
                <p className="text-sm text-lp-sec-3">Cargando usuarios…</p>
              ) : members.length === 0 ? (
                <p className="text-sm text-lp-sec-3">Aún no hay usuarios autorizados.</p>
              ) : (
                <ul className="divide-y divide-lp-gray-200">
                  {members.map((member) => (
                    <li key={member.user_id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-lp-primary-1">
                          {member.full_name || "Usuario sin nombre"}
                        </p>
                        <p className="text-xs uppercase tracking-wide text-lp-sec-4">
                          Rol: {member.role} · Estado: {member.status}
                        </p>
                      </div>
                      {membersCanEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          disabled={removingUserId === member.user_id}
                          onClick={() => handleRemoveMember(member.user_id)}
                        >
                          {removingUserId === member.user_id ? "Revocando…" : "Revocar acceso"}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {membersCanEdit ? (
            <Card className="border-lp-gray-200/70">
              <CardHeader>
                <CardTitle>Invitar nuevo usuario</CardTitle>
                <CardDescription>
                  Autoriza a otro inversionista ingresando su correo electrónico. El usuario recibirá acceso con rol INVESTOR.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={handleInvite}>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="invite-email">Correo electrónico</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      required
                      placeholder="inversor@correo.com"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                    />
                  </div>
                  <Button type="submit" className="shrink-0" disabled={inviting}>
                    {inviting ? "Enviando invitación…" : "Autorizar"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <InlineBanner variant="warning" title="No tienes permisos para editar">
              Solicita a un administrador de la organización que te otorgue permisos para gestionar usuarios.
            </InlineBanner>
          )}
        </section>
      )}
    </div>
  );
}
