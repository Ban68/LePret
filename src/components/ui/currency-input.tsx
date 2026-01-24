"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type CurrencyInputProps = Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string;
  onValueChange?: (value: string, numericValue: number) => void;
  currency?: "COP" | "USD" | "EUR" | string;
  helperText?: string;
  showSpelledValue?: boolean;
};

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      value,
      onValueChange,
      onBlur,
      onFocus,
      className,
      currency = "COP",
      helperText,
      showSpelledValue = true,
      id,
      ...rest
    },
    ref,
  ) => {
    const [focused, setFocused] = React.useState(false);
    const helperId = helperText ? `${id ?? rest.name ?? "currency"}-helper` : undefined;
    const spelledId = showSpelledValue ? `${id ?? rest.name ?? "currency"}-spelled` : undefined;

    const numericValue = React.useMemo(() => {
      const digits = (value || "").replace(/[^0-9]/g, "");
      if (!digits) return 0;
      return Number(digits);
    }, [value]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      const digits = raw.replace(/[^0-9]/g, "");
      const formatted = formatCurrency(digits, currency);
      onValueChange?.(formatted, digits ? Number(digits) : 0);
    };

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
      setFocused(true);
      onFocus?.(event);
    };

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      setFocused(false);
      onBlur?.(event);
    };

    return (
      <div className="space-y-2">
        <Input
          ref={ref}
          id={id}
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          aria-describedby={cn(helperId, showSpelledValue ? spelledId : undefined)}
          className={cn("tracking-[0.05em]", className)}
          {...rest}
        />
        {helperText && (
          <p id={helperId} className="text-xs text-lp-sec-3">
            {helperText}
          </p>
        )}
        {showSpelledValue && focused && (
          <p
            id={spelledId}
            aria-live="polite"
            className="flex items-center gap-1 text-xs text-lp-primary-1"
          >
            <span className="font-medium">Equivalente:</span>
            <span>{spellNumberInSpanish(numericValue, currency)}</span>
          </p>
        )}
      </div>
    );
  },
);

CurrencyInput.displayName = "CurrencyInput";

function formatCurrency(value: string, currency: string) {
  if (!value) return "";
  const numeric = Number(value);
  return new Intl.NumberFormat("es-CO", {
    currency,
    style: "currency",
    maximumFractionDigits: 0,
  })
    .format(numeric)
    .replace(/^COP\s?/, "")
    .replace(/\u00A0/g, " ");
}

const UNITS = [
  "cero",
  "uno",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
  "veinte",
];

const TENS = [
  "",
  "diez",
  "veinte",
  "treinta",
  "cuarenta",
  "cincuenta",
  "sesenta",
  "setenta",
  "ochenta",
  "noventa",
];

const HUNDREDS = [
  "",
  "ciento",
  "doscientos",
  "trescientos",
  "cuatrocientos",
  "quinientos",
  "seiscientos",
  "setecientos",
  "ochocientos",
  "novecientos",
];

function spellNumberInSpanish(value: number, currency: string) {
  if (!value) return `cero ${currency}`;
  if (value >= 1_000_000_000_000) {
    return `${value.toLocaleString("es-CO")} ${currency}`;
  }

  const groups = ["", "mil", "millón", "mil millones", "billón"];
  const parts: string[] = [];
  let remainder = value;
  let groupIndex = 0;

  while (remainder > 0 && groupIndex < groups.length) {
    const chunk = remainder % 1000;
    if (chunk) {
      const chunkWords = spellThreeDigits(chunk);
      if (groupIndex === 2 && chunk > 1) {
        parts.unshift(`${chunkWords} millones`);
      } else if (groupIndex === 0) {
        parts.unshift(chunkWords);
      } else if (groupIndex === 1) {
        parts.unshift(chunk === 1 ? "mil" : `${chunkWords} mil`);
      } else {
        parts.unshift(`${chunkWords} ${groups[groupIndex]}`);
      }
    }
    remainder = Math.floor(remainder / 1000);
    groupIndex += 1;
  }

  const result = parts.join(" ") || "cero";
  return `${result.trim()} ${currency}`;
}

function spellThreeDigits(value: number) {
  if (value === 0) return "";
  if (value === 100) return "cien";

  const hundreds = Math.floor(value / 100);
  const tensValue = value % 100;
  const unitsValue = value % 10;
  const words: string[] = [];

  if (hundreds) words.push(HUNDREDS[hundreds]);

  if (tensValue <= 20) {
    if (tensValue) words.push(UNITS[tensValue]);
  } else if (tensValue < 30) {
    words.push(`veinti${unitsValue === 0 ? "" : UNITS[unitsValue]}`.trim());
  } else {
    const tens = Math.floor(tensValue / 10);
    const remainder = tensValue % 10;
    if (remainder) {
      words.push(`${TENS[tens]} y ${UNITS[remainder]}`);
    } else {
      words.push(TENS[tens]);
    }
  }

  return words.join(" ");
}
