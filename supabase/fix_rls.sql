-- ============================================================
-- MUZAYID — Fix: Homepage shows no auctions + RLS policies
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. The homepage wasn't showing auctions because the RLS policy
--    only allowed SELECT on status IN ('active','ended','settled')
--    but the JOIN to vehicles also requires vehicles to be readable.
--    Let's fix both.

-- Drop old policies
drop policy if exists "auctions_select_public" on public.auctions;
drop policy if exists "vehicles_select_approved" on public.vehicles;
drop policy if exists "vehicles_select_own" on public.vehicles;

-- Auctions: anyone can read active/ended/settled auctions
create policy "auctions_select_public"
  on public.auctions for select
  using (status in ('active', 'ended', 'settled'));

-- Also allow draft auctions to be read (for pre-auction research page)
-- Comment the above and uncomment below if you want drafts visible too:
-- create policy "auctions_select_public" on public.auctions for select using (true);

-- Vehicles: anyone can read approved vehicles
create policy "vehicles_select_approved"
  on public.vehicles for select
  using (status = 'approved');

-- Vehicle owners can see their own vehicles
create policy "vehicles_select_own"
  on public.vehicles for select
  using (auth.uid() = seller_id);

-- Admins can see all vehicles
create policy "vehicles_select_admin"
  on public.vehicles for select
  using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- Admins can update vehicles (for approving/rejecting)
drop policy if exists "vehicles_update_admin" on public.vehicles;
create policy "vehicles_update_admin"
  on public.vehicles for update
  using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- Admins can insert vehicles on behalf of sellers
drop policy if exists "vehicles_insert_admin" on public.vehicles;
create policy "vehicles_insert_admin"
  on public.vehicles for insert
  with check (
    auth.uid() = seller_id or
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- Auctions: admins can do everything
drop policy if exists "auctions_insert_admin" on public.auctions;
drop policy if exists "auctions_update_admin" on public.auctions;

create policy "auctions_insert_admin"
  on public.auctions for insert
  with check (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "auctions_update_admin"
  on public.auctions for update
  using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- Transactions: admins can update (for deposit approvals)
drop policy if exists "transactions_update_admin" on public.transactions;
create policy "transactions_update_admin"
  on public.transactions for update
  using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- Users: admins can read and update all users
drop policy if exists "users_select_admin" on public.users;
drop policy if exists "users_update_admin" on public.users;
create policy "users_select_admin"
  on public.users for select
  using (
    auth.uid() = id or
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );
create policy "users_update_admin"
  on public.users for update
  using (
    auth.uid() = id or
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- Bids: admins can read all
drop policy if exists "bids_select_admin" on public.bids;
create policy "bids_select_admin"
  on public.bids for select
  using (
    true -- bids are already public, this is redundant but explicit
  );

-- Auction entries: admins can read all
drop policy if exists "entries_select_admin" on public.auction_entries;
create policy "entries_select_admin"
  on public.auction_entries for select
  using (
    auth.uid() = user_id or
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- 2. Verify current auctions are visible
--    Run this to check — should return your auctions
-- ============================================================
select a.id, a.status, v.make, v.model, v.year, v.status as vehicle_status
from public.auctions a
join public.vehicles v on v.id = a.vehicle_id
order by a.created_at desc
limit 10;
