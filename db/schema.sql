-- Enable the uuid-ossp extension for UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create venues table
CREATE TABLE IF NOT EXISTS public.venues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    website_url TEXT,
    instagram_username TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create organizers table
CREATE TABLE IF NOT EXISTS public.organizers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    website_url TEXT,
    instagram_username TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create events table
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    date DATE,
    time TEXT,
    end_time TEXT,
    location_name TEXT,
    venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
    organizer_id UUID REFERENCES public.organizers(id) ON DELETE SET NULL,
    image_url TEXT,
    description TEXT,
    category TEXT[],
    coordinates JSONB,
    price TEXT,
    ticket_link TEXT,
    dresscode TEXT,
    min_age INTEGER,
    guestlist_only BOOLEAN DEFAULT false,
    is_sold_out BOOLEAN DEFAULT false,
    source_link TEXT,
    raw_text TEXT,
    ai_confidence_score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Set up Row Level Security (RLS) policies

-- Enable RLS
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public read access
CREATE POLICY "Allow public read access on venues"
    ON public.venues FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access on organizers"
    ON public.organizers FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access on events"
    ON public.events FOR SELECT
    USING (true);

-- Allow public insert access on venues
CREATE POLICY "Allow public insert access on venues"
    ON public.venues FOR INSERT
    WITH CHECK (true);

-- Allow public insert access on organizers
CREATE POLICY "Allow public insert access on organizers"
    ON public.organizers FOR INSERT
    WITH CHECK (true);

-- Allow public insert access on events
CREATE POLICY "Allow public insert access on events"
    ON public.events FOR INSERT
    WITH CHECK (true);
