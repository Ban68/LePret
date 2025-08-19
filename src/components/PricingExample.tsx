"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PricingExampleProps {
  monto: number;
  plazo: number;
}

export function PricingExample({ monto, plazo }: PricingExampleProps) {
  const formatCurrency = (value: number) => "$" + value.toLocaleString("es-CO");

  const [amount, setAmount] = useState(formatCurrency(monto));
  const [term, setTerm] = useState(plazo);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    const number = digits ? Number(digits) : 0;
    setAmount(digits ? formatCurrency(number) : "");
  };

  const calculateRate = (days: number) => {
    if (days <= 30) return 0.015;
    if (days <= 60) return 0.025;
    if (days <= 90) return 0.035;
    return 0.04;
  };

  const rate = calculateRate(term);
  const numericAmount = Number(amount.replace(/\D/g, "")) || 0;
  const toReceive = Math.round(numericAmount * (1 - rate));

  return (
    <div className="mt-8 rounded-lg border border-lp-sec-4/50 bg-lp-primary-1/5 p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="monto">Monto de la factura (COP)</Label>
          <Input
            id="monto"
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={handleAmountChange}
          />
        </div>
        <div>
          <Label htmlFor="plazo">Plazo (días)</Label>
          <Input
            id="plazo"
            type="number"
            value={term}
            onChange={(e) => setTerm(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="mt-6 space-y-2">
        <p>
          Tasa estimada: <span className="font-bold text-lp-primary-1">{(rate * 100).toFixed(2)}%</span>
        </p>
        <p>
          Valor a recibir:{" "}
          <span className="font-bold text-lp-primary-1">
            {formatCurrency(toReceive)}
          </span>
        </p>
      </div>
    </div>
  );
}
