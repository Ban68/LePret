import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { getOrganizationDisplayName, getOrganizationKycStatus, isKycCompleted } from "@/lib/organizations";

import { ClientPortalNav } from "./ui/ClientPortalNav";

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

  const kycStatus = await getOrganizationKycStatus(supabase, orgId);
  if (!isKycCompleted(kycStatus)) {
    redirect(`/registro/datos-empresa?orgId=${encodeURIComponent(orgId)}`);
  }

  const links = [
    { href: `/c/${orgId}/dashboard`, label: "Dashboard" },
    { href: `/c/${orgId}/invoices`, label: "Facturas" },
    { href: `/c/${orgId}/payers`, label: "Pagadores" },
    { href: `/c/${orgId}/requests`, label: "Solicitudes" },
    { href: `/c/${orgId}/documents`, label: "Documentos" },
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

        <ClientPortalNav links={links} />

        {children}
      </div>
    </div>
  );
}
