-- Migration: Optimize RLS policies for performance (wrapping auth.uid() interactions)

-- 1. Profiles
drop policy if exists "profiles_self_select" on profiles;
create policy "profiles_self_select" on profiles for select using ((select auth.uid()) = user_id);

drop policy if exists "profiles_self_update" on profiles;
create policy "profiles_self_update" on profiles for update using ((select auth.uid()) = user_id);

drop policy if exists "profiles_self_insert" on profiles;
create policy "profiles_self_insert" on profiles for insert with check ((select auth.uid()) = user_id);

-- 2. Memberships
drop policy if exists "memberships_self_select" on memberships;
create policy "memberships_self_select" on memberships for select using ((select auth.uid()) = user_id);

-- 3. Companies
drop policy if exists "companies_member_select" on companies;
create policy "companies_member_select" on companies for select using (
  exists (
    select 1 from memberships m where m.company_id = id and m.user_id = (select auth.uid()) and m.status = 'ACTIVE'
  ) or exists (
    select 1 from profiles p where p.user_id = (select auth.uid()) and coalesce(p.is_staff, false) = true
  )
);

-- 4. Payers
drop policy if exists "payers_member_select" on payers;
create policy "payers_member_select" on payers for select using (
  exists (
    select 1 from memberships m where m.company_id = payers.company_id and m.user_id = (select auth.uid()) and m.status = 'ACTIVE'
  ) or exists (
    select 1 from profiles p where p.user_id = (select auth.uid()) and coalesce(p.is_staff, false) = true
  )
);

drop policy if exists "payers_manager_insert" on payers;
create policy "payers_manager_insert" on payers for insert with check (
  exists (
    select 1 from memberships m
    where m.company_id = payers.company_id
      and m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and upper(m.role) in ('OWNER','ADMIN')
  ) or exists (
    select 1 from profiles p where p.user_id = (select auth.uid()) and coalesce(p.is_staff, false) = true
  )
);

drop policy if exists "payers_manager_update" on payers;
create policy "payers_manager_update" on payers for update using (
  exists (
    select 1 from memberships m
    where m.company_id = payers.company_id
      and m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and upper(m.role) in ('OWNER','ADMIN')
  ) or payers.created_by = (select auth.uid()) or exists (
    select 1 from profiles p where p.user_id = (select auth.uid()) and coalesce(p.is_staff, false) = true
  )
) with check (
  exists (
    select 1 from memberships m
    where m.company_id = payers.company_id
      and m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and upper(m.role) in ('OWNER','ADMIN')
  ) or payers.created_by = (select auth.uid()) or exists (
    select 1 from profiles p where p.user_id = (select auth.uid()) and coalesce(p.is_staff, false) = true
  )
);

drop policy if exists "payers_manager_delete" on payers;
create policy "payers_manager_delete" on payers for delete using (
  exists (
    select 1 from memberships m
    where m.company_id = payers.company_id
      and m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and upper(m.role) in ('OWNER','ADMIN')
  ) or payers.created_by = (select auth.uid()) or exists (
    select 1 from profiles p where p.user_id = (select auth.uid()) and coalesce(p.is_staff, false) = true
  )
);

-- 5. Invoices
drop policy if exists "invoices_member_select" on invoices;
create policy "invoices_member_select" on invoices for select using (
  exists (
    select 1 from memberships m where m.company_id = invoices.company_id and m.user_id = (select auth.uid()) and m.status = 'ACTIVE'
  ) or exists (
    select 1 from profiles p where p.user_id = (select auth.uid()) and coalesce(p.is_staff, false) = true
  )
);

drop policy if exists "invoices_member_insert" on invoices;
create policy "invoices_member_insert" on invoices for insert with check (
  (
    exists (
      select 1 from memberships m where m.company_id = invoices.company_id and m.user_id = (select auth.uid()) and m.status = 'ACTIVE'
    ) or exists (
      select 1 from profiles p where p.user_id = (select auth.uid()) and coalesce(p.is_staff, false) = true
    )
  ) and created_by = (select auth.uid())
);

drop policy if exists "invoices_author_update" on invoices;
create policy "invoices_author_update" on invoices for update using (
  created_by = (select auth.uid()) or exists (
    select 1 from profiles p where p.user_id = (select auth.uid()) and coalesce(p.is_staff, false) = true
  )
);

drop policy if exists "invoices_author_delete" on invoices;
create policy "invoices_author_delete" on invoices for delete using (
  created_by = (select auth.uid()) or exists (
    select 1 from profiles p where p.user_id = (select auth.uid()) and coalesce(p.is_staff, false) = true
  )
);

-- 6. Funding Requests
drop policy if exists "fr_member_select" on funding_requests;
create policy "fr_member_select" on funding_requests for select using (
  exists (
    select 1 from memberships m where m.company_id = funding_requests.company_id and m.user_id = (select auth.uid()) and m.status = 'ACTIVE'
  ) or exists (
    select 1 from profiles p where p.user_id = (select auth.uid()) and coalesce(p.is_staff, false) = true
  )
);

drop policy if exists "fr_member_insert" on funding_requests;
create policy "fr_member_insert" on funding_requests for insert with check (
  (
    exists (
      select 1 from memberships m where m.company_id = funding_requests.company_id and m.user_id = (select auth.uid()) and m.status = 'ACTIVE'
    ) or exists (
      select 1 from profiles p where p.user_id = (select auth.uid()) and coalesce(p.is_staff, false) = true
    )
  ) and created_by = (select auth.uid())
);

drop policy if exists "fr_author_update" on funding_requests;
create policy "fr_author_update" on funding_requests for update using (
  created_by = (select auth.uid()) or exists (
    select 1 from profiles p where p.user_id = (select auth.uid()) and coalesce(p.is_staff, false) = true
  )
);

drop policy if exists "fr_author_delete" on funding_requests;
create policy "fr_author_delete" on funding_requests for delete using (
  created_by = (select auth.uid()) or exists (
    select 1 from profiles p where p.user_id = (select auth.uid()) and coalesce(p.is_staff, false) = true
  )
);

-- 7. Offers
drop policy if exists "offers_member_select" on offers;
create policy "offers_member_select" on offers for select using (
  exists (
    select 1 from memberships m where m.company_id = offers.company_id and m.user_id = (select auth.uid())
  ) or exists (
    select 1 from profiles p where p.user_id = (select auth.uid()) and coalesce(p.is_staff, false) = true
  )
);

drop policy if exists "offers_member_insert" on offers;
create policy "offers_member_insert" on offers for insert with check (
  (
    exists (
      select 1 from memberships m where m.company_id = offers.company_id and m.user_id = (select auth.uid())
    ) or exists (
      select 1 from profiles p where p.user_id = (select auth.uid()) and coalesce(p.is_staff, false) = true
    )
  ) and created_by = (select auth.uid())
);

drop policy if exists "offers_member_update" on offers;
create policy "offers_member_update" on offers for update using (
  exists (
    select 1 from memberships m where m.company_id = offers.company_id and m.user_id = (select auth.uid())
  ) or exists (
    select 1 from profiles p where p.user_id = (select auth.uid()) and coalesce(p.is_staff, false) = true
  )
);

-- 8. Funding Request Invoices
drop policy if exists "fri_member_select" on funding_request_invoices;
create policy "fri_member_select" on funding_request_invoices for select using (
  exists (
    select 1 from memberships m
    join funding_requests fr on fr.id = funding_request_invoices.request_id
    where m.company_id = fr.company_id and m.user_id = (select auth.uid()) and m.status = 'ACTIVE'
  ) or exists (
    select 1 from profiles p where p.user_id = (select auth.uid()) and coalesce(p.is_staff, false) = true
  )
);

drop policy if exists "fri_member_insert" on funding_request_invoices;
create policy "fri_member_insert" on funding_request_invoices for insert with check (
  (
    exists (
      select 1 from memberships m
      join funding_requests fr on fr.id = funding_request_invoices.request_id
      where m.company_id = fr.company_id and m.user_id = (select auth.uid()) and m.status = 'ACTIVE'
    ) and exists (
      select 1 from memberships m2
      join invoices inv on inv.id = funding_request_invoices.invoice_id
      where m2.company_id = inv.company_id and m2.user_id = (select auth.uid()) and m2.status = 'ACTIVE'
    )
  ) or exists (
    select 1 from profiles p where p.user_id = (select auth.uid()) and coalesce(p.is_staff, false) = true
  )
);
