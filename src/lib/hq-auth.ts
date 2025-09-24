import { supabaseAdmin } from "@/lib/supabase";

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
