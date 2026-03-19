
-- Add prompt quality columns to prompts table
ALTER TABLE public.prompts 
  ADD COLUMN IF NOT EXISTS prompt_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS prompt_tag text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS total_players integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_answers integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS top_answer_pct integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS performance text DEFAULT NULL;

-- Add word-level appearance tracking
ALTER TABLE public.words
  ADD COLUMN IF NOT EXISTS strong_appearances integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weak_appearances integer NOT NULL DEFAULT 0;
