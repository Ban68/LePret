import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { getSupabaseAdminClient } from "@/lib/supabase";
import { createNotification, notifyInvestorWithdrawalRequested } from "@/lib/notifications";

type RouteContext = { params: Promise<{ orgId: string }> };

type MembershipRow = { status?: string | null };
type TransactionRow = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  date: string;
  description: string | null;
  status?: string | null;
};

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { orgId } = await params;

    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Missing organization" }, { status: 400 });
    }

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("status")
      .eq("company_id", orgId)
      .eq("user_id", session.user.id)
      .maybeSingle<MembershipRow>();

    if (membershipError) {
      return NextResponse.json({ ok: false, error: membershipError.message }, { status: 500 });
    }

    if (!membership || (membership.status ?? "").toUpperCase() !== "ACTIVE") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const payload = await req.json().catch(() => null);

    const amount = parseAmount(payload?.amount);
    if (amount === null || amount <= 0) {
      return NextResponse.json({ ok: false, error: "El monto debe ser un número positivo." }, { status: 400 });
    }

    const currency = parseCurrency(payload?.currency) ?? "COP";
    const description = parseDescription(payload?.description);
    const date = parseDate(payload?.date) ?? new Date().toISOString();

    const supabaseAdmin = getSupabaseAdminClient();

    const insertPayload = {
      org_id: orgId,
      type: "distribution" as const,
      amount,
      currency,
      date,
      description,
      status: "pending" as const,
    };

    const { data, error } = await supabaseAdmin
      .from("investor_transactions")
      .insert(insertPayload)
      .select("id, type, amount, currency, date, description, status")
      .single<TransactionRow>();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    try {
      await notifyInvestorWithdrawalRequested({
        orgId,
        transactionId: data.id,
        amount,
        currency,
        date,
        description,
        requestedByUserId: session.user.id,
        requestedByEmail: session.user.email ?? null,
      });
    } catch (notifyError) {
      console.error("Failed to notify investor about withdrawal request", notifyError);
    }

    notifyStaff({
      orgId,
      transactionId: data.id,
      amount,
      currency,
      type: "distribution",
    }).catch((notifyError) => {
      console.error("Failed to notify staff about withdrawal request", notifyError);
    });

    return NextResponse.json({ ok: true, transaction: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function parseAmount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseCurrency(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.toUpperCase();
}

function parseDescription(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseDate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

async function notifyStaff(params: {
  orgId: string;
  transactionId: string;
  amount: number;
  currency: string;
  type: "distribution";
}) {
  const supabaseAdmin = getSupabaseAdminClient();
  const { data: staffRows, error } = await supabaseAdmin
    .from("profiles")
    .select("user_id")
    .eq("is_staff", true);

  if (error) {
    throw error;
  }

  const staffIds = (staffRows ?? [])
    .map((row) => row.user_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (!staffIds.length) {
    return;
  }

  await createNotification(staffIds, "investor_transaction_request", "Nueva solicitud de retiro pendiente", {
    orgId: params.orgId,
    transactionId: params.transactionId,
    amount: params.amount,
    currency: params.currency,
    type: params.type,
  });
}
