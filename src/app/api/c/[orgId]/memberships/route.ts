import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { supabaseAdmin as defaultSupabaseAdmin } from "@/lib/supabase";

type RouteSupabaseClient = ReturnType<typeof createRouteHandlerClient>;
type SupabaseAdminClient = typeof defaultSupabaseAdmin;

let supabaseClientFactory: (() => RouteSupabaseClient) | null = null;
let supabaseAdminOverride: SupabaseAdminClient | null = null;
let cookiesOverride: (() => ReturnType<typeof cookies>) | null = null;

function getSupabaseClient(cookieStore: ReturnType<typeof cookies>) {
  return supabaseClientFactory ? supabaseClientFactory() : createRouteHandlerClient({ cookies: () => cookieStore });
}

function getSupabaseAdmin(): SupabaseAdminClient {
  return supabaseAdminOverride ?? defaultSupabaseAdmin;
}

function getCookieStore() {
  return cookiesOverride ? cookiesOverride() : cookies();
}

export function __setMembershipsSupabaseClientFactory(factory: (() => RouteSupabaseClient) | null) {
  supabaseClientFactory = factory;
}

export function __setMembershipsSupabaseAdmin(client: SupabaseAdminClient | null) {
  supabaseAdminOverride = client;
}

export function __setMembershipsCookies(override: (() => ReturnType<typeof cookies>) | null) {
  cookiesOverride = override;
}

const MEMBER_ROLES = ["OWNER", "ADMIN", "OPERATOR", "VIEWER"] as const;
const EDITABLE_ROLES = new Set<MemberRole>(["OWNER", "ADMIN"]);
const HQ_STAFF_ERROR_CODE = "HQ_STAFF";

type MemberRole = (typeof MEMBER_ROLES)[number];
type MemberStatus = "ACTIVE" | "INVITED" | "DISABLED";

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

class HqStaffError extends Error {
  readonly code = HQ_STAFF_ERROR_CODE;
}

function normaliseRole(role?: string | null): MemberRole | null {
  if (!role) return null;
  const upper = role.toUpperCase();
  return (MEMBER_ROLES as readonly string[]).includes(upper) ? (upper as MemberRole) : null;
}

function requireValidRole(value: unknown): MemberRole {
  if (typeof value !== "string") {
    throw new Error("Invalid role value");
  }
  const normalized = normaliseRole(value);
  if (!normalized) {
    throw new Error("Unsupported role");
  }
  return normalized;
}

function requireValidStatus(value: unknown): MemberStatus {
  if (typeof value !== "string") {
    throw new Error("Invalid status value");
  }
  const upper = value.toUpperCase();
  if (upper === "ACTIVE" || upper === "INVITED" || upper === "DISABLED") {
    return upper;
  }
  throw new Error("Unsupported status");
}

async function resolveContext(orgId: string): Promise<Context> {
  const cookieStore = getCookieStore();
  const supabase = getSupabaseClient(cookieStore);

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

async function ensureTargetNotStaff(userId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("is_staff")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "No se pudo consultar el perfil del usuario");
  }

  if (data?.is_staff) {
    throw new HqStaffError("Los usuarios de HQ no pueden gestionarse desde el portal");
  }
}

function ensureCanManage(isStaff: boolean, membership: { role?: string | null; status?: string | null } | null) {
  if (isStaff) return;
  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("Forbidden");
  }
  const normalized = normaliseRole(membership.role);
  if (!normalized || !EDITABLE_ROLES.has(normalized)) {
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

  const adminClient = getSupabaseAdmin();
  const adminAuth = (adminClient.auth as unknown as { admin?: AdminAuthClient }).admin;
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

    const supabaseAdmin = getSupabaseAdmin();
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
      return {
        user_id: row.user_id,
        role: row.role,
        status: row.status,
        full_name: profile ? profile.full_name ?? null : null,
      };
    });

    const currentRole = normaliseRole(context.membership?.role);
    const canEdit = context.isStaff || (currentRole ? EDITABLE_ROLES.has(currentRole) : false);

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

    try {
      await ensureTargetNotStaff(resolvedUserId);
    } catch (err) {
      if (err instanceof HqStaffError) {
        return NextResponse.json(
          { ok: false, error: err.message, code: err.code },
          { status: 403 }
        );
      }
      const message = err instanceof Error ? err.message : "Unexpected error";
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }

    let role: MemberRole | undefined;
    let status: MemberStatus | undefined;
    try {
      if (payload.role !== undefined) {
        role = requireValidRole(payload.role);
      }
      if (payload.status !== undefined) {
        status = requireValidStatus(payload.status);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid payload";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }

    const insertPayload = {
      user_id: resolvedUserId,
      company_id: orgId,
      role: role ?? "VIEWER",
      status: status ?? "INVITED",
    };

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("memberships")
      .upsert(insertPayload, { onConflict: "user_id,company_id" })
      .select("user_id, role, status")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
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

    try {
      await ensureTargetNotStaff(userId);
    } catch (err) {
      if (err instanceof HqStaffError) {
        return NextResponse.json(
          { ok: false, error: err.message, code: err.code },
          { status: 403 }
        );
      }
      const message = err instanceof Error ? err.message : "Unexpected error";
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }

    const updatePayload: Record<string, unknown> = {};

    try {
      if (payload.role !== undefined) {
        updatePayload.role = requireValidRole(payload.role);
      }
      if (payload.status !== undefined) {
        updatePayload.status = requireValidStatus(payload.status);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid payload";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ ok: false, error: "No changes provided" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
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

    if (!context.isStaff) {
      const supabaseAdmin = getSupabaseAdmin();
      const { data: existing } = await supabaseAdmin
        .from("memberships")
        .select("role")
        .eq("company_id", orgId)
        .eq("user_id", userId)
        .maybeSingle();
      const victimRole = normaliseRole(existing?.role);
      const actorRole = normaliseRole(context.membership?.role);
      if (victimRole === "OWNER" && actorRole !== "OWNER") {
        return NextResponse.json({ ok: false, error: "Solo otro owner puede eliminar a un owner" }, { status: 403 });
      }
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from("memberships")
      .delete()
      .eq("company_id", orgId)
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

