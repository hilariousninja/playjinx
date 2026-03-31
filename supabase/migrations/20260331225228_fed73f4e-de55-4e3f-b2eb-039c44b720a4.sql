
ALTER TABLE public.words ADD COLUMN IF NOT EXISTS generation_status text NOT NULL DEFAULT 'active';
ALTER TABLE public.words ADD COLUMN IF NOT EXISTS semantic_lane text DEFAULT NULL;
ALTER TABLE public.words ADD CONSTRAINT words_word_unique UNIQUE (word);
