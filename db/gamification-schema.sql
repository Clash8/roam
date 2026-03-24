-- ============================================================
-- GAMIFICATION SCHEMA — Run after auth-schema.sql
-- Adds event_requests table and user_points for gamification
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── event_requests: user-submitted event suggestions ─────────
CREATE TABLE IF NOT EXISTS public.event_requests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL,
    title           TEXT NOT NULL,
    date            TEXT,
    venue_name      TEXT,
    organizer_name  TEXT,
    description     TEXT,
    instagram_username TEXT,
    ticket_link     TEXT,
    notes           TEXT,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.event_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_requests: own read"
    ON public.event_requests FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "event_requests: own insert"
    ON public.event_requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "event_requests: admin read all"
    ON public.event_requests FOR SELECT
    USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "event_requests: admin update"
    ON public.event_requests FOR UPDATE
    USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Users can delete their own pending or rejected event requests
CREATE POLICY "event_requests: own delete"
    ON public.event_requests FOR DELETE
    USING (auth.uid() = user_id AND status IN ('pending', 'rejected'));

-- ── user_points: gamification point ledger ───────────────────
-- Updated automatically when admins approve/reject requests.
-- +2 pts per approved venue or organizer request
-- +5 pts per approved event request
CREATE TABLE IF NOT EXISTS public.user_points (
    user_id       UUID PRIMARY KEY,
    total_points  INTEGER NOT NULL DEFAULT 0,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

-- Users can read their own score
CREATE POLICY "user_points: own read"
    ON public.user_points FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can read all scores (for leaderboard)
CREATE POLICY "user_points: admin read all"
    ON public.user_points FOR SELECT
    USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Admins can insert/update scores when approving requests
CREATE POLICY "user_points: admin insert"
    ON public.user_points FOR INSERT
    WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "user_points: admin update"
    ON public.user_points FOR UPDATE
    USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
