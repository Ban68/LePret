import { NextResponse } from "next/server";
import { isBackofficeAllowed } from "@/lib/hq-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// Helper to get user session
async function getUserSession() {
  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export async function GET() {
  const session = await getUserSession();
  const isAllowed = session ? await isBackofficeAllowed(session.user?.id, session.user?.email) : false;

  if (!isAllowed) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    // 1. Total requests and total amount
    const { count: totalRequests, error: totalError } = await supabaseAdmin
      .from("funding_requests")
      .select("id", { count: "exact", head: true });

    if (totalError) throw new Error(`Error fetching total requests: ${totalError.message}`);

    // NOTE: This is not the most performant way to get a sum.
    // An RPC function in Supabase would be better.
    const { data: amounts, error: amountError } = await supabaseAdmin
      .from("funding_requests")
      .select("requested_amount");

    if (amountError) throw new Error(`Error fetching amounts: ${amountError.message}`);
    const totalAmount = amounts.reduce((sum, { requested_amount }) => sum + requested_amount, 0);


    // 2. Requests by status
    const { data: statusCounts, error: statusError } = await supabaseAdmin
      .from("funding_requests")
      .select("status");

    if (statusError) throw new Error(`Error fetching status counts: ${statusError.message}`);

    const requestsByStatus = statusCounts.reduce((acc, { status }) => {
      if (status) {
        acc[status] = (acc[status] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);


    // 3. Requests over time (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: monthlyData, error: monthlyError } = await supabaseAdmin
      .from("funding_requests")
      .select("created_at")
      .gte("created_at", sixMonthsAgo.toISOString());

    if (monthlyError) throw new Error(`Error fetching monthly data: ${monthlyError.message}`);

    const requestsByMonth = monthlyData.reduce((acc, { created_at }) => {
      if(!created_at) return acc;
      const month = created_at.slice(0, 7); // YYYY-MM
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);


    const metrics = {
      totalRequests: totalRequests ?? 0,
      totalAmount: totalAmount,
      requestsByStatus,
      requestsByMonth,
    };

    return NextResponse.json(metrics);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado";
    console.error(`[API METRICS ERROR] ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
