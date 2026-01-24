import { redirect } from "next/navigation";

export default async function ClientPortalHome({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  redirect(`/c/${orgId}/dashboard`);
}
