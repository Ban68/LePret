-- Migration: Fix Security Definer views and add missing indexes for performance

-- 1. Fix View Security (Security Definer -> Security Invoker)
-- This ensures the view uses the permissions of the querying user (invoker) rather than the creator (definer/owner).
drop view if exists public.collection_case_summaries;
create or replace view public.collection_case_summaries
with (security_invoker = true)
as select
  c.id,
  c.request_id,
  c.company_id,
  c.status,
  c.priority,
  c.assigned_to,
  c.notes,
  c.opened_at,
  c.closed_at,
  c.next_action_at,
  c.promise_amount,
  c.promise_date,
  c.created_at,
  c.updated_at,
  r.status as request_status,
  r.requested_amount,
  r.currency,
  comp.name as company_name,
  ca_total.actions_count,
  ca_last.last_action_id,
  ca_last.last_action_type,
  ca_last.last_action_note,
  ca_last.last_action_due_at,
  ca_last.last_action_completed_at,
  ca_last.last_action_created_at
from public.collection_cases c
left join public.funding_requests r on r.id = c.request_id
left join public.companies comp on comp.id = c.company_id
left join lateral (
  select count(*)::bigint as actions_count
  from public.collection_actions ca
  where ca.case_id = c.id
) ca_total on true
left join lateral (
  select
    ca.id as last_action_id,
    ca.action_type as last_action_type,
    ca.note as last_action_note,
    ca.due_at as last_action_due_at,
    ca.completed_at as last_action_completed_at,
    ca.created_at as last_action_created_at
  from public.collection_actions ca
  where ca.case_id = c.id
  order by ca.created_at desc
  limit 1
) ca_last on true;

drop view if exists public.request_timeline_entries;
create or replace view public.request_timeline_entries
with (security_invoker = true)
as select
  e.id,
  e.request_id,
  e.company_id,
  'event'::text as item_kind,
  e.event_type,
  e.status,
  e.title,
  e.description,
  e.actor_role,
  e.actor_id,
  e.actor_name,
  e.metadata,
  e.occurred_at,
  e.created_at
from public.request_events e
union all
select
  m.id,
  m.request_id,
  m.company_id,
  'message'::text as item_kind,
  m.message_type as event_type,
  m.visibility as status,
  coalesce(m.subject, 'Mensaje') as title,
  m.body as description,
  m.sender_role as actor_role,
  m.sender_id as actor_id,
  m.sender_name as actor_name,
  m.metadata,
  m.sent_at as occurred_at,
  m.created_at
from public.request_messages m;

-- 2. Add Missing Indexes for Performance
-- Offers
create index if not exists offers_company_idx on public.offers(company_id);
create index if not exists offers_request_idx on public.offers(request_id);
create index if not exists offers_status_idx on public.offers(status);

-- Funding Requests
create index if not exists funding_requests_company_idx on public.funding_requests(company_id);
create index if not exists funding_requests_invoice_idx on public.funding_requests(invoice_id);
create index if not exists funding_requests_status_idx on public.funding_requests(status);

-- Invoices
create index if not exists invoices_company_idx on public.invoices(company_id);
create index if not exists invoices_status_idx on public.invoices(status);
create index if not exists invoices_issue_date_idx on public.invoices(issue_date);

-- 3. Fix Function Search Path (Security Hardening)
-- Force search_path to public for security-critical functions to prevent hijacking
alter function public.handle_new_user() set search_path = public;
alter function public.set_updated_at() set search_path = public;

