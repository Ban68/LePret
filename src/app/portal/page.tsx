import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { supabaseServer } from "@/lib/supabase-server";

type LastOrgCookie = { type: "client" | "investor"; id: string };

function parseLastOrgCookie(value: string | undefined): LastOrgCookie | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed.includes(":")) {
    return { type: "client", id: trimmed };
  }

  const [rawType, ...rest] = trimmed.split(":");
  const id = rest.join(":").trim();
  if (!id) {
    return null;
  }

  const normalizedType = rawType?.toLowerCase() === "investor" ? "investor" : "client";
  return { type: normalizedType, id };
}

function resolveCompanyType(value: unknown): "client" | "investor" {
  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase();
    if (normalized === "INVESTOR") {
      return "investor";
    }
  }
  return "client";
}

export default async function PortalRedirect() {
  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect(`/login?redirectTo=${encodeURIComponent("/portal")}`);
  }

  const cookieStore = cookies();
  const lastOrgCookie = parseLastOrgCookie(cookieStore.get("last_org")?.value);
  if (lastOrgCookie) {
    const destination = lastOrgCookie.type === "investor" ? `/i/${lastOrgCookie.id}` : `/c/${lastOrgCookie.id}`;
    redirect(destination);
  }

  const { data: membership, error } = await supabase
    .from("memberships")
    .select("company_id, companies(type)")
    .eq("user_id", session.user.id)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error && membership?.company_id) {
    const company = Array.isArray(membership.companies) ? membership.companies[0] : membership.companies;
    const companyType = resolveCompanyType(company?.type);
    const destination = companyType === "investor" ? `/i/${membership.company_id}` : `/c/${membership.company_id}`;
    redirect(destination);
  }

  redirect("/select-org");
}
