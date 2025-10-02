-- Migration: add request timeline, messages, and collections tracking

create table if not exists public.request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.funding_requests(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  event_type text not null,
  status text,
  title text,
  description text,
  actor_role text,
  actor_id uuid,
  actor_name text,
  metadata jsonb,
  occurred_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists request_events_request_id_idx on public.request_events(request_id, occurred_at desc);
create index if not exists request_events_company_idx on public.request_events(company_id);

create table if not exists public.request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.funding_requests(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  sender_id uuid,
  sender_role text,
  sender_name text,
  subject text,
  body text not null,
  visibility text not null default 'client',
  message_type text default 'note',
  metadata jsonb,
  sent_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists request_messages_request_idx on public.request_messages(request_id, sent_at desc);
create index if not exists request_messages_company_idx on public.request_messages(company_id);

create table if not exists public.collection_cases (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.funding_requests(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  status text not null default 'open',
  priority text default 'normal',
  assigned_to uuid,
  notes text,
  opened_at timestamptz not null default timezone('utc', now()),
  closed_at timestamptz,
  next_action_at timestamptz,
  promise_amount numeric,
  promise_date date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists collection_cases_company_idx on public.collection_cases(company_id);
create index if not exists collection_cases_request_idx on public.collection_cases(request_id);
create index if not exists collection_cases_status_idx on public.collection_cases(status, next_action_at);

create table if not exists public.collection_actions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.collection_cases(id) on delete cascade,
  request_id uuid not null references public.funding_requests(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  action_type text not null,
  note text,
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  created_by_name text,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists collection_actions_case_idx on public.collection_actions(case_id, created_at desc);
create index if not exists collection_actions_request_idx on public.collection_actions(request_id);

create or replace view public.request_timeline_entries as
select
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

create or replace view public.collection_case_summaries as
select
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

