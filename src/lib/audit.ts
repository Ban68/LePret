import { supabaseAdmin } from "@/lib/supabase";

export async function logAudit(input: {
  company_id: string;
  actor_id?: string | null;
  entity: 'invoice' | 'request' | 'offer' | 'document' | 'contract';
  entity_id?: string | null;
  action: 'created' | 'updated' | 'status_changed' | 'deleted' | 'signed' | 'funded';
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
