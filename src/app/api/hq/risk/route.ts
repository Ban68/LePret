import { NextResponse } from "next/server";

import { isBackofficeAllowed } from "@/lib/hq-auth";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { getHqSettings } from "@/lib/hq-settings";

export const dynamic = "force-dynamic";

async function getSession() {
  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatAmount(amount: number): number {
  return Math.round(amount);
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const allowed = await isBackofficeAllowed(session.user?.id, session.user?.email);
  if (!allowed) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime());
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const [paymentsRes, payersRes, fundedRequestsRes, hqSettingsResult] = await Promise.all([
      supabaseAdmin
        .from('payments')
        .select('status, amount, direction, due_date, company_id')
        .gte('created_at', ninetyDaysAgo.toISOString()),
      supabaseAdmin.from('payers').select('id, name, risk_rating, credit_limit'),
      supabaseAdmin
        .from('funding_requests')
        .select('id, requested_amount, disbursed_at, created_at, invoice_id, company_id')
        .eq('status', 'funded'),
      getHqSettings(),
    ]);

    if (paymentsRes.error) throw new Error(paymentsRes.error.message);
    if (payersRes.error) throw new Error(payersRes.error.message);
    if (fundedRequestsRes.error) throw new Error(fundedRequestsRes.error.message);

    const settings = hqSettingsResult.settings;

    const inboundPayments = (paymentsRes.data || []).filter((payment) => payment.direction === 'inbound');
    const activeStatuses = new Set(['pending', 'in_collection', 'overdue']);
    const delinquentStatuses = new Set(['overdue', 'in_collection']);

    const outstandingAmount = inboundPayments
      .filter((payment) => activeStatuses.has(String(payment.status)))
      .reduce((sum, payment) => sum + toNumber(payment.amount), 0);
    const delinquentAmount = inboundPayments
      .filter((payment) => delinquentStatuses.has(String(payment.status)))
      .reduce((sum, payment) => sum + toNumber(payment.amount), 0);
    const paymentsInArrears = inboundPayments.filter((payment) => delinquentStatuses.has(String(payment.status))).length;
    const delinquencyRate = outstandingAmount > 0 ? Number(((delinquentAmount / outstandingAmount) * 100).toFixed(2)) : 0;

    const payerProfiles = new Map<string, { risk_rating?: string | null; credit_limit?: number | null }>();
    for (const payer of payersRes.data || []) {
      const key = typeof payer.name === 'string' ? payer.name.trim().toLowerCase() : null;
      if (!key) continue;
      payerProfiles.set(key, {
        risk_rating: payer.risk_rating ?? null,
        credit_limit: payer.credit_limit != null ? Number(payer.credit_limit) : null,
      });
    }

    const fundedRequests = fundedRequestsRes.data || [];
    const requestIds = fundedRequests.map((request) => request.id).filter(Boolean);

    const requestInvoiceLinksRes = requestIds.length
      ? await supabaseAdmin
          .from('funding_request_invoices')
          .select('request_id, invoice_id')
          .in('request_id', requestIds)
      : { data: [] as Array<{ request_id: string; invoice_id: string }>, error: null };

    if (requestInvoiceLinksRes.error) {
      throw new Error(requestInvoiceLinksRes.error.message);
    }

    const invoiceIdSet = new Set<string>();
    for (const request of fundedRequests) {
      if (request.invoice_id) {
        invoiceIdSet.add(request.invoice_id);
      }
    }
    for (const relation of requestInvoiceLinksRes.data || []) {
      if (relation.invoice_id) {
        invoiceIdSet.add(relation.invoice_id);
      }
    }

    const invoicesRes = invoiceIdSet.size
      ? await supabaseAdmin
          .from('invoices')
          .select('id, payer, amount, net_amount, gross_amount, face_value, total, total_amount, financed_amount')
          .in('id', Array.from(invoiceIdSet))
      : { data: [] as Array<Record<string, unknown>>, error: null };

    if (invoicesRes.error) {
      throw new Error(invoicesRes.error.message);
    }

    const requestInvoiceMap = new Map<string, Set<string>>();
    for (const relation of requestInvoiceLinksRes.data || []) {
      if (!relation.request_id || !relation.invoice_id) continue;
      const collection = requestInvoiceMap.get(relation.request_id) ?? new Set<string>();
      collection.add(relation.invoice_id);
      requestInvoiceMap.set(relation.request_id, collection);
    }
    for (const request of fundedRequests) {
      if (!request.id || !request.invoice_id) continue;
      const collection = requestInvoiceMap.get(request.id) ?? new Set<string>();
      collection.add(request.invoice_id);
      requestInvoiceMap.set(request.id, collection);
    }

    const invoiceMap = new Map(
      (invoicesRes.data || []).map((invoice) => {
        const id = typeof invoice.id === 'string' ? invoice.id : '';
        return [id, invoice];
      }),
    );

    const totalsByPayer = new Map<string, number>();
    for (const request of fundedRequests) {
      const associatedInvoiceIds = request.id ? Array.from(requestInvoiceMap.get(request.id) ?? []) : [];
      const associatedInvoices = associatedInvoiceIds
        .map((invoiceId) => invoiceMap.get(invoiceId))
        .filter((invoice): invoice is Record<string, unknown> & { payer?: unknown } => Boolean(invoice));

      if (!associatedInvoices.length) {
        const fallbackAmount = Number(request.requested_amount ?? 0);
        if (fallbackAmount > 0) {
          const key = 'Sin pagador';
          totalsByPayer.set(key, (totalsByPayer.get(key) ?? 0) + fallbackAmount);
        }
        continue;
      }

      const invoiceWithAmounts = associatedInvoices.map((invoice) => ({
        raw: invoice,
        amount: resolveInvoiceAmount(invoice),
      }));
      const totalInvoiceAmount = invoiceWithAmounts.reduce((sum, item) => sum + item.amount, 0);

      if (totalInvoiceAmount > 0) {
        for (const { raw, amount } of invoiceWithAmounts) {
          const key =
            typeof raw.payer === 'string' && raw.payer.trim().length ? raw.payer.trim() : 'Sin pagador';
          totalsByPayer.set(key, (totalsByPayer.get(key) ?? 0) + amount);
        }
      } else {
        const fallbackAmount = Number(request.requested_amount ?? 0);
        if (fallbackAmount > 0) {
          const share = fallbackAmount / invoiceWithAmounts.length;
          for (const { raw } of invoiceWithAmounts) {
            const key =
              typeof raw.payer === 'string' && raw.payer.trim().length ? raw.payer.trim() : 'Sin pagador';
            totalsByPayer.set(key, (totalsByPayer.get(key) ?? 0) + share);
          }
        }
      }
    }

    const totalExposure = Array.from(totalsByPayer.values()).reduce((sum, value) => sum + value, 0);
    const orderedPayers = Array.from(totalsByPayer.entries()).sort((a, b) => b[1] - a[1]);
    const topPayers = orderedPayers.slice(0, 5).map(([name, amount]) => {
      const normalizedKey = name.trim().toLowerCase();
      const profile = payerProfiles.get(normalizedKey);
      const share = totalExposure > 0 ? Number(((amount / totalExposure) * 100).toFixed(2)) : 0;
      return {
        name,
        amount: formatAmount(amount),
        share,
        riskRating: profile?.risk_rating ?? null,
        creditLimit: profile?.credit_limit ?? null,
      };
    });

    const riskRatings = Array.from(totalsByPayer.entries()).reduce<Record<string, number>>((acc, [payerName, exposure]) => {
      if (exposure <= 0) {
        return acc;
      }
      const normalizedKey = payerName.trim().toLowerCase();
      const profile = payerProfiles.get(normalizedKey);
      const rating = typeof profile?.risk_rating === 'string' && profile.risk_rating.trim().length
        ? profile.risk_rating.trim().toLowerCase()
        : 'sin rating';
      acc[rating] = (acc[rating] || 0) + 1;
      return acc;
    }, {});

    const alerts: string[] = [];
    if (delinquencyRate > 10) {
      alerts.push('La tasa de morosidad supera el 10% del portafolio.');
    }
    if (topPayers.length > 0 && topPayers[0].share > 35) {
      alerts.push(`Alta concentración en ${topPayers[0].name} (${topPayers[0].share}% del volumen).`);
    }
    for (const payer of topPayers) {
      if (payer.creditLimit != null && payer.amount > payer.creditLimit) {
        alerts.push(`El pagador ${payer.name} supera su límite de crédito configurado.`);
      }
      if (typeof payer.riskRating === 'string' && payer.riskRating.toLowerCase().includes('alto')) {
        alerts.push(`Exposición relevante a ${payer.name}, clasificado como alto riesgo.`);
      }
    }
    if (outstandingAmount > (settings.creditLimits.default ?? 0) * 10) {
      alerts.push('La cartera activa supera significativamente el límite base configurado.');
    }

    const riskRatingDistribution = Object.entries(riskRatings).map(([rating, count]) => ({ rating, count }));

    return NextResponse.json({
      delinquencyRate,
      delinquentAmount: formatAmount(delinquentAmount),
      outstandingAmount: formatAmount(outstandingAmount),
      paymentsInArrears,
      topPayers,
      riskRatings: riskRatingDistribution,
      alerts,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado";
    console.error('[hq-risk] GET', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function resolveInvoiceAmount(invoice: {
  amount?: unknown;
  net_amount?: unknown;
  gross_amount?: unknown;
  face_value?: unknown;
  total?: unknown;
  total_amount?: unknown;
  financed_amount?: unknown;
}): number {
  const fields = [
    invoice.net_amount,
    invoice.amount,
    invoice.gross_amount,
    invoice.face_value,
    invoice.total,
    invoice.total_amount,
    invoice.financed_amount,
  ];
  for (const field of fields) {
    const numeric = Number(field ?? 0);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
  }
  return 0;
}
