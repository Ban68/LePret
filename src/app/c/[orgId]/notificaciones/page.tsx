import { NotificationsClient } from "./ui/NotificationsClient";

export default async function NotificationsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  return <NotificationsClient orgId={orgId} />;
}
