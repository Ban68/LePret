import type { SupabaseClient } from "@supabase/supabase-js";

export async function getUsedInvoiceIds(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Set<string>> {
  const used = new Set<string>();

  // 1. Get all request IDs for this company
  const { data: requestIdsData } = await supabase
    .from("funding_requests")
    .select("id, invoice_id")
    .eq("company_id", orgId);

  const requestIds = (requestIdsData || []).map((r) => r.id);

  // 2. Add direct invoice_ids
  requestIdsData?.forEach((row) => {
    if (row.invoice_id) used.add(row.invoice_id);
  });

  if (requestIds.length > 0) {
    // 3. Get relations only for these requests
    const { data: relations } = await supabase
      .from("funding_request_invoices")
      .select("invoice_id")
      .in("request_id", requestIds);

    relations?.forEach((row) => {
      if (row.invoice_id) used.add(row.invoice_id);
    });
  }


  return used;
}

export function formatIdsForNotIn(ids: string[]): string {
  return `(${ids.map((id) => `"${id}"`).join(",")})`;
}

