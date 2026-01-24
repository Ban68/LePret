import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { supabaseAdmin } from "@/lib/supabase";
import { isBackofficeAllowed } from "@/lib/hq-auth";
import { notifyInvestorStatementGenerated } from "@/lib/notifications";

interface StatementRequestBody {
  orgId?: string;
  statementId?: string;
  period?: string | null;
  periodLabel?: string | null;
  downloadUrl?: string | null;
  generatedAt?: string | null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeIsoString(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const isAllowed = await isBackofficeAllowed(session.user?.id, session.user?.email);
  if (!isAllowed) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  let payload: StatementRequestBody;
  try {
    payload = (await request.json()) as StatementRequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isNonEmptyString(payload.orgId)) {
    return NextResponse.json({ ok: false, error: "Missing orgId" }, { status: 400 });
  }

  if (!isNonEmptyString(payload.downloadUrl)) {
    return NextResponse.json({ ok: false, error: "Missing downloadUrl" }, { status: 400 });
  }

  const statementId = isNonEmptyString(payload.statementId) ? payload.statementId : randomUUID();
  const nowIso = new Date().toISOString();
  const generatedAt = normalizeIsoString(payload.generatedAt) ?? nowIso;
  const period = payload.period?.trim() ?? null;
  const periodLabel = payload.periodLabel?.trim() ?? null;
  const downloadUrl = payload.downloadUrl.trim();

  const record: Record<string, unknown> = {
    id: statementId,
    org_id: payload.orgId,
    period,
    generated_at: generatedAt,
    download_url: downloadUrl,
  };

  if (periodLabel) {
    record.period_label = periodLabel;
  }

  const { error: upsertError } = await supabaseAdmin.from("investor_statements").upsert(record);

  if (upsertError) {
    return NextResponse.json({ ok: false, error: upsertError.message }, { status: 500 });
  }

  await notifyInvestorStatementGenerated({
    orgId: payload.orgId,
    statementId,
    period,
    periodLabel,
    downloadUrl,
    generatedAt,
  });

  return NextResponse.json({ ok: true, id: statementId });
}
