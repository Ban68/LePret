import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { getSupabaseAdminClient } from "@/lib/supabase";
import { normalizeMemberRole } from "@/lib/rbac";

type RouteContext = { params: { orgId: string } };

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const { orgId } = params;
    if (!orgId?.trim()) {
      return NextResponse.json({ ok: false, error: "Missing organization" }, { status: 400 });
    }

    const companyId = orgId.trim();

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_staff")
      .eq("user_id", session.user.id)
      .maybeSingle();
    const isStaff = Boolean(profile?.is_staff);

    const { data: membership } = await supabase
      .from("memberships")
      .select("role,status")
      .eq("company_id", companyId)
      .eq("user_id", session.user.id)
      .maybeSingle();

    const normalizedRole = normalizeMemberRole(membership?.role);
    const isActiveMember = membership?.status === "ACTIVE";

    if (!isStaff) {
      if (!isActiveMember || normalizedRole !== "OWNER") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      }
    }

    const supabaseAdmin = getSupabaseAdminClient();

    const { error: membersError } = await supabaseAdmin
      .from("memberships")
      .delete()
      .eq("company_id", companyId);

    if (membersError) {
      return NextResponse.json({ ok: false, error: membersError.message }, { status: 500 });
    }

    const { error: deleteError } = await supabaseAdmin.from("companies").delete().eq("id", companyId);

    if (deleteError) {
      if (deleteError.code === "23503") {
        return NextResponse.json(
          { ok: false, error: "No se puede eliminar la organizacion porque tiene datos asociados." },
          { status: 409 },
        );
      }
      return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
