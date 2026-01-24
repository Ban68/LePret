import type { SupabaseClient } from "@supabase/supabase-js";

export async function isStaffUser(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.from('profiles').select('is_staff').eq('user_id', userId).maybeSingle();
  return !!(data && data.is_staff);
}
