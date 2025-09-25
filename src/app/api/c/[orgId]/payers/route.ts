import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

const ALLOWED_SORT_FIELDS = new Set([
  "name",
  "status",
  "created_at",
  "updated_at",
]);

const sanitizeSort = (value: string | null | undefined) => {
  if (!value) return { field: "name", ascending: true } as const;
  const [rawField, rawDirection] = value.split(".");
  const field = ALLOWED_SORT_FIELDS.has(rawField) ? rawField : "name";
  const ascending = (rawDirection ?? "asc").toLowerCase() !== "desc";
  return { field, ascending } as const;
};

const sanitizeStatus = (value: string | null | undefined) => {
  if (!value || value.toLowerCase() === "all") return null;
  const upper = value.toUpperCase();
  return ["ACTIVE", "BLOCKED", "ARCHIVED"].includes(upper) ? upper : null;
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const status = sanitizeStatus(url.searchParams.get("status"));
  const { field, ascending } = sanitizeSort(url.searchParams.get("sort"));
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? "20")));
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const offset = (page - 1) * limit;

  let query = supabase
    .from("payers")
    .select(
      "id, name, tax_id, status, contact_email, contact_phone, sector, credit_limit, risk_rating, notes, created_at, updated_at",
      { count: "exact" }
    )
    .eq("company_id", orgId);

  if (status) {
    query = query.eq("status", status);
  }

  if (q && q.trim().length > 0) {
    const value = q.trim();
    const pattern = `%${value.replace(/%/g, "").replace(/_/g, "")}%`;
    query = query.or(`name.ilike.${pattern},tax_id.ilike.${pattern}`);
  }

  query = query.order(field, { ascending });
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, items: data ?? [], total: count ?? 0 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ ok: false, error: "Missing name" }, { status: 400 });
  }

  const payload = {
    company_id: orgId,
    created_by: session.user.id,
    name,
    tax_id: typeof body?.tax_id === "string" ? body.tax_id.trim() || null : null,
    status: sanitizeStatus(body?.status) ?? "ACTIVE",
    contact_email: typeof body?.contact_email === "string" ? body.contact_email.trim() || null : null,
    contact_phone: typeof body?.contact_phone === "string" ? body.contact_phone.trim() || null : null,
    sector: typeof body?.sector === "string" ? body.sector.trim() || null : null,
    credit_limit:
      body?.credit_limit !== undefined && body?.credit_limit !== null
        ? Number(body.credit_limit) || null
        : null,
    risk_rating: typeof body?.risk_rating === "string" ? body.risk_rating.trim() || null : null,
    notes: typeof body?.notes === "string" ? body.notes.trim() || null : null,
  };

  const { data, error } = await supabase
    .from("payers")
    .insert(payload)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, payer: data }, { status: 201 });
}
