-- Migration: add per-company lending parameter overrides and request defaults

create table if not exists public.hq_company_parameters (
  company_id uuid primary key references public.companies(id) on delete cascade,
  discount_rate numeric,
  operation_days integer,
  advance_pct numeric,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users(id)
);

comment on table public.hq_company_parameters is 'Stores per-company overrides for lending parameters used to prefill requests.';
comment on column public.hq_company_parameters.company_id is 'Company identifier for the override.';
comment on column public.hq_company_parameters.discount_rate is 'Effective annual discount rate override (percentage).';
comment on column public.hq_company_parameters.operation_days is 'Default tenor in days for operations of this company.';
comment on column public.hq_company_parameters.advance_pct is 'Default advance percentage over invoice total for this company.';
comment on column public.hq_company_parameters.updated_at is 'Timestamp of the latest modification.';
comment on column public.hq_company_parameters.updated_by is 'Backoffice user that performed the latest modification.';

create index if not exists hq_company_parameters_updated_at_idx on public.hq_company_parameters(updated_at desc);

alter table public.hq_company_parameters enable row level security;

drop policy if exists "hq_company_parameters_select_staff" on public.hq_company_parameters;
create policy "hq_company_parameters_select_staff" on public.hq_company_parameters
  for select using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

drop policy if exists "hq_company_parameters_modify_staff" on public.hq_company_parameters;
create policy "hq_company_parameters_modify_staff" on public.hq_company_parameters
  for all using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

alter table public.funding_requests add column if not exists default_discount_rate numeric;
alter table public.funding_requests add column if not exists default_operation_days integer;
alter table public.funding_requests add column if not exists default_advance_pct numeric;
alter table public.funding_requests add column if not exists default_settings_source text;

comment on column public.funding_requests.default_discount_rate is 'Prefilled annual discount rate applied when the request was created.';
comment on column public.funding_requests.default_operation_days is 'Prefilled operation tenor in days applied when the request was created.';
comment on column public.funding_requests.default_advance_pct is 'Prefilled advance percentage applied when the request was created.';
comment on column public.funding_requests.default_settings_source is 'Source of the defaults (e.g. company_override, segment_default, global_default).';

