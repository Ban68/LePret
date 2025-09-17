import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

const toCsv = (value: unknown) => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

export async function GET(_req: Request, { params }: { params: { orgId: string } }) {
  const { orgId } = params;
  const supabase = createRouteHandlerClient({ cookies: () => cookies() });
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("invoices")
    .select("id, amount, issue_date, due_date, status")
    .eq("company_id", orgId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const header = ["id", "amount", "issue_date", "due_date", "status"].join(",");
  const rows = (data ?? [])
    .map((row) =>
      [row.id, row.amount, row.issue_date, row.due_date, row.status]
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

