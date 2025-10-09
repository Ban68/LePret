import { CollectionsClient } from "./ui/CollectionsClient";

export default async function CollectionsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  return <CollectionsClient orgId={orgId} />;
}
