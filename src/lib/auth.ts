import { createClient, type Session } from '@supabase/supabase-js';
import { env } from './env';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY ?? '');

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function getLastOrgId(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|; )last_org=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
