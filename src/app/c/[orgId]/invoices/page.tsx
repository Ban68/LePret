import { InvoicesClient } from "./ui/InvoicesClient";

export default async function InvoicesPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  return <InvoicesClient orgId={orgId} />;
}
