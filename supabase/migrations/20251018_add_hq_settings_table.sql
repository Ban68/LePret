-- Migration: create HQ settings table for backoffice configuration

create table if not exists public.hq_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users(id)
);

comment on table public.hq_settings is 'Stores HQ backoffice configuration parameters such as discount rates and limits.';
comment on column public.hq_settings.key is 'Identifier for the configuration group (e.g., lending_parameters).';
comment on column public.hq_settings.value is 'JSON document with configuration values.';
comment on column public.hq_settings.updated_at is 'Timestamp of the latest modification.';
comment on column public.hq_settings.updated_by is 'User who performed the latest modification.';

create index if not exists hq_settings_updated_at_idx on public.hq_settings(updated_at desc);

alter table public.hq_settings enable row level security;

drop policy if exists "hq_settings_select_staff" on public.hq_settings;
create policy "hq_settings_select_staff" on public.hq_settings
  for select using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

drop policy if exists "hq_settings_modify_staff" on public.hq_settings;
create policy "hq_settings_modify_staff" on public.hq_settings
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

insert into public.hq_settings (key, value, updated_at, updated_by)
values (
  'lending_parameters',
  jsonb_build_object(
    'discountRate', 24,
    'creditLimits', jsonb_build_object(
      'default', 250000000,
      'startup', 150000000,
      'pyme', 300000000,
      'corporativo', 600000000
    ),
    'terms', jsonb_build_object(
      'default', 90,
      'startup', 75,
      'pyme', 90,
      'corporativo', 120
    ),
    'autoApproval', jsonb_build_object(
      'maxExposureRatio', 1,
      'maxTenorBufferDays', 5,
      'minRiskLevel', 'medium'
    )
  ),
  timezone('utc', now()),
  null
)
on conflict (key) do nothing;
