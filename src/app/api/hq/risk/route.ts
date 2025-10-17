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

    const fundedInvoiceStatuses = ['funded'];

    const [paymentsRes, payersRes, invoicesRes, hqSettingsResult] = await Promise.all([
      supabaseAdmin
        .from('payments')
        .select('status, amount, direction, due_date, company_id')
        .gte('created_at', ninetyDaysAgo.toISOString()),
      supabaseAdmin.from('payers').select('id, name, risk_rating, credit_limit'),
      supabaseAdmin
        .from('invoices')
        .select('payer, amount, status')
        .gte('created_at', ninetyDaysAgo.toISOString())
        .in('status', fundedInvoiceStatuses),
      getHqSettings(),
    ]);

    if (paymentsRes.error) throw new Error(paymentsRes.error.message);
    if (payersRes.error) throw new Error(payersRes.error.message);
    if (invoicesRes.error) throw new Error(invoicesRes.error.message);

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

    const fundedInvoices = (invoicesRes.data || []).filter((invoice) => {
      const status = typeof invoice.status === 'string' ? invoice.status.toLowerCase() : '';
      return fundedInvoiceStatuses.includes(status);
    });

    const totalsByPayer = new Map<string, number>();
    for (const invoice of fundedInvoices) {
      const key = typeof invoice.payer === 'string' && invoice.payer.trim().length ? invoice.payer.trim() : 'Sin pagador';
      const amount = resolveInvoiceAmount(invoice);
      totalsByPayer.set(key, (totalsByPayer.get(key) ?? 0) + amount);
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

    const riskRatings = Array.from(totalsByPayer.keys()).reduce<Record<string, number>>((acc, payerName) => {
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
