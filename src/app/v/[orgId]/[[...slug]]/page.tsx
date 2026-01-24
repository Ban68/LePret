import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";

type Params = {
  orgId: string;
  slug?: string[];
};

type SearchParams = Record<string, string | string[] | undefined>;

const normalizeSlug = (segments: string[] = []): string => {
  if (!segments.length) {
    return "";
  }

  const encoded = segments
    .map((segment) => segment?.toString() ?? "")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment));

  if (!encoded.length) {
    return "";
  }

  return `/${encoded.join("/")}`;
};

const formatQuery = (params: SearchParams | undefined): string => {
  if (!params) {
    return "";
  }

  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      query.append(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      value.filter((item): item is string => typeof item === "string").forEach((item) => {
        query.append(key, item);
      });
    }
  }

  const serialized = query.toString();

  return serialized ? `?${serialized}` : "";
};

const getCompanyType = (
  record: { type?: string | null } | Array<{ type?: string | null }> | null | undefined,
): string | null => {
  if (!record) {
    return null;
  }

  const entry = Array.isArray(record) ? record[0] : record;
  const raw = typeof entry?.type === "string" ? entry.type.trim().toUpperCase() : "";

  return raw || null;
};

export default async function LegacyPortalRedirect({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams?: Promise<SearchParams>;
}) {
  const { orgId, slug } = await params;
  if (!orgId) {
    redirect("/select-org");
  }

  const query = searchParams ? await searchParams : undefined;
  const suffix = normalizeSlug(slug);
  const queryString = formatQuery(query);
  const legacyPath = `/v/${orgId}${suffix}${queryString}`;

  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect(`/login?redirectTo=${encodeURIComponent(legacyPath)}`);
  }

  const { data: membership, error } = await supabase
    .from("memberships")
    .select("status, companies ( type )")
    .eq("company_id", orgId)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) {
    console.error("Failed to resolve legacy portal route", error);
    redirect("/select-org?reason=lookup-error");
  }

  const normalizedStatus = typeof membership?.status === "string" ? membership.status.toUpperCase() : null;

  if (!membership || (normalizedStatus && normalizedStatus !== "ACTIVE")) {
    redirect("/select-org?reason=no-membership");
  }

  const companyType = getCompanyType(
    (membership as { companies?: { type?: string | null } | Array<{ type?: string | null }> | null }).companies,
  );

  const basePath = companyType === "INVESTOR" ? `/i/${orgId}` : `/c/${orgId}`;
  const destination = `${basePath}${suffix}${queryString}`;

  redirect(destination);
}
