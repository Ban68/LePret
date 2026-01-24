import { redirect } from "next/navigation";

type Params = {
  orgId: string;
};

export default async function InvestorPortalRoot({
  params,
}: {
  params: Promise<Params>;
}) {
  const { orgId } = await params;
  const target = typeof orgId === "string" && orgId.length > 0 ? orgId : "";
  if (!target) {
    redirect("/select-org");
  }
  redirect(`/i/${encodeURIComponent(target)}/dashboard`);
}
