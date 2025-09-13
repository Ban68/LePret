import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { requireAuth, UnauthorizedError } from "@/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const session = await requireAuth();

    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Staff bypass info
    const { data: prof } = await supabase
      .from("profiles")
      .select("is_staff, full_name")
      .eq("user_id", session.user.id)
      .maybeSingle();

    // Membership (if any) in the requested org
    const { data: membership } = await supabase
      .from("memberships")
      .select("role, status")
      .eq("company_id", orgId)
      .eq("user_id", session.user.id)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      orgId,
      user: { id: session.user.id, email: session.user.email ?? null },
      staff: Boolean(prof?.is_staff),
      membership: membership ? { role: membership.role, status: membership.status } : null,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    console.error("/api/c/[orgId]/me error", err);
    return NextResponse.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
  }
}
