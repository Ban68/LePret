"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type DateRangeValue = { start: string; end: string };

type DateRangePickerProps = {
  id?: string;
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  required?: boolean;
  helperText?: string;
  className?: string;
};

export function DateRangePicker({ id, value, onChange, required, helperText, className }: DateRangePickerProps) {
  const [touched, setTouched] = React.useState(false);
  const error = React.useMemo(() => {
    if (!value.start || !value.end) return null;
    const start = new Date(value.start);
    const end = new Date(value.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    if (end < start) return "La fecha de vencimiento no puede ser anterior a la emisión.";
    return null;
  }, [value.start, value.end]);

  const helperId = helperText ? `${id ?? "date-range"}-helper` : undefined;
  const errorMessage = touched ? error : null;
  const errorId = `${id ?? "date-range"}-error`;

  const handleChange = (field: "start" | "end") => (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, [field]: event.target.value });
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${id ?? "date-range"}-start`}>
            Emisión
            {required ? <span className="ml-1 text-xs text-lp-primary-1" aria-hidden="true">*</span> : null}
          </Label>
          <Input
            id={`${id ?? "date-range"}-start`}
            type="date"
            value={value.start}
            onChange={handleChange("start")}
            onBlur={() => setTouched(true)}
            aria-describedby={cn(helperId, errorId)}
            required={required}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id ?? "date-range"}-end`}>
            Vencimiento
            {required ? <span className="ml-1 text-xs text-lp-primary-1" aria-hidden="true">*</span> : null}
          </Label>
          <Input
            id={`${id ?? "date-range"}-end`}
            type="date"
            value={value.end}
            onChange={handleChange("end")}
            onBlur={() => setTouched(true)}
            aria-describedby={cn(helperId, errorId)}
            min={value.start || undefined}
            required={required}
          />
        </div>
      </div>
      {helperText && (
        <p id={helperId} className="text-xs text-lp-sec-3">
          {helperText}
        </p>
      )}
      <p
        id={errorId}
        aria-live="assertive"
        className={cn("text-xs", errorMessage ? "text-red-600" : "text-transparent")}
      >
        {errorMessage ?? "Sin errores"}
      </p>
    </div>
  );
}
