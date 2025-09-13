import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const [invAll, invFunded, reqOpen, offerOpen] = await Promise.all([
      supabase.from('invoices').select('id, amount, created_at, status').eq('company_id', orgId),
      supabase.from('invoices').select('id, amount, created_at, status').eq('company_id', orgId).eq('status', 'funded'),
      supabase.from('funding_requests').select('id, requested_amount, created_at, status').eq('company_id', orgId).in('status', ['review','offered']),
      supabase.from('offers').select('id', { count: 'exact', head: true }).eq('company_id', orgId).eq('status', 'offered'),
    ]);

    const allDates: string[] = [];
    const addDate = (d?: string | null) => { if (!d) return; const key = d.slice(0,10); allDates.push(key); };
    invAll.data?.forEach((r)=>addDate((r as { created_at?: string | null }).created_at || null));
    const lastActivity = allDates.sort().pop() || null;

    // Totales
    const invoicesCount = invAll.data?.length ?? 0;
    const invoicesAmountTotal = (invAll.data || []).reduce((s:number,r)=>s+Number((r as { amount?: number | string | null }).amount||0),0);
    const fundedCount = invFunded.data?.length ?? 0;
    const fundedAmountTotal = (invFunded.data || []).reduce((s:number,r)=>s+Number((r as { amount?: number | string | null }).amount||0),0);
    const requestsOpenCount = reqOpen.data?.length ?? 0;
    const requestsAmountOpen = (reqOpen.data || []).reduce((s:number,r)=>s+Number((r as { requested_amount?: number | string | null }).requested_amount||0),0);

    // Series últimos 30 días
    const start = new Date(Date.now() - 30*24*3600*1000);
    function makeSeries(rows: Array<Record<string, unknown>>, field: 'created_at', valueField?: string){
      const map = new Map<string, number>();
      for (let i=0;i<31;i++){ const d = new Date(start.getTime()+i*24*3600*1000); const k = d.toISOString().slice(0,10); map.set(k,0); }
      rows.forEach((r)=>{
        const rec = r as Record<string, unknown>;
        const created = rec[field] as string;
        const d = new Date(created);
        if (d >= start) {
          const k = d.toISOString().slice(0, 10);
          const raw = valueField ? (rec[valueField] as number | string | null) : 1;
          const val = valueField ? Number(raw || 0) : 1;
          map.set(k, (map.get(k) || 0) + val);
        }
      });
      return Array.from(map.entries()).map(([date,value])=>({date,value}));
    }
    const invoicesDaily = makeSeries(invAll.data||[], 'created_at');
    const fundedDaily = makeSeries(invFunded.data||[], 'created_at');
    const requestsDaily = makeSeries(reqOpen.data||[], 'created_at');

    return NextResponse.json({
      ok: true,
      metrics: {
        invoices: invoicesCount,
        invoicesAmountTotal,
        funded: fundedCount,
        fundedAmountTotal,
        requestsOpen: requestsOpenCount,
        requestsAmountOpen,
        offersOpen: offerOpen.count ?? 0,
        lastActivity,
        series: { invoicesDaily, fundedDaily, requestsDaily },
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
