import type { SupabaseClient } from "@supabase/supabase-js";

type AnySupabaseClient = SupabaseClient<any, any, any, any, any>;

export async function isStaffUser(supabase: AnySupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.from('profiles').select('is_staff').eq('user_id', userId).maybeSingle();
  return !!(data && data.is_staff);
}
