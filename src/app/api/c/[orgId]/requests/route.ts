import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { createRequestWithInvoices } from "./helpers";

type FundingRequestRow = {
  id: string;
  invoice_id: string | null;
  requested_amount: number;
  status: string;
  created_at: string;
  file_path: string | null;
  created_by: string | null;
};

type OfferRow = {
  id: string;
  request_id: string;
  status: string;
  annual_rate: number | null;
  advance_pct: number | null;
  net_amount: number | null;
  valid_until: string | null;
  created_at: string;
};

type DocumentRow = {
  id: string;
  request_id: string | null;
  type: string;
  status: string;
  provider_envelope_id: string | null;
  created_at: string;
};

type ClientNextStep = {
  label: string;
  hint?: string | null;
  cta?: {
    kind: string;
    label?: string | null;
    offer_id?: string;
  } | null;
} | null;

function formatFriendlyDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

function computeClientNextStep(
  status: string | null | undefined,
  offer: OfferRow | null,
  contract: DocumentRow | null,
): ClientNextStep {
  const normalized = (status || "").toLowerCase();

  if (normalized === "offered") {
    if (offer && offer.status === "offered") {
      const expires = formatFriendlyDate(offer.valid_until);
      return {
        label: "Aceptar oferta",
        hint: expires ? `Vigente hasta ${expires}` : "Revisa las condiciones y acepta para continuar.",
        cta: { kind: "accept_offer", label: "Aceptar oferta", offer_id: offer.id },
      };
    }
    return {
      label: "Oferta en preparacion",
      hint: "Estamos afinando las condiciones para tu oferta.",
    };
  }

  if (normalized === "accepted") {
    if (!contract) {
      return {
        label: "Esperar contrato",
        hint: "Pronto recibiras el contrato para firma.",
      };
    }

    const contractStatus = (contract.status || "").toLowerCase();
    if (contractStatus === "signed") {
      return {
        label: "Desembolso en proceso",
        hint: "Estamos programando el desembolso de tu operacion.",
      };
    }

    return {
      label: "Firmar contrato",
      hint: "Revisa tu correo y firma el contrato enviado.",
    };
  }

  if (normalized === "signed") {
    return {
      label: "Desembolso en proceso",
      hint: "Estamos programando el desembolso de tu operacion.",
    };
  }

  if (normalized === "funded") {
    return {
      label: "Solicitud desembolsada",
      hint: "El proceso finalizo con exito.",
    };
  }

  if (normalized === "cancelled") {
    return {
      label: "Solicitud cancelada",
      hint: "Contactanos si deseas retomarla.",
    };
  }

  return {
    label: "En revision",
    hint: "Nuestro equipo valida tu solicitud. Te avisaremos si necesitamos algo mas.",
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const minAmount = url.searchParams.get("minAmount");
  const maxAmount = url.searchParams.get("maxAmount");
  const withInvoice = url.searchParams.get("withInvoice");
  const sort = url.searchParams.get("sort") || "created_at.desc";
  const limit = Number(url.searchParams.get("limit") ?? "10");
  const page = Number(url.searchParams.get("page") ?? "1");
  const offset = Math.max(0, (page - 1) * limit);

  let query = supabase
    .from("funding_requests")
    .select("id, invoice_id, requested_amount, status, created_at, file_path, created_by", { count: "exact" })
    .eq("company_id", orgId);

  if (status && status !== "all") query = query.eq("status", status);
  if (start) query = query.gte("created_at", start);
  if (end) query = query.lte("created_at", end);
  if (minAmount) query = query.gte("requested_amount", Number(minAmount));
  if (maxAmount) query = query.lte("requested_amount", Number(maxAmount));
  if (withInvoice === "true") query = query.not("invoice_id", "is", null);
  if (withInvoice === "false") query = query.is("invoice_id", null);

  const [field, direction] = (sort || "").split(".") as [string, string];
  query = query.order(field || "created_at", { ascending: (direction || "desc") !== "desc" });

  query = query.range(offset, offset + limit - 1);
  const { data, error, count } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const reqs = (data || []) as FundingRequestRow[];
  const reqIds = reqs.map((row) => row.id);
  const byReq: Record<string, { invoice_ids: string[]; total: number }> = {};

  if (reqIds.length) {
    const fri = await supabase
      .from("funding_request_invoices")
      .select("request_id, invoice_id")
      .in("request_id", reqIds);

    const mapIds: Record<string, string[]> = {};
    const allInvIds: string[] = [];
    for (const row of fri.data || []) {
      (mapIds[row.request_id] ||= []).push(row.invoice_id);
      allInvIds.push(row.invoice_id);
    }

    const amounts: Record<string, number> = {};
    if (allInvIds.length) {
      const inv = await supabase
        .from("invoices")
        .select("id, amount")
        .in("id", allInvIds);
      for (const invoice of inv.data || []) {
        amounts[invoice.id] = Number(invoice.amount || 0);
      }
    }

    Object.entries(mapIds).forEach(([requestId, ids]) => {
      const total = ids.reduce((acc, id) => acc + (amounts[id] || 0), 0);
      byReq[requestId] = { invoice_ids: ids, total };
    });
  }

  let offersByRequest = new Map<string, OfferRow>();
  let contractByRequest = new Map<string, DocumentRow>();

  if (reqIds.length) {
    const [offersRes, docsRes] = await Promise.all([
      supabase
        .from("offers")
        .select("id, request_id, status, annual_rate, advance_pct, net_amount, valid_until, created_at")
        .eq("company_id", orgId)
        .in("request_id", reqIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("documents")
        .select("id, request_id, type, status, provider_envelope_id, created_at")
        .eq("company_id", orgId)
        .in("request_id", reqIds)
        .eq("type", "CONTRATO_MARCO")
        .order("created_at", { ascending: false }),
    ]);

    if (offersRes.error) {
      return NextResponse.json({ ok: false, error: offersRes.error.message }, { status: 500 });
    }
    if (docsRes.error) {
      return NextResponse.json({ ok: false, error: docsRes.error.message }, { status: 500 });
    }

    offersByRequest = new Map<string, OfferRow>();
    for (const raw of offersRes.data || []) {
      const offer = raw as OfferRow;
      if (!offersByRequest.has(offer.request_id)) {
        offersByRequest.set(offer.request_id, offer);
      }
    }

    contractByRequest = new Map<string, DocumentRow>();
    for (const raw of docsRes.data || []) {
      const doc = raw as DocumentRow;
      if (!doc.request_id) continue;
      if (!contractByRequest.has(doc.request_id)) {
        contractByRequest.set(doc.request_id, doc);
      }
    }
  }

  const enriched = reqs.map((row) => {
    const invoicesInfo = byReq[row.id] || { invoice_ids: row.invoice_id ? [row.invoice_id] : [], total: Number(row.requested_amount || 0) };
    const offer = offersByRequest.get(row.id) ?? null;
    const contract = contractByRequest.get(row.id) ?? null;
    const nextStep = computeClientNextStep(row.status, offer, contract);

    return {
      ...row,
      invoice_ids: invoicesInfo.invoice_ids,
      invoices_count: invoicesInfo.invoice_ids.length,
      invoices_total: invoicesInfo.total,
      current_offer: offer
        ? {
            id: offer.id,
            status: offer.status,
            annual_rate: typeof offer.annual_rate === "number" ? offer.annual_rate : null,
            advance_pct: typeof offer.advance_pct === "number" ? offer.advance_pct : null,
            net_amount: typeof offer.net_amount === "number" ? offer.net_amount : null,
            valid_until: offer.valid_until,
          }
        : null,
      contract_status: contract?.status ?? null,
      next_step: nextStep,
    };
  });

  return NextResponse.json({ ok: true, items: enriched, total: count ?? 0 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const invoiceIds = [
    ...(Array.isArray(body?.invoice_ids) ? body.invoice_ids : []),
    ...(typeof body?.invoice_id === "string" ? [body.invoice_id] : []),
  ];
  const requestedAmountRaw = Number(body?.requested_amount ?? 0);
  const status = typeof body?.status === "string" && body.status.trim().length > 0 ? body.status : undefined;
  const filePath = typeof body?.file_path === "string" && body.file_path.trim().length > 0 ? body.file_path : null;

  const result = await createRequestWithInvoices({
    supabase,
    orgId,
    userId: session.user.id,
    invoiceIds,
    requestedAmount: Number.isFinite(requestedAmountRaw) ? requestedAmountRaw : undefined,
    status,
    filePath,
  });

  if (!result.ok) {
    const payload: Record<string, unknown> = { ok: false, error: result.error };
    if (result.details) payload.details = result.details;
    return NextResponse.json(payload, { status: result.status });
  }

  const requestId = (result.request as { id: string }).id;

  try {
    const { notifyStaffNewRequest } = await import("@/lib/notifications");
    await notifyStaffNewRequest(orgId, requestId);
  } catch {}

  try {
    const { logAudit } = await import("@/lib/audit");
    await logAudit({ company_id: orgId, actor_id: session.user.id, entity: "request", entity_id: requestId, action: "created", data: { requested_amount: result.request.requested_amount } });
  } catch {}

  return NextResponse.json({ ok: true, created: result.request, total: result.total, count: result.count }, { status: 201 });
}
