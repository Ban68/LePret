import type { SupabaseClient } from "@supabase/supabase-js";

function extractCompanyName(source: unknown): string | null {
  if (!source) return null;
  if (Array.isArray(source)) {
    for (const item of source) {
      if (item && typeof item === "object" && "name" in item) {
        const value = (item as { name?: unknown }).name;
        if (typeof value === "string" && value.trim()) {
          return value.trim();
        }
      }
    }
    return null;
  }
  if (typeof source === "object" && source !== null && "name" in source) {
    const value = (source as { name?: unknown }).name;
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

export async function getOrganizationDisplayName(
  supabase: SupabaseClient,
  orgId: string,
  userId?: string | null,
): Promise<string | null> {
  const memberUserId = typeof userId === "string" && userId.length ? userId : null;

  if (memberUserId) {
    const { data: membership } = await supabase
      .from("memberships")
      .select("companies(name)")
      .eq("company_id", orgId)
      .eq("user_id", memberUserId)
      .maybeSingle();

    const membershipName = extractCompanyName(membership?.companies);
    if (membershipName) return membershipName;
  }

  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", orgId)
    .maybeSingle();

  const directName = typeof company?.name === "string" && company.name.trim() ? company.name.trim() : null;
  return directName;
}
