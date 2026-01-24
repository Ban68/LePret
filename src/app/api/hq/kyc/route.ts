import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { supabaseAdmin } from "@/lib/supabase";
import { isBackofficeAllowed } from "@/lib/hq-auth";
import { normalizeKycStatus, type KycStatus } from "@/lib/organizations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CompanyRow = {
  id: string;
  name: string | null;
  type: string | null;
  kyc_status: string | null;
  kyc_submitted_at: string | null;
  kyc_approved_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type KycListItem = {
  id: string;
  name: string | null;
  type: string | null;
  status: KycStatus | null;
  rawStatus: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function extractString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function GET(req: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await isBackofficeAllowed(session.user?.id, session.user?.email);
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const searchTerm = extractString(url.searchParams.get("search"));
  const limitParam = Number(url.searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : 200;

  const statuses = statusParam
    ? statusParam
        .split(/[,\s]+/)
        .map((value) => normalizeKycStatus(value))
        .filter((value): value is KycStatus => Boolean(value))
    : null;

  let query = supabaseAdmin
    .from("companies")
    .select("id, name, type, kyc_status, kyc_submitted_at, kyc_approved_at, created_at, updated_at")
    .order("kyc_submitted_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (statuses && statuses.length > 0) {
    query = query.in("kyc_status", statuses);
  } else {
    query = query.or(
      "kyc_status.is.null,kyc_status.eq.NOT_STARTED,kyc_status.eq.IN_PROGRESS,kyc_status.eq.SUBMITTED,kyc_status.eq.REJECTED"
    );
  }

  if (searchTerm) {
    const normalized = searchTerm.replace(/%/g, "\\%");
    query = query.ilike("name", `%${normalized}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("hq kyc list error", error);
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 500 });
  }

  const items: KycListItem[] = (data ?? []).map((row: CompanyRow) => {
    const status = normalizeKycStatus(row.kyc_status);
    return {
      id: row.id,
      name: extractString(row.name),
      type: extractString(row.type),
      status,
      rawStatus: row.kyc_status,
      submittedAt: row.kyc_submitted_at,
      approvedAt: row.kyc_approved_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

  return NextResponse.json({ ok: true, items });
}
