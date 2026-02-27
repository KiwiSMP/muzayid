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
