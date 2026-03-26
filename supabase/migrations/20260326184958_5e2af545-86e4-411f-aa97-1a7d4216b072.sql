ALTER TABLE public.words
  ADD COLUMN IF NOT EXISTS in_core_deck boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deck_override text NULL;