import { supabaseAdmin } from "@/lib/supabase";

type MembershipRow = {
  company_id: string;
  role: string | null;
  status: string | null;
  companies?: { type?: string | null } | null;
};

function isInvestorCompany(row: MembershipRow): boolean {
  const type = row.companies?.type;
  if (typeof type === "string" && type.toUpperCase() === "INVESTOR") {
    return true;
  }
  if (typeof row.role === "string" && row.role.trim().toLowerCase() === "investor") {
    return true;
  }
  return false;
}

export async function isBackofficeAllowed(userId?: string | null, email?: string | null) {
  const allowedList = (process.env.BACKOFFICE_ALLOWED_EMAILS || "")
    .split(/[\,\s]+/)
    .map((value) => value.toLowerCase())
    .filter(Boolean);

  const normalizedEmail = email?.toLowerCase() ?? null;

  if (normalizedEmail && allowedList.includes(normalizedEmail)) {
    return true;
  }

  if (userId) {
    const hasStaffFlag = await fetchStaffFlag(userId);
    if (hasStaffFlag) {
      return true;
    }
  }

  if (!allowedList.length) {
    return true;
  }

  return false;
}

async function fetchStaffFlag(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("is_staff")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to verify staff access", error);
    return false;
  }

  return Boolean(data?.is_staff);
}

async function fetchInvestorMemberships(userId: string): Promise<MembershipRow[]> {
  const { data, error } = await supabaseAdmin
    .from("memberships")
    .select("company_id, role, status, companies(type)")
    .eq("user_id", userId)
    .eq("status", "ACTIVE");

  if (error || !data) {
    if (error) {
      console.error("Failed to fetch investor memberships", error);
    }
    return [];
  }

  return data as MembershipRow[];
}

export async function getInvestorCompanyIds(userId?: string | null): Promise<string[]> {
  if (!userId) {
    return [];
  }
  const memberships = await fetchInvestorMemberships(userId);
  const companyIds = memberships.filter(isInvestorCompany).map((row) => row.company_id);
  return Array.from(new Set(companyIds));
}

export async function isInvestorAllowed(userId?: string | null, email?: string | null) {
  if (!userId) {
    return false;
  }

  const staff = await fetchStaffFlag(userId);
  if (staff) {
    return true;
  }

  const investorCompanyIds = await getInvestorCompanyIds(userId);
  if (investorCompanyIds.length > 0) {
    return true;
  }

  // Optional allow-list reuse if provided (investor-only emails)
  if (email) {
    const allowList = (process.env.INVESTOR_ALLOWED_EMAILS || "")
      .split(/[\s,;]+/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    if (allowList.length && allowList.includes(email.toLowerCase())) {
      return true;
    }
  }

  return false;
}
