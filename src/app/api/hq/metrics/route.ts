import { NextResponse } from "next/server";

import { isBackofficeAllowed } from "@/lib/hq-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

async function getUserSession() {
  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

type StageDurations = Record<string, { averageHours: number; samples: number }>;

type FeedbackMetrics = {
  nps: { average: number | null; responses: number };
  csat: { average: number | null; responses: number };
};

function computeStageDurations(logs: Array<{ entity_id: string; data: Record<string, unknown> | null; inserted_at: string }>): StageDurations {
  const stageOrder = ["review", "offered", "accepted", "signed", "funded"];
  const byRequest = new Map<string, Array<{ to: string; at: number }>>();

  for (const log of logs) {
    if (!log.entity_id || !log.inserted_at) continue;
    const to = typeof log.data?.to_status === "string" ? log.data.to_status.toLowerCase() : null;
    if (!to) continue;
    const collection = byRequest.get(log.entity_id) ?? [];
    collection.push({ to, at: new Date(log.inserted_at).getTime() });
    byRequest.set(log.entity_id, collection);
  }

  const accumulator: Record<string, { totalMs: number; samples: number }> = {};

  for (const [, events] of byRequest) {
    const ordered = events.sort((a, b) => a.at - b.at);
    for (let i = 1; i < ordered.length; i++) {
      const fromStage = ordered[i - 1].to;
      const toStage = ordered[i].to;
      const fromIndex = stageOrder.indexOf(fromStage);
      const toIndex = stageOrder.indexOf(toStage);
      if (fromIndex === -1 || toIndex === -1 || toIndex <= fromIndex) continue;
      const key = `${fromStage}->${toStage}`;
      const bucket = accumulator[key] ?? { totalMs: 0, samples: 0 };
      bucket.totalMs += ordered[i].at - ordered[i - 1].at;
      bucket.samples += 1;
      accumulator[key] = bucket;
    }
  }

  const result: StageDurations = {};
  for (const [key, value] of Object.entries(accumulator)) {
    const averageHours = value.samples > 0 ? value.totalMs / value.samples / (1000 * 60 * 60) : 0;
    result[key] = { averageHours: Number(averageHours.toFixed(2)), samples: value.samples };
  }
  return result;
}

function computeFeedbackMetrics(rows: Array<{ data: Record<string, unknown> | null }>): FeedbackMetrics {
  const base = {
    nps: { total: 0, count: 0 },
    csat: { total: 0, count: 0 },
  };

  for (const row of rows) {
    const kind = typeof row.data?.kind === "string" ? row.data.kind.toUpperCase() : null;
    const score = Number(row.data?.score);
    if (!kind || !Number.isFinite(score)) continue;
    if (kind === "NPS") {
      base.nps.total += score;
      base.nps.count += 1;
    } else if (kind === "CSAT") {
      base.csat.total += score;
      base.csat.count += 1;
    }
  }

  return {
    nps: {
      average: base.nps.count > 0 ? Number((base.nps.total / base.nps.count).toFixed(2)) : null,
      responses: base.nps.count,
    },
    csat: {
      average: base.csat.count > 0 ? Number((base.csat.total / base.csat.count).toFixed(2)) : null,
      responses: base.csat.count,
    },
  };
}

export async function GET() {
  const session = await getUserSession();
  const isAllowed = session ? await isBackofficeAllowed(session.user?.id, session.user?.email) : false;

  if (!isAllowed) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime());
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const thirtyDaysAgo = new Date(now.getTime());
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalRes,
      amountsRes,
      statusRes,
      monthlyRes,
      statusLogsRes,
      validationRes,
      feedbackRes,
      fundedRes,
      offersRes,
    ] = await Promise.all([
      supabaseAdmin.from('funding_requests').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('funding_requests').select('requested_amount'),
      supabaseAdmin.from('funding_requests').select('status'),
      supabaseAdmin
        .from('funding_requests')
        .select('created_at, status')
        .gte('created_at', sixMonthsAgo.toISOString()),
      supabaseAdmin
        .from('audit_logs')
        .select('entity_id, data, inserted_at')
        .eq('entity', 'request')
        .eq('action', 'status_changed')
        .gte('inserted_at', sixMonthsAgo.toISOString()),
      supabaseAdmin
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .eq('action', 'validation_failed')
        .gte('inserted_at', thirtyDaysAgo.toISOString()),
      supabaseAdmin
        .from('audit_logs')
        .select('data')
        .eq('action', 'feedback_submitted')
        .gte('inserted_at', sixMonthsAgo.toISOString()),
      supabaseAdmin
        .from('funding_requests')
        .select('requested_amount, disbursed_at, created_at')
        .eq('status', 'funded'),
      supabaseAdmin
        .from('offers')
        .select('annual_rate, advance_pct, status')
        .gte('created_at', sixMonthsAgo.toISOString()),
    ]);

    if (totalRes.error) throw new Error(`Error fetching total requests: ${totalRes.error.message}`);
    if (amountsRes.error) throw new Error(`Error fetching amounts: ${amountsRes.error.message}`);
    if (statusRes.error) throw new Error(`Error fetching status counts: ${statusRes.error.message}`);
    if (monthlyRes.error) throw new Error(`Error fetching monthly data: ${monthlyRes.error.message}`);
    if (statusLogsRes.error) throw new Error(`Error fetching status logs: ${statusLogsRes.error.message}`);
    if (validationRes.error) throw new Error(`Error fetching validation counts: ${validationRes.error.message}`);
    if (feedbackRes.error) throw new Error(`Error fetching feedback: ${feedbackRes.error.message}`);
    if (fundedRes.error) throw new Error(`Error fetching funded requests: ${fundedRes.error.message}`);
    if (offersRes.error) throw new Error(`Error fetching offers: ${offersRes.error.message}`);

    const totalRequests = totalRes.count ?? 0;
    const totalAmount = (amountsRes.data || []).reduce((sum, { requested_amount }) => sum + requested_amount, 0);

    const requestsByStatus = (statusRes.data || []).reduce<Record<string, number>>((acc, { status }) => {
      if (status) acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const requestsByMonth = (monthlyRes.data || []).reduce<Record<string, number>>((acc, { created_at }) => {
      if (!created_at) return acc;
      const month = created_at.slice(0, 7);
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {});

    const approvalsNumerator = (statusRes.data || []).filter(({ status }) => status === 'accepted' || status === 'funded').length;
    const approvalsDenominator = (statusRes.data || []).filter(({ status }) => status === 'review' || status === 'offered' || status === 'accepted' || status === 'funded').length || 1;
    const approvalRate = Number(((approvalsNumerator / approvalsDenominator) * 100).toFixed(2));

    const stageDurations = computeStageDurations(statusLogsRes.data || []);
    const validationErrors30d = validationRes.count ?? 0;
    const feedback = computeFeedbackMetrics(feedbackRes.data || []);

    const fundedRows = fundedRes.data || [];
    const fundedAmount = fundedRows.reduce((sum, row) => sum + Number(row.requested_amount ?? 0), 0);
    const fundedRequests = fundedRows.length;
    const disbursementDurations = fundedRows
      .map((row) => {
        if (!row.disbursed_at || !row.created_at) return null;
        const disbursedAt = new Date(row.disbursed_at).getTime();
        const createdAt = new Date(row.created_at).getTime();
        if (Number.isNaN(disbursedAt) || Number.isNaN(createdAt) || disbursedAt <= createdAt) return null;
        const diffHours = (disbursedAt - createdAt) / (1000 * 60 * 60);
        return diffHours;
      })
      .filter((value): value is number => Number.isFinite(value));
    const averageDisbursementHours = disbursementDurations.length
      ? Number((disbursementDurations.reduce((sum, hours) => sum + hours, 0) / disbursementDurations.length).toFixed(2))
      : null;

    const monthlyFundingVolumes = fundedRows.reduce<Record<string, number>>((acc, row) => {
      if (!row.disbursed_at) return acc;
      const month = row.disbursed_at.slice(0, 7);
      const amount = Number(row.requested_amount ?? 0);
      acc[month] = (acc[month] || 0) + amount;
      return acc;
    }, {});

    const offers = offersRes.data || [];
    const acceptedOffers = offers.filter((offer) => offer.status === 'accepted');
    const averageYield = acceptedOffers.length
      ? Number(
          (
            acceptedOffers.reduce((sum, offer) => sum + Number(offer.annual_rate ?? 0), 0) /
            acceptedOffers.length
          ).toFixed(4)
        ) * 100
      : null;
    const averageAdvancePct = acceptedOffers.length
      ? Number(
          (
            acceptedOffers.reduce((sum, offer) => sum + Number(offer.advance_pct ?? 0), 0) /
            acceptedOffers.length
          ).toFixed(2)
        )
      : null;

    const averageApprovalHours = stageDurations['review->accepted']?.averageHours ?? null;

    return NextResponse.json({
      totalRequests,
      totalAmount,
      requestsByStatus,
      requestsByMonth,
      approvalRate,
      stageDurations,
      validationErrors30d,
      feedback,
      fundedAmount,
      fundedRequests,
      averageDisbursementHours,
      averageApprovalHours,
      averageYieldPct: averageYield,
      averageAdvancePct,
      monthlyFundingVolumes,
      webVitals: {
        provider: "vercel",
        analyticsEnabled: Boolean(process.env.NEXT_PUBLIC_VERCEL_ANALYTICS_ID || process.env.VERCEL_URL),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado";
    console.error(`[API METRICS ERROR] ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
