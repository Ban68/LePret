import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

type RegistroIndexProps = {
  searchParams?: Promise<SearchParams>;
};

export default async function RegistroIndex({ searchParams }: RegistroIndexProps) {
  const params = (await searchParams) ?? {};
  const orgParam = params.orgId;
  const orgId = Array.isArray(orgParam) ? orgParam[0] : orgParam;
  if (!orgId) {
    redirect("/select-org?reason=missing-org");
  }
  redirect(`/registro/datos-empresa?orgId=${encodeURIComponent(orgId)}`);
}
