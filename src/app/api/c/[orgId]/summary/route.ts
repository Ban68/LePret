import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const runtime = "nodejs";

type FundingRequestRow = {
  id: string;
  status: string | null;
  requested_amount: number | null;
  created_at: string | null;
  invoice_id: string | null;
  archived_at: string | null;
};

type InvoiceRow = {
  id: string;
  amount: number | null;
  status: string | null;
  created_at: string | null;
};

type TimelineRow = {
  id: string;
  request_id: string;
  event_type: string | null;
  title: string | null;
  description: string | null;
  occurred_at: string | null;
  status: string | null;
};

const FINAL_REQUEST_STATUSES = new Set(["funded", "cancelled", "rejected", "declined", "denied", "archived"]);

const REQUEST_STAGE_ORDER: Record<string, number> = {
  review: 1,
  offered: 2,
  accepted: 3,
  signed: 4,
  funded: 5,
};

type NextAction = {
  requestId: string;
  status: string | null;
  stage: number;
  label: string;
  description: string | null;
};

type Notification = { type: string; message: string };

type TrendPoint = { label: string; requested: number; funded: number };

function computeNextAction(row: FundingRequestRow): NextAction {
  const status = (row.status || "").toLowerCase();
  const stage = REQUEST_STAGE_ORDER[status] ?? 0;
  if (!status || FINAL_REQUEST_STATUSES.has(status)) {
    return {
      requestId: row.id,
      status: row.status,
      stage,
      label: "Seguimiento en curso",
      description: "Estamos monitoreando el estado de tu solicitud.",
    };
  }

  if (status === "review") {
    if (!row.invoice_id) {
      return {
        requestId: row.id,
        status: row.status,
        stage,
        label: "Adjuntar factura",
        description: "Agrega una factura a la solicitud para continuar con el análisis.",
      };
    }
    return {
      requestId: row.id,
      status: row.status,
      stage,
      label: "Completar revisión",
      description: "Nuestro equipo revisa tus documentos. Te avisaremos si necesitamos algo más.",
    };
  }

  if (status === "offered") {
    return {
      requestId: row.id,
      status: row.status,
      stage,
      label: "Revisar oferta",
      description: "Valida la oferta disponible y confirma si deseas avanzar.",
    };
  }

  if (status === "accepted") {
    return {
      requestId: row.id,
      status: row.status,
      stage,
      label: "Firmar contrato",
      description: "Firma el contrato para preparar el desembolso.",
    };
  }

  if (status === "signed") {
    return {
      requestId: row.id,
      status: row.status,
      stage,
      label: "Esperar desembolso",
      description: "Estamos programando el desembolso correspondiente.",
    };
  }

  if (status === "funded") {
    return {
      requestId: row.id,
      status: row.status,
      stage,
      label: "Solicitud desembolsada",
      description: "El proceso finalizó con éxito.",
    };
  }

  if (status === "cancelled") {
    return {
      requestId: row.id,
      status: row.status,
      stage,
      label: "Solicitud cancelada",
      description: "Contáctanos si deseas retomarla.",
    };
  }

  return {
    requestId: row.id,
    status: row.status,
    stage,
    label: "Seguimiento en curso",
    description: "Seguimos acompañando tu operación.",
  };
}

function monthKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function buildTrend(requests: FundingRequestRow[], invoices: InvoiceRow[]): TrendPoint[] {
  const months = new Map<string, TrendPoint>();
  const today = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const seed = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const label = monthKey(seed);
    months.set(label, { label, requested: 0, funded: 0 });
  }

  requests.forEach((row) => {
    if (!row.created_at) return;
    const created = new Date(row.created_at);
    if (Number.isNaN(created.getTime())) return;
    const label = monthKey(new Date(created.getFullYear(), created.getMonth(), 1));
    if (!months.has(label)) return;
    const point = months.get(label)!;
    point.requested += Number(row.requested_amount || 0);
  });

  invoices.forEach((row) => {
    if ((row.status || "").toLowerCase() !== "funded") return;
    if (!row.created_at) return;
    const created = new Date(row.created_at);
    if (Number.isNaN(created.getTime())) return;
    const label = monthKey(new Date(created.getFullYear(), created.getMonth(), 1));
    if (!months.has(label)) return;
    const point = months.get(label)!;
    point.funded += Number(row.amount || 0);
  });

  return Array.from(months.values()).sort((a, b) => a.label.localeCompare(b.label));
}

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

    const [requestsRes, invoicesRes, eventsRes] = await Promise.all([
      supabase
        .from("funding_requests")
        .select("id, status, requested_amount, created_at, invoice_id, archived_at")
        .eq("company_id", orgId),
      supabase.from("invoices").select("id, amount, status, created_at").eq("company_id", orgId),
      supabase
        .from("request_timeline_entries")
        .select("id, request_id, event_type, title, description, occurred_at, status")
        .eq("company_id", orgId)
        .order("occurred_at", { ascending: false })
        .limit(6),
    ]);

    if (requestsRes.error) {
      return NextResponse.json({ ok: false, error: requestsRes.error.message }, { status: 500 });
    }
    if (invoicesRes.error) {
      return NextResponse.json({ ok: false, error: invoicesRes.error.message }, { status: 500 });
    }

    const requests = (requestsRes.data || []) as FundingRequestRow[];
    const invoices = (invoicesRes.data || []) as InvoiceRow[];
    const events = (eventsRes?.data || []) as TimelineRow[];

    const activeRequests = requests.filter((row) => {
      const status = (row.status || "").toLowerCase();
      return !FINAL_REQUEST_STATUSES.has(status) && !row.archived_at;
    });

    const metrics = {
      activeRequests: activeRequests.length,
      activeAmount: activeRequests.reduce((sum, row) => sum + Number(row.requested_amount || 0), 0),
      totalRequested: requests.reduce((sum, row) => sum + Number(row.requested_amount || 0), 0),
      totalFunded: invoices
        .filter((row) => (row.status || "").toLowerCase() === "funded")
        .reduce((sum, row) => sum + Number(row.amount || 0), 0),
      pendingInvoices: invoices.filter((row) => (row.status || "").toLowerCase() === "uploaded").length,
    };

    const nextActions = activeRequests
      .map((row) => computeNextAction(row))
      .sort((a, b) => b.stage - a.stage)
      .slice(0, 5);

    const trend = buildTrend(requests, invoices);

    const notifications: Notification[] = [];
    if (metrics.pendingInvoices > 0) {
      notifications.push({
        type: "pending_invoices",
        message: `Tienes ${metrics.pendingInvoices} factura${metrics.pendingInvoices === 1 ? "" : "s"} pendiente${
          metrics.pendingInvoices === 1 ? "" : "s"
        } de validación.`,
      });
    }
    if (metrics.activeRequests === 0 && requests.length > 0) {
      notifications.push({
        type: "no_active_requests",
        message: "No tienes solicitudes activas en este momento.",
      });
    }

    const formattedEvents = events.map((event) => ({
      id: event.id,
      requestId: event.request_id,
      title: event.title || event.event_type || "Actualización",
      description: event.description,
      occurredAt: event.occurred_at,
      status: event.status,
      type: event.event_type,
    }));

    return NextResponse.json({
      ok: true,
      summary: {
        metrics,
        nextActions,
        trend,
        events: formattedEvents,
        notifications,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
