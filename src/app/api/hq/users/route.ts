import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { supabaseAdmin } from "@/lib/supabase";
import { isBackofficeAllowed } from "@/lib/hq-auth";

const DEFAULT_LIMIT = 200;

function sanitizeSearch(value: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

type ProfileRow = {
  user_id: string;
  full_name?: string | null;
  is_staff?: boolean | null;
  created_at?: string | null;
};

type AuthUserRow = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
};

type RawMembershipRow = {
  user_id: string;
  company_id: string;
  role: string;
  status: string;
  companies?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

type UserSummary = {
  id: string;
  email: string | null;
  full_name: string | null;
  is_staff: boolean;
  created_at: string | null;
  last_sign_in_at: string | null;
  companies: Array<{
    company_id: string;
    company_name: string | null;
    role: string;
    status: string;
  }>;
};

export async function GET(req: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session || !isBackofficeAllowed(session.user?.email)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const typeFilter = (url.searchParams.get("type") ?? "all").toLowerCase();
  const companyFilter = url.searchParams.get("company");
  const searchTerm = sanitizeSearch(url.searchParams.get("search"));
  const limitParam = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.floor(limitParam), 1), 500) : DEFAULT_LIMIT;

  let filteredUserIds: string[] | null = null;
  if (companyFilter && companyFilter !== "all") {
    const { data: membershipRows, error: membershipError } = await supabaseAdmin
      .from("memberships")
      .select("user_id")
      .eq("company_id", companyFilter)
      .limit(1000);

    if (membershipError) {
      return NextResponse.json({ ok: false, error: membershipError.message }, { status: 500 });
    }

    filteredUserIds = (membershipRows ?? []).map((row) => row.user_id);
    if (!filteredUserIds.length) {
      return NextResponse.json({ ok: true, users: [], total: 0 });
    }
  }

  let profilesQuery = supabaseAdmin
    .from("profiles")
    .select("user_id, full_name, is_staff, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (typeFilter === "staff") {
    profilesQuery = profilesQuery.eq("is_staff", true);
  } else if (typeFilter === "client") {
    profilesQuery = profilesQuery.eq("is_staff", false);
  }

  if (filteredUserIds) {
    profilesQuery = profilesQuery.in("user_id", filteredUserIds);
  }

  const { data: profiles, error: profilesError } = await profilesQuery;
  if (profilesError) {
    return NextResponse.json({ ok: false, error: profilesError.message }, { status: 500 });
  }

  const profileRows = (profiles ?? []) as ProfileRow[];
  if (!profileRows.length) {
    return NextResponse.json({ ok: true, users: [], total: 0 });
  }

  const userIds = profileRows.map((profile) => profile.user_id);

  const { data: membershipData, error: membershipFetchError } = await supabaseAdmin
    .from('memberships')
    .select('user_id, company_id, role, status, companies(name)')
    .in('user_id', userIds);

  if (membershipFetchError) {
    return NextResponse.json({ ok: false, error: membershipFetchError.message }, { status: 500 });
  }


  const membershipMap = new Map<string, RawMembershipRow[]>();
  const membershipRows = ((membershipData ?? []) as RawMembershipRow[] | null) ?? [];

  membershipRows.forEach((row) => {
    if (!membershipMap.has(row.user_id)) {
      membershipMap.set(row.user_id, []);
    }
    membershipMap.get(row.user_id)!.push(row);
  });

  let authMap: Map<string, AuthUserRow>;
  try {
    authMap = await getAuthUsersByIds(userIds);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
  const users: UserSummary[] = profileRows.map((profile) => {
    const auth = authMap.get(profile.user_id);
    const companyMemberships = membershipMap.get(profile.user_id) ?? [];
    const companies = mapMembershipRows(companyMemberships);

    return {
      id: profile.user_id,
      email: auth?.email ?? null,
      full_name: profile.full_name ?? null,
      is_staff: Boolean(profile.is_staff),
      created_at: auth?.created_at ?? profile.created_at ?? null,
      last_sign_in_at: auth?.last_sign_in_at ?? null,
      companies,
    };
  });

  const filteredUsers = users.filter((user) => {
    if (!searchTerm) {
      return true;
    }

    const haystack = [user.email, user.full_name, user.id, ...user.companies.map((company) => company.company_name ?? "")]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(searchTerm);
  });

  return NextResponse.json({
    ok: true,
    users: filteredUsers,
    total: filteredUsers.length,
  });
}

export async function POST(req: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session || !isBackofficeAllowed(session.user?.email)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let payload: CreateUserPayload;
  try {
    payload = (await req.json()) as CreateUserPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  const emailRaw = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!emailRaw || !EMAIL_REGEX.test(emailRaw)) {
    return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
  }

  const fullName = toOptionalString(payload.full_name) ?? null;

  let isStaff = false;
  if (typeof payload.is_staff !== "undefined") {
    isStaff = coerceBoolean(payload.is_staff, false);
  } else if (typeof payload.type === "string") {
    const typeValue = payload.type.trim().toLowerCase();
    if (["staff", "backoffice", "internal"].includes(typeValue)) {
      isStaff = true;
    } else if (["client", "customer", "external"].includes(typeValue)) {
      isStaff = false;
    }
  }

  const assignmentsInput = normalizeCompanyAssignments(payload.companies);
  const membershipRows = assignmentsInput.map((assignment) => {
    try {
      const role = normalizeMembershipRole(assignment.role);
      const status = normalizeMembershipStatus(assignment.status);
      return {
        user_id: "",
        company_id: assignment.company_id,
        role,
        status,
      };
    } catch (error) {
      throw new Error(`Invalid membership assignment for company ${assignment.company_id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  try {
    const adminAuth = (supabaseAdmin.auth as unknown as { admin?: AdminAuthClient }).admin;
    if (!adminAuth || typeof adminAuth.createUser !== "function") {
      throw new Error("Supabase admin client unavailable");
    }

    const { data: createdUser, error: createError } = await adminAuth.createUser({
      email: emailRaw,
      email_confirm: false,
      user_metadata: {
        full_name: fullName ?? undefined,
      },
    });

    if (createError) {
      if ((createError as { message?: string }).message?.includes("existing user")) {
        return NextResponse.json({ ok: false, error: "User already exists" }, { status: 409 });
      }
      throw createError;
    }
    const userId = createdUser?.user?.id;
    if (!userId) {
      throw new Error("Failed to create user");
    }

    const inviteFlag = typeof payload.invite === "undefined" ? true : coerceBoolean(payload.invite, true);
    if (inviteFlag && typeof adminAuth.inviteUserByEmail === "function") {
      try {
        await adminAuth.inviteUserByEmail(emailRaw);
      } catch (inviteError) {
        console.warn("Failed to send invite email", inviteError);
      }
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          user_id: userId,
          full_name: fullName ?? emailRaw,
          is_staff: isStaff,
        },
        { onConflict: "user_id" }
      );

    if (profileError) {
      throw profileError;
    }

    if (membershipRows.length) {
      const rows = membershipRows.map((row) => ({
        ...row,
        user_id: userId,
      }));

      const { error: membershipError } = await supabaseAdmin
        .from("memberships")
        .upsert(rows, { onConflict: "user_id,company_id" });

      if (membershipError) {
        throw membershipError;
      }
    }

    const summary = await getUserSummaryById(userId);

    return NextResponse.json({
      ok: true,
      user: summary ?? {
        id: userId,
        email: emailRaw,
        full_name: fullName,
        is_staff: isStaff,
        created_at: createdUser?.user?.created_at ?? null,
        last_sign_in_at: null,
        companies: membershipRows.map((row) => ({
          company_id: row.company_id,
          company_name: null,
          role: row.role,
          status: row.status,
        })),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("POST /api/hq/users error", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session || !isBackofficeAllowed(session.user?.email)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let payload: UpdateUserPayload;
  try {
    payload = (await req.json()) as UpdateUserPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  const userId = typeof payload.id === "string" ? payload.id.trim() : "";
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Missing user id" }, { status: 400 });
  }

  try {
    const existing = await getUserSummaryById(userId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    const nextFullName =
      payload.full_name === null
        ? null
        : toOptionalString(payload.full_name) ?? existing.full_name ?? existing.email ?? null;
    const nextIsStaff =
      typeof payload.is_staff === "undefined"
        ? existing.is_staff
        : coerceBoolean(payload.is_staff, existing.is_staff);

    const profileResult = await supabaseAdmin
      .from("profiles")
      .upsert({
        user_id: userId,
        full_name: nextFullName ?? existing.email ?? null,
        is_staff: nextIsStaff,
      }, { onConflict: "user_id" });

    if (profileResult.error) {
      throw profileResult.error;
    }

    const assignmentsInput = normalizeCompanyAssignments(payload.companies ?? payload.memberships);
    if (assignmentsInput.length) {
      const assignmentMap = new Map<string, { user_id: string; company_id: string; role: string; status: string }>();
      assignmentsInput.forEach((assignment) => {
        try {
          const role = normalizeMembershipRole(assignment.role);
          const status = normalizeMembershipStatus(assignment.status);
          assignmentMap.set(assignment.company_id, {
            user_id: userId,
            company_id: assignment.company_id,
            role,
            status,
          });
        } catch (error) {
          throw new Error(`Invalid membership assignment for company ${assignment.company_id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      });

      const upsertRows = Array.from(assignmentMap.values());
      if (upsertRows.length) {
        const { error: membershipError } = await supabaseAdmin
          .from("memberships")
          .upsert(upsertRows, { onConflict: "user_id,company_id" });
        if (membershipError) {
          throw membershipError;
        }
      }
    }

    const removalsRaw = Array.isArray(payload.remove) ? payload.remove : Array.isArray(payload.remove_companies) ? payload.remove_companies : [];
    const removalIds = (removalsRaw as unknown[])
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value) => value.length > 0);

    if (removalIds.length) {
      const { error: deleteError } = await supabaseAdmin
        .from("memberships")
        .delete()
        .eq("user_id", userId)
        .in("company_id", removalIds);
      if (deleteError) {
        throw deleteError;
      }
    }

    const inviteFlag = typeof payload.invite === "undefined" ? false : coerceBoolean(payload.invite, false);
    if (inviteFlag && existing.email) {
      const adminAuth = (supabaseAdmin.auth as unknown as { admin?: AdminAuthClient }).admin;
      if (adminAuth && typeof adminAuth.inviteUserByEmail === "function") {
        try {
          await adminAuth.inviteUserByEmail(existing.email);
        } catch (inviteError) {
          console.warn("Failed to resend invite email", inviteError);
        }
      }
    }

    const summary = await getUserSummaryById(userId);

    return NextResponse.json({ ok: true, user: summary ?? existing });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("PATCH /api/hq/users error", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const queryId = url.searchParams.get("id")?.trim() ?? "";
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session || !isBackofficeAllowed(session.user?.email)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let payload: { id?: unknown; hard?: unknown; hard_delete?: unknown; mode?: unknown } = {};
  try {
    payload = (await req.json()) as typeof payload;
  } catch (err) {
    // ignore body parse errors, we'll rely on query params
    if (req.headers.get("content-length")) {
      console.warn("DELETE /api/hq/users payload parse error", err);
    }
  }

  const bodyId = typeof payload.id === "string" ? payload.id.trim() : "";
  const userId = bodyId || queryId;

  if (!userId) {
    return NextResponse.json({ ok: false, error: "Missing user id" }, { status: 400 });
  }

  const modeValue = typeof payload.mode === "string" ? payload.mode.trim().toLowerCase() : null;
  const hardFromBody = typeof payload.hard_delete !== "undefined" ? coerceBoolean(payload.hard_delete, false) : undefined;
  const hardFlag =
    typeof hardFromBody === "boolean"
      ? hardFromBody
      : typeof payload.hard !== "undefined"
        ? coerceBoolean(payload.hard, false)
        : modeValue === "hard" || url.searchParams.get("mode")?.toLowerCase() === "hard";

  try {
    const existing = await getUserSummaryById(userId);
    if (!existing && !hardFlag) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    if (hardFlag) {
      const { error: membershipDeleteError } = await supabaseAdmin
        .from("memberships")
        .delete()
        .eq("user_id", userId);
      if (membershipDeleteError) {
        throw membershipDeleteError;
      }

      const { error: profileDeleteError } = await supabaseAdmin
        .from("profiles")
        .delete()
        .eq("user_id", userId);
      if (profileDeleteError) {
        throw profileDeleteError;
      }

      const adminAuth = (supabaseAdmin.auth as unknown as { admin?: AdminAuthClient }).admin;
      if (adminAuth && typeof adminAuth.deleteUser === "function") {
        const result = (await adminAuth.deleteUser(userId)) as { error?: { message?: string } | null } | null;
        if (result && result.error) {
          throw new Error(result.error.message ?? "Failed to delete auth user");
        }
      }

      return NextResponse.json({ ok: true, user: null, deleted: true });
    }

    if (!existing) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    const { error: membershipDisableError } = await supabaseAdmin
      .from("memberships")
      .update({ status: "DISABLED" })
      .eq("user_id", userId);
    if (membershipDisableError) {
      throw membershipDisableError;
    }

    const { error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          user_id: userId,
          full_name: existing.full_name ?? existing.email ?? null,
          is_staff: false,
        },
        { onConflict: "user_id" }
      );
    if (profileUpdateError) {
      throw profileUpdateError;
    }

    const summary = await getUserSummaryById(userId);
    return NextResponse.json({ ok: true, user: summary ?? existing, deleted: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("DELETE /api/hq/users error", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
const MEMBERSHIP_ROLES = new Set([
  "client",
  "admin",
  "investor",
  "OWNER",
  "ADMIN",
  "OPERATOR",
  "VIEWER",
]);

const MEMBERSHIP_STATUSES = new Set(["ACTIVE", "INVITED", "DISABLED"]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


type UpdateUserPayload = {
  id?: unknown;
  full_name?: unknown;
  is_staff?: unknown;
  companies?: unknown;
  memberships?: unknown;
  remove?: unknown;
  remove_companies?: unknown;
  invite?: unknown;
};

type CompanyAssignmentInput = {
  company_id: string;
  role?: string;
  status?: string;
};

type CreateUserPayload = {
  email?: unknown;
  full_name?: unknown;
  is_staff?: unknown;
  type?: unknown;
  companies?: unknown;
  invite?: unknown;
};


type AdminAuthClient = {
  createUser: (attributes: {
    email: string;
    email_confirm?: boolean;
    user_metadata?: Record<string, unknown> | null;
  }) => Promise<{ data: { user?: { id: string; created_at?: string | null } | null } | null; error: { message?: string } | null }>; 
  inviteUserByEmail?: (email: string) => Promise<unknown>;
  deleteUser?: (id: string) => Promise<{ data: unknown; error: { message?: string } | null }>;
  getUserById?: (id: string) => Promise<{ data: { user?: { id: string; email?: string | null; created_at?: string | null; last_sign_in_at?: string | null } | null } | null; error: { message?: string } | null }>;
};



function normalizeMembershipRole(value?: string): string {
  if (!value) {
    return "client";
  }
  const trimmed = value.trim();
  if (MEMBERSHIP_ROLES.has(trimmed)) {
    return trimmed;
  }
  const upper = trimmed.toUpperCase();
  if (MEMBERSHIP_ROLES.has(upper)) {
    return upper;
  }
  const lower = trimmed.toLowerCase();
  if (MEMBERSHIP_ROLES.has(lower)) {
    return lower;
  }
  throw new Error(`Invalid membership role: ${value}`);
}

function normalizeMembershipStatus(value?: string): string {
  if (!value) {
    return "INVITED";
  }
  const upper = value.trim().toUpperCase();
  if (MEMBERSHIP_STATUSES.has(upper)) {
    return upper;
  }
  throw new Error(`Invalid membership status: ${value}`);
}

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "n", "off"].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}

function toOptionalString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  return null;
}

function normalizeCompanyAssignments(input: unknown): CompanyAssignmentInput[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.reduce<CompanyAssignmentInput[]>((acc, entry) => {
    if (!entry || typeof entry !== "object") {
      return acc;
    }
    const companyId = String((entry as { company_id?: unknown }).company_id ?? "").trim();
    if (!companyId) {
      return acc;
    }
    const roleRaw = (entry as { role?: unknown }).role;
    const statusRaw = (entry as { status?: unknown }).status;
    acc.push({
      company_id: companyId,
      role: typeof roleRaw === "string" ? roleRaw : undefined,
      status: typeof statusRaw === "string" ? statusRaw : undefined,
    });
    return acc;
  }, []);
}

function extractCompanyName(value: RawMembershipRow["companies"]): string | null {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    const first = value[0];
    if (!first || typeof first !== "object") {
      return null;
    }
    const raw = (first as { name?: unknown }).name;
    return typeof raw === "string" ? raw : raw === null ? null : null;
  }
  const raw = (value as { name?: unknown }).name;
  if (typeof raw === "string") {
    return raw;
  }
  return null;
}

function mapMembershipRows(rows: RawMembershipRow[]): Array<{
  company_id: string;
  company_name: string | null;
  role: string;
  status: string;
}> {
  return rows.map((row) => ({
    company_id: row.company_id,
    company_name: extractCompanyName(row.companies),
    role: row.role,
    status: row.status,
  }));
}

async function getAuthUsersByIds(userIds: string[]): Promise<Map<string, AuthUserRow>> {
  const map = new Map<string, AuthUserRow>();
  if (!userIds.length) {
    return map;
  }

  const adminAuth = (supabaseAdmin.auth as unknown as { admin?: AdminAuthClient }).admin;
  const getUserById = adminAuth?.getUserById?.bind(adminAuth);
  if (!getUserById) {
    throw new Error("Supabase admin client unavailable");
  }

  const uniqueIds = Array.from(new Set(userIds));

  await Promise.all(
    uniqueIds.map(async (id) => {
      const { data, error } = await getUserById(id);
      if (error) {
        const message = error.message ?? '';
        if (message.toLowerCase().includes('not found')) {
          return;
        }
        throw new Error(message || `Failed to load user ${id}`);
      }
      const user = data?.user;
      if (!user) {
        return;
      }
      map.set(user.id, {
        id: user.id,
        email: user.email ?? null,
        created_at: user.created_at ?? null,
        last_sign_in_at: (user as { last_sign_in_at?: string | null }).last_sign_in_at ?? null,
      });
    })
  );

  return map;
}


async function getUserSummariesByIds(userIds: string[]): Promise<UserSummary[]> {
  if (!userIds.length) {
    return [];
  }

  const [{ data: profilesData, error: profilesError }, { data: membershipData, error: membershipError }] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('user_id, full_name, is_staff, created_at')
      .in('user_id', userIds),
    supabaseAdmin
      .from('memberships')
      .select('user_id, company_id, role, status, companies(name)')
      .in('user_id', userIds),
  ]);

  if (profilesError) {
    throw profilesError;
  }
  if (membershipError) {
    throw membershipError;
  }

  const profiles = (profilesData as ProfileRow[] | null) ?? [];

  const membershipMap = new Map<string, RawMembershipRow[]>();
  (membershipData as RawMembershipRow[] | null ?? []).forEach((row) => {
    if (!membershipMap.has(row.user_id)) {
      membershipMap.set(row.user_id, []);
    }
    membershipMap.get(row.user_id)!.push(row);
  });

  const authMap = await getAuthUsersByIds(userIds);

  return profiles.map((profile) => {
    const auth = authMap.get(profile.user_id);
    const companyMemberships = membershipMap.get(profile.user_id) ?? [];
    const companies = mapMembershipRows(companyMemberships);

    return {
      id: profile.user_id,
      email: auth?.email ?? null,
      full_name: profile.full_name ?? null,
      is_staff: Boolean(profile.is_staff),
      created_at: auth?.created_at ?? profile.created_at ?? null,
      last_sign_in_at: auth?.last_sign_in_at ?? null,
      companies,
    };
  });
}

async function getUserSummaryById(userId: string): Promise<UserSummary | null> {
  const summaries = await getUserSummariesByIds([userId]);
  return summaries[0] ?? null;
}



