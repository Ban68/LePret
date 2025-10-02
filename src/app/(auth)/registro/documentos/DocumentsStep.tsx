"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { UseOnboardingReturn } from "../_components/useOnboarding";
import { normalizeKycStatus } from "@/lib/organizations";

type DocumentsStepProps = {
  companyId: string;
  onboarding: UseOnboardingReturn;
};

type UploadState = Record<string, boolean>;

type RequiredDoc = {
  key: string;
  label: string;
  description: string;
};

const REQUIRED_DOCS: RequiredDoc[] = [
  { key: "rut", label: "RUT actualizado", description: "Formato PDF o imagen del Registro Único Tributario." },
  { key: "representante", label: "Documento del representante legal", description: "Cédula o pasaporte vigente del representante." },
  { key: "estatutos", label: "Documentos societarios", description: "Acta o certificación de existencia y representación legal." },
];

function formatBytes(bytes?: number): string {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function DocumentsStep({ companyId, onboarding }: DocumentsStepProps) {
  const router = useRouter();
  const [uploading, setUploading] = useState<UploadState>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const documents = onboarding.data.documents;
  const kycStatus = onboarding.data.company?.kycStatus ?? null;
  const normalizedStatus = normalizeKycStatus(kycStatus);

  const handleUpload = async (docKey: string, fileList: FileList | null) => {
    if (!fileList || !fileList.length) return;
    const file = fileList[0];
    setUploading((prev) => ({ ...prev, [docKey]: true }));
    setError(null);
    try {
      const formData = new FormData();
      formData.append("type", docKey);
      formData.append("file", file);
      const response = await fetch(`/api/onboarding/${companyId}/documents`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = typeof payload?.error === "string" ? payload.error : "Error subiendo archivo";
        throw new Error(message);
      }
      toast.success("Documento cargado correctamente");
      await onboarding.refresh();
    } catch (err) {
      console.error("document upload error", err);
      setError(err instanceof Error ? err.message : "Error inesperado");
      toast.error("No pudimos subir el documento");
    } finally {
      setUploading((prev) => ({ ...prev, [docKey]: false }));
    }
  };

  const handleDelete = async (path: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/onboarding/${companyId}/documents`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = typeof payload?.error === "string" ? payload.error : "Error eliminando archivo";
        throw new Error(message);
      }
      toast.success("Documento eliminado");
      await onboarding.refresh();
    } catch (err) {
      console.error("document delete error", err);
      setError(err instanceof Error ? err.message : "Error inesperado");
      toast.error("No pudimos eliminar el documento");
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/onboarding/${companyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "status", status: "SUBMITTED" }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = typeof payload?.error === "string" ? payload.error : "Error enviando KYC";
        throw new Error(message);
      }
      toast.success("Enviamos tu información para revisión");
      await onboarding.refresh();
      router.push(`/select-org?orgId=${encodeURIComponent(companyId)}&status=submitted`);
    } catch (err) {
      console.error("kyc submit error", err);
      setError(err instanceof Error ? err.message : "Error inesperado");
      toast.error("No pudimos enviar la información");
    } finally {
      setSubmitting(false);
    }
  };

  const uploadedByType = useMemo(() => {
    const map = new Map<string, number>();
    documents.forEach((doc, index) => {
      if (!doc.path) return;
      const segments = doc.path.split("/");
      const name = segments.pop();
      if (!name) return;
      const key = name.split("-")[0];
      map.set(key, index);
    });
    return map;
  }, [documents]);

  const canSubmit = uploadedByType.size >= REQUIRED_DOCS.length;

  return (
    <div className="space-y-6">
      {normalizedStatus === "SUBMITTED" ? (
        <Alert>
          <AlertTitle>En revisión</AlertTitle>
          <AlertDescription>
            Ya recibimos tu información. Te notificaremos cuando el proceso haya finalizado.
          </AlertDescription>
        </Alert>
      ) : null}
      {normalizedStatus === "APPROVED" ? (
        <Alert>
          <AlertTitle className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
              Aprobado
            </span>
            KYC aprobado
          </AlertTitle>
          <AlertDescription>
            ¡Felicitaciones! Tu registro fue aprobado. Puedes volver al portal para operar normalmente.
          </AlertDescription>
        </Alert>
      ) : null}

      {REQUIRED_DOCS.map((doc) => {
        const index = uploadedByType.get(doc.key);
        const uploaded = typeof index === "number" ? documents[index] : null;
        return (
          <div key={doc.key} className="rounded-xl border border-lp-sec-4/40 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-lp-primary-1">{doc.label}</h3>
                <p className="text-sm text-lp-sec-3">{doc.description}</p>
                {uploaded ? (
                  <p className="mt-2 text-sm text-lp-sec-2">
                    Última carga: {uploaded.updatedAt ? new Date(uploaded.updatedAt).toLocaleString() : ""}
                    {uploaded.size ? ` · ${formatBytes(uploaded.size)}` : ""}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-lp-sec-2">Aún no se ha cargado este documento.</p>
                )}
              </div>
              <div className="flex flex-col gap-2 md:items-end">
                <Label className="cursor-pointer">
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(event) => handleUpload(doc.key, event.target.files)}
                    disabled={uploading[doc.key]}
                  />
                  <Button type="button" variant="outline" disabled={uploading[doc.key]}>
                    {uploading[doc.key] ? "Cargando..." : uploaded ? "Reemplazar documento" : "Subir documento"}
                  </Button>
                </Label>
                {uploaded ? (
                  <Button type="button" variant="ghost" onClick={() => handleDelete(uploaded.path)}>
                    Eliminar
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="ghost" onClick={() => router.push(`/registro/beneficiarios?orgId=${encodeURIComponent(companyId)}`)} className="w-full sm:w-auto">
          Volver
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={submitting || !canSubmit} className="w-full sm:w-auto">
          {submitting ? "Enviando..." : "Enviar a revisión"}
        </Button>
      </div>
    </div>
  );
}
