-- Add to your existing schema

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('new_car', 'auction_start', 'outbid', 'won', 'system')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  related_auction_id UUID REFERENCES public.auctions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to users if not present
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS whatsapp_alerts BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS preferred_lang TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Platform stats function
CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'live_count', (SELECT COUNT(*) FROM auctions WHERE status = 'active'),
    'total_vehicles', (SELECT COUNT(*) FROM vehicles WHERE status = 'approved'),
    'active_bidders', (SELECT COUNT(DISTINCT bidder_id) FROM bids 
                       WHERE created_at > NOW() - INTERVAL '30 days')
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_own" ON public.notifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_admin_all" ON public.notifications
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

-- RLS for auctions - ensure public read for active/upcoming
DROP POLICY IF EXISTS "auctions_select_public" ON public.auctions;
CREATE POLICY "auctions_select_public" ON public.auctions
  FOR SELECT TO anon, authenticated
  USING (status IN ('active', 'upcoming', 'ended', 'settled'));

-- RLS for vehicles - ensure public read for approved
DROP POLICY IF EXISTS "vehicles_select_public" ON public.vehicles;
CREATE POLICY "vehicles_select_public" ON public.vehicles
  FOR SELECT TO anon, authenticated
  USING (status = 'approved');

-- Trigger: Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, full_name, email, phone_number, whatsapp_alerts, preferred_lang)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    NEW.email,
    NEW.raw_user_meta_data->>'phone_number',
    COALESCE((NEW.raw_user_meta_data->>'whatsapp_alerts')::boolean, true),
    COALESCE(NEW.raw_user_meta_data->>'preferred_lang', 'en')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone_number = COALESCE(EXCLUDED.phone_number, public.users.phone_number);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing users who have no profile row
INSERT INTO public.users (id, full_name, email)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', 'User'),
  au.email
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.users pu WHERE pu.id = au.id)
ON CONFLICT (id) DO NOTHING;

-- Fix RLS so draft auctions are visible (needed for homepage/auctions page)
DROP POLICY IF EXISTS "auctions_select_public" ON public.auctions;
CREATE POLICY "auctions_select_public" ON public.auctions
  FOR SELECT TO anon, authenticated
  USING (status IN ('active', 'upcoming', 'draft', 'ended', 'settled'));

-- Fix platform stats: total_vehicles = vehicles that have an active/draft auction
CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'live_count', (SELECT COUNT(*) FROM auctions WHERE status = 'active'),
    'total_vehicles', (SELECT COUNT(*) FROM vehicles WHERE status = 'approved'),
    'active_bidders', (SELECT COUNT(DISTINCT bidder_id) FROM bids
                       WHERE created_at > NOW() - INTERVAL '30 days')
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════
-- NOTIFICATION PREFERENCE COLUMNS (add to existing users table)
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notif_new_car BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notif_outbid BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS preferred_lang TEXT DEFAULT 'en' CHECK (preferred_lang IN ('en', 'ar'));

-- ══════════════════════════════════════════════════════════════
-- CATALOG AUCTIONS (Copart-style sequential bidding)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.auction_catalogs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'ended')),
  scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bid_increment   INTEGER NOT NULL DEFAULT 500,   -- EGP
  current_lot_order INTEGER NOT NULL DEFAULT 1,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.catalog_lots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id          UUID NOT NULL REFERENCES public.auction_catalogs(id) ON DELETE CASCADE,
  vehicle_id          UUID NOT NULL REFERENCES public.vehicles(id),
  lot_order           INTEGER NOT NULL,
  status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'sold', 'passed', 'no_sale')),
  starting_price      NUMERIC(12,2) NOT NULL DEFAULT 1000,
  current_bid         NUMERIC(12,2) NOT NULL DEFAULT 0,
  highest_bidder_id   UUID REFERENCES auth.users(id),
  highest_bidder_name TEXT,
  end_time            TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(catalog_id, lot_order)
);

CREATE TABLE IF NOT EXISTS public.catalog_bids (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id  UUID NOT NULL REFERENCES public.auction_catalogs(id) ON DELETE CASCADE,
  lot_id      UUID NOT NULL REFERENCES public.catalog_lots(id) ON DELETE CASCADE,
  bidder_id   UUID NOT NULL REFERENCES auth.users(id),
  amount      NUMERIC(12,2) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS catalog_lots_catalog_id_idx ON public.catalog_lots(catalog_id);
CREATE INDEX IF NOT EXISTS catalog_bids_lot_id_idx ON public.catalog_bids(lot_id);
CREATE INDEX IF NOT EXISTS catalog_bids_catalog_id_idx ON public.catalog_bids(catalog_id);

-- Auto-update highest bid on catalog_lots when a catalog_bid is inserted
CREATE OR REPLACE FUNCTION public.handle_catalog_bid()
RETURNS TRIGGER AS $$
DECLARE
  bidder_name TEXT;
BEGIN
  -- Get bidder's name
  SELECT full_name INTO bidder_name FROM public.users WHERE id = NEW.bidder_id;

  -- Update catalog_lots if this is the new highest bid
  UPDATE public.catalog_lots
  SET
    current_bid = NEW.amount,
    highest_bidder_id = NEW.bidder_id,
    highest_bidder_name = bidder_name,
    updated_at = NOW()
  WHERE id = NEW.lot_id AND NEW.amount > current_bid;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_catalog_bid_insert ON public.catalog_bids;
CREATE TRIGGER on_catalog_bid_insert
  AFTER INSERT ON public.catalog_bids
  FOR EACH ROW EXECUTE FUNCTION public.handle_catalog_bid();

-- RLS
ALTER TABLE public.auction_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_bids ENABLE ROW LEVEL SECURITY;

-- Public read on catalogs and lots
CREATE POLICY "catalog_select_public" ON public.auction_catalogs
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "catalog_lots_select_public" ON public.catalog_lots
  FOR SELECT TO anon, authenticated USING (true);

-- Admin full access
CREATE POLICY "catalog_admin_all" ON public.auction_catalogs
  FOR ALL TO authenticated
  USING ((SELECT is_admin FROM public.users WHERE id = auth.uid()) = true)
  WITH CHECK ((SELECT is_admin FROM public.users WHERE id = auth.uid()) = true);
CREATE POLICY "catalog_lots_admin_all" ON public.catalog_lots
  FOR ALL TO authenticated
  USING ((SELECT is_admin FROM public.users WHERE id = auth.uid()) = true)
  WITH CHECK ((SELECT is_admin FROM public.users WHERE id = auth.uid()) = true);

-- Bids: authenticated can select and insert their own
CREATE POLICY "catalog_bids_select" ON public.catalog_bids
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "catalog_bids_insert" ON public.catalog_bids
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = bidder_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_catalogs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_lots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_bids;

-- ─────────────────────────────────────────────────────────────────
-- CATALOG AUCTIONS (Copart-style sequential live bidding)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.auction_catalogs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'ended')),
  scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_lot_order INT NOT NULL DEFAULT 1,
  bid_increment   INT NOT NULL DEFAULT 500,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.catalog_lots (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  catalog_id          UUID REFERENCES public.auction_catalogs(id) ON DELETE CASCADE,
  vehicle_id          UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  lot_order           INT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'sold', 'passed', 'no_sale')),
  starting_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_bid         NUMERIC(12,2) NOT NULL DEFAULT 0,
  highest_bidder_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  highest_bidder_name TEXT,
  end_time            TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.catalog_bids (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lot_id     UUID REFERENCES public.catalog_lots(id) ON DELETE CASCADE,
  catalog_id UUID REFERENCES public.auction_catalogs(id) ON DELETE CASCADE,
  bidder_id  UUID REFERENCES public.users(id) ON DELETE CASCADE,
  amount     NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: update catalog_lots.current_bid and highest_bidder on new catalog bid
CREATE OR REPLACE FUNCTION public.handle_catalog_bid()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.catalog_lots
  SET current_bid = NEW.amount,
      highest_bidder_id = NEW.bidder_id,
      highest_bidder_name = (SELECT full_name FROM public.users WHERE id = NEW.bidder_id)
  WHERE id = NEW.lot_id AND NEW.amount > current_bid;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_catalog_bid ON public.catalog_bids;
CREATE TRIGGER on_catalog_bid
  AFTER INSERT ON public.catalog_bids
  FOR EACH ROW EXECUTE FUNCTION public.handle_catalog_bid();

-- RLS for catalog tables
ALTER TABLE public.auction_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_select_public" ON public.auction_catalogs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "catalog_lots_select_public" ON public.catalog_lots FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "catalog_bids_select_authenticated" ON public.catalog_bids FOR SELECT TO authenticated USING (true);

CREATE POLICY "catalog_insert_admin" ON public.auction_catalogs FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin FROM public.users WHERE id = auth.uid()));
CREATE POLICY "catalog_update_admin" ON public.auction_catalogs FOR UPDATE TO authenticated
  USING ((SELECT is_admin FROM public.users WHERE id = auth.uid()));
CREATE POLICY "catalog_delete_admin" ON public.auction_catalogs FOR DELETE TO authenticated
  USING ((SELECT is_admin FROM public.users WHERE id = auth.uid()));

CREATE POLICY "catalog_lots_insert_admin" ON public.catalog_lots FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin FROM public.users WHERE id = auth.uid()));
CREATE POLICY "catalog_lots_update_admin" ON public.catalog_lots FOR UPDATE TO authenticated
  USING ((SELECT is_admin FROM public.users WHERE id = auth.uid()));

CREATE POLICY "catalog_bids_insert_authenticated" ON public.catalog_bids FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = bidder_id);

-- ─────────────────────────────────────────────────────────────────
-- NOTIFICATION PREFERENCES on users table
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_notifications  BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notif_new_car         BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notif_outbid          BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS preferred_lang        TEXT DEFAULT 'en' CHECK (preferred_lang IN ('en', 'ar'));

-- ─────────────────────────────────────────────────────────────────
-- Realtime publications
-- ─────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_catalogs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_lots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_bids;
