import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { isBackofficeAllowed } from "@/lib/hq-auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const isAllowed = await isBackofficeAllowed(session.user?.id, session.user?.email);
  if (!isAllowed) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: rows, error } = await supabaseAdmin
    .from('memberships')
    .select('user_id, role, status, created_at, profiles(full_name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const userIds = (rows || []).map(r => r.user_id);
  const emails: Record<string, string> = {};
  if (userIds.length) {
    const { data: users } = await supabaseAdmin.from('auth.users' as unknown as string).select('id, email').in('id', userIds);
    (users as Array<{ id: string; email: string | null }> | null || []).forEach((u) => { emails[u.id] = u.email ?? ''; });
  }

  const members = (rows || []).map(r => ({
    user_id: r.user_id,
    full_name: (r as { profiles?: { full_name?: string | null } | null }).profiles?.full_name ?? null,
    email: emails[r.user_id] ?? null,
    role: r.role,
    status: r.status,
    created_at: r.created_at,
  }));

  return NextResponse.json({ ok: true, members });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const isAllowed = await isBackofficeAllowed(session.user?.id, session.user?.email);
  if (!isAllowed) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { user_id, status, role } = body || {};
  if (!user_id || (!status && !role)) return NextResponse.json({ ok: false, error: 'Missing fields' }, { status: 400 });

  const update: Partial<{ status: string; role: string }> = {};
  if (status) update.status = status;
  if (role) update.role = role;

  const { error } = await supabaseAdmin
    .from('memberships')
    .update(update)
    .eq('company_id', companyId)
    .eq('user_id', user_id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

