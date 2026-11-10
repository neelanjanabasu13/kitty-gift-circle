ALTER TABLE public.pots ADD COLUMN IF NOT EXISTS demo_factor integer NOT NULL DEFAULT 60;
ALTER TABLE public.pots ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.pots ADD COLUMN IF NOT EXISTS reminder_drafted_at timestamptz;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS missing_count integer;
ALTER TABLE public.pots ADD CONSTRAINT pots_demo_factor_range CHECK (demo_factor BETWEEN 1 AND 1440);