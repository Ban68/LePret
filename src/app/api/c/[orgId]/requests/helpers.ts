import type { SupabaseClient } from "@supabase/supabase-js";

import { getUsedInvoiceIds } from "../invoices/helpers";

type CreateRequestParams = {
  supabase: SupabaseClient;
  orgId: string;
  userId: string;
  invoiceIds: string[];
  requestedAmount?: number | null;
  status?: string | null;
  filePath?: string | null;
};

type CreateRequestSuccess = {
  ok: true;
  request: Record<string, unknown>;
  total: number;
  count: number;
};

type CreateRequestFailure = {
  ok: false;
  status: number;
  error: string;
  details?: Record<string, unknown>;
};

type CreateRequestResult = CreateRequestSuccess | CreateRequestFailure;

export async function createRequestWithInvoices(params: CreateRequestParams): Promise<CreateRequestResult> {
  const { supabase, orgId, userId, invoiceIds, requestedAmount, status, filePath } = params;

  const dedupedIds = Array.from(
    new Set(
      (invoiceIds || []).filter((id): id is string => typeof id === "string" && id.trim().length > 0),
    ),
  );

  if (dedupedIds.length === 0) {
    return { ok: false, status: 400, error: "missing_invoice_ids" };
  }

  const { data: invoices, error: invErr } = await supabase
    .from("invoices")
    .select("id, amount, company_id")
    .in("id", dedupedIds)
    .eq("company_id", orgId);
  if (invErr) {
    return { ok: false, status: 500, error: invErr.message };
  }
  if (!invoices || invoices.length === 0) {
    return { ok: false, status: 404, error: "no_invoices_found" };
  }

  const foundIds = new Set((invoices as Array<{ id: string }>).map((row) => row.id));
  const missing = dedupedIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    return {
      ok: false,
      status: 404,
      error: "no_invoices_found",
      details: { missing_invoice_ids: missing },
    };
  }

  const usedIds = await getUsedInvoiceIds(supabase, orgId);
  const alreadyUsed = dedupedIds.filter((id) => usedIds.has(id));
  if (alreadyUsed.length > 0) {
    return {
      ok: false,
      status: 409,
      error: "invoice_already_used",
      details: { invoice_ids: alreadyUsed },
    };
  }

  const total = invoices.reduce((acc, it) => {
    const amount = Number((it as { amount?: number | string | null }).amount || 0);
    return acc + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  if (total <= 0) {
    return { ok: false, status: 400, error: "invalid_total" };
  }

  const normalizedRequested = requestedAmount && requestedAmount > 0 ? requestedAmount : total;

  const payload = {
    company_id: orgId,
    created_by: userId,
    requested_amount: normalizedRequested,
    status: status ?? "review",
    file_path: filePath ?? null,
  };

  const { data: requestRow, error: requestErr } = await supabase
    .from("funding_requests")
    .insert(payload)
    .select()
    .single();

  if (requestErr || !requestRow) {
    return { ok: false, status: 400, error: requestErr?.message ?? "request_creation_failed" };
  }

  const rows = dedupedIds.map((invoiceId) => ({ request_id: (requestRow as { id: string }).id, invoice_id: invoiceId }));
  const { error: linkErr } = await supabase.from("funding_request_invoices").insert(rows);

  if (linkErr) {
    await supabase.from("funding_requests").delete().eq("id", (requestRow as { id: string }).id);

    const duplicate = linkErr.code === "23505" || /duplicate key/i.test(linkErr.message || "");
    if (duplicate) {
      return {
        ok: false,
        status: 409,
        error: "invoice_already_used",
        details: { invoice_ids: dedupedIds },
      };
    }

    return { ok: false, status: 400, error: linkErr.message };
  }

  return {
    ok: true,
    request: requestRow as Record<string, unknown>,
    total,
    count: dedupedIds.length,
  };
}
