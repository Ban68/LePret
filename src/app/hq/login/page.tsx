import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

export default async function HqLoginRedirectPage({
  searchParams,
}: PageProps) {
  const query = new URLSearchParams();

  const resolved = await searchParams;

  if (resolved) {
    for (const [key, value] of Object.entries(resolved)) {
      if (typeof value === "string") {
        query.set(key, value);
        continue;
      }

      if (Array.isArray(value)) {
        for (const entry of value) {
          if (typeof entry === "string") {
            query.append(key, entry);
          }
        }
      }
    }
  }

  const search = query.toString();
  redirect(`/login${search ? `?${search}` : ""}`);
}
