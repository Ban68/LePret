import { PayersClient } from "./ui/PayersClient";

export default async function PayersPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  return <PayersClient orgId={orgId} />;
}

