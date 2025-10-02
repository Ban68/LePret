import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { fetchInvestorDocuments, getDefaultInvestorCompanyId } from "@/lib/investors";
import { getInvestorCompanyIds, isBackofficeAllowed, isInvestorAllowed } from "@/lib/hq-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { notifyInvestorDocumentPublished } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
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

    const url = new URL(request.url);
    const requestedCompanyId = url.searchParams.get("companyId");
    const allowedCompanyIds = await getInvestorCompanyIds(session.user.id);

    if (!allowedCompanyIds.length) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const companyId = requestedCompanyId && allowedCompanyIds.includes(requestedCompanyId)
      ? requestedCompanyId
      : allowedCompanyIds[0];

    const documents = await fetchInvestorDocuments(supabase, companyId);

    return NextResponse.json({ companyId, documents });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api:investors:documents:get]", message);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      investor_company_id?: string;
      vehicle_company_id?: string | null;
      name?: string;
      doc_type?: string;
      description?: string | null;
      file_path?: string | null;
      send_notification?: boolean;
    };

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const canManage = await isBackofficeAllowed(session.user.id, session.user.email);
    if (!canManage) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const investorCompanyId = payload.investor_company_id ?? (await getDefaultInvestorCompanyId(session.user.id));
    if (!investorCompanyId) {
      return NextResponse.json({ error: "invalid_investor_company" }, { status: 400 });
    }

    if (!payload.name || !payload.doc_type) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    const insertPayload = {
      investor_company_id: investorCompanyId,
      vehicle_company_id: payload.vehicle_company_id ?? null,
      name: payload.name,
      doc_type: payload.doc_type,
      description: payload.description ?? null,
      file_path: payload.file_path ?? null,
      uploaded_by: session.user.id,
    };

    const { data, error } = await supabaseAdmin
      .from("investor_documents")
      .insert(insertPayload)
      .select("id, investor_company_id, vehicle_company_id, name, doc_type, file_path")
      .single();

    if (error || !data) {
      const message = error?.message ?? "insert_failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    if (payload.send_notification !== false) {
      try {
        await notifyInvestorDocumentPublished({
          investorCompanyId,
          vehicleCompanyId: data.vehicle_company_id ?? null,
          name: data.name,
          docType: data.doc_type,
          filePath: data.file_path ?? null,
        });
      } catch (err) {
        console.error("[api:investors:documents:notify]", err);
      }
    }

    return NextResponse.json({ ok: true, documentId: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api:investors:documents:post]", message);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
