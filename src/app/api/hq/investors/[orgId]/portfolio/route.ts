import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";
import {
  TRANSACTION_STATUS,
  TRANSACTION_TYPES,
  coerceCurrency,
  ensureStaffAccess,
  optionalNumber,
  requireNumber,
  sanitizeString,
  toIsoDate,
} from "../../helpers";

type RouteContext = { params: Promise<{ orgId: string }> };

const mapPosition = (row: Record<string, unknown>) => ({
  id: row.id as string,
  name: row.name as string,
  strategy: (row.strategy as string | null) ?? null,
  investedAmount: Number(row.invested_amount ?? 0),
  currentValue: Number(row.current_value ?? 0),
  currency: (row.currency as string) ?? "COP",
  irr: row.irr === null || row.irr === undefined ? null : Number(row.irr),
  timeWeightedReturn:
    row.time_weighted_return === null || row.time_weighted_return === undefined
      ? null
      : Number(row.time_weighted_return),
  updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
});

const mapTransaction = (row: Record<string, unknown>) => ({
  id: row.id as string,
  type: row.type as string,
  status: (row.status as string) ?? "pending",
  amount: Number(row.amount ?? 0),
  currency: (row.currency as string) ?? "COP",
  date: typeof row.date === "string" ? row.date : null,
  description: (row.description as string | null) ?? null,
  positionId: (row.position_id as string | null) ?? null,
});

const mapStatement = (row: Record<string, unknown>) => ({
  id: row.id as string,
  period: (row.period as string | null) ?? null,
  periodLabel: (row.period_label as string | null) ?? null,
  generatedAt: typeof row.generated_at === "string" ? row.generated_at : null,
  downloadUrl: (row.download_url as string | null) ?? null,
});

async function fetchPortfolio(orgId: string) {
  const [positionsRes, transactionsRes, statementsRes] = await Promise.all([
    supabaseAdmin
      .from("investor_positions")
      .select(
        "id,name,strategy,invested_amount,current_value,currency,irr,time_weighted_return,updated_at",
      )
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false }),
    supabaseAdmin
      .from("investor_transactions")
      .select("id,type,status,amount,currency,date,description,position_id")
      .eq("org_id", orgId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    supabaseAdmin
      .from("investor_statements")
      .select("id,period,period_label,generated_at,download_url")
      .eq("org_id", orgId)
      .order("generated_at", { ascending: false }),
  ]);

  if (positionsRes.error) {
    throw new Error(`Posiciones: ${positionsRes.error.message}`);
  }
  if (transactionsRes.error) {
    throw new Error(`Transacciones: ${transactionsRes.error.message}`);
  }
  if (statementsRes.error) {
    throw new Error(`Estados de cuenta: ${statementsRes.error.message}`);
  }

  return {
    positions: (positionsRes.data ?? []).map(mapPosition),
    transactions: (transactionsRes.data ?? []).map(mapTransaction),
    statements: (statementsRes.data ?? []).map(mapStatement),
  };
}

type PositionInput = {
  id?: string;
  name: string;
  strategy?: string | null;
  investedAmount: number | string;
  currentValue: number | string;
  currency?: string | null;
  irr?: number | string | null;
  timeWeightedReturn?: number | string | null;
};

type TransactionInput = {
  id?: string;
  type: string;
  status?: string | null;
  amount: number | string;
  currency?: string | null;
  date?: string | Date | null;
  description?: string | null;
  positionId?: string | null;
};

type StatementInput = {
  id?: string;
  period?: string | null;
  periodLabel?: string | null;
  generatedAt?: string | Date | null;
  downloadUrl?: string | null;
};

type PortfolioPayload = {
  positions?: PositionInput[];
  transactions?: TransactionInput[];
  statements?: StatementInput[];
  replace?: {
    positions?: boolean;
    transactions?: boolean;
    statements?: boolean;
  };
};

function normalizePositions(orgId: string, items: PositionInput[]): Record<string, unknown>[] {
  const now = new Date().toISOString();
  return items.map((item, index) => {
    const id = sanitizeString(item.id) ?? randomUUID();
    const name = sanitizeString(item.name);
    if (!name) {
      throw new Error(`La posición #${index + 1} debe tener un nombre.`);
    }
    const investedAmount = requireNumber(item.investedAmount, `positions[${index}].investedAmount`);
    const currentValue = requireNumber(item.currentValue, `positions[${index}].currentValue`);
    const currency = coerceCurrency(item.currency);
    const irr = optionalNumber(item.irr);
    const twr = optionalNumber(item.timeWeightedReturn);

    const payload: Record<string, unknown> = {
      id,
      org_id: orgId,
      name,
      strategy: sanitizeString(item.strategy),
      invested_amount: investedAmount,
      current_value: currentValue,
      currency,
      irr,
      time_weighted_return: twr,
      updated_at: now,
    };

    return payload;
  });
}

function normalizeTransactions(
  orgId: string,
  items: TransactionInput[],
): Record<string, unknown>[] {
  const now = new Date().toISOString();
  return items.map((item, index) => {
    const id = sanitizeString(item.id) ?? randomUUID();
    const type = sanitizeString(item.type)?.toLowerCase();
    if (!type || !TRANSACTION_TYPES.has(type)) {
      throw new Error(
        `La transacción #${index + 1} tiene un tipo inválido. Valores permitidos: ${Array.from(
          TRANSACTION_TYPES,
        ).join(", ")}`,
      );
    }
    const status = sanitizeString(item.status)?.toLowerCase() ?? "pending";
    if (!TRANSACTION_STATUS.has(status)) {
      throw new Error(
        `La transacción #${index + 1} tiene un estado inválido. Valores permitidos: ${Array.from(
          TRANSACTION_STATUS,
        ).join(", ")}`,
      );
    }
    const amount = requireNumber(item.amount, `transactions[${index}].amount`);
    const currency = coerceCurrency(item.currency);
    const dateIso = toIsoDate(item.date, `transactions[${index}].date`);
    const description = sanitizeString(item.description);
    const positionId = sanitizeString(item.positionId);

    const payload: Record<string, unknown> = {
      id,
      org_id: orgId,
      type,
      status,
      amount,
      currency,
      date: dateIso,
      tx_date: dateIso,
      description,
      position_id: positionId,
      updated_at: now,
    };

    return payload;
  });
}

function normalizeStatements(orgId: string, items: StatementInput[]): Record<string, unknown>[] {
  const now = new Date().toISOString();
  return items.map((item, index) => {
    const id = sanitizeString(item.id) ?? randomUUID();
    const period = sanitizeString(item.period);
    const periodLabel = sanitizeString(item.periodLabel);
    const downloadUrl = sanitizeString(item.downloadUrl);
    const generatedAt = toIsoDate(item.generatedAt, `statements[${index}].generatedAt`);

    return {
      id,
      org_id: orgId,
      period,
      period_label: periodLabel,
      download_url: downloadUrl,
      generated_at: generatedAt,
      updated_at: now,
    };
  });
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    await ensureStaffAccess();
    const { orgId } = await params;
    const payload = await fetchPortfolio(orgId);
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Error inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    await ensureStaffAccess();
    const { orgId } = await params;

    let body: PortfolioPayload;
    try {
      body = (await req.json()) as PortfolioPayload;
    } catch {
      return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
    }

    const replaceFlags = body.replace ?? {};
    const positionsInput = Array.isArray(body.positions) ? body.positions : undefined;
    const transactionsInput = Array.isArray(body.transactions) ? body.transactions : undefined;
    const statementsInput = Array.isArray(body.statements) ? body.statements : undefined;

    if (
      !positionsInput?.length &&
      !transactionsInput?.length &&
      !statementsInput?.length &&
      !replaceFlags.positions &&
      !replaceFlags.transactions &&
      !replaceFlags.statements
    ) {
      return NextResponse.json(
        { ok: false, error: "No se recibieron datos para procesar." },
        { status: 400 },
      );
    }

    if (replaceFlags.positions) {
      const { error } = await supabaseAdmin
        .from("investor_positions")
        .delete()
        .eq("org_id", orgId);
      if (error) throw new Error(`Eliminar posiciones: ${error.message}`);
    }

    if (replaceFlags.transactions) {
      const { error } = await supabaseAdmin
        .from("investor_transactions")
        .delete()
        .eq("org_id", orgId);
      if (error) throw new Error(`Eliminar transacciones: ${error.message}`);
    }

    if (replaceFlags.statements) {
      const { error } = await supabaseAdmin
        .from("investor_statements")
        .delete()
        .eq("org_id", orgId);
      if (error) throw new Error(`Eliminar estados: ${error.message}`);
    }

    if (positionsInput?.length) {
      const payload = normalizePositions(orgId, positionsInput);
      const { error } = await supabaseAdmin
        .from("investor_positions")
        .upsert(payload, { onConflict: "id" });
      if (error) throw new Error(`Upsert posiciones: ${error.message}`);
    }

    if (transactionsInput?.length) {
      const payload = normalizeTransactions(orgId, transactionsInput);
      const { error } = await supabaseAdmin
        .from("investor_transactions")
        .upsert(payload, { onConflict: "id" });
      if (error) throw new Error(`Upsert transacciones: ${error.message}`);
    }

    if (statementsInput?.length) {
      const payload = normalizeStatements(orgId, statementsInput);
      const { error } = await supabaseAdmin
        .from("investor_statements")
        .upsert(payload, { onConflict: "id" });
      if (error) throw new Error(`Upsert estados: ${error.message}`);
    }

    const payload = await fetchPortfolio(orgId);
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Error inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

