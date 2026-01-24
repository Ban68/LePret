"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, Info, TriangleAlert, XCircle } from "lucide-react";

type BannerProps = {
  title: string;
  description?: string;
  tone?: "success" | "info" | "warning" | "error";
  action?: React.ReactNode;
  className?: string;
};

const ICONS = {
  success: CheckCircle2,
  info: Info,
  warning: TriangleAlert,
  error: XCircle,
};

const TONES = {
  success: "bg-emerald-50 text-emerald-900 border-emerald-200",
  info: "bg-lp-sec-4/30 text-lp-primary-1 border-lp-sec-4/60",
  warning: "bg-amber-50 text-amber-900 border-amber-200",
  error: "bg-red-50 text-red-900 border-red-200",
};

export function InlineBanner({ title, description, tone = "info", action, className }: BannerProps) {
  const Icon = ICONS[tone];
  return (
    <div
      role="status"
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border px-4 py-3",
        TONES[tone],
        className,
      )}
    >
      <Icon className="mt-1 h-5 w-5 flex-shrink-0" aria-hidden="true" />
      <div className="flex-1 space-y-1 text-sm">
        <p className="font-medium leading-none">{title}</p>
        {description && <p className="text-xs text-inherit/80">{description}</p>}
        {action}
      </div>
    </div>
  );
}
