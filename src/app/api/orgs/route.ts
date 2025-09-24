import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

type RouteSupabaseClient = ReturnType<typeof createRouteHandlerClient>;
type SupabaseAdminClient = typeof import("@/lib/supabase").supabaseAdmin;

let supabaseClientFactory: (() => RouteSupabaseClient) | null = null;
let supabaseAdminOverride: SupabaseAdminClient | null = null;
let cookiesOverride: (() => ReturnType<typeof cookies>) | null = null;

function getSupabaseClient(cookieStore: ReturnType<typeof cookies>) {
  return supabaseClientFactory ? supabaseClientFactory() : createRouteHandlerClient({ cookies: () => cookieStore });
}

function getCookieStore() {
  return cookiesOverride ? cookiesOverride() : cookies();
}

async function getSupabaseAdmin(): Promise<SupabaseAdminClient> {
  if (supabaseAdminOverride) {
    return supabaseAdminOverride;
  }
  const { supabaseAdmin } = await import("@/lib/supabase");
  return supabaseAdmin;
}

export function __setOrgRouteSupabaseClientFactory(factory: (() => RouteSupabaseClient) | null) {
  supabaseClientFactory = factory;
}

export function __setOrgRouteSupabaseAdmin(client: SupabaseAdminClient | null) {
  supabaseAdminOverride = client;
}

export function __setOrgRouteCookies(override: (() => ReturnType<typeof cookies>) | null) {
  cookiesOverride = override;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = getCookieStore();
  const supabase = getSupabaseClient(cookieStore);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("memberships")
    .select("role, status, company_id, companies ( id, name, type )")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  type Company = { id: string; name: string; type: string };
  type Row = { role: string; status: string; companies: Company | Company[] | null };
  const orgs = (data ?? []).map((m: Row) => {
    const c = Array.isArray(m.companies) ? m.companies[0] : m.companies;
    return {
      id: c?.id,
      name: c?.name,
      type: c?.type,
      role: m.role,
      status: m.status,
    };
  });
  return NextResponse.json({ ok: true, orgs });
}

export async function POST(req: Request) {
  try {
    const { name, type } = await req.json();
    if (!name || !type || !["CLIENT", "INVESTOR"].includes(type)) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    const cookieStore = getCookieStore();
    const supabase = getSupabaseClient(cookieStore);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_staff")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (profileError) {
      console.error("profiles lookup error", profileError);
      return NextResponse.json({ ok: false, error: profileError.message }, { status: 500 });
    }
    if (profile?.is_staff) {
      return NextResponse.json(
        {
          ok: false,
          error: "El personal de HQ no puede crear organizaciones",
          code: "HQ_STAFF",
        },
        { status: 403 }
      );
    }
    console.log("POST /api/orgs", { userId: session.user.id, name, type });

    // Ensure profile exists (user may predate trigger) via UPSERT
    {
      const supabaseAdmin = await getSupabaseAdmin();
      const { error: pErr } = await supabaseAdmin
        .from("profiles")
        .upsert(
          {
            user_id: session.user.id,
            full_name:
              (typeof session.user.user_metadata === 'object' && session.user.user_metadata && 'full_name' in session.user.user_metadata)
                ? String((session.user.user_metadata as Record<string, unknown>).full_name)
                : session.user.email,
          },
          { onConflict: "user_id" }
        );
      if (pErr) {
        console.error("profiles upsert error", pErr);
        return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
      }
    }

    // Create company and membership
    const supabaseAdmin = await getSupabaseAdmin();
    const { data: org, error: orgErr } = await supabaseAdmin
      .from("companies")
      .insert({ name, type })
      .select()
      .single();
    if (orgErr) {
      console.error("companies insert error", orgErr);
      throw orgErr;
    }

    const { error: mErr } = await supabaseAdmin
      .from("memberships")
      .insert({ user_id: session.user.id, company_id: org.id, role: "OWNER", status: 'ACTIVE' })
      .select()
      .single();
    if (mErr && mErr.code !== "23505") {
      console.error("memberships insert error", mErr);
      throw mErr;
    }

    return NextResponse.json({ ok: true, org });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("POST /api/orgs error", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
