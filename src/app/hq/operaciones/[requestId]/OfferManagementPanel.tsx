"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Save } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type Offer = {
    id: string;
    annual_rate: number;
    advance_pct: number;
    fees: Record<string, number> | null;
    valid_until: string | null;
    status: string;
    net_amount: number | null;
};

type OfferManagementPanelProps = {
    requestId: string;
    existingOffer: Offer | null;
    requestStatus: string;
    requestedAmount: number;
};

export function OfferManagementPanel({
    requestId,
    existingOffer,
    requestStatus,
    requestedAmount,
}: OfferManagementPanelProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [rate, setRate] = useState(existingOffer?.annual_rate?.toString() ?? "24"); // Default 24%
    const [advance, setAdvance] = useState(existingOffer?.advance_pct?.toString() ?? "80"); // Default 80%
    const [validUntil, setValidUntil] = useState(
        existingOffer?.valid_until ? existingOffer.valid_until.split("T")[0] : ""
    );

    // Simple Fees handling: just one 'Processing Fee' for MVP
    const [feeAmount, setFeeAmount] = useState<string>(
        existingOffer?.fees?.processing_fee?.toString() ?? "0"
    );

    const isReadOnly = requestStatus === "accepted" || requestStatus === "funded" || requestStatus === "signed";

    const calculateNet = () => {
        const rAmount = requestedAmount;
        const adv = Number(advance);
        const f = Number(feeAmount);
        if (Number.isNaN(adv) || Number.isNaN(f)) return 0;

        // Simple calculation: Request * Advance% - Fees
        // Logic can be more complex (interest upfront etc), but sticking to simple for MVP
        const grossAdvance = rAmount * (adv / 100);
        return grossAdvance - f;
    };

    const netAmount = calculateNet();

    const handleSave = async () => {
        setLoading(true);
        try {
            const payload = {
                annual_rate: Number(rate),
                advance_pct: Number(advance),
                fees: { processing_fee: Number(feeAmount) },
                valid_until: validUntil ? new Date(validUntil).toISOString() : null,
            };

            const res = await fetch(`/api/operations/${requestId}/offer`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Error guardando oferta");
            }

            const data = await res.json();
            toast.success(data.action === "created" ? "Oferta creada" : "Oferta actualizada");
            router.refresh();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Error inesperado";

            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    if (isReadOnly && !existingOffer) {
        return null; // Don't show panel if no offer and request is already past stage
    }

    return (
        <Card className="border-lp-sec-4/60">
            <CardHeader className="bg-lp-sec-4/10 pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-medium text-lp-primary-1">
                        Gestión de Oferta
                    </CardTitle>
                    {existingOffer?.status === "accepted" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">
                            <CheckCircle2 className="h-3 w-3" /> Aceptada
                        </span>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Tasa E.A. (%)</Label>
                        <div className="relative">
                            <Input
                                type="number"
                                value={rate}
                                onChange={(e) => setRate(e.target.value)}
                                disabled={isReadOnly}
                                step="0.01"
                                className="pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">%</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>% Anticipo</Label>
                        <div className="relative">
                            <Input
                                type="number"
                                value={advance}
                                onChange={(e) => setAdvance(e.target.value)}
                                disabled={isReadOnly}
                                step="1"
                                className="pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">%</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Comsiones (Valor Fijo)</Label>
                        <Input
                            type="number"
                            value={feeAmount}
                            onChange={(e) => setFeeAmount(e.target.value)}
                            disabled={isReadOnly}
                            placeholder="0"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Válida hasta</Label>
                        <Input
                            type="date"
                            value={validUntil}
                            onChange={(e) => setValidUntil(e.target.value)}
                            disabled={isReadOnly}
                        />
                    </div>
                </div>

                <div className="rounded-md bg-slate-50 p-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Monto Solicitado:</span>
                        <span className="font-medium">
                            {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(requestedAmount)}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                        <span className="text-gray-600">Anticipo Bruto:</span>
                        <span className="font-medium">
                            {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(requestedAmount * (Number(advance) / 100))}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1 border-b pb-2">
                        <span className="text-gray-600">Descuentos/Comisiones:</span>
                        <span className="font-medium text-red-600">
                            - {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(feeAmount))}
                        </span>
                    </div>
                    <div className="flex justify-between text-base font-bold text-lp-primary-1 mt-2">
                        <span>Neto a Girar (Est.):</span>
                        <span>
                            {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(netAmount)}
                        </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">* El cálculo final puede variar según la fecha exacta de desembolso.</p>
                </div>
            </CardContent>
            {!isReadOnly && (
                <CardFooter className="flex justify-end bg-slate-50 py-3">
                    <Button onClick={handleSave} disabled={loading} className="gap-2">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {existingOffer ? "Actualizar Oferta" : "Generar Oferta"}
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}
