import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const SIGNED_URL_TTL = 60 * 10; // 10 minutos

function resolveBucket(type: string | null | undefined): string | null {
  const normalized = (type || "").toUpperCase();
  if (!normalized) return null;
  if (normalized.includes("CONTRATO")) return "contracts";
  return "kyc-documents";
}

type RouteContext = { params: Promise<{ orgId: string }> };

type DocumentRow = {
  id: string;
  type: string;
  status: string;
  created_at: string;
  request_id: string | null;
  file_path: string | null;
};

export async function GET(req: Request, { params }: RouteContext) {
  try {
    const { orgId } = await params;
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const typeFilter = url.searchParams.get("type");
    const requestId = url.searchParams.get("requestId");

    let query = supabase
      .from("documents")
      .select("id, type, status, created_at, request_id, file_path")
      .eq("company_id", orgId)
      .order("created_at", { ascending: false });

    if (typeFilter && typeFilter !== "all") {
      query = query.eq("type", typeFilter);
    }

    if (requestId) {
      query = query.eq("request_id", requestId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows = (data || []) as DocumentRow[];
    if (!rows.length) {
      return NextResponse.json({ ok: true, items: [] });
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const items = await Promise.all(
      rows.map(async (row) => {
        const bucket = resolveBucket(row.type);
        if (!bucket || !row.file_path) {
          return { ...row, public_url: null };
        }
        try {
          const { data: signed, error: signedError } = await supabaseAdmin.storage
            .from(bucket)
            .createSignedUrl(row.file_path, SIGNED_URL_TTL, { download: true });
          if (signedError || !signed?.signedUrl) {
            return { ...row, public_url: null };
          }
          return { ...row, public_url: signed.signedUrl };
        } catch (err) {
          console.error("documents signed url error", err);
          return { ...row, public_url: null };
        }
      }),
    );

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
