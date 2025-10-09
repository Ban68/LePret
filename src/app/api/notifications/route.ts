import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  message: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
};

type PaginationResult<T> = {
  data: T[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
};

function parsePage(value: string | null): number {
  if (!value) return 1;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return parsed;
}

function parsePerPage(value: string | null): number {
  if (!value) return DEFAULT_PAGE_SIZE;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(parsed, MAX_PAGE_SIZE);
}

function parseIsRead(value: string | null): boolean | null {
  if (value == null) return null;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

async function getAuthenticatedClient() {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return { supabase, session } as const;
}

export async function GET(req: Request) {
  const { supabase, session } = await getAuthenticatedClient();

  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const page = parsePage(url.searchParams.get("page"));
  const perPage = parsePerPage(url.searchParams.get("perPage"));
  const isReadFilter = parseIsRead(url.searchParams.get("is_read"));
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (isReadFilter !== null) {
    query = query.eq("is_read", isReadFilter);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = (data as NotificationRow[] | null) ?? [];
  const total = typeof count === "number" ? count : rows.length;
  const payload: PaginationResult<NotificationRow> = {
    data: rows,
    pagination: {
      page,
      perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
    },
  };

  return NextResponse.json({ ok: true, ...payload });
}

export async function POST(req: Request) {
  const { supabase, session } = await getAuthenticatedClient();

  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const { type, message, data, userId } = body as {
    type?: string;
    message?: string;
    data?: Record<string, unknown> | null;
    userId?: string;
  };

  if (typeof type !== "string" || !type.trim()) {
    return NextResponse.json({ ok: false, error: "missing_type" }, { status: 400 });
  }

  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ ok: false, error: "missing_message" }, { status: 400 });
  }

  const targetUserId = typeof userId === "string" && userId.trim() ? userId.trim() : session.user.id;

  const { data: inserted, error } = await supabase
    .from("notifications")
    .insert({
      user_id: targetUserId,
      type: type.trim(),
      message: message.trim(),
      data: data ?? null,
    })
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: inserted });
}
