import { supabaseAdmin } from "@/lib/supabase";

type AuditEntity = 'invoice' | 'request' | 'offer' | 'document' | 'contract' | 'membership';
type AuditAction =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'deleted'
  | 'signed'
  | 'funded'
  | 'archived'
  | 'denied';

export async function logAudit(input: {
  company_id: string;
  actor_id?: string | null;
  entity: AuditEntity;
  entity_id?: string | null;
  action: AuditAction;
  data?: Record<string, unknown> | null;
}) {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      company_id: input.company_id,
      actor_id: input.actor_id ?? null,
      entity: input.entity,
      entity_id: input.entity_id ?? null,
      action: input.action,
      data: input.data ?? null,
    });
  } catch {}
}
