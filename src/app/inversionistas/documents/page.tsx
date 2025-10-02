import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabaseServer } from "@/lib/supabase-server";
import { fetchInvestorDocuments, getDefaultInvestorCompanyId } from "@/lib/investors";

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
}

function formatType(value: string): string {
  switch (value) {
    case "FINANCIAL_STATEMENT":
      return "Estado financiero";
    case "REPORT":
      return "Reporte";
    case "NOTICE":
      return "Notificación";
    default:
      return "Documento";
  }
}

export default async function InvestorDocumentsPage() {
  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login?redirectTo=/inversionistas/documents");
  }

  const companyId = await getDefaultInvestorCompanyId(session.user?.id);
  if (!companyId) {
    redirect("/login?redirectTo=/inversionistas/documents");
  }

  const documents = await fetchInvestorDocuments(supabase, companyId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-lp-primary-1">Documentos y reportes</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="min-w-full divide-y divide-lp-sec-5/60 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-lp-sec-4">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Vehículo</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Descripción</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-lp-sec-5/40">
            {documents.map((document) => (
              <tr key={document.id}>
                <td className="px-4 py-3 text-sm font-medium text-lp-primary-1">{document.name}</td>
                <td className="px-4 py-3 text-sm text-lp-sec-3">
                  {document.vehicles?.name?.trim() || "General"}
                </td>
                <td className="px-4 py-3 text-sm text-lp-sec-3">{formatType(document.doc_type)}</td>
                <td className="px-4 py-3 text-sm text-lp-sec-3">{document.description || "-"}</td>
                <td className="px-4 py-3 text-sm text-lp-sec-3">{formatDate(document.uploaded_at)}</td>
                <td className="px-4 py-3 text-sm">
                  {document.file_path ? (
                    <a
                      href={`/api/investors/documents/${document.id}/download`}
                      className="inline-flex items-center rounded-full border border-lp-primary-1 px-3 py-1 text-xs font-medium text-lp-primary-1 transition-colors hover:bg-lp-primary-1 hover:text-white"
                    >
                      Descargar
                    </a>
                  ) : (
                    <span className="text-xs text-lp-sec-4">Sin archivo</span>
                  )}
                </td>
              </tr>
            ))}
            {!documents.length && (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-lp-sec-4" colSpan={6}>
                  No se han cargado documentos todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
