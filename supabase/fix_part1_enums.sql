-- ================================================================
-- MUZAYID Fix — PART 1 of 2
-- Run this FIRST. Wait for it to succeed, then run Part 2.
-- ================================================================
-- PostgreSQL requires enum value additions to be committed in a
-- separate transaction before any DDL can reference the new values.
-- ================================================================

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
