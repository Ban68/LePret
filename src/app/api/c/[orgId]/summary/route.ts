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

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const [invAll, invFunded, requestsActive, offerOpen] = await Promise.all([
      supabase.from('invoices').select('id, amount, created_at, status').eq('company_id', orgId),
      supabase.from('invoices').select('id, amount, created_at, status').eq('company_id', orgId).eq('status', 'funded'),
      supabase
        .from('funding_requests')
        .select('id, requested_amount, created_at, status, archived_at')
        .eq('company_id', orgId)
        .is('archived_at', null)
        .in('status', ['review', 'offered', 'accepted', 'signed']),
      supabase.from('offers').select('id', { count: 'exact', head: true }).eq('company_id', orgId).eq('status', 'offered'),
    ]);

    const allDates: string[] = [];
    const addDate = (d?: string | null) => {
      if (!d) return;
      const key = d.slice(0, 10);
      allDates.push(key);
    };
    invAll.data?.forEach((r) => addDate((r as { created_at?: string | null }).created_at || null));
    const lastActivity = allDates.sort().pop() || null;

    const requestsRows = (requestsActive.data || []) as Array<{ id: string; status?: string | null; requested_amount?: number | string | null; created_at?: string | null }>;

    const invoicesCount = invAll.data?.length ?? 0;
    const invoicesAmountTotal = (invAll.data || []).reduce((sum: number, row) => sum + Number((row as { amount?: number | string | null }).amount || 0), 0);
    const fundedCount = invFunded.data?.length ?? 0;
    const fundedAmountTotal = (invFunded.data || []).reduce((sum: number, row) => sum + Number((row as { amount?: number | string | null }).amount || 0), 0);
    const requestsOpenCount = requestsRows.filter((row) => {
      const status = (row.status || '').toLowerCase();
      return status === 'review' || status === 'offered';
    }).length;
    const requestsAmountOpen = requestsRows.reduce((sum: number, row) => {
      const status = (row.status || '').toLowerCase();
      if (status !== 'review' && status !== 'offered') return sum;
      return sum + Number(row.requested_amount || 0);
    }, 0);

    const start = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    function makeSeries(rows: Array<Record<string, unknown>>, field: 'created_at', valueField?: string) {
      const map = new Map<string, number>();
      for (let i = 0; i < 31; i++) {
        const d = new Date(start.getTime() + i * 24 * 3600 * 1000);
        const k = d.toISOString().slice(0, 10);
        map.set(k, 0);
      }
      rows.forEach((record) => {
        const created = record[field] as string | null | undefined;
        if (!created) return;
        const date = new Date(created);
        if (date >= start) {
          const key = date.toISOString().slice(0, 10);
          const raw = valueField ? (record[valueField] as number | string | null) : 1;
          const val = valueField ? Number(raw || 0) : 1;
          map.set(key, (map.get(key) || 0) + val);
        }
      });
      return Array.from(map.entries()).map(([date, value]) => ({ date, value }));
    }

    const nextSteps = requestsRows
      .map((row) => {
        const status = (row.status || '').toLowerCase();
        const base = {
          id: row.id,
          status,
          created_at: row.created_at || null,
          requested_amount: Number(row.requested_amount || 0),
        };
        switch (status) {
          case 'review':
            return { ...base, title: 'Estamos revisando tu solicitud', hint: 'Estamos validando tus documentos y te avisaremos cuando tengamos una oferta.' };
          case 'offered':
            return { ...base, title: 'Revisar y responder la oferta', hint: 'Ingresa a la solicitud para aceptar la oferta o pedir ajustes.' };
          case 'accepted':
            return { ...base, title: 'Completar documentacion y firmas', hint: 'Sube los documentos faltantes y revisa el contrato para continuar.' };
          case 'signed':
            return { ...base, title: 'Esperar desembolso', hint: 'Estamos programando el desembolso y te notificaremos al completarlo.' };
          case 'cancelled':
            return { ...base, title: 'Solicitud denegada', hint: 'Te contactaremos si necesitamos informacion adicional o si podemos reevaluar mas adelante.' };
          default:
            return { ...base, title: 'Seguimiento en curso', hint: 'Seguimos acompanando tu operacion.' };
        }
      })
      .sort((a, b) => new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime())
      .slice(0, 4);

    const invoicesDaily = makeSeries(invAll.data || [], 'created_at');
    const fundedDaily = makeSeries(invFunded.data || [], 'created_at');
    const requestsDaily = makeSeries(requestsRows as unknown as Array<Record<string, unknown>>, 'created_at');

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
        nextSteps,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}