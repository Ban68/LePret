import { BankAccountsClient } from "./ui/BankAccountsClient";

export default async function BankAccountsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  return <BankAccountsClient orgId={orgId} />;
}
