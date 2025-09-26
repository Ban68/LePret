import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

type DocumentPayload = {
  file_path?: string;
  name?: string;
  size?: number;
  content_type?: string;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string; requestId: string }> }
) {
  try {
    const { orgId, requestId } = await params;
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const rawDocuments: DocumentPayload[] = Array.isArray(body?.documents) ? body.documents : [];
    const normalized = rawDocuments
      .map((doc) => ({
        file_path: typeof doc?.file_path === "string" && doc.file_path.trim().length > 0 ? doc.file_path.trim() : null,
        name: typeof doc?.name === "string" ? doc.name : null,
        size: typeof doc?.size === "number" && Number.isFinite(doc.size) ? doc.size : null,
        content_type: typeof doc?.content_type === "string" ? doc.content_type : null,
      }))
      .filter((doc) => doc.file_path);

    if (!normalized.length) {
      return NextResponse.json({ ok: false, error: "missing_documents" }, { status: 400 });
    }

    const deduped = Array.from(
      new Map(
        normalized.map((doc) => [doc.file_path as string, { ...doc, file_path: doc.file_path as string }])
      ).values(),
    );

    const { data: requestRow, error: requestErr } = await supabase
      .from("funding_requests")
      .select("id")
      .eq("id", requestId)
      .eq("company_id", orgId)
      .maybeSingle();

    if (requestErr) {
      return NextResponse.json({ ok: false, error: requestErr.message }, { status: 500 });
    }

    if (!requestRow) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const rows = deduped.map((doc) => ({
      company_id: orgId,
      request_id: requestId,
      type: "REQUEST_SUPPORT",
      status: "uploaded",
      provider: "STORAGE",
      provider_envelope_id: null,
      file_path: doc.file_path,
      uploaded_by: session.user.id,
    }));

    const { data, error: insertErr } = await supabase
      .from("documents")
      .insert(rows)
      .select("id, file_path, type, status, created_at");

    if (insertErr) {
      return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, documents: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
