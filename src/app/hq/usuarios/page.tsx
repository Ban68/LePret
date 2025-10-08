import { getSupabaseAdminClient } from "@/lib/supabase";

import { UsersManager } from "../ui/UsersManager";

export const dynamic = "force-dynamic";

export default async function HqUsersPage() {
  const supabaseAdmin = getSupabaseAdminClient();
  const { data: companies } = await supabaseAdmin
    .from("companies")
    .select("id, name, type")
    .order("name", { ascending: true });

  return <UsersManager companies={companies ?? []} />;
}
