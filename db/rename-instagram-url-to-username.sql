-- Rename instagram_url → instagram_username and strip the https://instagram.com/ prefix from existing data

-- venues
ALTER TABLE public.venues RENAME COLUMN instagram_url TO instagram_username;
UPDATE public.venues
  SET instagram_username = trim(trailing '/' from regexp_replace(instagram_username, '^https?://(www\.)?instagram\.com/', ''))
  WHERE instagram_username IS NOT NULL;

-- organizers
ALTER TABLE public.organizers RENAME COLUMN instagram_url TO instagram_username;
UPDATE public.organizers
  SET instagram_username = trim(trailing '/' from regexp_replace(instagram_username, '^https?://(www\.)?instagram\.com/', ''))
  WHERE instagram_username IS NOT NULL;

-- requests
ALTER TABLE public.requests RENAME COLUMN instagram_url TO instagram_username;
UPDATE public.requests
  SET instagram_username = trim(trailing '/' from regexp_replace(instagram_username, '^https?://(www\.)?instagram\.com/', ''))
  WHERE instagram_username IS NOT NULL;

-- event_requests
ALTER TABLE public.event_requests RENAME COLUMN instagram_url TO instagram_username;
UPDATE public.event_requests
  SET instagram_username = trim(trailing '/' from regexp_replace(instagram_username, '^https?://(www\.)?instagram\.com/', ''))
  WHERE instagram_username IS NOT NULL;
