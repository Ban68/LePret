import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { isBackofficeAllowed } from "@/lib/hq-auth";

export const TRANSACTION_TYPES = new Set(["contribution", "distribution", "interest", "fee"]);
export const TRANSACTION_STATUS = new Set([
  "pending",
  "processing",
  "settled",
  "cancelled",
  "scheduled",
]);

export function sanitizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function coerceCurrency(value: unknown): string {
  if (typeof value !== "string") return "COP";
  const trimmed = value.trim().toUpperCase();
  return trimmed || "COP";
}

export function requireNumber(value: unknown, field: string): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`El campo "${field}" debe ser numerico.`);
  }
  return numeric;
}

export function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error("El valor numerico proporcionado no es valido.");
  }
  return numeric;
}

export function toIsoDate(value: unknown, field: string): string {
  if (!value) {
    return new Date().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  throw new Error(`El campo "${field}" debe ser una fecha valida.`);
}

export async function ensureStaffAccess(): Promise<string> {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const allowed = await isBackofficeAllowed(session.user.id, session.user.email);
  if (!allowed) {
    throw new Response("Unauthorized", { status: 401 });
  }

  return session.user.id;
}
