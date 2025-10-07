import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getSupabaseAdminClient } from "@/lib/supabase";

export type TimelineItemKind = "event" | "message";

export type RequestTimelineItem = {
  id: string;
  request_id: string;
  company_id: string;
  item_kind: TimelineItemKind;
  event_type: string | null;
  status: string | null;
  title: string | null;
  description: string | null;
  actor_role: string | null;
  actor_id: string | null;
  actor_name: string | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
  created_at: string;
};

export type RequestMessageInput = {
  requestId: string;
  companyId: string;
  body: string;
  subject?: string | null;
  visibility?: "client" | "internal" | "staff";
  messageType?: string | null;
  senderId?: string | null;
  senderRole?: string | null;
  senderName?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type RequestEventInput = {
  requestId: string;
  companyId: string;
  eventType: string;
  status?: string | null;
  title?: string | null;
  description?: string | null;
  actorRole?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  occurredAt?: string | null;
  metadata?: Record<string, unknown> | null;
};

function mapTimelineRow(row: Record<string, unknown>): RequestTimelineItem {
  return {
    id: String(row.id ?? ""),
    request_id: String(row.request_id ?? ""),
    company_id: String(row.company_id ?? ""),
    item_kind: (row.item_kind === "message" ? "message" : "event") as TimelineItemKind,
    event_type: typeof row.event_type === "string" ? row.event_type : null,
    status: typeof row.status === "string" ? row.status : null,
    title: typeof row.title === "string" ? row.title : null,
    description: typeof row.description === "string" ? row.description : null,
    actor_role: typeof row.actor_role === "string" ? row.actor_role : null,
    actor_id: typeof row.actor_id === "string" ? row.actor_id : null,
    actor_name: typeof row.actor_name === "string" ? row.actor_name : null,
    metadata: (row.metadata && typeof row.metadata === "object") ? (row.metadata as Record<string, unknown>) : null,
    occurred_at: typeof row.occurred_at === "string" ? row.occurred_at : new Date().toISOString(),
    created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
  };
}

export async function getRequestTimeline(
  client: SupabaseClient,
  requestId: string,
): Promise<RequestTimelineItem[]> {
  const { data, error } = await client
    .from("request_timeline_entries")
    .select("*")
    .eq("request_id", requestId)
    .order("occurred_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => mapTimelineRow(row as Record<string, unknown>));
}

export async function createRequestMessage(
  client: SupabaseClient,
  input: RequestMessageInput,
) {
  const payload = {
    request_id: input.requestId,
    company_id: input.companyId,
    body: input.body,
    subject: input.subject ?? null,
    visibility: input.visibility ?? "client",
    message_type: input.messageType ?? "note",
    sender_id: input.senderId ?? null,
    sender_role: input.senderRole ?? null,
    sender_name: input.senderName ?? null,
    metadata: input.metadata ?? null,
  };

  const { data, error } = await client
    .from("request_messages")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createRequestMessageAdmin(input: RequestMessageInput) {
  return createRequestMessage(getSupabaseAdminClient(), input);
}

export async function createRequestEvent(input: RequestEventInput) {
  const supabaseAdmin = getSupabaseAdminClient();
  const payload = {
    request_id: input.requestId,
    company_id: input.companyId,
    event_type: input.eventType,
    status: input.status ?? null,
    title: input.title ?? null,
    description: input.description ?? null,
    actor_role: input.actorRole ?? null,
    actor_id: input.actorId ?? null,
    actor_name: input.actorName ?? null,
    metadata: input.metadata ?? null,
    occurred_at: input.occurredAt ?? null,
  };

  const { data, error } = await supabaseAdmin
    .from("request_events")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export type CollectionCaseSummary = {
  id: string;
  request_id: string;
  company_id: string;
  status: string;
  priority: string | null;
  assigned_to: string | null;
  notes: string | null;
  opened_at: string;
  closed_at: string | null;
  next_action_at: string | null;
  promise_amount: string | number | null;
  promise_date: string | null;
  created_at: string;
  updated_at: string;
  request_status: string | null;
  requested_amount: number | string | null;
  currency: string | null;
  company_name: string | null;
  actions_count: number | null;
  last_action_id: string | null;
  last_action_type: string | null;
  last_action_note: string | null;
  last_action_due_at: string | null;
  last_action_completed_at: string | null;
  last_action_created_at: string | null;
};

export async function getCollectionCaseSummary(
  client: SupabaseClient,
  caseId: string,
): Promise<CollectionCaseSummary | null> {
  const { data, error } = await client
    .from("collection_case_summaries")
    .select("*")
    .eq("id", caseId)
    .maybeSingle();

  if (error) throw error;
  return data as CollectionCaseSummary | null;
}

export function subscribeToRequestTimeline(
  requestId: string,
  onChange?: () => void,
) {
  if (typeof window === "undefined") return () => {};

  try {
    const client = getSupabaseBrowserClient();
    const channel = client
      .channel(`request-timeline:${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "request_timeline_entries",
          filter: `request_id=eq.${requestId}`,
        },
        () => {
          if (onChange) onChange();
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  } catch (err) {
    console.error("subscribeToRequestTimeline error", err);
    return () => {};
  }
}

export function computeClientNextSteps(
  requestStatus: string | null | undefined,
  collectionCase: Pick<CollectionCaseSummary, "status" | "next_action_at" | "promise_amount" | "promise_date"> | null,
) {
  const status = (requestStatus || "").toLowerCase();
  if (collectionCase && collectionCase.status && collectionCase.status.toLowerCase() !== "closed") {
    const promiseInfo = collectionCase.promise_date
      ? `Compromiso de pago para ${new Date(collectionCase.promise_date).toLocaleDateString("es-CO")}`
      : null;
    const reminder = collectionCase.next_action_at
      ? `Revisión programada ${new Date(collectionCase.next_action_at).toLocaleString("es-CO")}`
      : null;
    return {
      label: "Seguimiento de cobranza en curso",
      hint: promiseInfo || reminder || "Nuestro equipo está acompañando el proceso de cobranza.",
    };
  }

  if (status === "funded") {
    return {
      label: "Solicitud desembolsada",
      hint: "Tu operación fue desembolsada. Mantente atento a los recordatorios de pago.",
    };
  }

  if (status === "signed") {
    return {
      label: "Desembolso en proceso",
      hint: "Estamos gestionando el desembolso de tu operación.",
    };
  }

  if (status === "accepted") {
    return {
      label: "Firma de contrato",
      hint: "Revisa y firma el contrato enviado para continuar con el desembolso.",
    };
  }

  if (status === "offered") {
    return {
      label: "Aceptar oferta",
      hint: "Revisa las condiciones para continuar con tu solicitud.",
    };
  }

  if (status === "cancelled") {
    return {
      label: "Solicitud cancelada",
      hint: "Contáctanos si deseas retomar el proceso.",
    };
  }

  return {
    label: "Solicitud en revisión",
    hint: "Nuestro equipo está analizando la información enviada.",
  };
}

