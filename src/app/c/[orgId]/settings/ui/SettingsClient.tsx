"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MembersManager } from "./MembersManager";

type CompanySettingsPayload = {
  name: string | null;
  legal_name: string | null;
  tax_id: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  billing_email: string | null;
  bank_account: string | null;
  notification_email: boolean | null;
  notification_sms: boolean | null;
  notification_whatsapp: boolean | null;
  updated_at?: string | null;
};

type FormState = {
  name: string;
  legal_name: string;
  tax_id: string;
  contact_email: string;
  contact_phone: string;
  billing_email: string;
  bank_account: string;
  notification_email: boolean;
  notification_sms: boolean;
  notification_whatsapp: boolean;
};

type SettingsResponse = {
  ok: boolean;
  company?: CompanySettingsPayload;
  membership?: { role?: string | null; status?: string | null } | null;
  isStaff?: boolean;
  canEdit?: boolean;
  error?: string;
};

type SettingsClientProps = {
  orgId: string;
};

export function SettingsClient({ orgId }: SettingsClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [membershipRole, setMembershipRole] = useState<string | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const baselineRef = useRef<FormState | null>(null);

  const mapCompany = useCallback((company: CompanySettingsPayload): FormState => {
    return {
      name: (company.name ?? "").trim(),
      legal_name: (company.legal_name ?? "").trim(),
      tax_id: (company.tax_id ?? "").trim(),
      contact_email: (company.contact_email ?? "").trim(),
      contact_phone: (company.contact_phone ?? "").trim(),
      billing_email: (company.billing_email ?? "").trim(),
      bank_account: (company.bank_account ?? "").trim(),
      notification_email: company.notification_email ?? true,
      notification_sms: company.notification_sms ?? false,
      notification_whatsapp: company.notification_whatsapp ?? false,
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/c/${orgId}/settings`, { cache: "no-store" });
      const data: SettingsResponse = await res.json().catch(() => ({ ok: false, error: "No se pudo leer la respuesta" }));
      if (!res.ok || !data.ok || !data.company) {
        throw new Error(data.error || "No se pudieron cargar los ajustes");
      }
      const next = mapCompany(data.company);
      setForm(next);
      baselineRef.current = { ...next };
      setCanEdit(Boolean(data.canEdit));
      setMembershipRole((data.membership?.role ?? null) && String(data.membership?.role).toUpperCase());
      setIsStaff(Boolean(data.isStaff));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [mapCompany, orgId]);

  useEffect(() => {
    load().catch(() => null);
  }, [load]);

  const hasChanges = useMemo(() => {
    if (!form || !baselineRef.current) return false;
    return JSON.stringify(form) !== JSON.stringify(baselineRef.current);
  }, [form]);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const updateToggle = (field: keyof FormState, checked: boolean | string) => {
    const nextValue = checked === true || checked === "indeterminate";
    setForm((prev) => (prev ? { ...prev, [field]: nextValue } : prev));
  };

  const resetForm = () => {
    if (baselineRef.current) {
      setForm({ ...baselineRef.current });
    }
  };

  const handleDelete = async () => {
    if (!canEdit) {
      toast.error("No tienes permisos para eliminar esta organización");
      return;
    }
    if (!confirm("¿Eliminar esta organización? Esta acción no se puede deshacer.")) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({ ok: false, error: "No se pudo leer la respuesta" }));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo eliminar la organización");
      }
      toast.success("Organización eliminada");
      router.push("/select-org");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const toPayload = (state: FormState) => {
    const normalize = (value: string) => {
      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    };
    return {
      name: normalize(state.name),
      legal_name: normalize(state.legal_name),
      tax_id: normalize(state.tax_id),
      contact_email: normalize(state.contact_email),
      contact_phone: normalize(state.contact_phone),
      billing_email: normalize(state.billing_email),
      bank_account: normalize(state.bank_account),
      notification_email: state.notification_email,
      notification_sms: state.notification_sms,
      notification_whatsapp: state.notification_whatsapp,
    } satisfies Partial<CompanySettingsPayload>;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;
    if (!canEdit) {
      toast.error("No tienes permisos para editar estos ajustes");
      return;
    }
    if (!form.name.trim()) {
      toast.error("El nombre de la empresa es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const payload = toPayload(form);
      const res = await fetch(`/api/c/${orgId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: SettingsResponse = await res.json().catch(() => ({ ok: false, error: "No se pudo leer la respuesta" }));
      if (!res.ok || !data.ok || !data.company) {
        throw new Error(data.error || "No se pudieron guardar los cambios");
      }
      const next = mapCompany(data.company);
      setForm(next);
      baselineRef.current = { ...next };
      toast.success("Ajustes guardados");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const displayOrgName = (() => {
    const fromForm = form?.name?.trim() || baselineRef.current?.name?.trim() || "";
    return fromForm || orgId;
  })();

  return (
    <div className="space-y-6">
      <Toaster position="top-center" richColors />
      <div>
        <h1 className="font-colette text-2xl font-bold text-lp-primary-1">Configuracion</h1>
        <p className="text-sm text-lp-sec-3">
          Gestiona los datos de la organización <span className="font-semibold text-lp-primary-1">{displayOrgName}</span>.
        </p>
        <div className="mt-2 text-xs text-lp-sec-3">
          Rol: {isStaff ? "staff" : membershipRole ? membershipRole.toLowerCase() : "miembro"}
          {!canEdit && (
            <span className="ml-2 text-red-600">(solo lectura)</span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="rounded-md border border-dashed border-lp-sec-4/60 p-4 text-sm text-lp-sec-3">
          Cargando ajustes...
        </div>
      ) : error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : !form ? (
        <div className="rounded-md border border-dashed border-lp-sec-4/60 p-4 text-sm text-lp-sec-3">
          No se encontraron datos de la organización.
        </div>
      ) : (
        <>
          <form className="space-y-8" onSubmit={handleSubmit}>
            <section className="space-y-4 rounded-lg border border-lp-sec-4/60 p-5">
            <div>
              <h2 className="text-lg font-semibold text-lp-primary-1">Datos de la empresa</h2>
              <p className="text-sm text-lp-sec-3">Actualiza la informacion basica que usamos para contratos y comunicaciones.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company-name">Nombre publico</Label>
                <Input
                  id="company-name"
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Ej: Mi Empresa SAS"
                  disabled={!canEdit || saving}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-legal-name">Razon social</Label>
                <Input
                  id="company-legal-name"
                  value={form.legal_name}
                  onChange={(event) => updateField("legal_name", event.target.value)}
                  placeholder="Opcional"
                  disabled={!canEdit || saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-tax-id">Numero de identificacion</Label>
                <Input
                  id="company-tax-id"
                  value={form.tax_id}
                  onChange={(event) => updateField("tax_id", event.target.value)}
                  placeholder="NIT sin digito de verificacion"
                  disabled={!canEdit || saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-bank">Cuenta bancaria</Label>
                <Input
                  id="company-bank"
                  value={form.bank_account}
                  onChange={(event) => updateField("bank_account", event.target.value)}
                  placeholder="Banco - tipo de cuenta - numero"
                  disabled={!canEdit || saving}
                />
              </div>
            </div>
            </section>

            <section className="space-y-4 rounded-lg border border-lp-sec-4/60 p-5">
            <div>
              <h2 className="text-lg font-semibold text-lp-primary-1">Contacto y facturacion</h2>
              <p className="text-sm text-lp-sec-3">Estos datos se usan para notificaciones y soporte de operaciones.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company-email">Correo principal</Label>
                <Input
                  id="company-email"
                  type="email"
                  value={form.contact_email}
                  onChange={(event) => updateField("contact_email", event.target.value)}
                  placeholder="contacto@empresa.com"
                  disabled={!canEdit || saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-phone">Telefono</Label>
                <Input
                  id="company-phone"
                  value={form.contact_phone}
                  onChange={(event) => updateField("contact_phone", event.target.value)}
                  placeholder="Ej: +57 3000000000"
                  disabled={!canEdit || saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-billing-email">Correo de facturacion</Label>
                <Input
                  id="company-billing-email"
                  type="email"
                  value={form.billing_email}
                  onChange={(event) => updateField("billing_email", event.target.value)}
                  placeholder="contabilidad@empresa.com"
                  disabled={!canEdit || saving}
                />
              </div>
            </div>
            </section>

            <section className="space-y-4 rounded-lg border border-lp-sec-4/60 p-5">
            <div>
              <h2 className="text-lg font-semibold text-lp-primary-1">Notificaciones</h2>
              <p className="text-sm text-lp-sec-3">Elige como quieres recibir recordatorios y alertas sobre tus operaciones.</p>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-3 text-sm">
                <Checkbox
                  checked={form.notification_email}
                  onCheckedChange={(value) => updateToggle("notification_email", value)}
                  disabled={!canEdit || saving}
                />
                <span>Recibir correos sobre movimientos y documentos</span>
              </label>
              <label className="flex items-center gap-3 text-sm">
                <Checkbox
                  checked={form.notification_sms}
                  onCheckedChange={(value) => updateToggle("notification_sms", value)}
                  disabled={!canEdit || saving}
                />
                <span>Alertas por SMS para hitos importantes</span>
              </label>
              <label className="flex items-center gap-3 text-sm">
                <Checkbox
                  checked={form.notification_whatsapp}
                  onCheckedChange={(value) => updateToggle("notification_whatsapp", value)}
                  disabled={!canEdit || saving}
                />
                <span>Mensajes por WhatsApp en eventos criticos</span>
              </label>
            </div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-lp-sec-3">
              Los cambios se guardan para toda la organización.
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={resetForm} disabled={!hasChanges || saving || !canEdit}>
                Restablecer
              </Button>
              <Button type="submit" disabled={!hasChanges || saving || !canEdit}>
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </div>
          </form>
          <MembersManager orgId={orgId} />
          <section className="space-y-4 rounded-lg border border-red-200/80 bg-red-50/60 p-5">
            <div>
              <h2 className="text-lg font-semibold text-red-700">Eliminar organización</h2>
              <p className="text-sm text-red-600">
                Quita permanentemente esta organización del portal. Todos los datos asociados se eliminarán y no podrás
                recuperarlos.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={!canEdit || deleting}
            >
              {deleting ? "Eliminando..." : "Eliminar organización"}
            </Button>
            {!canEdit && (
              <p className="text-xs text-red-600/80">Solo los administradores pueden eliminar una organización.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}





