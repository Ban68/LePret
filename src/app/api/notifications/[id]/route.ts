import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

type RouteParams = { params: Promise<{ id: string }> };

async function getAuthenticatedClient() {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return { supabase, session } as const;
}

export async function PATCH(
  _req: Request,
  { params }: RouteParams
) {
  const { id: notificationId } = (await params) ?? {};
  if (!notificationId) {
    return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
  }

  const { supabase, session } = await getAuthenticatedClient();

  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", session.user.id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data });
}
