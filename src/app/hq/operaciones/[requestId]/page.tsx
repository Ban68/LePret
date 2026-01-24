import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Calendar, FileText } from "lucide-react";

import { supabaseServer } from "@/lib/supabase-server";
import { Badge } from "@/components/ui/badge";
import { OfferManagementPanel } from "./OfferManagementPanel";

export default async function OperationDetailPage({
    params,
}: {
    params: Promise<{ requestId: string }>;
}) {
    const { requestId } = await params;
    const supabase = await supabaseServer();

    // 1. Get Request Details
    const { data: request, error } = await supabase
        .from("funding_requests")
        .select(`
      id,
      status,
      requested_amount,
      created_at,
      companies (
        id,
        name,
        tax_id
      ),
      invoices (
        count
      )
    `)
        .eq("id", requestId)
        .single();

    if (error || !request) {
        console.error(error);
        notFound();
    }

    // 2. Get Existing Offer (if any)
    const { data: existingOffer } = await supabase
        .from("offers")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    // Safe casting for potentially loose Supabase types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestData = request as any;
    const company = Array.isArray(requestData.companies) ? requestData.companies[0] : requestData.companies;
    const invoicesData = Array.isArray(requestData.invoices) ? requestData.invoices[0] : requestData.invoices;
    const companyName = company?.name ?? "N/A";
    const companyTaxId = company?.tax_id ?? "N/A";
    const invoiceCount = invoicesData?.count ?? 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link
                    href="/hq/operaciones"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-100"
                >
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">
                        Solicitud #{request.id.slice(0, 8)}
                    </h1>
                    <p className="text-sm text-slate-500">
                        Gestión y Análisis de Operación
                    </p>
                </div>
                <div className="ml-auto">
                    <Badge variant={request.status === "offered" ? "default" : "outline"}>
                        {request.status.toUpperCase()}
                    </Badge>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Left Column: Details */}
                <div className="space-y-6 lg:col-span-2">
                    <div className="rounded-lg border bg-white p-6 shadow-sm">
                        <h2 className="mb-4 text-lg font-medium">Detalles de la Solicitud</h2>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <span className="block text-xs uppercase text-gray-400">Cliente</span>
                                <div className="flex items-center gap-2 font-medium">
                                    <Building2 className="h-4 w-4 text-gray-400" />
                                    {companyName}
                                </div>
                                <span className="text-xs text-gray-500">{companyTaxId}</span>
                            </div>
                            <div>
                                <span className="block text-xs uppercase text-gray-400">Monto Solicitado</span>
                                <div className="text-lg font-bold text-lp-primary-1">
                                    {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(request.requested_amount)}
                                </div>
                            </div>
                            <div>
                                <span className="block text-xs uppercase text-gray-400">Fecha Creación</span>
                                <div className="flex items-center gap-2 text-sm">
                                    <Calendar className="h-4 w-4 text-gray-400" />
                                    {new Date(request.created_at).toLocaleDateString()}
                                </div>
                            </div>
                            <div>
                                <span className="block text-xs uppercase text-gray-400">Facturas</span>
                                <div className="flex items-center gap-2 text-sm">
                                    <FileText className="h-4 w-4 text-gray-400" />
                                    {invoiceCount} Facturas
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Timeline or Invoices List implementation could go here */}
                    <div className="rounded-lg border bg-gray-50 p-8 text-center text-gray-400 border-dashed">
                        <p>Vista detallada de facturas y timeline no implementada en este Sprint.</p>
                    </div>
                </div>

                {/* Right Column: Offer Management */}
                <div className="space-y-6">
                    <OfferManagementPanel
                        requestId={requestId}
                        existingOffer={existingOffer}
                        requestStatus={request.status}
                        requestedAmount={request.requested_amount}
                    />
                </div>
            </div>
        </div>
    );
}
