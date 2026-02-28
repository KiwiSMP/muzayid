-- ================================================================
-- MUZAYID — Catalog Auction Tables
-- Run this once in Supabase SQL Editor (Dashboard → SQL Editor)
-- ================================================================

-- 1. CATALOG AUCTIONS (the session/event)
CREATE TABLE IF NOT EXISTS public.auction_catalogs (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title               TEXT NOT NULL,
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled', 'active', 'ended')),
  scheduled_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_lot_order   INT NOT NULL DEFAULT 1,
  bid_increment       INT NOT NULL DEFAULT 500,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CATALOG LOTS (individual vehicles in a catalog session)
CREATE TABLE IF NOT EXISTS public.catalog_lots (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  catalog_id          UUID NOT NULL REFERENCES public.auction_catalogs(id) ON DELETE CASCADE,
  vehicle_id          UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  lot_order           INT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'active', 'sold', 'passed', 'no_sale')),
  starting_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_bid         NUMERIC(12,2) NOT NULL DEFAULT 0,
  highest_bidder_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  highest_bidder_name TEXT,
  end_time            TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CATALOG BIDS (bids placed during a catalog session)
CREATE TABLE IF NOT EXISTS public.catalog_bids (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lot_id      UUID NOT NULL REFERENCES public.catalog_lots(id) ON DELETE CASCADE,
  catalog_id  UUID NOT NULL REFERENCES public.auction_catalogs(id) ON DELETE CASCADE,
  bidder_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount      NUMERIC(12,2) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. INDEXES for performance
CREATE INDEX IF NOT EXISTS catalog_lots_catalog_id_idx ON public.catalog_lots(catalog_id);
CREATE INDEX IF NOT EXISTS catalog_lots_status_idx     ON public.catalog_lots(status);
CREATE INDEX IF NOT EXISTS catalog_bids_lot_id_idx     ON public.catalog_bids(lot_id);
CREATE INDEX IF NOT EXISTS catalog_bids_catalog_id_idx ON public.catalog_bids(catalog_id);

-- 5. TRIGGER — auto-update highest bid on catalog_lots when a bid is placed
CREATE OR REPLACE FUNCTION public.handle_catalog_bid()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.catalog_lots
  SET
    current_bid         = NEW.amount,
    highest_bidder_id   = NEW.bidder_id,
    highest_bidder_name = (SELECT full_name FROM public.users WHERE id = NEW.bidder_id)
  WHERE id = NEW.lot_id
    AND NEW.amount > current_bid;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_catalog_bid_insert ON public.catalog_bids;
CREATE TRIGGER on_catalog_bid_insert
  AFTER INSERT ON public.catalog_bids
  FOR EACH ROW EXECUTE FUNCTION public.handle_catalog_bid();

-- 6. ROW LEVEL SECURITY
ALTER TABLE public.auction_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_lots     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_bids     ENABLE ROW LEVEL SECURITY;

-- Public can read catalogs and lots
DROP POLICY IF EXISTS "catalog_select_public"      ON public.auction_catalogs;
DROP POLICY IF EXISTS "catalog_lots_select_public" ON public.catalog_lots;
CREATE POLICY "catalog_select_public"      ON public.auction_catalogs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "catalog_lots_select_public" ON public.catalog_lots     FOR SELECT TO anon, authenticated USING (true);

-- Authenticated users can read bids and place their own
DROP POLICY IF EXISTS "catalog_bids_select"        ON public.catalog_bids;
DROP POLICY IF EXISTS "catalog_bids_insert"        ON public.catalog_bids;
CREATE POLICY "catalog_bids_select" ON public.catalog_bids FOR SELECT TO authenticated USING (true);
CREATE POLICY "catalog_bids_insert" ON public.catalog_bids FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = bidder_id);

-- Only admins can create/update/delete catalogs and lots
DROP POLICY IF EXISTS "catalog_admin_all"      ON public.auction_catalogs;
DROP POLICY IF EXISTS "catalog_lots_admin_all" ON public.catalog_lots;
CREATE POLICY "catalog_admin_all" ON public.auction_catalogs FOR ALL TO authenticated
  USING     ((SELECT is_admin FROM public.users WHERE id = auth.uid()))
  WITH CHECK ((SELECT is_admin FROM public.users WHERE id = auth.uid()));
CREATE POLICY "catalog_lots_admin_all" ON public.catalog_lots FOR ALL TO authenticated
  USING     ((SELECT is_admin FROM public.users WHERE id = auth.uid()))
  WITH CHECK ((SELECT is_admin FROM public.users WHERE id = auth.uid()));

-- 7. NOTIFICATION PREFERENCE COLUMNS (safe to run if already added)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notif_new_car       BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notif_outbid        BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS preferred_lang      TEXT    DEFAULT 'en'
    CHECK (preferred_lang IN ('en', 'ar'));

-- 8. REALTIME
-- (ignore "already member" errors — safe to run multiple times)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_catalogs;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_lots;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_bids;
EXCEPTION WHEN others THEN NULL;
END $$;
