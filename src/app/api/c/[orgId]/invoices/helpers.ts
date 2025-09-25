import type { SupabaseClient } from "@supabase/supabase-js";

export async function getUsedInvoiceIds(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Set<string>> {
  const used = new Set<string>();

  const { data: direct } = await supabase
    .from("funding_requests")
    .select("invoice_id, id")
    .eq("company_id", orgId)
    .not("invoice_id", "is", null);

  direct?.forEach((row) => {
    const invoiceId = (row as { invoice_id?: string | null }).invoice_id;
    if (invoiceId) used.add(invoiceId);
  });

  const { data: relations } = await supabase
    .from("funding_request_invoices")
    .select("invoice_id, request_id");

  const requestIds = Array.from(
    new Set(
      (relations || [])
        .map((row) => (row as { request_id?: string | null }).request_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );

  if (requestIds.length > 0) {
    const { data: reqs } = await supabase
      .from("funding_requests")
      .select("id")
      .eq("company_id", orgId)
      .in("id", requestIds);

    const allowed = new Set((reqs || []).map((row) => (row as { id: string }).id));

    (relations || []).forEach((row) => {
      const invoiceId = (row as { invoice_id?: string | null }).invoice_id;
      const requestId = (row as { request_id?: string | null }).request_id;
      if (invoiceId && requestId && allowed.has(requestId)) used.add(invoiceId);
    });
  }
  return used;
}
