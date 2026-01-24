"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type StepperStep = {
  title: string;
  description?: string;
};

type StepperProps = {
  steps: readonly StepperStep[];
  current: number;
  className?: string;
};

export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol className={cn("flex flex-col gap-4", className)}>
      {steps.map((step, index) => {
        const status = index === current ? "current" : index < current ? "completed" : "upcoming";
        return (
          <li
            key={step.title}
            className={cn(
              "flex items-start gap-3 rounded-lg border px-3 py-2 text-sm transition",
              status === "current" && "border-lp-primary-1 bg-lp-primary-1/10 text-lp-primary-1",
              status === "completed" && "border-emerald-200 bg-emerald-50 text-emerald-900",
              status === "upcoming" && "border-lp-sec-4/40 bg-white text-lp-sec-2",
            )}
            aria-current={status === "current" ? "step" : undefined}
          >
            <span
              className={cn(
                "mt-1 flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold",
                status === "current" && "border-lp-primary-1 text-lp-primary-1",
                status === "completed" && "border-emerald-500 bg-emerald-500 text-white",
                status === "upcoming" && "border-lp-sec-4/60 text-lp-sec-3",
              )}
            >
              {index + 1}
            </span>
            <div className="space-y-1">
              <p className="font-medium leading-none">{step.title}</p>
              {step.description && <p className="text-xs text-inherit/70">{step.description}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
