import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { ContractGenerationError, generateContractForRequest } from "@/lib/contracts";
import { notifyClientContractReady } from "@/lib/notifications";

export const dynamic = "force-dynamic";

function isResendEligible(type: string | null, status: string | null): boolean {
  if (!type) return false;
  const normalizedType = type.toUpperCase();
  if (normalizedType !== "CONTRATO_MARCO") return false;
  const normalizedStatus = (status || "").toLowerCase();
  return normalizedStatus === "created";
}

type RouteContext = { params: Promise<{ orgId: string; documentId: string }> };

type DocumentRow = {
  id: string;
  company_id: string;
  request_id: string | null;
  type: string;
  status: string;
  provider: string | null;
  provider_envelope_id: string | null;
};

export async function POST(_req: Request, { params }: RouteContext) {
  try {
    const { orgId, documentId } = await params;
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: document, error } = await supabase
      .from("documents")
      .select("id, company_id, request_id, type, status, provider, provider_envelope_id")
      .eq("id", documentId)
      .eq("company_id", orgId)
      .single();

    const row = document as DocumentRow | null;

    if (error || !row) {
      const message = error?.message ?? "not_found";
      return NextResponse.json({ ok: false, error: message }, { status: 404 });
    }

    if (!isResendEligible(row.type, row.status)) {
      return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });
    }

    if (!row.request_id) {
      return NextResponse.json({ ok: false, error: "missing_request" }, { status: 400 });
    }

    try {
      const result = await generateContractForRequest({
        orgId,
        requestId: row.request_id,
        actorId: session.user.id,
        skipIfExists: true,
      });

      if (result.skipped) {
        const appBase = process.env.PANDADOC_APP_URL || "https://app.pandadoc.com/a/#/documents/";
        const appUrl = row.provider_envelope_id ? `${appBase}${row.provider_envelope_id}` : null;
        if (appUrl) {
          await notifyClientContractReady(orgId, { appUrl });
        }
        return NextResponse.json({ ok: true, skipped: true, reason: result.skipReason ?? "existing_document" });
      }

      return NextResponse.json({ ok: true, document: result.document, envelope: result.envelope });
    } catch (err) {
      if (err instanceof ContractGenerationError) {
        return NextResponse.json({ ok: false, error: err.code }, { status: err.status });
      }
      throw err;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unexpected_error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
