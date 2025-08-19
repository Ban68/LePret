"use client";

import { cn } from "@/lib/utils";

interface FormErrorProps {
  message?: string;
  className?: string;
}

export function FormError({ message, className }: FormErrorProps) {
  if (!message) return null;

  return (
    <p className={cn("text-red-500 text-sm", className)} aria-live="polite">
      {message}
    </p>
  );
}
