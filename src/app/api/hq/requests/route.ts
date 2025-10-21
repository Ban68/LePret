import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { supabaseAdmin } from "@/lib/supabase";
import { isBackofficeAllowed } from "@/lib/hq-auth";
import { getHqSettings, type HqParameterSettings } from "@/lib/hq-settings";

const NEEDS_ACTION_STATUSES = new Set(["review", "offered", "accepted", "signed"]);
const REQUIRED_DOC_TYPES = [
  "KYC_RUT",
  "KYC_CAMARA",
  "KYC_CERT_BANCARIA",
  "CONTRATO_MARCO",
];

type FundingRequestRow = {
  id: string;
  company_id: string;
  requested_amount: number;
  status: string;
  created_at: string;
  file_path?: string | null;
  created_by?: string | null;
  invoice_id?: string | null;
  currency?: string | null;
  archived_at?: string | null;
  default_discount_rate?: number | null;
  default_operation_days?: number | null;
  default_advance_pct?: number | null;
  default_settings_source?: string | null;
};

type DocumentRow = {
  id: string;
  request_id: string | null;
  type: string;
  status: string;
  file_path?: string | null;
  created_at: string;
  company_id?: string | null;
};

type OfferRow = {
  id: string;
  request_id: string;
  status: string;
  annual_rate: number | null;
  advance_pct: number | null;
  net_amount: number | null;
  valid_until: string | null;
  created_at: string;
};

type InvoiceRow = Record<string, unknown> & {
  id: string;
  amount?: number | string | null;
  gross_amount?: number | string | null;
  net_amount?: number | string | null;
};

type ProfileRow = {
  user_id: string;
  full_name?: string | null;
};

type RequestResponseItem = {
  id: string;
  company_id: string;
  company_name: string;
  company_type: string | null;
  status: string;
  requested_amount: number;
  currency: string;
  created_at: string;
  created_by_id: string | null;
  created_by_name: string | null;
  invoices_count: number;
  invoices_total: number;
  payers: Array<{ name: string; identifier: string | null }>;
  needs_action: boolean;
  next_action: string;
  pending_documents: string[];
  documents: Array<{ type: string; status: string; created_at: string }>;
  offer: {
    id: string;
    status: string;
    summary: string;
  } | null;
  archived_at: string | null;
  force_sign_enabled: boolean;
  risk: {
    level: "low" | "medium" | "high";
    score: number;
    reasons: string[];
    exposureRatio: number | null;
    tenorDays: number | null;
  };
  defaults: {
    discountRate: number | null;
    operationDays: number | null;
    advancePct: number | null;
    source: string | null;
  };
};

export async function GET(req: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const isAllowed = await isBackofficeAllowed(session.user?.id, session.user?.email);
  if (!isAllowed) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const allowForceSign = (process.env.PANDADOC_ALLOW_FORCE_SIGN || '').toLowerCase() === 'true' || process.env.NODE_ENV !== 'production';

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status");
  const companyFilter = url.searchParams.get("company");
  const needsActionOnly = url.searchParams.get("needsAction") === "true";
  const includeArchived = url.searchParams.get("includeArchived") === "true";
  const startDate = url.searchParams.get("start");
  const endDate = url.searchParams.get("end");
  const limitParam = Number(url.searchParams.get("limit") ?? "200");
  const offsetParam = Number(url.searchParams.get("offset") ?? "0");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 200;
  const offset = Number.isFinite(offsetParam) && offsetParam > 0 ? offsetParam : 0;

  let query = supabaseAdmin
    .from('funding_requests')
    .select(
      'id, company_id, requested_amount, status, created_at, file_path, created_by, invoice_id, currency, archived_at, default_discount_rate, default_operation_days, default_advance_pct, default_settings_source',
      { count: 'exact' },
    );

  if (!includeArchived) {
    query = query.is('archived_at', null);
  }

  query = query.order('created_at', { ascending: false });
  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  if (companyFilter) {
    query = query.eq('company_id', companyFilter);
  }

  if (needsActionOnly) {
    query = query.in('status', Array.from(NEEDS_ACTION_STATUSES));
  }

  if (startDate) {
    const startIso = toISOStart(startDate);
    if (startIso) {
      query = query.gte('created_at', startIso);
    }
  }

  if (endDate) {
    const endIso = toISOEnd(endDate);
    if (endIso) {
      query = query.lte('created_at', endIso);
    }
  }

  query = query.range(offset, offset + limit - 1);

  const { data: rows, error, count } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const requests: FundingRequestRow[] = rows ?? [];
  if (requests.length === 0) {
    return NextResponse.json({ ok: true, items: [], total: count ?? 0 });
  }

  const requestIds = Array.from(new Set(requests.map((item) => item.id)));
  const companyIds = Array.from(new Set(requests.map((item) => item.company_id).filter(Boolean)));
  const creatorIds = Array.from(new Set(requests.map((item) => item.created_by).filter(Boolean))) as string[];

  const { settings: hqSettings } = await getHqSettings();

  const [
    companiesRes,
    linksRes,
    requestDocumentsRes,
    companyDocumentsRes,
    offersRes,
    profilesRes,
    exposureRes,
  ] = await Promise.all([
    companyIds.length
      ? supabaseAdmin.from('companies').select('id, name, type').in('id', companyIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string; type: string | null }>, error: null }),
    requestIds.length
      ? supabaseAdmin.from('funding_request_invoices').select('request_id, invoice_id').in('request_id', requestIds)
      : Promise.resolve({ data: [] as Array<{ request_id: string; invoice_id: string }>, error: null }),
    requestIds.length
      ? supabaseAdmin
          .from('documents')
          .select('id, request_id, type, status, file_path, created_at, company_id')
          .in('request_id', requestIds)
      : Promise.resolve({ data: [] as DocumentRow[], error: null }),
    companyIds.length
      ? supabaseAdmin
          .from('documents')
          .select('id, request_id, type, status, file_path, created_at, company_id')
          .is('request_id', null)
          .in('company_id', companyIds)
      : Promise.resolve({ data: [] as DocumentRow[], error: null }),
    requestIds.length
      ? supabaseAdmin.from('offers').select('id, request_id, status, annual_rate, advance_pct, net_amount, valid_until, created_at').in('request_id', requestIds)
      : Promise.resolve({ data: [] as OfferRow[], error: null }),
    creatorIds.length
      ? supabaseAdmin.from('profiles').select('user_id, full_name').in('user_id', creatorIds)
      : Promise.resolve({ data: [] as ProfileRow[], error: null }),
    companyIds.length
      ? supabaseAdmin
          .from('funding_requests')
          .select('company_id, requested_amount, status')
          .in('company_id', companyIds)
          .in('status', ['review', 'offered', 'accepted', 'signed', 'funded'])
      : Promise.resolve({ data: [] as Array<{ company_id: string; requested_amount: number; status: string }>, error: null }),
  ]);

  if (companiesRes.error) {
    return NextResponse.json({ ok: false, error: companiesRes.error.message }, { status: 500 });
  }
  if (linksRes.error) {
    return NextResponse.json({ ok: false, error: linksRes.error.message }, { status: 500 });
  }
  if (requestDocumentsRes.error) {
    return NextResponse.json({ ok: false, error: requestDocumentsRes.error.message }, { status: 500 });
  }
  if (companyDocumentsRes.error) {
    return NextResponse.json({ ok: false, error: companyDocumentsRes.error.message }, { status: 500 });
  }
  if (offersRes.error) {
    return NextResponse.json({ ok: false, error: offersRes.error.message }, { status: 500 });
  }
  if (profilesRes.error) {
    return NextResponse.json({ ok: false, error: profilesRes.error.message }, { status: 500 });
  }
  if (exposureRes.error) {
    return NextResponse.json({ ok: false, error: exposureRes.error.message }, { status: 500 });
  }

  const invoiceIds = new Set<string>();
  for (const row of linksRes.data || []) {
    invoiceIds.add(row.invoice_id);
  }
  for (const row of requests) {
    if (row.invoice_id) {
      invoiceIds.add(row.invoice_id);
    }
  }

  const invoicesRes = invoiceIds.size
    ? await supabaseAdmin.from('invoices').select('*').in('id', Array.from(invoiceIds))
    : { data: [] as InvoiceRow[], error: null };

  if (invoicesRes.error) {
    return NextResponse.json({ ok: false, error: invoicesRes.error.message }, { status: 500 });
  }

  const companyMap = new Map((companiesRes.data || []).map((company) => [company.id, company]));
  const profileMap = new Map((profilesRes.data || []).map((profile) => [profile.user_id, profile]));
  const invoicesMap = new Map((invoicesRes.data || []).map((invoice) => [invoice.id, invoice]));

  const linkMap = new Map<string, string[]>();
  for (const relation of linksRes.data || []) {
    const existing = linkMap.get(relation.request_id) || [];
    existing.push(relation.invoice_id);
    linkMap.set(relation.request_id, existing);
  }

  const docsMap = new Map<string, DocumentRow[]>();
  const companyDocsMap = new Map<string, DocumentRow[]>();
  for (const doc of requestDocumentsRes.data || []) {
    if (doc.request_id) {
      const existing = docsMap.get(doc.request_id) || [];
      existing.push(doc);
      docsMap.set(doc.request_id, existing);
    }

    if (doc.company_id) {
      const companyDocs = companyDocsMap.get(doc.company_id) || [];
      companyDocs.push(doc);
      companyDocsMap.set(doc.company_id, companyDocs);
    }
  }

  for (const doc of companyDocumentsRes.data || []) {
    if (doc.company_id) {
      const companyDocs = companyDocsMap.get(doc.company_id) || [];
      companyDocs.push(doc);
      companyDocsMap.set(doc.company_id, companyDocs);
    }
  }

  const offersMap = new Map<string, OfferRow[]>();
  for (const offer of offersRes.data || []) {
    const existing = offersMap.get(offer.request_id) || [];
    existing.push(offer);
    offersMap.set(offer.request_id, existing);
  }

  const exposureMap = new Map<string, number>();
  for (const row of exposureRes.data || []) {
    if (!row?.company_id) continue;
    const amount = Number(row.requested_amount ?? 0);
    if (!Number.isFinite(amount)) continue;
    exposureMap.set(row.company_id, (exposureMap.get(row.company_id) ?? 0) + amount);
  }

  const items: RequestResponseItem[] = requests.map((request) => {
    const company = companyMap.get(request.company_id);
    const invoiceIdsForRequest = new Set<string>();
    if (request.invoice_id) {
      invoiceIdsForRequest.add(request.invoice_id);
    }
    const related = linkMap.get(request.id) || [];
    for (const invoiceId of related) {
      invoiceIdsForRequest.add(invoiceId);
    }

    const invoices = Array.from(invoiceIdsForRequest)
      .map((id) => invoicesMap.get(id))
      .filter((invoice): invoice is InvoiceRow => Boolean(invoice));

    const invoicesTotal = invoices.reduce((acc, invoice) => acc + resolveInvoiceAmount(invoice), 0);
    const payers = resolvePayers(invoices);
    const requestDocs = docsMap.get(request.id) || [];
    const companyDocs = request.company_id ? companyDocsMap.get(request.company_id) || [] : [];
    const combinedDocs = dedupeDocuments([...requestDocs, ...companyDocs.filter((doc) => doc.type.startsWith('KYC_'))]);
    const documents = combinedDocs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const offers = (offersMap.get(request.id) || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const activeOffer = offers.length ? offers[0] : null;
    const docSummary = summariseDocuments(requestDocs, companyDocs);
    const nextStep = computeNextAction(request.status, docSummary, activeOffer?.status ?? null);
    const creator = request.created_by ? profileMap.get(request.created_by) : null;
    const companyExposure = exposureMap.get(request.company_id) ?? Number(request.requested_amount ?? 0);
    const risk = assessRisk({
      request,
      companyType: company?.type ?? null,
      invoices,
      payers,
      docSummary,
      settings: hqSettings,
      exposure: companyExposure,
      invoicesTotal,
    });

    return {
      id: request.id,
      company_id: request.company_id,
      company_name: company?.name ?? 'Sin asignar',
      company_type: company?.type ?? null,
      status: request.status,
      requested_amount: Number(request.requested_amount ?? 0),
      currency: (request.currency || 'COP').toUpperCase(),
      created_at: request.created_at,
      created_by_id: request.created_by ?? null,
      created_by_name: creator?.full_name ?? null,
      invoices_count: invoices.length,
      invoices_total: invoicesTotal,
      payers,
      needs_action: nextStep.needsAction && !request.archived_at,
      next_action: nextStep.label,
      pending_documents: nextStep.pendingDocuments,
      documents: documents.map((doc) => ({ type: doc.type, status: doc.status, created_at: doc.created_at })),
      archived_at: request.archived_at ?? null,
      force_sign_enabled: allowForceSign,
      risk,
      defaults: {
        discountRate: normalizeNumber(request.default_discount_rate, 2),
        operationDays: normalizeInteger(request.default_operation_days),
        advancePct: normalizeNumber(request.default_advance_pct, 2),
        source: typeof request.default_settings_source === 'string' ? request.default_settings_source : null,
      },
      offer: activeOffer
        ? {
            id: activeOffer.id,
            status: activeOffer.status,
            summary: formatOffer(activeOffer),
          }
        : null,
    };
  });

  return NextResponse.json({ ok: true, items, total: count ?? items.length });
}

function resolveInvoiceAmount(invoice: InvoiceRow): number {
  const fields = [invoice.amount, invoice.net_amount, invoice.gross_amount];
  for (const value of fields) {
    const numeric = Number(value ?? 0);
    if (!Number.isNaN(numeric) && numeric > 0) {
      return numeric;
    }
  }
  return 0;
}

function resolvePayers(invoices: InvoiceRow[]): Array<{ name: string; identifier: string | null }> {
  const names = new Map<string, string | null>();
  for (const invoice of invoices) {
    const metadata = (invoice as { metadata?: Record<string, unknown> }).metadata;
    let metaName: string | null = null;
    let metaIdentifier: string | null = null;
    if (metadata && typeof metadata === 'object') {
      const extracted = extractFromMetadata(metadata as Record<string, unknown>);
      metaName = extracted?.name ?? null;
      metaIdentifier = extracted?.identifier ?? null;
    }

    const name =
      (invoice as { payer_name?: string | null }).payer_name ??
      (invoice as { payer?: string | null }).payer ??
      (invoice as { debtor_name?: string | null }).debtor_name ??
      (invoice as { counterparty_name?: string | null }).counterparty_name ??
      metaName ??
      null;

    const identifier =
      (invoice as { payer_tax_id?: string | null }).payer_tax_id ??
      (invoice as { debtor_tax_id?: string | null }).debtor_tax_id ??
      metaIdentifier ??
      null;

    const key = (name || 'Sin pagador').trim() || 'Sin pagador';
    if (!names.has(key)) {
      names.set(key, identifier ?? null);
    }
  }

  if (!names.size) {
    return [{ name: 'Sin pagador', identifier: null }];
  }

  return Array.from(names.entries()).map(([name, identifier]) => ({ name, identifier }));
}

function extractFromMetadata(metadata: Record<string, unknown>): { name: string; identifier: string | null } | null {
  const fromNested = (metadata?.payer as Record<string, unknown>) || (metadata?.debtor as Record<string, unknown>);
  if (fromNested && typeof fromNested === 'object') {
    const maybeName = typeof fromNested.name === 'string' ? fromNested.name : null;
    const maybeId = typeof fromNested.identifier === 'string' ? fromNested.identifier : null;
    if (maybeName) {
      return { name: maybeName, identifier: maybeId ?? null };
    }
  }

  return null;
}

function dedupeDocuments(documents: DocumentRow[]) {
  const seen = new Set<string>();
  return documents.filter((doc) => {
    if (seen.has(doc.id)) {
      return false;
    }
    seen.add(doc.id);
    return true;
  });
}

function summariseDocuments(requestDocs: DocumentRow[], companyDocs: DocumentRow[]) {
  const latestByType = new Map<string, DocumentRow>();
  const maybeUpdate = (doc: DocumentRow) => {
    const existing = latestByType.get(doc.type);
    if (!existing || new Date(existing.created_at).getTime() < new Date(doc.created_at).getTime()) {
      latestByType.set(doc.type, doc);
    }
  };

  for (const doc of companyDocs) {
    if (doc.type.startsWith('KYC_')) {
      maybeUpdate(doc);
    }
  }

  for (const doc of requestDocs) {
    maybeUpdate(doc);
  }

  const missing = REQUIRED_DOC_TYPES.filter((type) => !latestByType.has(type))
    .filter((type) => !type.startsWith('KYC_'));
  const unsigned = Array.from(latestByType.values())
    .filter((doc) => !doc.type.startsWith('KYC_'))
    .filter((doc) => doc.status !== 'signed')
    .map((doc) => doc.type);

  return { latestByType, missing, unsigned };
}

function resolveSegmentKey(companyType: string | null | undefined): string {
  if (!companyType) return 'default';
  const normalized = companyType.toLowerCase();
  if (normalized.includes('corp')) return 'corporativo';
  if (normalized.includes('start')) return 'startup';
  if (normalized.includes('pyme') || normalized.includes('sme')) return 'pyme';
  return 'default';
}

function assessRisk(input: {
  request: FundingRequestRow;
  companyType: string | null;
  invoices: InvoiceRow[];
  payers: Array<{ name: string; identifier: string | null }>;
  docSummary: ReturnType<typeof summariseDocuments>;
  settings: HqParameterSettings;
  exposure: number;
  invoicesTotal: number;
}): { level: 'low' | 'medium' | 'high'; score: number; reasons: string[]; exposureRatio: number | null; tenorDays: number | null } {
  const reasons: string[] = [];
  let score = 0;
  const segment = resolveSegmentKey(input.companyType);
  const limit = input.settings.creditLimits[segment] ?? input.settings.creditLimits.default ?? 0;
  const tenorLimit = input.settings.terms[segment] ?? input.settings.terms.default ?? 90;

  const exposureRatio = limit > 0 ? input.exposure / limit : null;
  if (exposureRatio !== null) {
    if (exposureRatio >= 1.05) {
      score += 45;
      reasons.push('Supera el límite de crédito configurado');
    } else if (exposureRatio >= 0.8) {
      score += 25;
      reasons.push('Cercano al límite de crédito');
    }
  }

  const now = Date.now();
  const tenorDays = input.invoices
    .map((invoice) => {
      const due = (invoice as { due_date?: string | null }).due_date;
      if (!due) return null;
      const dueAt = new Date(due).getTime();
      if (Number.isNaN(dueAt)) return null;
      const diffDays = Math.round((dueAt - now) / (1000 * 60 * 60 * 24));
      return diffDays;
    })
    .filter((value): value is number => Number.isFinite(value));
  const maxTenor = tenorDays.length ? Math.max(...tenorDays) : null;

  if (maxTenor !== null) {
    if (maxTenor > tenorLimit + 15) {
      score += 25;
      reasons.push('Plazo excede el máximo permitido');
    } else if (maxTenor > tenorLimit) {
      score += 15;
      reasons.push('Plazo superior al objetivo');
    }
  }

  if (input.docSummary.missing.length > 0) {
    score += 15;
    reasons.push('Documentación obligatoria pendiente');
  }

  if (input.docSummary.unsigned.length > 0) {
    score += 10;
    reasons.push('Documentos sin firma');
  }

  if (input.payers.length <= 1) {
    score += 10;
    reasons.push('Dependencia de un único pagador');
  }

  const requested = Number(input.request.requested_amount ?? 0);
  if (input.invoicesTotal > requested * 1.8 && requested > 0) {
    score += 8;
    reasons.push('Monto de facturas muy superior al solicitado');
  }

  const level = exposureRatio !== null && exposureRatio >= 1
    ? 'high'
    : score >= 60
      ? 'high'
      : score >= 30
        ? 'medium'
        : 'low';

  return {
    level,
    score,
    reasons,
    exposureRatio: exposureRatio !== null ? Number(exposureRatio.toFixed(2)) : null,
    tenorDays: maxTenor,
  };
}

function computeNextAction(status: string | null | undefined, summary: { missing: string[]; unsigned: string[] }, offerStatus: string | null) {
  const normalized = (status || '').toLowerCase();
  const hasMissingDocs = summary.missing.length > 0;
  const hasUnsignedDocs = summary.unsigned.length > 0;
  const hasOffer = typeof offerStatus === 'string' && offerStatus.length > 0;

  if (!normalized) {
    return {
      label: 'Actualizar estado',
      needsAction: true,
      pendingDocuments: summary.missing,
    };
  }

  if (normalized === 'review') {
    if (hasMissingDocs) {
      return {
        label: 'Solicitar documentacion pendiente',
        needsAction: true,
        pendingDocuments: summary.missing,
      };
    }
    return {
      label: hasOffer ? 'Dar seguimiento a la oferta' : 'Generar oferta para el cliente',
      needsAction: true,
      pendingDocuments: summary.missing,
    };
  }

  if (normalized === 'offered') {
    const waitingAcceptance = offerStatus !== 'accepted';
    return {
      label: waitingAcceptance ? 'Dar seguimiento a la aceptacion del cliente' : 'Preparar contrato y anexos',
      needsAction: waitingAcceptance,
      pendingDocuments: summary.missing,
    };
  }

  if (normalized === 'accepted') {
    if (hasMissingDocs) {
      return {
        label: 'Solicitar documentacion KYC pendiente',
        needsAction: true,
        pendingDocuments: [...summary.missing, ...summary.unsigned],
      };
    }

    if (hasUnsignedDocs) {
      return {
        label: 'Gestionar firma del contrato',
        needsAction: true,
        pendingDocuments: [...summary.missing, ...summary.unsigned],
      };
    }

    return {
      label: 'Generar contrato y enviarlo a firma',
      needsAction: true,
      pendingDocuments: [...summary.missing, ...summary.unsigned],
    };
  }

  if (normalized === 'signed') {
    return {
      label: 'Programar y registrar desembolso',
      needsAction: true,
      pendingDocuments: [...summary.missing, ...summary.unsigned],
    };
  }

  if (normalized === 'funded') {
    return {
      label: hasMissingDocs || hasUnsignedDocs ? 'Regularizar documentacion pendiente' : 'En seguimiento',
      needsAction: hasMissingDocs || hasUnsignedDocs,
      pendingDocuments: [...summary.missing, ...summary.unsigned],
    };
  }

  if (normalized === 'cancelled') {
    return {
      label: 'Cancelada',
      needsAction: false,
      pendingDocuments: [],
    };
  }

  return {
    label: 'Actualizar estado',
    needsAction: true,
    pendingDocuments: [...summary.missing, ...summary.unsigned],
  };
}
function normalizeNumber(value: unknown, precision: number): number | null {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const factor = Math.pow(10, Math.max(0, Math.min(precision, 6)));
  return Math.round(numeric * factor) / factor;
}

function normalizeInteger(value: unknown): number | null {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const int = Math.round(numeric);
  return int >= 0 ? int : null;
}

function formatOffer(offer: OfferRow): string {
  const parts: string[] = [];
  if (typeof offer.annual_rate === 'number') {
    parts.push(`Tasa ${Number(offer.annual_rate * 100).toFixed(2)}% EA`);
  }
  if (typeof offer.advance_pct === 'number') {
    parts.push(`Aforo ${Number(offer.advance_pct).toFixed(0)}%`);
  }
  if (typeof offer.net_amount === 'number') {
    parts.push(`Neto $${Intl.NumberFormat('es-CO').format(Number(offer.net_amount))}`);
  }
  return parts.join(' | ');
}

function toISOStart(value: string): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toISOEnd(value: string): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

