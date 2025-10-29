import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";
import {
  TRANSACTION_STATUS,
  coerceCurrency,
  ensureStaffAccess,
  requireNumber,
  sanitizeString,
  toIsoDate,
} from "../../helpers";

type RouteContext = { params: Promise<{ orgId: string }> };

type MovementPayload = {
  type?: string;
  amount?: number | string;
  currency?: string | null;
  date?: string | Date | null;
  description?: string | null;
  positionId?: string | null;
  status?: string | null;
};

const MOVEMENT_TYPE_MAP: Record<string, "contribution" | "distribution"> = {
  addition: "contribution",
  add: "contribution",
  aporte: "contribution",
  contribution: "contribution",
  retiro: "distribution",
  withdrawal: "distribution",
  withdraw: "distribution",
  distribution: "distribution",
};

function normalizeManualMovement(orgId: string, body: MovementPayload) {
  const typeKey = sanitizeString(body.type)?.toLowerCase();
  if (!typeKey) {
    throw new Error("Selecciona si el movimiento es una adicion o un retiro.");
  }

  const normalizedType = MOVEMENT_TYPE_MAP[typeKey];
  if (!normalizedType) {
    throw new Error("Tipo de movimiento no valido. Usa adicion o retiro.");
  }

  const status = sanitizeString(body.status)?.toLowerCase() ?? "settled";
  if (!TRANSACTION_STATUS.has(status)) {
    throw new Error("Estado de transaccion no valido.");
  }

  const amount = requireNumber(body.amount, "amount");
  if (amount <= 0) {
    throw new Error("El monto debe ser mayor que cero.");
  }

  const currency = coerceCurrency(body.currency);
  const isoDate = toIsoDate(body.date, "date");
  const description = sanitizeString(body.description);
  const positionId = sanitizeString(body.positionId);

  const now = new Date().toISOString();

  return {
    org_id: orgId,
    type: normalizedType,
    status,
    amount,
    currency,
    date: isoDate,
    tx_date: isoDate,
    description,
    position_id: positionId,
    updated_at: now,
  };
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    await ensureStaffAccess();
    const { orgId } = await params;

    let body: MovementPayload;
    try {
      body = (await req.json()) as MovementPayload;
    } catch {
      return NextResponse.json({ ok: false, error: "JSON invalido." }, { status: 400 });
    }

    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Organizacion invalida." }, { status: 400 });
    }

    const payload = normalizeManualMovement(orgId, body);

    const { data, error } = await supabaseAdmin
      .from("investor_transactions")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      throw new Error(`No se pudo registrar el movimiento: ${error.message}`);
    }

    return NextResponse.json({ ok: true, transactionId: data?.id ?? null });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Error inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
