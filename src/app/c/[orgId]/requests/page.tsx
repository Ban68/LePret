import { RequestsClient } from "./ui/RequestsClient";

export default async function RequestsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  return <RequestsClient orgId={orgId} />;
}
