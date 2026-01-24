"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Calendar, Calculator } from "lucide-react";

interface PricingExampleProps {
  monto: number;
  plazo: number;
}

export function PricingExample({ monto, plazo }: PricingExampleProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);

  // Keep internal state as number strings for input handling, but process as numbers
  const [amountStr, setAmountStr] = useState(monto.toLocaleString("es-CO"));
  const [term, setTerm] = useState(plazo);

  const getNumericAmount = (str: string) => {
    return Number(str.replace(/\D/g, "")) || 0;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, "");
    const numberVal = Number(rawVal);
    setAmountStr(numberVal.toLocaleString("es-CO"));
  };

  const calculateRate = (days: number) => {
    if (days <= 30) return 0.015;
    if (days <= 60) return 0.025;
    if (days <= 90) return 0.035;
    return 0.04;
  };

  const currentAmount = getNumericAmount(amountStr);
  const rate = calculateRate(term);
  const discountAmount = Math.round(currentAmount * rate);
  const toReceive = currentAmount - discountAmount;

  return (
    <Card className="w-full max-w-2xl mx-auto border-none shadow-card overflow-hidden">
      <div className="bg-lp-primary-1 p-6 text-white text-center">
        <h3 className="text-2xl font-colette font-bold flex items-center justify-center gap-2">
          <Calculator className="h-6 w-6" /> Simulador de Costos
        </h3>
        <p className="text-white/80 text-sm mt-1">Calcula cuánto recibirías por tu factura</p>
      </div>

      <CardContent className="p-8 space-y-8 bg-white">

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <Label htmlFor="monto" className="text-lp-primary-1 font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Valor de la Factura
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lp-sec-3 font-bold">$</span>
              <Input
                id="monto"
                className="pl-8 text-lg font-bold text-lp-primary-1 border-lp-sec-4/30 h-12 focus-visible:ring-lp-primary-1"
                value={amountStr}
                onChange={handleAmountChange}
              />
            </div>
          </div>

          <div className="space-y-4">
            <Label htmlFor="plazo" className="text-lp-primary-1 font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Plazo (Días): <span className="text-xl font-bold">{term}</span>
            </Label>
            <Slider
              value={[term]}
              min={1}
              max={120}
              step={1}
              onValueChange={(vals) => setTerm(vals[0])}
              className="py-4"
            />
          </div>
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-dashed border-gray-200">
          <div className="bg-lp-primary-2/30 p-4 rounded-xl text-center">
            <p className="text-sm text-lp-sec-3 mb-1">Tasa Estimada</p>
            <p className="text-2xl font-bold text-lp-primary-1">{(rate * 100).toFixed(2)}%</p>
          </div>
          <div className="bg-lp-primary-2/30 p-4 rounded-xl text-center">
            <p className="text-sm text-lp-sec-3 mb-1">Costo Financiero</p>
            <p className="text-xl font-bold text-red-500/80">-{formatCurrency(discountAmount)}</p>
          </div>
        </div>

        {/* Grand Total */}
        <div className="bg-lp-primary-1/5 rounded-2xl p-6 text-center border border-lp-primary-1/10">
          <p className="text-lp-sec-3 font-medium mb-2 uppercase tracking-wide text-xs">Valor Neto a Recibir</p>
          <p className="text-4xl font-bold text-lp-primary-1 text-shadow-sm">
            {formatCurrency(toReceive)}
          </p>
        </div>

        <p className="text-xs text-center text-gray-500 italic px-4">
          * Cifras estimadas con fines ilustrativos. La tasa final depende del análisis de riesgo del pagador.
        </p>

      </CardContent>
    </Card>
  );
}
