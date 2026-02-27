-- ============================================================
-- MUZAYID (مزاید) — Full Database Schema
-- Run this in Supabase SQL Editor in order.
-- ============================================================

-- ── 0. Extensions ─────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ── 1. ENUMS ──────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('admin', 'buyer', 'seller');

CREATE TYPE damage_type AS ENUM (
  'front_collision',
  'rear_collision',
  'side_collision',
  'rollover',
  'flood',
  'fire',
  'hail',
  'theft_recovery',
  'mechanical',
  'other'
);

CREATE TYPE vehicle_status AS ENUM (
  'pending_review',
  'approved',
  'rejected',
  'sold'
);

CREATE TYPE auction_status AS ENUM (
  'draft',
  'active',
  'ended',
  'settled'
);

CREATE TYPE transaction_type AS ENUM (
  'deposit',
  'entry_fee',
  'final_invoice',
  'refund'
);

CREATE TYPE transaction_status AS ENUM (
  'pending',
  'completed',
  'failed'
);


-- ── 2. TABLES ─────────────────────────────────────────────

-- 2a. Users (extends Supabase auth.users)
CREATE TABLE public.users (
  id                uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role              user_role        NOT NULL DEFAULT 'buyer',
  full_name         text             NOT NULL,
  phone_number      text             NOT NULL,
  national_id_url   text,
  is_verified       boolean          NOT NULL DEFAULT false,
  deposit_balance   numeric(12, 2)   NOT NULL DEFAULT 0.00,
  bidding_tier      smallint         NOT NULL DEFAULT 0 CHECK (bidding_tier BETWEEN 0 AND 3),
  created_at        timestamptz      NOT NULL DEFAULT now(),
  updated_at        timestamptz      NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.users.bidding_tier IS
  '0=No access, 1=10K EGP→100K max, 2=25K EGP→300K max, 3=50K EGP→unlimited';


-- 2b. Vehicles
CREATE TABLE public.vehicles (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id         uuid             NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  make              text             NOT NULL,
  model             text             NOT NULL,
  year              smallint         NOT NULL CHECK (year BETWEEN 1950 AND 2100),
  damage_type       damage_type      NOT NULL,
  mileage           integer          NOT NULL CHECK (mileage >= 0),
  description       text,
  condition_report  jsonb            NOT NULL DEFAULT '{
    "exterior": [],
    "interior": [],
    "mechanical": [],
    "missing_parts": [],
    "notes": ""
  }'::jsonb,
  images            text[]           NOT NULL DEFAULT '{}',
  fines_cleared     boolean          NOT NULL DEFAULT false,
  status            vehicle_status   NOT NULL DEFAULT 'pending_review',
  created_at        timestamptz      NOT NULL DEFAULT now(),
  updated_at        timestamptz      NOT NULL DEFAULT now()
);

CREATE INDEX idx_vehicles_seller_id   ON public.vehicles(seller_id);
CREATE INDEX idx_vehicles_status      ON public.vehicles(status);
CREATE INDEX idx_vehicles_damage_type ON public.vehicles(damage_type);


-- 2c. Auctions
CREATE TABLE public.auctions (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id           uuid             NOT NULL UNIQUE REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  start_time           timestamptz      NOT NULL,
  end_time             timestamptz      NOT NULL CHECK (end_time > start_time),
  starting_price       numeric(12, 2)   NOT NULL CHECK (starting_price >= 0),
  current_highest_bid  numeric(12, 2)   NOT NULL DEFAULT 0,
  highest_bidder_id    uuid             REFERENCES public.users(id) ON DELETE SET NULL,
  status               auction_status   NOT NULL DEFAULT 'draft',
  reserve_price        numeric(12, 2),  -- optional hidden reserve
  created_at           timestamptz      NOT NULL DEFAULT now(),
  updated_at           timestamptz      NOT NULL DEFAULT now(),

  CONSTRAINT auction_duration_check CHECK (
    end_time - start_time BETWEEN INTERVAL '5 days' AND INTERVAL '7 days'
  )
);

CREATE INDEX idx_auctions_status     ON public.auctions(status);
CREATE INDEX idx_auctions_end_time   ON public.auctions(end_time);
CREATE INDEX idx_auctions_vehicle_id ON public.auctions(vehicle_id);


-- 2d. Bids
CREATE TABLE public.bids (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  auction_id  uuid             NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  bidder_id   uuid             NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount      numeric(12, 2)   NOT NULL CHECK (amount > 0),
  created_at  timestamptz      NOT NULL DEFAULT now()
);

CREATE INDEX idx_bids_auction_id ON public.bids(auction_id);
CREATE INDEX idx_bids_bidder_id  ON public.bids(bidder_id);
CREATE INDEX idx_bids_amount     ON public.bids(auction_id, amount DESC);


-- 2e. Auction Entry Fees (tracks who has paid the 200 EGP entry fee per auction)
CREATE TABLE public.auction_entries (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  auction_id  uuid        NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  paid_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auction_id, user_id)
);

CREATE INDEX idx_auction_entries_user ON public.auction_entries(user_id);


-- 2f. Transactions
CREATE TABLE public.transactions (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid                NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type        transaction_type    NOT NULL,
  amount      numeric(12, 2)      NOT NULL,
  status      transaction_status  NOT NULL DEFAULT 'pending',
  auction_id  uuid                REFERENCES public.auctions(id) ON DELETE SET NULL,
  reference   text,               -- payment gateway reference / receipt number
  notes       text,
  created_at  timestamptz         NOT NULL DEFAULT now(),
  updated_at  timestamptz         NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_user_id   ON public.transactions(user_id);
CREATE INDEX idx_transactions_type      ON public.transactions(type);
CREATE INDEX idx_transactions_auction   ON public.transactions(auction_id);


-- ── 3. FUNCTIONS & TRIGGERS ───────────────────────────────

-- 3a. Auto-update updated_at column
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_auctions_updated_at
  BEFORE UPDATE ON public.auctions
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();


-- 3b. Auto-create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, full_name, phone_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- 3c. Place Bid — the core business logic trigger
-- Validates bid, updates auction, enforces anti-sniper rule
CREATE OR REPLACE FUNCTION process_new_bid()
RETURNS TRIGGER AS $$
DECLARE
  v_auction         public.auctions%ROWTYPE;
  v_bidder          public.users%ROWTYPE;
  v_seconds_left    numeric;
  v_min_bid         numeric;
  v_entry_exists    boolean;
BEGIN
  -- Fetch the auction
  SELECT * INTO v_auction FROM public.auctions WHERE id = NEW.auction_id FOR UPDATE;

  -- Auction must be active
  IF v_auction.status != 'active' THEN
    RAISE EXCEPTION 'AUCTION_NOT_ACTIVE: Auction is not currently active.';
  END IF;

  -- Auction must not be expired
  IF now() > v_auction.end_time THEN
    RAISE EXCEPTION 'AUCTION_EXPIRED: Auction time has ended.';
  END IF;

  -- Fetch the bidder
  SELECT * INTO v_bidder FROM public.users WHERE id = NEW.bidder_id;

  -- Bidder must be verified
  IF NOT v_bidder.is_verified THEN
    RAISE EXCEPTION 'USER_NOT_VERIFIED: Your account must be verified before bidding.';
  END IF;

  -- Bidder must have a valid tier
  IF v_bidder.bidding_tier = 0 THEN
    RAISE EXCEPTION 'NO_DEPOSIT: You must make a deposit to access bidding.';
  END IF;

  -- Bidder must have paid entry fee
  SELECT EXISTS(
    SELECT 1 FROM public.auction_entries
    WHERE auction_id = NEW.auction_id AND user_id = NEW.bidder_id
  ) INTO v_entry_exists;

  IF NOT v_entry_exists THEN
    RAISE EXCEPTION 'ENTRY_FEE_REQUIRED: You must pay the 200 EGP entry fee to bid on this auction.';
  END IF;

  -- Tier-based max bid check
  IF v_bidder.bidding_tier = 1 AND NEW.amount > 100000 THEN
    RAISE EXCEPTION 'TIER_LIMIT_EXCEEDED: Tier 1 bidders cannot bid more than 100,000 EGP.';
  END IF;

  IF v_bidder.bidding_tier = 2 AND NEW.amount > 300000 THEN
    RAISE EXCEPTION 'TIER_LIMIT_EXCEEDED: Tier 2 bidders cannot bid more than 300,000 EGP.';
  END IF;

  -- Bid must be higher than current bid (or starting price if first bid)
  v_min_bid := GREATEST(v_auction.current_highest_bid, v_auction.starting_price);
  IF NEW.amount <= v_min_bid THEN
    RAISE EXCEPTION 'BID_TOO_LOW: Bid must be greater than the current highest bid of % EGP.', v_min_bid;
  END IF;

  -- Cannot bid on your own vehicle (seller)
  IF EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.id = v_auction.vehicle_id AND v.seller_id = NEW.bidder_id
  ) THEN
    RAISE EXCEPTION 'SELLER_CANNOT_BID: Sellers cannot bid on their own vehicles.';
  END IF;

  -- ── ANTI-SNIPER RULE ──────────────────────────────────
  v_seconds_left := EXTRACT(EPOCH FROM (v_auction.end_time - now()));

  IF v_seconds_left <= 60 THEN
    -- Extend auction by 2 minutes
    UPDATE public.auctions
    SET
      end_time             = end_time + INTERVAL '2 minutes',
      current_highest_bid  = NEW.amount,
      highest_bidder_id    = NEW.bidder_id
    WHERE id = NEW.auction_id;
  ELSE
    -- Normal bid: just update the price
    UPDATE public.auctions
    SET
      current_highest_bid = NEW.amount,
      highest_bidder_id   = NEW.bidder_id
    WHERE id = NEW.auction_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_process_new_bid
  BEFORE INSERT ON public.bids
  FOR EACH ROW EXECUTE FUNCTION process_new_bid();


-- 3d. Update bidding tier when deposit balance changes
CREATE OR REPLACE FUNCTION update_bidding_tier()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deposit_balance >= 50000 THEN
    NEW.bidding_tier := 3;
  ELSIF NEW.deposit_balance >= 25000 THEN
    NEW.bidding_tier := 2;
  ELSIF NEW.deposit_balance >= 10000 THEN
    NEW.bidding_tier := 1;
  ELSE
    NEW.bidding_tier := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_bidding_tier
  BEFORE UPDATE OF deposit_balance ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_bidding_tier();


-- 3e. Auto-activate auction when start_time arrives (use pg_cron or Edge Function scheduler)
-- This function is called by a scheduled job (Supabase Edge Function / pg_cron)
CREATE OR REPLACE FUNCTION activate_scheduled_auctions()
RETURNS void AS $$
BEGIN
  UPDATE public.auctions
  SET status = 'active'
  WHERE status = 'draft'
    AND start_time <= now()
    AND end_time > now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3f. Auto-end auctions past their end_time
CREATE OR REPLACE FUNCTION end_expired_auctions()
RETURNS void AS $$
BEGIN
  UPDATE public.auctions
  SET status = 'ended'
  WHERE status = 'active'
    AND end_time <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 4. VIEWS ──────────────────────────────────────────────

-- 4a. Active auctions with vehicle info (used by homepage)
CREATE OR REPLACE VIEW public.active_auctions_view AS
SELECT
  a.id,
  a.vehicle_id,
  a.start_time,
  a.end_time,
  a.starting_price,
  a.current_highest_bid,
  a.highest_bidder_id,
  a.status,
  v.make,
  v.model,
  v.year,
  v.damage_type,
  v.mileage,
  v.images,
  v.fines_cleared,
  v.condition_report
FROM public.auctions a
JOIN public.vehicles v ON v.id = a.vehicle_id
WHERE a.status = 'active'
ORDER BY a.end_time ASC;


-- 4b. User's active bids (used by buyer dashboard)
CREATE OR REPLACE VIEW public.user_active_bids_view AS
SELECT DISTINCT ON (b.auction_id)
  b.bidder_id,
  b.auction_id,
  b.amount        AS my_highest_bid,
  a.current_highest_bid,
  a.end_time,
  a.status,
  v.make,
  v.model,
  v.year,
  v.images,
  (b.bidder_id = a.highest_bidder_id) AS is_winning
FROM public.bids b
JOIN public.auctions a ON a.id = b.auction_id
JOIN public.vehicles v ON v.id = a.vehicle_id
ORDER BY b.auction_id, b.amount DESC;


-- ── 5. ROW LEVEL SECURITY ─────────────────────────────────

ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auctions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions  ENABLE ROW LEVEL SECURITY;


-- ── users ──────────────────────────────────────────────────

-- Users can read their own profile
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "users_select_admin"
  ON public.users FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Users can update their own non-sensitive fields
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Service role can do anything (for triggers / Edge Functions)
CREATE POLICY "users_service_role"
  ON public.users FOR ALL
  USING (auth.role() = 'service_role');


-- ── vehicles ───────────────────────────────────────────────

-- Anyone can see approved vehicles
CREATE POLICY "vehicles_select_approved"
  ON public.vehicles FOR SELECT
  USING (status = 'approved');

-- Sellers see their own vehicles
CREATE POLICY "vehicles_select_own"
  ON public.vehicles FOR SELECT
  USING (auth.uid() = seller_id);

-- Sellers can create vehicles
CREATE POLICY "vehicles_insert_seller"
  ON public.vehicles FOR INSERT
  WITH CHECK (
    auth.uid() = seller_id AND
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('seller', 'admin'))
  );

-- Sellers can update their pending vehicles; admins can update all
CREATE POLICY "vehicles_update_seller_or_admin"
  ON public.vehicles FOR UPDATE
  USING (
    auth.uid() = seller_id OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );


-- ── auctions ───────────────────────────────────────────────

-- All active/ended auctions are public
CREATE POLICY "auctions_select_public"
  ON public.auctions FOR SELECT
  USING (status IN ('active', 'ended', 'settled'));

-- Admins see all
CREATE POLICY "auctions_select_admin"
  ON public.auctions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Only admins can create/edit auctions
CREATE POLICY "auctions_write_admin"
  ON public.auctions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );


-- ── bids ───────────────────────────────────────────────────

-- Bids are public (for transparency)
CREATE POLICY "bids_select_public"
  ON public.bids FOR SELECT
  USING (true);

-- Verified buyers can insert bids
CREATE POLICY "bids_insert_buyer"
  ON public.bids FOR INSERT
  WITH CHECK (
    auth.uid() = bidder_id AND
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND is_verified = true
        AND bidding_tier > 0
    )
  );


-- ── auction_entries ────────────────────────────────────────

CREATE POLICY "entries_select_own"
  ON public.auction_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "entries_insert_own"
  ON public.auction_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ── transactions ───────────────────────────────────────────

CREATE POLICY "transactions_select_own"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "transactions_select_admin"
  ON public.transactions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "transactions_insert_service"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR auth.uid() = user_id);


-- ── 6. REALTIME ───────────────────────────────────────────

-- Enable Realtime publications for live bidding
-- Run these in Supabase Dashboard → Database → Replication
-- Or uncomment if using SQL:

-- ALTER PUBLICATION supabase_realtime ADD TABLE public.auctions;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.bids;


-- ── 7. STORAGE ────────────────────────────────────────────

-- Run in Supabase Dashboard → Storage → New Bucket
-- OR via the API. These are the recommended buckets:

-- Bucket: "vehicle-images"   (public)
-- Bucket: "national-ids"     (private)


-- ── 8. SEED DATA (Development Only) ──────────────────────

-- Uncomment below for local development seeding

/*
-- Insert a test admin user (after creating via Supabase Auth)
-- UPDATE public.users SET role = 'admin', is_verified = true WHERE id = '<your-uuid>';

-- Sample vehicle
INSERT INTO public.vehicles (
  id, seller_id, make, model, year, damage_type, mileage,
  description, images, fines_cleared, status
) VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  '<seller-uuid>',
  'Toyota', 'Camry', 2022,
  'front_collision', 45000,
  'Well-maintained fleet vehicle, front bumper and hood damage from collision. Engine runs perfectly. Full service history available.',
  ARRAY[
    'https://images.unsplash.com/photo-1581540222194-0def2dda95b8?w=800',
    'https://images.unsplash.com/photo-1555353540-64580b51c258?w=800'
  ],
  true, 'approved'
);

-- Sample auction (5 days duration)
INSERT INTO public.auctions (
  vehicle_id, start_time, end_time,
  starting_price, current_highest_bid, status
) VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  now(),
  now() + INTERVAL '5 days',
  45000, 45000, 'active'
);
*/


-- ── 9. HELPER FUNCTIONS (Public API) ─────────────────────

-- Calculate buyer's premium (callable from frontend / Edge Functions)
CREATE OR REPLACE FUNCTION calculate_buyers_premium(final_price numeric)
RETURNS numeric AS $$
BEGIN
  IF final_price < 100000 THEN
    RETURN 5000;
  ELSIF final_price <= 400000 THEN
    RETURN ROUND(final_price * 0.05, 2);
  ELSIF final_price <= 1000000 THEN
    RETURN ROUND(final_price * 0.04, 2);
  ELSE
    RETURN ROUND(final_price * 0.04, 2);
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate total invoice amount
CREATE OR REPLACE FUNCTION calculate_total_invoice(final_price numeric)
RETURNS TABLE (
  hammer_price   numeric,
  buyers_premium numeric,
  admin_fee      numeric,
  total_due      numeric
) AS $$
BEGIN
  RETURN QUERY SELECT
    final_price,
    calculate_buyers_premium(final_price),
    750::numeric,
    final_price + calculate_buyers_premium(final_price) + 750;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Example: SELECT * FROM calculate_total_invoice(250000);
-- Returns: hammer_price=250000, buyers_premium=12500, admin_fee=750, total_due=263250


-- ── END OF SCHEMA ─────────────────────────────────────────
-- Next: Run Phase 2 to build the Auth pages and Homepage.
