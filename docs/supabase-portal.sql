-- Supabase Portal schema for LePrêt Capital
-- Run this after docs/supabase-schema.sql

create extension if not exists pgcrypto;

-- Profiles tied to Supabase auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  full_name text,
  company_name text,
  nit text,
  phone text,
  role text not null default 'customer'
);

alter table public.profiles enable row level security;

-- Auto-insert profile on new user
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS policies for profiles
drop policy if exists "Read own profile" on public.profiles;
create policy "Read own profile" on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists "Update own profile" on public.profiles;
create policy "Update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Operations requested by customers
create table if not exists public.operations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','submitted','reviewing','approved','rejected','funded','settled','cancelled')),
  requested_amount numeric(14,2),
  expected_due_date date,
  currency text not null default 'COP',
  cost numeric(14,2),
  notes text
);

alter table public.operations enable row level security;

drop policy if exists "Insert own operations" on public.operations;
create policy "Insert own operations" on public.operations
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Read own operations" on public.operations;
create policy "Read own operations" on public.operations
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Update own draft operations" on public.operations;
create policy "Update own draft operations" on public.operations
  for update to authenticated
  using (user_id = auth.uid() and status in ('draft','submitted'))
  with check (user_id = auth.uid());

-- Invoices attached to operations
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  operation_id uuid not null references public.operations(id) on delete cascade,
  invoice_number text,
  issue_date date,
  due_date date,
  amount numeric(14,2),
  debtor_name text,
  debtor_nit text,
  status text not null default 'uploaded'
);

create index if not exists idx_invoices_operation on public.invoices(operation_id);
alter table public.invoices enable row level security;

drop policy if exists "Read invoices of own operations" on public.invoices;
create policy "Read invoices of own operations" on public.invoices
  for select to authenticated
  using (exists (
    select 1 from public.operations o
    where o.id = invoices.operation_id and o.user_id = auth.uid()
  ));

drop policy if exists "Insert invoices to own operations" on public.invoices;
create policy "Insert invoices to own operations" on public.invoices
  for insert to authenticated
  with check (exists (
    select 1 from public.operations o
    where o.id = invoices.operation_id and o.user_id = auth.uid()
  ));

drop policy if exists "Update invoices of own draft ops" on public.invoices;
create policy "Update invoices of own draft ops" on public.invoices
  for update to authenticated
  using (exists (
    select 1 from public.operations o
    where o.id = invoices.operation_id and o.user_id = auth.uid() and o.status in ('draft','submitted')
  ))
  with check (exists (
    select 1 from public.operations o
    where o.id = invoices.operation_id and o.user_id = auth.uid()
  ));

-- Documents metadata (links to Storage)
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  operation_id uuid references public.operations(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  kind text not null, -- e.g. 'invoice_pdf', 'radian_xml', 'supporting_doc'
  storage_path text not null,
  mime_type text,
  size_bytes bigint
);

alter table public.documents enable row level security;

drop policy if exists "Insert own documents" on public.documents;
create policy "Insert own documents" on public.documents
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Read own documents" on public.documents;
create policy "Read own documents" on public.documents
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Delete own documents" on public.documents;
create policy "Delete own documents" on public.documents
  for delete to authenticated
  using (user_id = auth.uid());

-- Storage bucket for invoices/documents
-- Note: run with service role or in SQL editor as owner
select storage.create_bucket('invoices', public => false);

-- Storage RLS: limit access to own files using path prefix `${auth.uid()}/...`
-- Ensure RLS is enabled on storage.objects
-- Policies per bucket 'invoices'
drop policy if exists "invoices-upload-own" on storage.objects;
create policy "invoices-upload-own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'invoices'
    and (position(auth.uid()::text || '/' in name) = 1)
  );

drop policy if exists "invoices-read-own" on storage.objects;
create policy "invoices-read-own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'invoices'
    and (position(auth.uid()::text || '/' in name) = 1)
  );

drop policy if exists "invoices-delete-own" on storage.objects;
create policy "invoices-delete-own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'invoices'
    and (position(auth.uid()::text || '/' in name) = 1)
  );

