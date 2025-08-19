"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "d3-format";

interface PricingExampleProps {
  monto: number;
  plazo: number;
}

export function PricingExample({ monto, plazo }: PricingExampleProps) {
  const [amount, setAmount] = useState(monto);
  const [term, setTerm] = useState(plazo);

  const calculateRate = (days: number) => {
    if (days <= 30) return 0.015;
    if (days <= 60) return 0.025;
    if (days <= 90) return 0.035;
    return 0.04;
  };

  const rate = calculateRate(term);
  const toReceive = amount * (1 - rate);

  return (
    <div className="mt-8 rounded-lg border border-lp-sec-4/50 bg-lp-primary-1/5 p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="monto">Monto de la factura (COP)</Label>
          <Input
            id="monto"
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
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
            ${format(",.0f")(toReceive).replace(/,/g, ".")}
          </span>
        </p>
      </div>
    </div>
  );
}
