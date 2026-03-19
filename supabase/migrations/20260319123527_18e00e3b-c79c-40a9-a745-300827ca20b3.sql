ALTER TABLE public.words ADD COLUMN IF NOT EXISTS decent_appearances integer NOT NULL DEFAULT 0;
ALTER TABLE public.words ADD COLUMN IF NOT EXISTS times_used integer NOT NULL DEFAULT 0;
ALTER TABLE public.words ADD COLUMN IF NOT EXISTS avg_top_answer_pct numeric NOT NULL DEFAULT 0;
ALTER TABLE public.words ADD COLUMN IF NOT EXISTS avg_unique_answers numeric NOT NULL DEFAULT 0;