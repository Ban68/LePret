import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";
import { getOrganizationDisplayName } from "@/lib/organizations";

export default async function ClientPortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const orgName = await getOrganizationDisplayName(supabase, orgId, session?.user?.id ?? null);
  const displayOrg = orgName ?? orgId;

  const links = [
    { href: `/c/${orgId}`, label: "Resumen" },
    { href: `/c/${orgId}/invoices`, label: "Facturas" },
    { href: `/c/${orgId}/payers`, label: "Pagadores" },
    { href: `/c/${orgId}/requests`, label: "Solicitudes" },
    { href: `/c/${orgId}/settings`, label: "Ajustes" },
  ];

  return (
    <div className="py-8 sm:py-10">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-lp-sec-3">
          <span className="font-semibold text-lp-primary-1">Portal Clientes</span>
          <span className="opacity-60">/</span>
          <span className="truncate">Org: {displayOrg}</span>
        </div>

        <nav className="mb-8 flex flex-wrap gap-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md border border-lp-sec-4/60 px-3 py-1.5 text-sm text-lp-primary-1 hover:bg-lp-primary-1 hover:text-lp-primary-2"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {children}
      </div>
    </div>
  );
}
