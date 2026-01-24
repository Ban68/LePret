import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getUsedInvoiceIds } from "../helpers";

const toCsv = (value: unknown) => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

export async function GET(_req: Request, context: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await context.params;
  const supabase = createRouteHandlerClient({ cookies: () => cookies() });
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("invoices")
    .select("id, amount, issue_date, due_date, status, payer, forecast_payment_date")
    .eq("company_id", orgId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const usedIds = await getUsedInvoiceIds(supabase, orgId);

  const header = ["id", "amount", "issue_date", "due_date", "forecast_payment_date", "payer", "status"].join(",");
  const rows = (data ?? [])
    .filter((row) => !usedIds.has(row.id))
    .map((row) =>
      [row.id, row.amount, row.issue_date, row.due_date, row.forecast_payment_date, row.payer, row.status]
        .map(toCsv)
        .join(","),
    )
    .join("\n");

  const csv = [header, rows].filter(Boolean).join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="invoices_${orgId}.csv"`,
    },
  });
}


