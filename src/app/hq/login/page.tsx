import { redirect } from "next/navigation";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function HqLoginRedirectPage({ searchParams }: PageProps) {
  const query = new URLSearchParams();

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
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
