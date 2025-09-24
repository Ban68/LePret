import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | undefined;

export const getSupabaseBrowserClient = () => {
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      throw new Error("Missing Supabase browser environment variables");
    }

    browserClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
      },
    });
  }

  return browserClient;
};
