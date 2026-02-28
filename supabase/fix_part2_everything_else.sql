-- ================================================================
-- MUZAYID Fix — PART 2 of 2
-- Run this AFTER Part 1 has succeeded.
-- ================================================================

-- ----------------------------------------------------------------
-- FIX 1: Remove blanket UNIQUE on auctions.vehicle_id, replace with
--         partial index so ended vehicles can be re-auctioned.
-- ----------------------------------------------------------------

ALTER TABLE public.auctions
  DROP CONSTRAINT IF EXISTS auctions_vehicle_id_key;

DROP INDEX IF EXISTS auctions_vehicle_active_unique;
CREATE UNIQUE INDEX auctions_vehicle_active_unique
  ON public.auctions (vehicle_id)
  WHERE status NOT IN ('ended', 'settled', 'cancelled');


-- ----------------------------------------------------------------
-- FIX 2: Remove the 5–7 day duration constraint.
-- ----------------------------------------------------------------

ALTER TABLE public.auctions
  DROP CONSTRAINT IF EXISTS auction_duration_check;


-- ----------------------------------------------------------------
-- FIX 3: Vehicle DELETE policies (were missing entirely).
-- ----------------------------------------------------------------

DROP POLICY IF EXISTS "vehicles_delete_admin" ON public.vehicles;
CREATE POLICY "vehicles_delete_admin"
  ON public.vehicles FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "vehicles_delete_own" ON public.vehicles;
CREATE POLICY "vehicles_delete_own"
  ON public.vehicles FOR DELETE
  USING (
    auth.uid() = seller_id
    AND status IN ('pending_review', 'rejected')
  );


-- ----------------------------------------------------------------
-- FIX 4: Change auctions FK to CASCADE so deleting a vehicle also
--         removes its historical auction rows.
-- ----------------------------------------------------------------

ALTER TABLE public.auctions
  DROP CONSTRAINT IF EXISTS auctions_vehicle_id_fkey;

ALTER TABLE public.auctions
  ADD CONSTRAINT auctions_vehicle_id_fkey
  FOREIGN KEY (vehicle_id)
  REFERENCES public.vehicles(id)
  ON DELETE CASCADE;


-- ----------------------------------------------------------------
-- FIX 5: Auction RLS — admin must see ALL statuses (draft/cancelled
--         were invisible, causing the "no auctions" contradiction).
-- ----------------------------------------------------------------

DROP POLICY IF EXISTS "auctions_select_public" ON public.auctions;
CREATE POLICY "auctions_select_public"
  ON public.auctions FOR SELECT
  USING (status IN ('active', 'ended', 'settled', 'upcoming'));

DROP POLICY IF EXISTS "auctions_select_admin" ON public.auctions;
CREATE POLICY "auctions_select_admin"
  ON public.auctions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "auctions_write_admin" ON public.auctions;
CREATE POLICY "auctions_write_admin"
  ON public.auctions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );


-- ----------------------------------------------------------------
-- FIX 6: Normalise vehicle write policies to use is_admin.
-- ----------------------------------------------------------------

DROP POLICY IF EXISTS "vehicles_update_seller_or_admin" ON public.vehicles;
CREATE POLICY "vehicles_update_seller_or_admin"
  ON public.vehicles FOR UPDATE
  USING (
    auth.uid() = seller_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "vehicles_insert_seller" ON public.vehicles;
CREATE POLICY "vehicles_insert_seller"
  ON public.vehicles FOR INSERT
  WITH CHECK (
    auth.uid() = seller_id AND (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('seller', 'admin'))
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
    )
  );


-- ----------------------------------------------------------------
-- FIX 7: Create get_platform_stats() RPC (was missing, homepage
--         was falling back to zeros/dashes).
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS json AS $$
DECLARE
  v_live_count      int;
  v_total_vehicles  int;
  v_active_bidders  int;
BEGIN
  SELECT COUNT(DISTINCT vehicle_id) INTO v_live_count
    FROM public.auctions WHERE status = 'active';

  SELECT COUNT(*) INTO v_total_vehicles
    FROM public.vehicles WHERE status = 'approved';

  SELECT COUNT(*) INTO v_active_bidders
    FROM public.users WHERE bidding_tier > 0;

  RETURN json_build_object(
    'live_count',      v_live_count,
    'total_vehicles',  v_total_vehicles,
    'active_bidders',  v_active_bidders
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO anon, authenticated;


-- ----------------------------------------------------------------
-- FIX 8: Notification preference columns on users.
-- ----------------------------------------------------------------

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notif_new_car       BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notif_outbid        BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS preferred_lang      TEXT    DEFAULT 'en';
