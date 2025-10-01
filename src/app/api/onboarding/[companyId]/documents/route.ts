import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

import { canManageMembership, normalizeMemberRole } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireSession() {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { supabase, session } as const;
}

async function ensureManager(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("memberships")
    .select("role, status")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("onboarding documents membership error", error);
    throw new Error("membership_error");
  }
  if (!data || data.status !== "ACTIVE") {
    return { allowed: false } as const;
  }
  const role = normalizeMemberRole(data.role);
  if (!canManageMembership(role)) {
    return { allowed: false } as const;
  }
  return { allowed: true } as const;
}

function sanitizeName(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export async function POST(
  req: Request,
  { params }: { params: { companyId: string } },
) {
  try {
    const companyId = params.companyId;
    if (!companyId) {
      return NextResponse.json({ ok: false, error: "Missing company" }, { status: 400 });
    }

    const { supabase, session } = await requireSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const membership = await ensureManager(supabase, companyId, session.user.id);
    if (!membership.allowed) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });
    }

    const typeValue = formData.get("type");
    const type = typeof typeValue === "string" && typeValue.trim() ? typeValue.trim().toLowerCase() : "document";
    const originalName = sanitizeName(file.name || `${type}.pdf`);
    const timestamp = Date.now();
    const path = `${companyId}/${type}-${timestamp}-${originalName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error } = await supabaseAdmin.storage
      .from("kyc-documents")
      .upload(path, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (error) {
      console.error("onboarding document upload error", error);
      return NextResponse.json({ ok: false, error: "upload_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, path });
  } catch (error) {
    console.error("POST /api/onboarding documents error", error);
    return NextResponse.json({ ok: false, error: "unexpected" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { companyId: string } },
) {
  try {
    const companyId = params.companyId;
    if (!companyId) {
      return NextResponse.json({ ok: false, error: "Missing company" }, { status: 400 });
    }

    const { supabase, session } = await requireSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const membership = await ensureManager(supabase, companyId, session.user.id);
    if (!membership.allowed) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const path = body && typeof body.path === "string" ? body.path : null;
    if (!path || !path.startsWith(`${companyId}/`)) {
      return NextResponse.json({ ok: false, error: "Invalid path" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.storage.from("kyc-documents").remove([path]);
    if (error) {
      console.error("onboarding document delete error", error);
      return NextResponse.json({ ok: false, error: "delete_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/onboarding documents error", error);
    return NextResponse.json({ ok: false, error: "unexpected" }, { status: 500 });
  }
}
