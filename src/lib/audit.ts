import { getSupabaseAdminClient } from "@/lib/supabase";

type AuditEntity = 'invoice' | 'request' | 'offer' | 'document' | 'contract' | 'membership' | 'integration' | 'feedback';
type AuditAction =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'deleted'
  | 'signed'
  | 'funded'
  | 'archived'
  | 'denied'
  | 'validation_failed'
  | 'feedback_submitted'
  | 'integration_warning';

type AuditPayload = {
  company_id: string;
  actor_id?: string | null;
  entity: AuditEntity;
  entity_id?: string | null;
  action: AuditAction;
  data?: Record<string, unknown> | null;
};

export async function logAudit(input: AuditPayload) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    await supabaseAdmin.from('audit_logs').insert({
      company_id: input.company_id,
      actor_id: input.actor_id ?? null,
      entity: input.entity,
      entity_id: input.entity_id ?? null,
      action: input.action,
      data: input.data ?? null,
    });
  } catch (error) {
    console.error('[audit] failed to persist log', error);
  }
}

export async function logStatusChange(input: {
  company_id: string;
  actor_id?: string | null;
  entity_id: string;
  from_status: string | null;
  to_status: string;
}) {
  await logAudit({
    company_id: input.company_id,
    actor_id: input.actor_id ?? null,
    entity: 'request',
    entity_id: input.entity_id,
    action: 'status_changed',
    data: { from_status: input.from_status, to_status: input.to_status },
  });
}

export async function logValidationFailure(input: {
  company_id: string;
  actor_id?: string | null;
  entity_id?: string | null;
  error: string;
  details?: Record<string, unknown> | null;
}) {
  await logAudit({
    company_id: input.company_id,
    actor_id: input.actor_id ?? null,
    entity: 'request',
    entity_id: input.entity_id ?? null,
    action: 'validation_failed',
    data: { error: input.error, details: input.details ?? null },
  });
}

export async function logFeedbackEvent(input: {
  company_id: string;
  actor_id?: string | null;
  entity_id?: string | null;
  kind: 'NPS' | 'CSAT';
  score: number;
  comment?: string | null;
}) {
  await logAudit({
    company_id: input.company_id,
    actor_id: input.actor_id ?? null,
    entity: 'feedback',
    entity_id: input.entity_id ?? null,
    action: 'feedback_submitted',
    data: { kind: input.kind, score: input.score, comment: input.comment ?? null },
  });
}

export async function logIntegrationWarning(input: {
  company_id: string;
  actor_id?: string | null;
  entity?: AuditEntity;
  entity_id?: string | null;
  provider: string;
  message: string;
  meta?: Record<string, unknown> | null;
}) {
  await logAudit({
    company_id: input.company_id,
    actor_id: input.actor_id ?? null,
    entity: input.entity ?? 'integration',
    entity_id: input.entity_id ?? null,
    action: 'integration_warning',
    data: { provider: input.provider, message: input.message, meta: input.meta ?? null },
  });
}
