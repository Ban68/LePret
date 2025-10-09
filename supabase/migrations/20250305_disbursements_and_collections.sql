-- Migration: add bank accounts, payments tracking, and request disbursement fields

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  label text,
  bank_name text not null,
  account_type text not null,
  account_number text not null,
  account_holder_name text not null,
  account_holder_id text,
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists bank_accounts_company_idx on public.bank_accounts(company_id, created_at desc);
create index if not exists bank_accounts_default_idx on public.bank_accounts(company_id) where is_default = true;

alter table public.bank_accounts enable row level security;

drop policy if exists "bank_accounts_select" on public.bank_accounts;
create policy "bank_accounts_select" on public.bank_accounts
  for select using (
    exists (
      select 1 from public.memberships m
      where m.company_id = bank_accounts.company_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    ) or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

drop policy if exists "bank_accounts_insert" on public.bank_accounts;
create policy "bank_accounts_insert" on public.bank_accounts
  for insert with check (
    exists (
      select 1 from public.memberships m
      where m.company_id = bank_accounts.company_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
        and upper(coalesce(m.role, '')) in ('OWNER','ADMIN')
    ) or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

drop policy if exists "bank_accounts_update" on public.bank_accounts;
create policy "bank_accounts_update" on public.bank_accounts
  for update using (
    exists (
      select 1 from public.memberships m
      where m.company_id = bank_accounts.company_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
        and upper(coalesce(m.role, '')) in ('OWNER','ADMIN')
    ) or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.funding_requests(id) on delete set null,
  company_id uuid not null references public.companies(id) on delete cascade,
  bank_account_id uuid references public.bank_accounts(id) on delete set null,
  direction text not null default 'outbound' check (direction in ('outbound','inbound')),
  status text not null default 'pending' check (status in ('pending','in_collection','paid','overdue','cancelled')),
  amount numeric(14,2) not null,
  currency text not null default 'COP',
  due_date date,
  paid_at timestamptz,
  notes text,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists payments_company_idx on public.payments(company_id, created_at desc);
create index if not exists payments_request_idx on public.payments(request_id);
create index if not exists payments_status_idx on public.payments(status, due_date);

alter table public.payments enable row level security;

drop policy if exists "payments_select" on public.payments;
create policy "payments_select" on public.payments
  for select using (
    exists (
      select 1 from public.memberships m
      where m.company_id = payments.company_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    ) or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

drop policy if exists "payments_insert" on public.payments;
create policy "payments_insert" on public.payments
  for insert with check (
    exists (
      select 1 from public.memberships m
      where m.company_id = payments.company_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    ) or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

drop policy if exists "payments_update" on public.payments;
create policy "payments_update" on public.payments
  for update using (
    exists (
      select 1 from public.memberships m
      where m.company_id = payments.company_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    ) or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

alter table public.funding_requests add column if not exists disbursement_account_id uuid references public.bank_accounts(id) on delete set null;
alter table public.funding_requests add column if not exists disbursed_at timestamptz;

