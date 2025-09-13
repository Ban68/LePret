import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

export async function supabaseServer() {
  const cookieStore = cookies();
  return createServerComponentClient({ cookies: () => cookieStore });
}
