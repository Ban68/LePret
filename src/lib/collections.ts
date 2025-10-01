import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase";

export type CollectionActionRow = {
  id: string;
  case_id: string;
  request_id: string;
  company_id: string;
  action_type: string;
  note: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_by_name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type CollectionCaseRow = {
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
  promise_amount: number | string | null;
  promise_date: string | null;
  created_at: string;
  updated_at: string;
};

export async function listCollectionActions(
  client: SupabaseClient,
  caseId: string,
): Promise<CollectionActionRow[]> {
  const { data, error } = await client
    .from("collection_actions")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as CollectionActionRow[];
}

export async function getCollectionCase(
  client: SupabaseClient,
  caseId: string,
): Promise<CollectionCaseRow | null> {
  const { data, error } = await client
    .from("collection_cases")
    .select("*")
    .eq("id", caseId)
    .maybeSingle();

  if (error) throw error;
  return (data as CollectionCaseRow) ?? null;
}

export async function updateCollectionCase(
  caseId: string,
  updates: Partial<Pick<CollectionCaseRow, "status" | "priority" | "assigned_to" | "notes" | "closed_at" | "next_action_at" | "promise_amount" | "promise_date">>,
) {
  const payload = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("collection_cases")
    .update(payload)
    .eq("id", caseId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as CollectionCaseRow | null;
}

export async function createCollectionAction(input: {
  caseId: string;
  requestId: string;
  companyId: string;
  actionType: string;
  note?: string | null;
  dueAt?: string | null;
  completedAt?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const payload = {
    case_id: input.caseId,
    request_id: input.requestId,
    company_id: input.companyId,
    action_type: input.actionType,
    note: input.note ?? null,
    due_at: input.dueAt ?? null,
    completed_at: input.completedAt ?? null,
    created_by: input.createdBy ?? null,
    created_by_name: input.createdByName ?? null,
    metadata: input.metadata ?? null,
  };

  const { data, error } = await supabaseAdmin
    .from("collection_actions")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data as CollectionActionRow;
}

