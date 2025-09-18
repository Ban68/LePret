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

type MembershipRow = {
  user_id: string;
  company_id: string;
  role: string;
  status: string;
  companies?: { name: string | null } | null;
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

  const [{ data: authRows, error: authError }, { data: membershipData, error: membershipFetchError }] = await Promise.all([
    supabaseAdmin
      .from("auth.users" as unknown as string)
      .select("id, email, created_at, last_sign_in_at")
      .in("id", userIds),
    supabaseAdmin
      .from("memberships")
      .select("user_id, company_id, role, status, companies(name)")
      .in("user_id", userIds),
  ]);

  if (authError) {
    return NextResponse.json({ ok: false, error: authError.message }, { status: 500 });
  }

  if (membershipFetchError) {
    return NextResponse.json({ ok: false, error: membershipFetchError.message }, { status: 500 });
  }

  const authMap = new Map<string, AuthUserRow>();
  (authRows as AuthUserRow[] | null ?? []).forEach((row) => {
    authMap.set(row.id, row);
  });

  const membershipMap = new Map<string, MembershipRow[]>();
  const membershipRows = ((membershipData ?? []) as Array<{
    user_id: string;
    company_id: string;
    role: string;
    status: string;
    companies?: { name: string | null } | null;
  }>);

  membershipRows.forEach((row) => {
    if (!membershipMap.has(row.user_id)) {
      membershipMap.set(row.user_id, []);
    }
    membershipMap.get(row.user_id)!.push(row as MembershipRow);
  });

  const users: UserSummary[] = profileRows.map((profile) => {
    const auth = authMap.get(profile.user_id);
    const companyMemberships = membershipMap.get(profile.user_id) ?? [];
    const companies = companyMemberships.map((membership) => ({
      company_id: membership.company_id,
      company_name: membership.companies?.name ?? null,
      role: membership.role,
      status: membership.status,
    }));

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
