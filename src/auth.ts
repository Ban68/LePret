// Minimal auth() implementation backed by Supabase session from cookies.
// This mirrors the shape expected by callers: { user, ...optionalFields }
// If no authenticated user, returns null.

import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { User } from "@supabase/supabase-js";

export type SessionUser = User;
export type Session = { user: SessionUser };

export async function auth(): Promise<Session | null> {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return { user } as unknown as Session;
}

export class UnauthorizedError extends Error {
  constructor(message = "Not authenticated") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export async function requireAuth(): Promise<Session> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  return session;
}

export async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function isStaff(): Promise<boolean> {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from("profiles")
    .select("is_staff")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.is_staff);
}
