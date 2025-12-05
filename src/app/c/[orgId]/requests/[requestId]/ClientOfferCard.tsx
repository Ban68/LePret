"use client";

import { useState } from "react";
import { Check, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type Offer = {
    id: string;
    annual_rate: number;
    advance_pct: number;
    fees: Record<string, number> | null;
    valid_until: string | null;
    status: string;
};

type ClientOfferCardProps = {
    offer: Offer;
    requestedAmount: number;
};

export function ClientOfferCard({ offer, requestedAmount }: ClientOfferCardProps) {
    const router = useRouter();
    const [loading, setLoading] = useState<"accept" | "reject" | null>(null);

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency: "COP",
            maximumFractionDigits: 0,
        }).format(val);

    const advanceAmount = requestedAmount * (offer.advance_pct / 100);
    // Flatten simple fees for display
    const processingFee = offer.fees?.processing_fee ?? 0;
    const netAmount = advanceAmount - processingFee;

    const handleAction = async (action: "accept" | "reject") => {
        if (!confirm(action === "accept" ? "¿Aceptas las condiciones de esta oferta?" : "¿Seguro que deseas rechazar la oferta?")) {
            return;
        }

        setLoading(action);
        try {
            const res = await fetch(`/api/offers/${offer.id}/${action}`, {
                method: "POST",
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || `Error al ${action === "accept" ? "aceptar" : "rechazar"}`);
            }

            toast.success(action === "accept" ? "¡Oferta aceptada!" : "Oferta rechazada");
            router.refresh();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Error inesperado";

            toast.error(message);
        } finally {
            setLoading(null);
        }
    };

    if (offer.status !== "offered") {
        // If accepted/rejected, usually the page layout handles status badge, 
        // but we can show a summary "You accepted this on..." if needed.
        // For now, return null as per plan to only show Card when actionable or explicitly needed.
        // Actually, showing "Terminos pactados" is good for history.
        return (
            <Card className="border-lp-primary-1/20 bg-lp-primary-1/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lp-primary-1">
                        <Check className="h-5 w-5" /> Oferta {offer.status === 'accepted' ? 'Aceptada' : 'Finalizada'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                    <p>Monto Neto: <strong>{formatCurrency(netAmount)}</strong></p>
                    <p>Tasa: {offer.annual_rate}% E.A.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="overflow-hidden border-2 border-lp-primary-1 shadow-md">
            <CardHeader className="bg-lp-primary-1 text-white">
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="text-xl">¡Tu Oferta está lista!</CardTitle>
                        <CardDescription className="text-lp-sec-4">
                            Hemos analizado tu solicitud. Revisa las condiciones finales.
                        </CardDescription>
                    </div>
                    <Info className="text-white/80" />
                </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
                <div className="grid grid-cols-2 gap-4 text-center md:grid-cols-4">
                    <div className="rounded-lg bg-slate-50 p-3">
                        <span className="block text-xs uppercase text-gray-500">Monto Solicitado</span>
                        <span className="block text-lg font-bold text-gray-900">{formatCurrency(requestedAmount)}</span>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                        <span className="block text-xs uppercase text-gray-500">% Anticipo</span>
                        <span className="block text-lg font-bold text-lp-primary-1">{offer.advance_pct}%</span>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                        <span className="block text-xs uppercase text-gray-500">Tasa E.A.</span>
                        <span className="block text-lg font-bold text-lp-primary-1">{offer.annual_rate}%</span>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                        <span className="block text-xs uppercase text-gray-500">Comisiones</span>
                        <span className="block text-lg font-bold text-red-600">-{formatCurrency(processingFee)}</span>
                    </div>
                </div>

                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-6 text-center">
                    <p className="mb-1 text-sm font-medium text-emerald-800">Monto Neto a Desembolsar (Estimado)</p>
                    <p className="text-4xl font-extrabold text-emerald-700">{formatCurrency(netAmount)}</p>
                    <p className="mt-2 text-xs text-emerald-600/80">
                        * Sujeto a verificación final de cuenta bancaria y firma de contrato.
                    </p>
                </div>

                {offer.valid_until && (
                    <p className="text-center text-xs text-gray-500">
                        Esta oferta es válida hasta el {new Date(offer.valid_until).toLocaleDateString()}.
                    </p>
                )}
            </CardContent>
            <Separator />
            <CardFooter className="flex justify-end gap-3 bg-gray-50 p-4">
                <Button
                    variant="outline"
                    className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                    onClick={() => handleAction("reject")}
                    disabled={loading !== null}
                >
                    {loading === "reject" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Rechazar
                </Button>
                <Button
                    className="bg-lp-primary-1 px-8 hover:bg-lp-primary-1/90"
                    onClick={() => handleAction("accept")}
                    disabled={loading !== null}
                >
                    {loading === "accept" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Aceptar Oferta
                </Button>
            </CardFooter>
        </Card>
    );
}
