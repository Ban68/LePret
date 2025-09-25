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

-- Bandera para staff global (operaciones/soporte)
alter table profiles add column if not exists is_staff boolean default false;

-- Empresas/organizaciones
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  tax_id text,
  contact_email text,
  contact_phone text,
  billing_email text,
  bank_account text,
  notification_email boolean default true,
  notification_sms boolean default false,
  notification_whatsapp boolean default false,
  type text not null default 'CLIENT' check (type in ('CLIENT','INVESTOR')),
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);
alter table companies add column if not exists legal_name text;
alter table companies add column if not exists tax_id text;
alter table companies add column if not exists contact_email text;
alter table companies add column if not exists contact_phone text;
alter table companies add column if not exists billing_email text;
alter table companies add column if not exists bank_account text;
alter table companies add column if not exists notification_email boolean default true;
alter table companies add column if not exists notification_sms boolean default false;
alter table companies add column if not exists notification_whatsapp boolean default false;
alter table companies add column if not exists updated_at timestamptz default now();

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

-- Asegurar valores de rol permitidos (incluye roles backoffice existentes y propuestos)
alter table memberships drop constraint if exists memberships_role_check;
alter table memberships add constraint memberships_role_check
  check (role in ('client','admin','investor','OWNER','ADMIN','OPERATOR','VIEWER'));

-- Pagadores (cat�logo de pagadores por organizaci�n)
create table if not exists payers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now()
);

alter table payers add column if not exists tax_id text;
alter table payers add column if not exists contact_email text;
alter table payers add column if not exists contact_phone text;
alter table payers add column if not exists sector text;
alter table payers add column if not exists credit_limit numeric(14,2);
alter table payers add column if not exists risk_rating text;
alter table payers add column if not exists notes text;
alter table payers add column if not exists created_by uuid references profiles(user_id) on delete set null;
alter table payers add column if not exists updated_at timestamptz default now();

alter table payers drop constraint if exists payers_status_check;
alter table payers add constraint payers_status_check
  check (status in ('ACTIVE','BLOCKED','ARCHIVED'));

create index if not exists payers_company_idx on payers (company_id);
create index if not exists payers_company_status_idx on payers (company_id, status);
create unique index if not exists payers_company_tax_id_unique on payers (company_id, tax_id)
  where tax_id is not null;
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

-- Estados permitidos para invoices
alter table invoices drop constraint if exists invoices_status_check;
alter table invoices add constraint invoices_status_check
  check (status in ('uploaded','validated','rejected','funded','cancelled'));

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

-- Estados permitidos para funding_requests
alter table funding_requests drop constraint if exists funding_requests_status_check;
alter table funding_requests add constraint funding_requests_status_check
  check (status in ('review','offered','accepted','signed','funded','cancelled'));

-- Nuevas columnas para adjuntos en solicitudes (idempotente)
alter table funding_requests add column if not exists file_path text;
alter table funding_requests add column if not exists archived_at timestamptz;
alter table funding_requests add column if not exists archived_by uuid references profiles(user_id) on delete set null;

-- Habilitar RLS
alter table profiles enable row level security;
alter table companies enable row level security;
alter table memberships enable row level security;
alter table payers enable row level security;
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
  ) or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);

-- payers: miembros activos pueden leer; administraci�n restringida a owners/admins o staff
drop policy if exists "payers_member_select" on payers;
create policy "payers_member_select" on payers for select using (
  exists (
    select 1 from memberships m where m.company_id = payers.company_id and m.user_id = auth.uid() and m.status = 'ACTIVE'
  ) or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);

drop policy if exists "payers_manager_insert" on payers;
create policy "payers_manager_insert" on payers for insert with check (
  exists (
    select 1 from memberships m
    where m.company_id = payers.company_id
      and m.user_id = auth.uid()
      and m.status = 'ACTIVE'
      and upper(m.role) in ('OWNER','ADMIN')
  ) or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);

drop policy if exists "payers_manager_update" on payers;
create policy "payers_manager_update" on payers for update using (
  exists (
    select 1 from memberships m
    where m.company_id = payers.company_id
      and m.user_id = auth.uid()
      and m.status = 'ACTIVE'
      and upper(m.role) in ('OWNER','ADMIN')
  ) or payers.created_by = auth.uid() or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
) with check (
  exists (
    select 1 from memberships m
    where m.company_id = payers.company_id
      and m.user_id = auth.uid()
      and m.status = 'ACTIVE'
      and upper(m.role) in ('OWNER','ADMIN')
  ) or payers.created_by = auth.uid() or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);

drop policy if exists "payers_manager_delete" on payers;
create policy "payers_manager_delete" on payers for delete using (
  exists (
    select 1 from memberships m
    where m.company_id = payers.company_id
      and m.user_id = auth.uid()
      and m.status = 'ACTIVE'
      and upper(m.role) in ('OWNER','ADMIN')
  ) or payers.created_by = auth.uid() or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);
-- invoices: miembros pueden ver; crear; actualizar si son autores
drop policy if exists "invoices_member_select" on invoices;
create policy "invoices_member_select" on invoices for select using (
  exists (
    select 1 from memberships m where m.company_id = invoices.company_id and m.user_id = auth.uid() and m.status = 'ACTIVE'
  ) or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);
drop policy if exists "invoices_member_insert" on invoices;
create policy "invoices_member_insert" on invoices for insert with check (
  (
    exists (
      select 1 from memberships m where m.company_id = invoices.company_id and m.user_id = auth.uid() and m.status = 'ACTIVE'
    ) or exists (
      select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
    )
  ) and created_by = auth.uid()
);
drop policy if exists "invoices_author_update" on invoices;
create policy "invoices_author_update" on invoices for update using (
  created_by = auth.uid() or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);

-- permitir que el autor elimine su factura
drop policy if exists "invoices_author_delete" on invoices;
create policy "invoices_author_delete" on invoices for delete using (
  created_by = auth.uid() or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);

-- funding_requests: miembros pueden ver; crear; actualizar autor
drop policy if exists "fr_member_select" on funding_requests;
create policy "fr_member_select" on funding_requests for select using (
  exists (
    select 1 from memberships m where m.company_id = funding_requests.company_id and m.user_id = auth.uid() and m.status = 'ACTIVE'
  ) or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);
drop policy if exists "fr_member_insert" on funding_requests;
create policy "fr_member_insert" on funding_requests for insert with check (
  (
    exists (
      select 1 from memberships m where m.company_id = funding_requests.company_id and m.user_id = auth.uid() and m.status = 'ACTIVE'
    ) or exists (
      select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
    )
  ) and created_by = auth.uid()
);
drop policy if exists "fr_author_update" on funding_requests;
create policy "fr_author_update" on funding_requests for update using (
  created_by = auth.uid() or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);

-- permitir que el autor elimine su solicitud
drop policy if exists "fr_author_delete" on funding_requests;
create policy "fr_author_delete" on funding_requests for delete using (
  created_by = auth.uid() or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
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

-- Estados permitidos para offers
alter table offers drop constraint if exists offers_status_check;
alter table offers add constraint offers_status_check
  check (status in ('offered','accepted','expired','cancelled'));

drop policy if exists "offers_member_select" on offers;
create policy "offers_member_select" on offers for select using (
  exists (
    select 1 from memberships m where m.company_id = offers.company_id and m.user_id = auth.uid()
  ) or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);

drop policy if exists "offers_member_insert" on offers;
create policy "offers_member_insert" on offers for insert with check (
  (
    exists (
      select 1 from memberships m where m.company_id = offers.company_id and m.user_id = auth.uid()
    ) or exists (
      select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
    )
  ) and created_by = auth.uid()
);

drop policy if exists "offers_member_update" on offers;
create policy "offers_member_update" on offers for update using (
  exists (
    select 1 from memberships m where m.company_id = offers.company_id and m.user_id = auth.uid()
  ) or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);

-- === RELACIÓN SOLICITUD-FACTURAS (muchas a muchas) ===
create table if not exists funding_request_invoices (
  request_id uuid not null references funding_requests(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, invoice_id)
);
-- Garantizar que cada factura solo pertenezca a una solicitud
create unique index if not exists funding_request_invoices_invoice_unique
  on funding_request_invoices (invoice_id);

alter table funding_request_invoices enable row level security;

-- Políticas: miembros de la empresa o staff pueden ver/insertar
drop policy if exists "fri_member_select" on funding_request_invoices;
create policy "fri_member_select" on funding_request_invoices for select using (
  exists (
    select 1 from memberships m
    join funding_requests fr on fr.id = funding_request_invoices.request_id
    where m.company_id = fr.company_id and m.user_id = auth.uid() and m.status = 'ACTIVE'
  ) or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);

drop policy if exists "fri_member_insert" on funding_request_invoices;
create policy "fri_member_insert" on funding_request_invoices for insert with check (
  (
    exists (
      select 1 from memberships m
      join funding_requests fr on fr.id = funding_request_invoices.request_id
      where m.company_id = fr.company_id and m.user_id = auth.uid() and m.status = 'ACTIVE'
    ) and exists (
      select 1 from memberships m2
      join invoices inv on inv.id = funding_request_invoices.invoice_id
      where m2.company_id = inv.company_id and m2.user_id = auth.uid() and m2.status = 'ACTIVE'
    )
  ) or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);

-- === STORAGE (Bucket de facturas) ===
-- Crear bucket privado para archivos de facturas (si no existe)
do $$ begin
  if not exists (
    select 1 from storage.buckets where id = 'invoices'
  ) then
    insert into storage.buckets (id, name, public) values ('invoices', 'invoices', false);
  end if;
end $$;
-- asegurar límite de tamaño (idempotente)
update storage.buckets set file_size_limit = 10485760 where id = 'invoices';

-- Políticas de acceso: miembros de la organización pueden leer/subir/borrar
-- Convención: el path del archivo inicia con "<company_id>/<nombre-archivo>"
drop policy if exists "invoices_read" on storage.objects;
create policy "invoices_read" on storage.objects for select using (
  bucket_id = 'invoices' and exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.status = 'ACTIVE'
      and (storage.foldername(name))[1] = m.company_id::text
  )
  or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);

drop policy if exists "invoices_insert" on storage.objects;
create policy "invoices_insert" on storage.objects for insert with check (
  bucket_id = 'invoices' and exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.status = 'ACTIVE'
      and (storage.foldername(name))[1] = m.company_id::text
  )
  or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);

drop policy if exists "invoices_update" on storage.objects;
create policy "invoices_update" on storage.objects for update using (
  bucket_id = 'invoices' and exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.status = 'ACTIVE'
      and (storage.foldername(name))[1] = m.company_id::text
  )
  or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);

drop policy if exists "invoices_delete" on storage.objects;
create policy "invoices_delete" on storage.objects for delete using (
  bucket_id = 'invoices' and exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.status = 'ACTIVE'
      and (storage.foldername(name))[1] = m.company_id::text
  )
  or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);

-- === STORAGE (Bucket de solicitudes) ===
do $$ begin
  if not exists (
    select 1 from storage.buckets where id = 'requests'
  ) then
    insert into storage.buckets (id, name, public) values ('requests', 'requests', false);
  end if;
end $$;
update storage.buckets set file_size_limit = 10485760 where id = 'requests';

drop policy if exists "requests_read" on storage.objects;
create policy "requests_read" on storage.objects for select using (
  bucket_id = 'requests' and exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.status = 'ACTIVE'
      and (storage.foldername(name))[1] = m.company_id::text
  )
  or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);

drop policy if exists "requests_insert" on storage.objects;
create policy "requests_insert" on storage.objects for insert with check (
  bucket_id = 'requests' and exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.status = 'ACTIVE'
      and (storage.foldername(name))[1] = m.company_id::text
  )
  or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);

drop policy if exists "requests_update" on storage.objects;
create policy "requests_update" on storage.objects for update using (
  bucket_id = 'requests' and exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.status = 'ACTIVE'
      and (storage.foldername(name))[1] = m.company_id::text
  )
  or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);

drop policy if exists "requests_delete" on storage.objects;
create policy "requests_delete" on storage.objects for delete using (
  bucket_id = 'requests' and exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.status = 'ACTIVE'
      and (storage.foldername(name))[1] = m.company_id::text
  )
  or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);

-- === STORAGE (Bucket de pagadores) ===
do $$ begin
  if not exists (
    select 1 from storage.buckets where id = 'payers'
  ) then
    insert into storage.buckets (id, name, public) values ('payers', 'payers', false);
  end if;
end $$;
update storage.buckets set file_size_limit = 10485760 where id = 'payers';

drop policy if exists "payers_files_read" on storage.objects;
create policy "payers_files_read" on storage.objects for select using (
  bucket_id = 'payers' and exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.status = 'ACTIVE'
      and (storage.foldername(name))[1] = m.company_id::text
  )
  or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);

drop policy if exists "payers_files_insert" on storage.objects;
create policy "payers_files_insert" on storage.objects for insert with check (
  bucket_id = 'payers' and exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.status = 'ACTIVE'
      and (storage.foldername(name))[1] = m.company_id::text
  )
  or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);

drop policy if exists "payers_files_update" on storage.objects;
create policy "payers_files_update" on storage.objects for update using (
  bucket_id = 'payers' and exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.status = 'ACTIVE'
      and (storage.foldername(name))[1] = m.company_id::text
  )
  or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);

drop policy if exists "payers_files_delete" on storage.objects;
create policy "payers_files_delete" on storage.objects for delete using (
  bucket_id = 'payers' and exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.status = 'ACTIVE'
      and (storage.foldername(name))[1] = m.company_id::text
  )
  or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
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

-- === DOCUMENTOS (KYC y contratos) ===
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  request_id uuid references funding_requests(id) on delete set null,
  type text not null,
  status text not null default 'uploaded', -- uploaded | created | signed
  file_path text,
  provider text default 'PANDADOC',
  provider_envelope_id text,
  uploaded_by uuid references profiles(user_id) on delete set null,
  created_at timestamptz not null default now()
);

alter table documents enable row level security;

-- Checks de tipo/estado
alter table documents drop constraint if exists documents_type_check;
alter table documents add constraint documents_type_check
  check (type in ('KYC_RUT','KYC_CAMARA','KYC_CERT_BANCARIA','CONTRATO_MARCO','ANEXO_OPERACION'));
alter table documents drop constraint if exists documents_status_check;
alter table documents add constraint documents_status_check
  check (status in ('uploaded','created','signed'));

-- RLS: miembros u operadores (staff) pueden ver/gestionar
drop policy if exists "documents_member_select" on documents;
create policy "documents_member_select" on documents for select using (
  exists (
    select 1 from memberships m where m.company_id = documents.company_id and m.user_id = auth.uid() and m.status = 'ACTIVE'
  ) or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);
drop policy if exists "documents_member_insert" on documents;
create policy "documents_member_insert" on documents for insert with check (
  (
    exists (
      select 1 from memberships m where m.company_id = documents.company_id and m.user_id = auth.uid() and m.status = 'ACTIVE'
    ) or exists (
      select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
    )
  )
);
drop policy if exists "documents_member_update" on documents;
create policy "documents_member_update" on documents for update using (
  exists (
    select 1 from memberships m where m.company_id = documents.company_id and m.user_id = auth.uid() and m.status = 'ACTIVE'
  ) or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);
drop policy if exists "documents_member_delete" on documents;
create policy "documents_member_delete" on documents for delete using (
  exists (
    select 1 from memberships m where m.company_id = documents.company_id and m.user_id = auth.uid() and m.status = 'ACTIVE'
  ) or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);

-- Buckets de storage para KYC y Contratos
do $$ begin
  if not exists (select 1 from storage.buckets where id = 'kyc') then
    insert into storage.buckets (id, name, public) values ('kyc', 'kyc', false);
  end if;
  if not exists (select 1 from storage.buckets where id = 'contracts') then
    insert into storage.buckets (id, name, public) values ('contracts', 'contracts', false);
  end if;
end $$;
update storage.buckets set file_size_limit = 10485760 where id = 'kyc';
update storage.buckets set file_size_limit = 20971520 where id = 'contracts';

-- Convención de path: <company_id>/...
drop policy if exists "kyc_read" on storage.objects;
create policy "kyc_read" on storage.objects for select using (
  bucket_id = 'kyc' and (
    exists (
      select 1 from memberships m
      where m.user_id = auth.uid() and m.status = 'ACTIVE' and (storage.foldername(name))[1] = m.company_id::text
    ) or exists (
      select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
    )
  )
);
drop policy if exists "kyc_insert" on storage.objects;
create policy "kyc_insert" on storage.objects for insert with check (
  bucket_id = 'kyc' and (
    exists (
      select 1 from memberships m
      where m.user_id = auth.uid() and m.status = 'ACTIVE' and (storage.foldername(name))[1] = m.company_id::text
    ) or exists (
      select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
    )
  )
);
drop policy if exists "kyc_update" on storage.objects;
create policy "kyc_update" on storage.objects for update using (
  bucket_id = 'kyc' and (
    exists (
      select 1 from memberships m
      where m.user_id = auth.uid() and m.status = 'ACTIVE' and (storage.foldername(name))[1] = m.company_id::text
    ) or exists (
      select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
    )
  )
);
drop policy if exists "kyc_delete" on storage.objects;
create policy "kyc_delete" on storage.objects for delete using (
  bucket_id = 'kyc' and (
    exists (
      select 1 from memberships m
      where m.user_id = auth.uid() and m.status = 'ACTIVE' and (storage.foldername(name))[1] = m.company_id::text
    ) or exists (
      select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
    )
  )
);

drop policy if exists "contracts_read" on storage.objects;
create policy "contracts_read" on storage.objects for select using (
  bucket_id = 'contracts' and (
    exists (
      select 1 from memberships m
      where m.user_id = auth.uid() and m.status = 'ACTIVE' and (storage.foldername(name))[1] = m.company_id::text
    ) or exists (
      select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
    )
  )
);
drop policy if exists "contracts_insert" on storage.objects;
create policy "contracts_insert" on storage.objects for insert with check (
  bucket_id = 'contracts' and (
    exists (
      select 1 from memberships m
      where m.user_id = auth.uid() and m.status = 'ACTIVE' and (storage.foldername(name))[1] = m.company_id::text
    ) or exists (
      select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
    )
  )
);
drop policy if exists "contracts_update" on storage.objects;
create policy "contracts_update" on storage.objects for update using (
  bucket_id = 'contracts' and (
    exists (
      select 1 from memberships m
      where m.user_id = auth.uid() and m.status = 'ACTIVE' and (storage.foldername(name))[1] = m.company_id::text
    ) or exists (
      select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
    )
  )
);
drop policy if exists "contracts_delete" on storage.objects;
create policy "contracts_delete" on storage.objects for delete using (
  bucket_id = 'contracts' and (
    exists (
      select 1 from memberships m
      where m.user_id = auth.uid() and m.status = 'ACTIVE' and (storage.foldername(name))[1] = m.company_id::text
    ) or exists (
      select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
    )
  )
);

-- === AUDITORÍA ===
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  actor_id uuid references profiles(user_id) on delete set null,
  entity text not null, -- invoice | request | offer | document | contract
  entity_id uuid,
  action text not null, -- created | updated | status_changed | deleted | signed | funded
  data jsonb,
  created_at timestamptz not null default now()
);

alter table audit_logs enable row level security;
drop policy if exists "audit_member_select" on audit_logs;
create policy "audit_member_select" on audit_logs for select using (
  exists (
    select 1 from memberships m where m.company_id = audit_logs.company_id and m.user_id = auth.uid() and m.status = 'ACTIVE'
  ) or exists (
    select 1 from profiles p where p.user_id = auth.uid() and coalesce(p.is_staff, false) = true
  )
);
drop policy if exists "audit_member_insert" on audit_logs;
create policy "audit_member_insert" on audit_logs for insert with check (
  auth.uid() is not null
);
