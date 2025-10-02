import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("memberships")
    .select("role, status, company_id, companies ( id, name, type, kyc_status )")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  type Company = { id: string; name: string; type: string; kyc_status?: string | null };
  type Row = { role: string; status: string; companies: Company | Company[] | null };
  const orgs = (data ?? []).map((m: Row) => {
    const c = Array.isArray(m.companies) ? m.companies[0] : m.companies;
    return {
      id: c?.id,
      name: c?.name,
      type: c?.type,
      role: m.role,
      status: m.status,
      kycStatus: c?.kyc_status ?? null,
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

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    console.log("POST /api/orgs", { userId: session.user.id, name, type });

    // Ensure profile exists (user may predate trigger) via UPSERT
    {
      const { supabaseAdmin } = await import("@/lib/supabase");
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
    const { supabaseAdmin } = await import("@/lib/supabase");
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
