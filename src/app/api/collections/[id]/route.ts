import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { isBackofficeAllowed } from "@/lib/hq-auth";
import {
  CollectionCaseSummary,
  createCollectionAction,
  getCollectionCaseSummary,
  updateCollectionCase,
} from "@/lib/collections";
import {
  computeClientNextSteps,
  createRequestEvent,
  createRequestMessageAdmin,
  getRequestTimeline,
} from "@/lib/request-timeline";
import {
  notifyClientRequestMessage,
  notifyStaffCollectionPromise,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

async function ensureStaffSession() {
  const supabase = await supabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }

  const allowed = await isBackofficeAllowed(session.user?.id, session.user?.email);
  if (!allowed) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true as const, supabase, session };
}

async function fetchCaseSummary(caseId: string): Promise<CollectionCaseSummary | null> {
  return getCollectionCaseSummary(supabaseAdmin, caseId);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await ensureStaffSession();
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const summary = await fetchCaseSummary(id);
    if (!summary) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const timeline = await getRequestTimeline(supabaseAdmin, summary.request_id);
    const { data: actions, error: actionsError } = await supabaseAdmin
      .from("collection_actions")
      .select("*")
      .eq("case_id", summary.id)
      .order("created_at", { ascending: true });

    if (actionsError) throw new Error(actionsError.message);

    const nextSteps = computeClientNextSteps(summary.request_status, summary);

    return NextResponse.json({
      ok: true,
      case: summary,
      actions: actions ?? [],
      timeline,
      nextSteps,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/collections/[id]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await ensureStaffSession();
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const summary = await fetchCaseSummary(id);
    if (!summary) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const payload = await req.json();
    const allowedFields = [
      "status",
      "priority",
      "assigned_to",
      "notes",
      "closed_at",
      "next_action_at",
      "promise_amount",
      "promise_date",
    ];

    const updates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in payload) updates[key] = payload[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: false, error: "Sin cambios" }, { status: 400 });
    }

    const updated = await updateCollectionCase(id, updates);
    if (!updated) throw new Error("No se pudo actualizar el caso");

    await createRequestEvent({
      requestId: summary.request_id,
      companyId: summary.company_id,
      eventType: "collection_update",
      status: String(updates.status ?? updated.status ?? ""),
      title: "Actualización de cobranza",
      description: "Se actualizó la información del caso de cobranza.",
      actorRole: "staff",
      actorId: guard.session.user.id,
      actorName: guard.session.user.email ?? null,
      metadata: updates,
    });

    if ("promise_date" in updates || "promise_amount" in updates) {
      await notifyStaffCollectionPromise(
        summary.company_id,
        summary.request_id,
        (updates.promise_date as string | undefined) ?? updated.promise_date,
        (updates.promise_amount as string | number | undefined) ?? updated.promise_amount,
      );
    }

    const timeline = await getRequestTimeline(supabaseAdmin, summary.request_id);

    return NextResponse.json({
      ok: true,
      case: updated,
      timeline,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("PATCH /api/collections/[id]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await ensureStaffSession();
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const summary = await fetchCaseSummary(id);
    if (!summary) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const payload = await req.json();
    const kind = typeof payload?.kind === "string" ? payload.kind : "";

    if (kind === "action") {
      if (!payload?.actionType) {
        return NextResponse.json({ ok: false, error: "Tipo de acción requerido" }, { status: 400 });
      }

      const action = await createCollectionAction({
        caseId: summary.id,
        requestId: summary.request_id,
        companyId: summary.company_id,
        actionType: String(payload.actionType),
        note: typeof payload.note === "string" ? payload.note : null,
        dueAt: typeof payload.dueAt === "string" ? payload.dueAt : null,
        completedAt: typeof payload.completedAt === "string" ? payload.completedAt : null,
        createdBy: guard.session.user.id,
        createdByName: guard.session.user.email ?? null,
        metadata: payload.metadata && typeof payload.metadata === "object" ? payload.metadata : null,
      });

      await createRequestEvent({
        requestId: summary.request_id,
        companyId: summary.company_id,
        eventType: "collection_action",
        status: summary.status,
        title: `Acción de cobranza: ${action.action_type}`,
        description: action.note ?? undefined,
        actorRole: "staff",
        actorId: guard.session.user.id,
        actorName: guard.session.user.email ?? null,
        metadata: { id: action.id, due_at: action.due_at, completed_at: action.completed_at },
      });

      return NextResponse.json({ ok: true, action });
    }

    if (kind === "message") {
      const message = typeof payload?.message === "string" ? payload.message.trim() : "";
      if (!message) {
        return NextResponse.json({ ok: false, error: "Mensaje requerido" }, { status: 400 });
      }

      const visibility = payload?.visibility === "internal" ? "internal" : "client";
      const subject = typeof payload?.subject === "string" && payload.subject.trim() ? payload.subject.trim() : null;

      await createRequestMessageAdmin({
        requestId: summary.request_id,
        companyId: summary.company_id,
        body: message,
        subject,
        visibility,
        messageType: payload?.messageType ?? "note",
        senderId: guard.session.user.id,
        senderRole: "staff",
        senderName: guard.session.user.email ?? null,
      });

      if (visibility !== "internal") {
        await notifyClientRequestMessage(summary.company_id, summary.request_id, message);
      }

      const timeline = await getRequestTimeline(supabaseAdmin, summary.request_id);
      return NextResponse.json({ ok: true, timeline });
    }

    if (kind === "event") {
      if (!payload?.eventType) {
        return NextResponse.json({ ok: false, error: "Tipo de evento requerido" }, { status: 400 });
      }

      const event = await createRequestEvent({
        requestId: summary.request_id,
        companyId: summary.company_id,
        eventType: String(payload.eventType),
        status: typeof payload.status === "string" ? payload.status : null,
        title: typeof payload.title === "string" ? payload.title : null,
        description: typeof payload.description === "string" ? payload.description : null,
        actorRole: "staff",
        actorId: guard.session.user.id,
        actorName: guard.session.user.email ?? null,
        occurredAt: typeof payload.occurredAt === "string" ? payload.occurredAt : null,
        metadata: payload.metadata && typeof payload.metadata === "object" ? payload.metadata : null,
      });

      return NextResponse.json({ ok: true, event });
    }

    return NextResponse.json({ ok: false, error: "Operación no soportada" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/collections/[id]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

