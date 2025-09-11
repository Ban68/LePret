create extension if not exists pgcrypto;

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null,
  email text not null,
  phone text,
  company text,
  nit text,
  country text,
  message text,
  consent boolean not null,
  ip inet,
  user_agent text,
  utm_source text, utm_medium text, utm_campaign text, utm_term text, utm_content text,
  referrer text
);

create table if not exists preapprovals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_name text not null,
  nit text not null,
  contact_name text,
  email text,
  phone text,
  monthly_sales numeric(14,2),
  invoices_per_month integer,
  avg_ticket numeric(14,2),
  factoring_type text,
  accepted_privacy boolean not null,
  status text not null default 'new',
  notes text,
  ip inet,
  user_agent text,
  utm_source text, utm_medium text, utm_campaign text, utm_term text, utm_content text,
  referrer text
);

create index if not exists idx_contacts_created_at on contacts (created_at desc);
create index if not exists idx_preapprovals_created_at on preapprovals (created_at desc);

alter table contacts enable row level security;
alter table preapprovals enable row level security;

-- === PORTAL CLIENTES (mínimo) ===
-- Perfiles de usuario (1-1 con auth.users)
create table if not exists profiles (
  user_id uuid primary key,
  full_name text,
  created_at timestamptz not null default now()
);

-- Empresas/organizaciones
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'CLIENT' check (type in ('CLIENT','INVESTOR')),
  created_at timestamptz not null default now()
);

-- Membresías usuario-empresa con rol
create table if not exists memberships (
  user_id uuid not null,
  company_id uuid not null,
  role text not null default 'client',
  status text not null default 'ACTIVE', -- ACTIVE | INVITED | DISABLED
  created_at timestamptz not null default now(),
  primary key (user_id, company_id),
  constraint fk_m_user foreign key (user_id) references profiles(user_id) on delete cascade,
  constraint fk_m_company foreign key (company_id) references companies(id) on delete cascade
);

-- Facturas (simplificado)
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  created_by uuid not null references profiles(user_id) on delete restrict,
  amount numeric(14,2) not null,
  issue_date date not null,
  due_date date not null,
  currency text not null default 'COP' check (currency in ('COP')),
  status text not null default 'uploaded',
  file_path text,
  created_at timestamptz not null default now()
);

-- Solicitudes de financiación (simplificado)
create table if not exists funding_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete set null,
  requested_amount numeric(14,2) not null,
  currency text not null default 'COP' check (currency in ('COP')),
  status text not null default 'review',
  created_by uuid not null references profiles(user_id) on delete restrict,
  created_at timestamptz not null default now()
);

-- Nuevas columnas para adjuntos en solicitudes (idempotente)
alter table funding_requests add column if not exists file_path text;

-- Habilitar RLS
alter table profiles enable row level security;
alter table companies enable row level security;
alter table memberships enable row level security;
alter table invoices enable row level security;
alter table funding_requests enable row level security;

-- Políticas básicas
-- profiles: cada usuario ve/edita su propio perfil
drop policy if exists "profiles_self_select" on profiles;
create policy "profiles_self_select" on profiles for select using (auth.uid() = user_id);
drop policy if exists "profiles_self_update" on profiles;
create policy "profiles_self_update" on profiles for update using (auth.uid() = user_id);
drop policy if exists "profiles_self_insert" on profiles;
create policy "profiles_self_insert" on profiles for insert with check (auth.uid() = user_id);

-- memberships: ver propias, insertar por service role (RLS se omite con service role)
drop policy if exists "memberships_self_select" on memberships;
create policy "memberships_self_select" on memberships for select using (auth.uid() = user_id);

-- companies: acceso por pertenencia (select)
drop policy if exists "companies_member_select" on companies;
create policy "companies_member_select" on companies for select using (
  exists (
    select 1 from memberships m where m.company_id = id and m.user_id = auth.uid() and m.status = 'ACTIVE'
  )
);

-- invoices: miembros pueden ver; crear; actualizar si son autores
drop policy if exists "invoices_member_select" on invoices;
create policy "invoices_member_select" on invoices for select using (
  exists (
    select 1 from memberships m where m.company_id = invoices.company_id and m.user_id = auth.uid() and m.status = 'ACTIVE'
  )
);
drop policy if exists "invoices_member_insert" on invoices;
create policy "invoices_member_insert" on invoices for insert with check (
  exists (
    select 1 from memberships m where m.company_id = invoices.company_id and m.user_id = auth.uid() and m.status = 'ACTIVE'
  ) and created_by = auth.uid()
);
drop policy if exists "invoices_author_update" on invoices;
create policy "invoices_author_update" on invoices for update using (
  created_by = auth.uid()
);

-- permitir que el autor elimine su factura
drop policy if exists "invoices_author_delete" on invoices;
create policy "invoices_author_delete" on invoices for delete using (
  created_by = auth.uid()
);

-- funding_requests: miembros pueden ver; crear; actualizar autor
drop policy if exists "fr_member_select" on funding_requests;
create policy "fr_member_select" on funding_requests for select using (
  exists (
    select 1 from memberships m where m.company_id = funding_requests.company_id and m.user_id = auth.uid() and m.status = 'ACTIVE'
  )
);
drop policy if exists "fr_member_insert" on funding_requests;
create policy "fr_member_insert" on funding_requests for insert with check (
  exists (
    select 1 from memberships m where m.company_id = funding_requests.company_id and m.user_id = auth.uid() and m.status = 'ACTIVE'
  ) and created_by = auth.uid()
);
drop policy if exists "fr_author_update" on funding_requests;
create policy "fr_author_update" on funding_requests for update using (
  created_by = auth.uid()
);

-- permitir que el autor elimine su solicitud
drop policy if exists "fr_author_delete" on funding_requests;
create policy "fr_author_delete" on funding_requests for delete using (
  created_by = auth.uid()
);

-- === OFFERS (ofertas para solicitudes) ===
create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  request_id uuid not null references funding_requests(id) on delete cascade,
  annual_rate numeric(6,4) not null,
  advance_pct numeric(5,2) not null,
  fees jsonb,
  valid_until timestamptz,
  status text not null default 'offered', -- offered | accepted | expired | cancelled
  net_amount numeric(14,2),
  created_by uuid not null references profiles(user_id) on delete restrict,
  accepted_by uuid,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table offers enable row level security;

drop policy if exists "offers_member_select" on offers;
create policy "offers_member_select" on offers for select using (
  exists (
    select 1 from memberships m where m.company_id = offers.company_id and m.user_id = auth.uid()
  )
);

drop policy if exists "offers_member_insert" on offers;
create policy "offers_member_insert" on offers for insert with check (
  exists (
    select 1 from memberships m where m.company_id = offers.company_id and m.user_id = auth.uid()
  ) and created_by = auth.uid()
);

drop policy if exists "offers_member_update" on offers;
create policy "offers_member_update" on offers for update using (
  exists (
    select 1 from memberships m where m.company_id = offers.company_id and m.user_id = auth.uid()
  )
);

-- === STORAGE (Bucket de facturas) ===
-- Crear bucket privado para archivos de facturas (si no existe)
do $$ begin
  if not exists (
    select 1 from storage.buckets where id = 'invoices'
  ) then
    perform storage.create_bucket(
      id => 'invoices',
      public => false,
      file_size_limit => 10485760 -- 10 MB
    );
  end if;
end $$;

-- Políticas de acceso: miembros de la organización pueden leer/subir/borrar
-- Convención: el path del archivo inicia con "<company_id>/<nombre-archivo>"
drop policy if exists "invoices_read" on storage.objects;
create policy "invoices_read" on storage.objects for select using (
  bucket_id = 'invoices' and exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.status = 'ACTIVE'
      and (storage.foldername(name))[1] = m.company_id::text
  )
);

drop policy if exists "invoices_insert" on storage.objects;
create policy "invoices_insert" on storage.objects for insert with check (
  bucket_id = 'invoices' and exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.status = 'ACTIVE'
      and (storage.foldername(name))[1] = m.company_id::text
  )
);

drop policy if exists "invoices_update" on storage.objects;
create policy "invoices_update" on storage.objects for update using (
  bucket_id = 'invoices' and exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.status = 'ACTIVE'
      and (storage.foldername(name))[1] = m.company_id::text
  )
);

drop policy if exists "invoices_delete" on storage.objects;
create policy "invoices_delete" on storage.objects for delete using (
  bucket_id = 'invoices' and exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.status = 'ACTIVE'
      and (storage.foldername(name))[1] = m.company_id::text
  )
);

-- === STORAGE (Bucket de solicitudes) ===
do $$ begin
  if not exists (
    select 1 from storage.buckets where id = 'requests'
  ) then
    perform storage.create_bucket(
      id => 'requests',
      public => false,
      file_size_limit => 10485760 -- 10 MB
    );
  end if;
end $$;

drop policy if exists "requests_read" on storage.objects;
create policy "requests_read" on storage.objects for select using (
  bucket_id = 'requests' and exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.status = 'ACTIVE'
      and (storage.foldername(name))[1] = m.company_id::text
  )
);

drop policy if exists "requests_insert" on storage.objects;
create policy "requests_insert" on storage.objects for insert with check (
  bucket_id = 'requests' and exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.status = 'ACTIVE'
      and (storage.foldername(name))[1] = m.company_id::text
  )
);

drop policy if exists "requests_update" on storage.objects;
create policy "requests_update" on storage.objects for update using (
  bucket_id = 'requests' and exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.status = 'ACTIVE'
      and (storage.foldername(name))[1] = m.company_id::text
  )
);

drop policy if exists "requests_delete" on storage.objects;
create policy "requests_delete" on storage.objects for delete using (
  bucket_id = 'requests' and exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.status = 'ACTIVE'
      and (storage.foldername(name))[1] = m.company_id::text
  )
);

-- Trigger: crear profile al crear usuario en auth.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
