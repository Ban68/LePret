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

-- === PORTAL CLIENTES (mÃ­nimo) ===
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
  investor_kind text check (investor_kind in ('INDIVIDUAL','LEGAL_ENTITY')),
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
alter table companies add column if not exists investor_kind text check (investor_kind in ('INDIVIDUAL','LEGAL_ENTITY'));

create table if not exists bank_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  label text,
  bank_name text not null,
  account_type text not null,
  account_number text not null,
  account_holder_name text not null,
  account_holder_id text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bank_accounts_company_idx on bank_accounts (company_id, created_at desc);
create index if not exists bank_accounts_default_idx on bank_accounts (company_id) where is_default = true;

alter table bank_accounts enable row level security;

drop policy if exists "bank_accounts_select" on bank_accounts;
create policy "bank_accounts_select" on bank_accounts
  for select using (
    exists (
      select 1
      from memberships m
      where m.company_id = bank_accounts.company_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    ) or exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

drop policy if exists "bank_accounts_insert" on bank_accounts;
create policy "bank_accounts_insert" on bank_accounts
  for insert with check (
    exists (
      select 1
      from memberships m
      where m.company_id = bank_accounts.company_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
        and upper(coalesce(m.role, '')) in ('OWNER','ADMIN')
    ) or exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

drop policy if exists "bank_accounts_update" on bank_accounts;
create policy "bank_accounts_update" on bank_accounts
  for update using (
    exists (
      select 1
      from memberships m
      where m.company_id = bank_accounts.company_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
        and upper(coalesce(m.role, '')) in ('OWNER','ADMIN')
    ) or exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  )
  with check (
    exists (
      select 1
      from memberships m
      where m.company_id = bank_accounts.company_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
        and upper(coalesce(m.role, '')) in ('OWNER','ADMIN')
    ) or exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

-- Pagadores (catlogo de pagadores por organizacin)
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

-- Pagadores (catálogo de pagadores por organización)
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

alter table funding_requests add column if not exists disbursement_account_id uuid references bank_accounts(id) on delete set null;
alter table funding_requests add column if not exists disbursed_at timestamptz;

-- payers: miembros activos pueden leer; administracin restringida a owners/admins o staff
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
alter table funding_requests add column if not exists default_discount_rate numeric;
alter table funding_requests add column if not exists default_operation_days integer;
alter table funding_requests add column if not exists default_advance_pct numeric;
alter table funding_requests add column if not exists default_settings_source text;

-- Habilitar RLS
alter table profiles enable row level security;
alter table companies enable row level security;
alter table memberships enable row level security;
alter table payers enable row level security;
alter table invoices enable row level security;
alter table funding_requests enable row level security;

-- PolÃ­ticas bÃ¡sicas
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

-- payers: miembros activos pueden leer; administración restringida a owners/admins o staff
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

-- === RELACIÃN SOLICITUD-FACTURAS (muchas a muchas) ===
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

-- PolÃ­ticas: miembros de la empresa o staff pueden ver/insertar
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

-- === TIMELINE DE SOLICITUDES Y COBRANZA ===
create table if not exists request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references funding_requests(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
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

create index if not exists request_events_request_id_idx on request_events (request_id, occurred_at desc);
create index if not exists request_events_company_idx on request_events (company_id);

alter table request_events enable row level security;

drop policy if exists "request_events_member_select" on request_events;
create policy "request_events_member_select" on request_events
  for select using (
    exists (
      select 1
      from memberships m
      where m.company_id = request_events.company_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    ) or exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

drop policy if exists "request_events_manage_staff" on request_events;
create policy "request_events_manage_staff" on request_events
  for all using (
    exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  )
  with check (
    exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

create table if not exists request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references funding_requests(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
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

create index if not exists request_messages_request_idx on request_messages (request_id, sent_at desc);
create index if not exists request_messages_company_idx on request_messages (company_id);

alter table request_messages enable row level security;

drop policy if exists "request_messages_member_select" on request_messages;
create policy "request_messages_member_select" on request_messages
  for select using (
    exists (
      select 1
      from memberships m
      where m.company_id = request_messages.company_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    ) or exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

drop policy if exists "request_messages_insert_member" on request_messages;
create policy "request_messages_insert_member" on request_messages
  for insert with check (
    (
      exists (
        select 1
        from memberships m
        where m.company_id = request_messages.company_id
          and m.user_id = auth.uid()
          and m.status = 'ACTIVE'
      ) and coalesce(request_messages.sender_id, auth.uid()) = auth.uid()
    ) or exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

drop policy if exists "request_messages_manage_staff" on request_messages;
create policy "request_messages_manage_staff" on request_messages
  for update using (
    exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  )
  with check (
    exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

create table if not exists collection_cases (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references funding_requests(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
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

create index if not exists collection_cases_company_idx on collection_cases (company_id);
create index if not exists collection_cases_request_idx on collection_cases (request_id);
create index if not exists collection_cases_status_idx on collection_cases (status, next_action_at);

alter table collection_cases enable row level security;

drop policy if exists "collection_cases_member_select" on collection_cases;
create policy "collection_cases_member_select" on collection_cases
  for select using (
    exists (
      select 1
      from memberships m
      where m.company_id = collection_cases.company_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    ) or exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

drop policy if exists "collection_cases_manage_staff" on collection_cases;
create policy "collection_cases_manage_staff" on collection_cases
  for all using (
    exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  )
  with check (
    exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

create table if not exists collection_actions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references collection_cases(id) on delete cascade,
  request_id uuid not null references funding_requests(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  action_type text not null,
  note text,
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  created_by_name text,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists collection_actions_case_idx on collection_actions (case_id, created_at desc);
create index if not exists collection_actions_request_idx on collection_actions (request_id);

alter table collection_actions enable row level security;

drop policy if exists "collection_actions_member_select" on collection_actions;
create policy "collection_actions_member_select" on collection_actions
  for select using (
    exists (
      select 1
      from memberships m
      where m.company_id = collection_actions.company_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    ) or exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

drop policy if exists "collection_actions_manage_staff" on collection_actions;
create policy "collection_actions_manage_staff" on collection_actions
  for all using (
    exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  )
  with check (
    exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

create or replace view request_timeline_entries as
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
from request_events e
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
from request_messages m;

create or replace view collection_case_summaries as
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
from collection_cases c
left join funding_requests r on r.id = c.request_id
left join companies comp on comp.id = c.company_id
left join lateral (
  select count(*)::bigint as actions_count
  from collection_actions ca
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
  from collection_actions ca
  where ca.case_id = c.id
  order by ca.created_at desc
  limit 1
) ca_last on true;

-- === STORAGE (Bucket de facturas) ===
-- Crear bucket privado para archivos de facturas (si no existe)
do $$ begin
  if not exists (
    select 1 from storage.buckets where id = 'invoices'
  ) then
    insert into storage.buckets (id, name, public) values ('invoices', 'invoices', false);
  end if;
end $$;
-- asegurar lÃ­mite de tamaÃ±o (idempotente)
update storage.buckets set file_size_limit = 10485760 where id = 'invoices';

-- PolÃ­ticas de acceso: miembros de la organizaciÃ³n pueden leer/subir/borrar
-- ConvenciÃ³n: el path del archivo inicia con "<company_id>/<nombre-archivo>"
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

-- ConvenciÃ³n de path: <company_id>/...
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

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references funding_requests(id) on delete set null,
  company_id uuid not null references companies(id) on delete cascade,
  bank_account_id uuid references bank_accounts(id) on delete set null,
  direction text not null default 'outbound' check (direction in ('outbound','inbound')),
  status text not null default 'pending' check (status in ('pending','in_collection','paid','overdue','cancelled')),
  amount numeric(14,2) not null,
  currency text not null default 'COP',
  due_date date,
  paid_at timestamptz,
  notes text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_company_idx on payments (company_id, created_at desc);
create index if not exists payments_request_idx on payments (request_id);
create index if not exists payments_status_idx on payments (status, due_date);

alter table payments enable row level security;

drop policy if exists "payments_select" on payments;
create policy "payments_select" on payments
  for select using (
    exists (
      select 1
      from memberships m
      where m.company_id = payments.company_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    ) or exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

drop policy if exists "payments_insert" on payments;
create policy "payments_insert" on payments
  for insert with check (
    exists (
      select 1
      from memberships m
      where m.company_id = payments.company_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    ) or exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

drop policy if exists "payments_update" on payments;
create policy "payments_update" on payments
  for update using (
    exists (
      select 1
      from memberships m
      where m.company_id = payments.company_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    ) or exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  )
  with check (
    exists (
      select 1
      from memberships m
      where m.company_id = payments.company_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    ) or exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

-- === NOTIFICACIONES IN-APP ===
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  message text not null,
  data jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on notifications (user_id, created_at desc);
create index if not exists notifications_read_idx on notifications (user_id, is_read);

alter table notifications enable row level security;

drop policy if exists "notifications_select_owner" on notifications;
create policy "notifications_select_owner" on notifications
  for select using (auth.uid() = user_id);

drop policy if exists "notifications_insert_owner" on notifications;
create policy "notifications_insert_owner" on notifications
  for insert with check (auth.uid() = user_id);

drop policy if exists "notifications_update_owner" on notifications;
create policy "notifications_update_owner" on notifications
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "notifications_delete_owner" on notifications;
create policy "notifications_delete_owner" on notifications
  for delete using (auth.uid() = user_id);

-- === HQ CONFIGURACION ===
create table if not exists hq_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users(id)
);

create index if not exists hq_settings_updated_at_idx on hq_settings (updated_at desc);

alter table hq_settings enable row level security;

drop policy if exists "hq_settings_select_staff" on hq_settings;
create policy "hq_settings_select_staff" on hq_settings
  for select using (
    exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

drop policy if exists "hq_settings_modify_staff" on hq_settings;
create policy "hq_settings_modify_staff" on hq_settings
  for all using (
    exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  )
  with check (
    exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

insert into hq_settings (key, value, updated_at, updated_by)
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

create table if not exists hq_company_parameters (
  company_id uuid primary key references companies(id) on delete cascade,
  discount_rate numeric,
  operation_days integer,
  advance_pct numeric,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users(id)
);

create index if not exists hq_company_parameters_updated_at_idx on hq_company_parameters (updated_at desc);

alter table hq_company_parameters enable row level security;

drop policy if exists "hq_company_parameters_select_staff" on hq_company_parameters;
create policy "hq_company_parameters_select_staff" on hq_company_parameters
  for select using (
    exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

drop policy if exists "hq_company_parameters_modify_staff" on hq_company_parameters;
create policy "hq_company_parameters_modify_staff" on hq_company_parameters
  for all using (
    exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  )
  with check (
    exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

-- === CONFIGURACION PORTAL INVERSIONISTAS ===
create table if not exists investor_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  investor_org_id uuid not null references companies(id) on delete cascade,
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

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'investor_bank_accounts'
      and column_name = 'investor_org_id'
  ) then
    alter table investor_bank_accounts
      add column investor_org_id uuid references companies(id) on delete cascade;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'investor_bank_accounts'
      and column_name = 'company_id'
  ) then
    update investor_bank_accounts
    set investor_org_id = company_id
    where investor_org_id is null;

    alter table investor_bank_accounts
      alter column investor_org_id set not null;

    alter table investor_bank_accounts drop column company_id;
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'investor_bank_accounts'
      and column_name = 'investor_org_id'
  ) then
    alter table investor_bank_accounts
      alter column investor_org_id set not null;
  end if;
end;
$$;

create index if not exists investor_bank_accounts_org_idx on investor_bank_accounts (investor_org_id, updated_at desc);
create index if not exists investor_bank_accounts_default_idx on investor_bank_accounts (investor_org_id) where is_default = true;

alter table investor_bank_accounts enable row level security;

drop policy if exists "investor_bank_accounts_select" on investor_bank_accounts;
create policy "investor_bank_accounts_select" on investor_bank_accounts
  for select using (
    exists (
      select 1
      from memberships m
      where m.company_id = investor_bank_accounts.investor_org_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    ) or exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

drop policy if exists "investor_bank_accounts_upsert" on investor_bank_accounts;
create policy "investor_bank_accounts_upsert" on investor_bank_accounts
  for all using (
    exists (
      select 1
      from memberships m
      where m.company_id = investor_bank_accounts.investor_org_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    ) or exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  )
  with check (
    exists (
      select 1
      from memberships m
      where m.company_id = investor_bank_accounts.investor_org_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    ) or exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

create table if not exists investor_notification_preferences (
  id uuid primary key default gen_random_uuid(),
  investor_org_id uuid not null references companies(id) on delete cascade,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  frequency text not null default 'weekly',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists investor_notification_preferences_org_unique on investor_notification_preferences (investor_org_id);

alter table investor_notification_preferences enable row level security;

drop policy if exists "investor_notification_preferences_select" on investor_notification_preferences;
create policy "investor_notification_preferences_select" on investor_notification_preferences
  for select using (
    exists (
      select 1
      from memberships m
      where m.company_id = investor_notification_preferences.investor_org_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    ) or exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

drop policy if exists "investor_notification_preferences_upsert" on investor_notification_preferences;
create policy "investor_notification_preferences_upsert" on investor_notification_preferences
  for all using (
    exists (
      select 1
      from memberships m
      where m.company_id = investor_notification_preferences.investor_org_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    ) or exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  )
  with check (
    exists (
      select 1
      from memberships m
      where m.company_id = investor_notification_preferences.investor_org_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    ) or exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

create table if not exists notification_preferences (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references companies(id) on delete cascade,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  frequency text not null default 'weekly',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists notification_preferences_org_unique on notification_preferences (org_id);

alter table notification_preferences enable row level security;

drop policy if exists "notification_preferences_select" on notification_preferences;
create policy "notification_preferences_select" on notification_preferences
  for select using (
    exists (
      select 1
      from memberships m
      where m.company_id = notification_preferences.org_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    ) or exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

drop policy if exists "notification_preferences_upsert" on notification_preferences;
create policy "notification_preferences_upsert" on notification_preferences
  for all using (
    exists (
      select 1
      from memberships m
      where m.company_id = notification_preferences.org_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    ) or exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  )
  with check (
    exists (
      select 1
      from memberships m
      where m.company_id = notification_preferences.org_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    ) or exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

-- === MODULO INVERSIONISTAS ===
create table if not exists investor_positions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references companies(id) on delete cascade,
  name text not null,
  strategy text,
  invested_amount numeric(18,2) not null default 0,
  current_value numeric(18,2) not null default 0,
  currency text not null default 'COP',
  irr numeric,
  time_weighted_return numeric,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists investor_positions_org_idx on investor_positions (org_id);

alter table investor_positions enable row level security;
alter table investor_positions add column if not exists updated_at timestamptz not null default timezone('utc', now());

drop policy if exists "investor_positions_select_members" on investor_positions;
create policy "investor_positions_select_members" on investor_positions
  for select using (
    exists (
      select 1
      from memberships m
      where m.company_id = investor_positions.org_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    ) or exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

drop policy if exists "investor_positions_manage_staff" on investor_positions;
create policy "investor_positions_manage_staff" on investor_positions
  for all using (
    exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  )
  with check (
    exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

create table if not exists investor_transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references companies(id) on delete cascade,
  position_id uuid references investor_positions(id) on delete set null,
  type text not null check (type in ('contribution','distribution','interest','fee')),
  status text not null default 'pending',
  amount numeric(18,2) not null,
  currency text not null default 'COP',
  date timestamptz,
  tx_date timestamptz,
  description text,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists investor_transactions_org_idx on investor_transactions (org_id, date desc);
create index if not exists investor_transactions_status_idx on investor_transactions (org_id, status);

alter table investor_transactions enable row level security;
alter table investor_transactions add column if not exists updated_at timestamptz not null default timezone('utc', now());

drop policy if exists "investor_transactions_select_members" on investor_transactions;
create policy "investor_transactions_select_members" on investor_transactions
  for select using (
    exists (
      select 1
      from memberships m
      where m.company_id = investor_transactions.org_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    ) or exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

drop policy if exists "investor_transactions_manage_staff" on investor_transactions;
create policy "investor_transactions_manage_staff" on investor_transactions
  for all using (
    exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  )
  with check (
    exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

create table if not exists investor_statements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references companies(id) on delete cascade,
  period text,
  period_label text,
  generated_at timestamptz,
  download_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists investor_statements_org_idx on investor_statements (org_id, generated_at desc);

alter table investor_statements enable row level security;
alter table investor_statements add column if not exists updated_at timestamptz not null default timezone('utc', now());

drop policy if exists "investor_statements_select_members" on investor_statements;
create policy "investor_statements_select_members" on investor_statements
  for select using (
    exists (
      select 1
      from memberships m
      where m.company_id = investor_statements.org_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    ) or exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

drop policy if exists "investor_statements_manage_staff" on investor_statements;
create policy "investor_statements_manage_staff" on investor_statements
  for all using (
    exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  )
  with check (
    exists (
      select 1
      from profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

alter view if exists investor_summary set (security_invoker = true);
alter view if exists investor_vehicle_cashflows set (security_invoker = true);

-- === AUDITORÃA ===
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

