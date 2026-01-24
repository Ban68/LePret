import { DocumentsClient } from "./ui/DocumentsClient";

export default async function DocumentsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  return <DocumentsClient orgId={orgId} />;
}
