import { SettingsClient } from "./ui/SettingsClient";

export default async function SettingsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  return <SettingsClient orgId={orgId} />;
}
