import InvestorDashboard from "./client-dashboard";

type PageProps = {
  params: Promise<{ orgId: string }>;
};

export default async function InvestorDashboardPage({ params }: PageProps) {
  const { orgId } = await params;

  return <InvestorDashboard orgId={orgId} />;
}
