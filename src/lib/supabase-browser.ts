import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Este archivo se usará en el cliente cuando integremos el portal con Supabase.
  // Mantener como throw para detectar configuración faltante cuando se consuma.
  throw new Error("Missing Supabase browser environment variables");
}

export const supabaseBrowser = createClient(url, anonKey);

