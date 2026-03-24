-- ============================================================
-- AUTH SCHEMA — Run once after enabling Supabase Auth
-- Uses auth.users directly (no custom profiles table).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- requests table: user-submitted venue/organizer suggestions
CREATE TABLE IF NOT EXISTS public.requests (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL,
    item_type     TEXT NOT NULL CHECK (item_type IN ('venue', 'organizer')),
    name          TEXT NOT NULL,
    instagram_username TEXT,
    notes         TEXT,
    status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- Users can read their own requests
CREATE POLICY "requests: own read"
    ON public.requests FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own requests
CREATE POLICY "requests: own insert"
    ON public.requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Admins (app_metadata->>'role' = 'admin') can read all requests
CREATE POLICY "requests: admin read all"
    ON public.requests FOR SELECT
    USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Admins can update request status
CREATE POLICY "requests: admin update"
    ON public.requests FOR UPDATE
    USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Users can delete their own pending or rejected requests
CREATE POLICY "requests: own delete"
    ON public.requests FOR DELETE
    USING (auth.uid() = user_id AND status IN ('pending', 'rejected'));

-- ============================================================
-- TO MAKE YOURSELF ADMIN (run in Supabase SQL Editor):
--
--   UPDATE auth.users
--   SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'
--   WHERE email = 'your@email.com';
-- ============================================================
