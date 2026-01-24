import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { getSupabaseAdminClient } from "@/lib/supabase";
import {
  DEFAULT_MEMBER_ROLE,
  DEFAULT_MEMBER_STATUS,
  MemberRole,
  MemberStatus,
  canManageMembership,
  normalizeMemberRole,
  normalizeMemberStatus,
  parseMemberRole,
  parseMemberStatus,
} from "@/lib/rbac";

type RouteContext = { params: Promise<{ orgId: string }> };

type SessionContext = {
  sessionUserId: string | null;
  isStaff: boolean;
  membership: { role?: string | null; status?: string | null } | null;
};

type MembershipRow = {
  user_id: string;
  role: string | null;
  status: string | null;
  profiles?:
    | { full_name?: string | null; email?: string | null }
    | Array<{ full_name?: string | null; email?: string | null }>
    | null;
};

type AdminAuthClient = {
  getUserByEmail(email: string): Promise<{ data: { user: { id: string } | null } | null; error: { message?: string } | null }>;
};

async function resolveSession(orgId: string): Promise<SessionContext> {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { sessionUserId: null, isStaff: false, membership: null };
  }

  const userId = session.user.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_staff")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: membership } = await supabase
    .from("memberships")
    .select("role,status")
    .eq("company_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  return {
    sessionUserId: userId,
    isStaff: Boolean(profile?.is_staff),
    membership,
  };
}

function canRead(context: SessionContext): boolean {
  if (!context.sessionUserId) return false;
  if (context.isStaff) return true;
  return (context.membership?.status ?? "").toUpperCase() === "ACTIVE";
}

function ensureCanManage(context: SessionContext) {
  if (context.isStaff) return;
  const membership = context.membership;
  if (!membership || (membership.status ?? "").toUpperCase() !== "ACTIVE") {
    throw new Error("Forbidden");
  }
  const role = normalizeMemberRole(membership.role);
  if (!canManageMembership(role)) {
    throw new Error("Forbidden");
  }
}

function extractProfile(row: MembershipRow) {
  if (!row.profiles) {
    return { fullName: null, email: null };
  }
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    fullName: profile?.full_name ?? null,
    email: profile?.email ?? null,
  };
}

async function resolveUserIdFromPayload(payload: Record<string, unknown>) {
  const rawId = typeof payload.user_id === "string" ? payload.user_id.trim() : "";
  if (rawId) {
    return rawId;
  }

  const rawEmail = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!rawEmail) {
    throw new Error("Missing user identifier");
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const adminAuth = (supabaseAdmin.auth as unknown as { admin?: AdminAuthClient }).admin;
  if (!adminAuth || typeof adminAuth.getUserByEmail !== "function") {
    throw new Error("Supabase admin client unavailable");
  }

  const { data, error } = await adminAuth.getUserByEmail(rawEmail);
  if (error) {
    throw new Error(error.message || "No se pudo consultar el usuario");
  }

  const userId = data?.user?.id;
  if (!userId) {
    throw new Error("Usuario no encontrado");
  }

  return userId;
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { orgId } = await params;
    const context = await resolveSession(orgId);

    if (!context.sessionUserId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!canRead(context)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from("memberships")
      .select("user_id, role, status, profiles(full_name,email)")
      .eq("company_id", orgId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const items = (data ?? []).map((row: MembershipRow) => {
      const role = normalizeMemberRole(row.role) ?? DEFAULT_MEMBER_ROLE;
      const status = normalizeMemberStatus(row.status) ?? DEFAULT_MEMBER_STATUS;
      const profile = extractProfile(row);
      return {
        user_id: row.user_id,
        role,
        status,
        full_name: profile.fullName,
        email: profile.email,
      };
    });

    const currentRole = normalizeMemberRole(context.membership?.role);
    const canManage = context.isStaff || canManageMembership(currentRole);

    return NextResponse.json({ ok: true, members: items, canManage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { orgId } = await params;
    const context = await resolveSession(orgId);

    if (!context.sessionUserId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
      ensureCanManage(context);
    } catch {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    let userId: string;
    try {
      userId = await resolveUserIdFromPayload(body);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Datos inválidos";
      return NextResponse.json({ ok: false, error: message }, { status: message === "Usuario no encontrado" ? 404 : 400 });
    }

    let role: MemberRole = DEFAULT_MEMBER_ROLE;
    let status: MemberStatus = DEFAULT_MEMBER_STATUS;

    try {
      if (body.role !== undefined) {
        role = parseMemberRole(body.role);
      }
      if (body.status !== undefined) {
        status = parseMemberStatus(body.status);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Datos inválidos";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdminClient();

    const insertPayload = {
      company_id: orgId,
      user_id: userId,
      role,
      status,
    };

    const { data, error } = await supabaseAdmin
      .from("memberships")
      .upsert(insertPayload, { onConflict: "user_id,company_id" })
      .select("user_id, role, status")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, membership: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: RouteContext) {
  try {
    const { orgId } = await params;
    const context = await resolveSession(orgId);

    if (!context.sessionUserId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
      ensureCanManage(context);
    } catch {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Invalid user_id" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdminClient();

    const { data, error } = await supabaseAdmin
      .from("memberships")
      .delete()
      .eq("company_id", orgId)
      .eq("user_id", userId)
      .select("user_id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ ok: false, error: "Miembro no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
