import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { supabaseAdmin } from "@/lib/supabase";
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

type MembershipRow = {
  user_id: string;
  role: string;
  status: string;
  profiles?: { full_name?: string | null } | Array<{ full_name?: string | null }> | null;
};

type Context = {
  supabase: ReturnType<typeof createRouteHandlerClient>;
  sessionUserId: string | null;
  isStaff: boolean;
  membership: { role?: string | null; status?: string | null } | null;
};

type AdminAuthClient = {
  getUserByEmail(email: string): Promise<{ data: { user: { id: string } | null } | null; error: { message?: string } | null }>;
};

async function resolveContext(orgId: string): Promise<Context> {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { supabase, sessionUserId: null, isStaff: false, membership: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_staff")
    .eq("user_id", session.user.id)
    .maybeSingle();

  const { data: membership } = await supabase
    .from("memberships")
    .select("role,status")
    .eq("company_id", orgId)
    .eq("user_id", session.user.id)
    .maybeSingle();

  return {
    supabase,
    sessionUserId: session.user.id,
    isStaff: Boolean(profile?.is_staff),
    membership,
  };
}

function ensureCanManage(isStaff: boolean, membership: { role?: string | null; status?: string | null } | null) {
  if (isStaff) return;
  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("Forbidden");
  }
  const normalized = normalizeMemberRole(membership.role);
  if (!normalized || !canManageMembership(normalized)) {
    throw new Error("Forbidden");
  }
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const context = await resolveContext(orgId);
    if (!context.sessionUserId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const canRead = context.isStaff || context.membership?.status === "ACTIVE";
    if (!canRead) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("memberships")
      .select("user_id, role, status, profiles(full_name)")
      .eq("company_id", orgId)
      .order("role", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const items = (data || []).map((row: MembershipRow) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      const role = normalizeMemberRole(row.role) ?? DEFAULT_MEMBER_ROLE;
      const status = normalizeMemberStatus(row.status) ?? DEFAULT_MEMBER_STATUS;
      return {
        user_id: row.user_id,
        role,
        status,
        full_name: profile ? profile.full_name ?? null : null,
      };
    });

    const currentRole = normalizeMemberRole(context.membership?.role);
    const canEdit = context.isStaff || canManageMembership(currentRole);

    return NextResponse.json({ ok: true, items, canEdit });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    const status = message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const context = await resolveContext(orgId);
    if (!context.sessionUserId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
      ensureCanManage(context.isStaff, context.membership);
    } catch {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    let payload: Record<string, unknown>;
    try {
      payload = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    let resolvedUserId: string;
    try {
      resolvedUserId = await resolveUserIdFromPayload(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid payload";
      return NextResponse.json({ ok: false, error: message }, { status: message === "Usuario no encontrado" ? 404 : 400 });
    }

    let role: MemberRole = DEFAULT_MEMBER_ROLE;
    let status: MemberStatus = DEFAULT_MEMBER_STATUS;
    try {
      role = payload.role === undefined ? DEFAULT_MEMBER_ROLE : parseMemberRole(payload.role);
      status = payload.status === undefined ? DEFAULT_MEMBER_STATUS : parseMemberStatus(payload.status);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid payload";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }

    const { data: existingRows, error: existingLookupError } = await supabaseAdmin
      .from("memberships")
      .select("role, status")
      .eq("company_id", orgId)
      .eq("user_id", resolvedUserId)
      .limit(1);

    if (existingLookupError) {
      return NextResponse.json({ ok: false, error: existingLookupError.message }, { status: 500 });
    }

    const existingMembership = existingRows?.[0] ?? null;

    const insertPayload = {
      user_id: resolvedUserId,
      company_id: orgId,
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

    try {
      const { logAudit } = await import("@/lib/audit");
      await logAudit({
        company_id: orgId,
        actor_id: context.sessionUserId,
        entity: "membership",
        entity_id: resolvedUserId,
        action: existingMembership ? "updated" : "created",
        data: {
          previous_role: existingMembership?.role ?? null,
          previous_status: existingMembership?.status ?? null,
          role: data?.role ?? insertPayload.role,
          status: data?.status ?? insertPayload.status,
          user_id: resolvedUserId,
        },
      });
    } catch {
      // ignore audit failures
    }

    return NextResponse.json({ ok: true, membership: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const context = await resolveContext(orgId);
    if (!context.sessionUserId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
      ensureCanManage(context.isStaff, context.membership);
    } catch {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    let payload: Record<string, unknown>;
    try {
      payload = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    const userId = typeof payload.user_id === "string" ? payload.user_id.trim() : "";
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Invalid user_id" }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {};

    try {
      if (payload.role !== undefined) {
        updatePayload.role = parseMemberRole(payload.role);
      }
      if (payload.status !== undefined) {
        updatePayload.status = parseMemberStatus(payload.status);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid payload";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ ok: false, error: "No changes provided" }, { status: 400 });
    }

    const { data: beforeRows, error: beforeError } = await supabaseAdmin
      .from("memberships")
      .select("role, status")
      .eq("company_id", orgId)
      .eq("user_id", userId)
      .limit(1);
    if (beforeError) {
      return NextResponse.json({ ok: false, error: beforeError.message }, { status: 500 });
    }
    const before = beforeRows?.[0] ?? null;

    const { data, error } = await supabaseAdmin
      .from("memberships")
      .update(updatePayload)
      .eq("company_id", orgId)
      .eq("user_id", userId)
      .select("user_id, role, status")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    try {
      const { logAudit } = await import("@/lib/audit");
      await logAudit({
        company_id: orgId,
        actor_id: context.sessionUserId,
        entity: "membership",
        entity_id: userId,
        action: "updated",
        data: {
          previous_role: before?.role ?? null,
          previous_status: before?.status ?? null,
          role: data?.role ?? updatePayload.role ?? null,
          status: data?.status ?? updatePayload.status ?? null,
          user_id: userId,
        },
      });
    } catch {
      // ignore audit failures
    }

    return NextResponse.json({ ok: true, membership: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const context = await resolveContext(orgId);
    if (!context.sessionUserId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    let userId: string | null = null;
    try {
      const body = await req.json();
      if (body && typeof body.user_id === "string") {
        userId = body.user_id.trim();
      }
    } catch {
      // ignore optional body
    }

    if (!userId) {
      const url = new URL(req.url);
      userId = url.searchParams.get("user_id");
    }

    if (!userId || !userId.trim()) {
      return NextResponse.json({ ok: false, error: "Missing user_id" }, { status: 400 });
    }

    try {
      ensureCanManage(context.isStaff, context.membership);
    } catch {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from("memberships")
      .select("role, status")
      .eq("company_id", orgId)
      .eq("user_id", userId)
      .limit(1);
    if (existingError) {
      return NextResponse.json({ ok: false, error: existingError.message }, { status: 500 });
    }
    const existing = existingRows?.[0] ?? null;

    if (!context.isStaff) {
      const victimRole = normalizeMemberRole(existing?.role);
      const actorRole = normalizeMemberRole(context.membership?.role);
      if (victimRole === "OWNER" && actorRole !== "OWNER") {
        return NextResponse.json({ ok: false, error: "Solo otro owner puede eliminar a un owner" }, { status: 403 });
      }
    }

    const { error } = await supabaseAdmin
      .from("memberships")
      .delete()
      .eq("company_id", orgId)
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    try {
      const { logAudit } = await import("@/lib/audit");
      await logAudit({
        company_id: orgId,
        actor_id: context.sessionUserId,
        entity: "membership",
        entity_id: userId,
        action: "deleted",
        data: {
          previous_role: existing?.role ?? null,
          previous_status: existing?.status ?? null,
          user_id: userId,
        },
      });
    } catch {
      // ignore audit failures
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

