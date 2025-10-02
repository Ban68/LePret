import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { isInvestorAllowed } from "@/lib/hq-auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ documentId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { documentId } = await params;
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const allowed = await isInvestorAllowed(session.user.id, session.user.email);
    if (!allowed) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { data: document, error } = await supabase
      .from("investor_documents")
      .select("id, file_path")
      .eq("id", documentId)
      .maybeSingle();

    if (error || !document) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (!document.file_path) {
      return NextResponse.json({ error: "missing_file" }, { status: 404 });
    }

    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from("investor-documents")
      .createSignedUrl(document.file_path, 120, { download: true });

    if (signedError || !signed?.signedUrl) {
      return NextResponse.json({ error: signedError?.message ?? "signed_url_failed" }, { status: 500 });
    }

    return NextResponse.redirect(signed.signedUrl, 302);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api:investors:documents:download]", message);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
