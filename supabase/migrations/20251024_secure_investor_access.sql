-- Migration: enforce invoker security for investor views and enable RLS on key tables

-- Ensure investor-facing views execute with the permissions of the caller
alter view if exists public.investor_summary
  set (security_invoker = true);

alter view if exists public.investor_vehicle_cashflows
  set (security_invoker = true);

-- Harden notifications table with row level security
alter table if exists public.notifications enable row level security;

drop policy if exists "notifications_select_owner" on public.notifications;
create policy "notifications_select_owner" on public.notifications
  for select
  using (auth.uid() = user_id);

drop policy if exists "notifications_insert_owner" on public.notifications;
create policy "notifications_insert_owner" on public.notifications
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "notifications_update_owner" on public.notifications;
create policy "notifications_update_owner" on public.notifications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "notifications_delete_owner" on public.notifications;
create policy "notifications_delete_owner" on public.notifications
  for delete
  using (auth.uid() = user_id);

-- Guard investor transactions with row level security
alter table if exists public.investor_transactions enable row level security;

drop policy if exists "investor_transactions_select_members" on public.investor_transactions;
create policy "investor_transactions_select_members" on public.investor_transactions
  for select
  using (
    exists (
      select 1
      from public.memberships m
      where m.company_id = investor_transactions.org_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    )
    or exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

drop policy if exists "investor_transactions_modify_staff" on public.investor_transactions;
create policy "investor_transactions_modify_staff" on public.investor_transactions
  for all
  using (
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

-- Guard investor statements with row level security
alter table if exists public.investor_statements enable row level security;

drop policy if exists "investor_statements_select_members" on public.investor_statements;
create policy "investor_statements_select_members" on public.investor_statements
  for select
  using (
    exists (
      select 1
      from public.memberships m
      where m.company_id = investor_statements.org_id
        and m.user_id = auth.uid()
        and m.status = 'ACTIVE'
    )
    or exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and coalesce(p.is_staff, false) = true
    )
  );

drop policy if exists "investor_statements_modify_staff" on public.investor_statements;
create policy "investor_statements_modify_staff" on public.investor_statements
  for all
  using (
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
