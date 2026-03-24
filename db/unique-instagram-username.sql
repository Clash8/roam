-- 1. Remove duplicate venues (keep oldest row per instagram_username)
DELETE FROM public.venues
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY instagram_username ORDER BY created_at) AS rn
    FROM public.venues
    WHERE instagram_username IS NOT NULL
  ) t WHERE rn > 1
);

-- 2. Remove duplicate organizers (keep oldest row per instagram_username)
DELETE FROM public.organizers
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY instagram_username ORDER BY created_at) AS rn
    FROM public.organizers
    WHERE instagram_username IS NOT NULL
  ) t WHERE rn > 1
);

-- 3. Add unique constraints on main tables
ALTER TABLE public.venues
  ADD CONSTRAINT venues_instagram_username_key UNIQUE (instagram_username);

ALTER TABLE public.organizers
  ADD CONSTRAINT organizers_instagram_username_key UNIQUE (instagram_username);

-- 4. Prevent duplicate pending/approved requests for the same username
CREATE UNIQUE INDEX IF NOT EXISTS requests_instagram_username_active_idx
  ON public.requests (instagram_username)
  WHERE instagram_username IS NOT NULL AND status IN ('pending', 'approved');

CREATE UNIQUE INDEX IF NOT EXISTS event_requests_instagram_username_active_idx
  ON public.event_requests (instagram_username)
  WHERE instagram_username IS NOT NULL AND status IN ('pending', 'approved');
