// src/lib/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // servidor solo

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  cachedClient = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  return cachedClient;
}

export const supabaseAdmin = new Proxy(
  {},
  {
    get(_target, prop, receiver) {
      const client = getSupabaseAdminClient() as unknown as Record<PropertyKey, unknown>;
      const value = Reflect.get(client, prop, receiver);
      if (typeof value === "function") {
        return (value as (...args: unknown[]) => unknown).bind(client);
      }
      return value;
    },
  },
) as unknown as SupabaseClient;
