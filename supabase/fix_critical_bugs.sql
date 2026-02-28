-- ================================================================
-- MUZAYID — Critical Bug Fixes Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ================================================================

-- ----------------------------------------------------------------
-- FIX 1: Remove the UNIQUE constraint on auctions.vehicle_id
--         so a vehicle can be re-auctioned after its first auction ends.
--         Replace it with a PARTIAL UNIQUE INDEX that only prevents
--         two *concurrent* (non-ended/settled) auctions per vehicle.
-- ----------------------------------------------------------------

-- Drop the old blanket unique constraint
ALTER TABLE public.auctions
  DROP CONSTRAINT IF EXISTS auctions_vehicle_id_key;

-- Add a partial unique index: only one active/draft/upcoming auction per vehicle at a time
CREATE UNIQUE INDEX IF NOT EXISTS auctions_vehicle_active_unique
  ON public.auctions (vehicle_id)
  WHERE status NOT IN ('ended', 'settled', 'cancelled');

-- ----------------------------------------------------------------
-- FIX 2: Remove the 5-7 day auction duration constraint.
--         Admins need to set shorter or longer auctions freely.
-- ----------------------------------------------------------------

ALTER TABLE public.auctions
  DROP CONSTRAINT IF EXISTS auction_duration_check;

-- ----------------------------------------------------------------
-- FIX 3: Add vehicle DELETE policy so admins can delete vehicles.
--         Also change auctions.vehicle_id reference to ON DELETE CASCADE
--         so deleting a vehicle automatically removes its auction history.
-- ----------------------------------------------------------------

-- RLS DELETE policy for vehicles (admin only)
DROP POLICY IF EXISTS "vehicles_delete_admin" ON public.vehicles;
CREATE POLICY "vehicles_delete_admin"
  ON public.vehicles FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

-- Also allow sellers to delete their own pending/rejected vehicles
DROP POLICY IF EXISTS "vehicles_delete_own" ON public.vehicles;
CREATE POLICY "vehicles_delete_own"
  ON public.vehicles FOR DELETE
  USING (
    auth.uid() = seller_id
    AND status IN ('pending_review', 'rejected')
  );

-- Change the FK to CASCADE so deleting a vehicle cascades to its auctions.
-- (Only safe once the unique constraint above is fixed.)
ALTER TABLE public.auctions
  DROP CONSTRAINT IF EXISTS auctions_vehicle_id_fkey;

ALTER TABLE public.auctions
  ADD CONSTRAINT auctions_vehicle_id_fkey
  FOREIGN KEY (vehicle_id)
  REFERENCES public.vehicles(id)
  ON DELETE CASCADE;

-- ----------------------------------------------------------------
-- FIX 4: Add 'cancelled' and 'upcoming' to auction_status enum
--         so we can properly cancel auctions and schedule future ones.
-- ----------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'cancelled'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'auction_status')
  ) THEN
    ALTER TYPE public.auction_status ADD VALUE 'cancelled';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'upcoming'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'auction_status')
  ) THEN
    ALTER TYPE public.auction_status ADD VALUE 'upcoming';
  END IF;
END$$;

-- ----------------------------------------------------------------
-- FIX 5: Add 'settled' and 'cancelled' to auctions RLS select
--         so admin live-control can see all auctions.
-- ----------------------------------------------------------------

DROP POLICY IF EXISTS "auctions_select_public" ON public.auctions;
CREATE POLICY "auctions_select_public"
  ON public.auctions FOR SELECT
  USING (status IN ('active', 'ended', 'settled', 'upcoming'));

-- Make sure admin can still see ALL statuses including draft/cancelled
DROP POLICY IF EXISTS "auctions_select_admin" ON public.auctions;
CREATE POLICY "auctions_select_admin"
  ON public.auctions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

-- ----------------------------------------------------------------
-- FIX 6: Add is_admin column support in RLS policies
--         (some policies use role = 'admin', others use is_admin = true —
--          normalise to is_admin throughout)
-- ----------------------------------------------------------------

-- Re-create vehicle policies using is_admin for consistency
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
-- FIX 7: Create get_platform_stats() RPC used by the homepage.
--         Returns accurate counts that match what the UI labels say.
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS json AS $$
DECLARE
  v_live_count      int;
  v_total_vehicles  int;
  v_active_bidders  int;
BEGIN
  -- Vehicles with an active (live) auction
  SELECT COUNT(DISTINCT vehicle_id) INTO v_live_count
    FROM public.auctions WHERE status = 'active';

  -- All approved vehicles (in inventory or listed)
  SELECT COUNT(*) INTO v_total_vehicles
    FROM public.vehicles WHERE status = 'approved';

  -- Users with bidding tier > 0 (have made a deposit)
  SELECT COUNT(*) INTO v_active_bidders
    FROM public.users WHERE bidding_tier > 0;

  RETURN json_build_object(
    'live_count',      v_live_count,
    'total_vehicles',  v_total_vehicles,
    'active_bidders',  v_active_bidders
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to anon and authenticated
GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO anon, authenticated;
