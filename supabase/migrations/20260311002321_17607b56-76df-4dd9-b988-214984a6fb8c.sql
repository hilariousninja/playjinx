
-- Timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Prompts table
CREATE TABLE public.prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  word_a TEXT NOT NULL,
  word_b TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'daily' CHECK (mode IN ('daily', 'archive')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  results_unlock_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prompts are readable by everyone" ON public.prompts FOR SELECT USING (true);
CREATE POLICY "Prompts are insertable by everyone" ON public.prompts FOR INSERT WITH CHECK (true);

-- Answers table
CREATE TABLE public.answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_id UUID NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  raw_answer TEXT NOT NULL,
  normalized_answer TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Answers are readable by everyone" ON public.answers FOR SELECT USING (true);
CREATE POLICY "Answers are insertable by everyone" ON public.answers FOR INSERT WITH CHECK (true);

CREATE INDEX idx_answers_prompt_id ON public.answers(prompt_id);
CREATE INDEX idx_answers_session_prompt ON public.answers(session_id, prompt_id);
CREATE INDEX idx_answers_normalized ON public.answers(prompt_id, normalized_answer);

-- Words table (deck management)
CREATE TABLE public.words (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  word TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Uncategorized',
  source TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unreviewed' CHECK (status IN ('unreviewed', 'keep', 'review', 'cut')),
  jinx_score INTEGER NOT NULL DEFAULT 50,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Words are readable by everyone" ON public.words FOR SELECT USING (true);
CREATE POLICY "Words are insertable by everyone" ON public.words FOR INSERT WITH CHECK (true);
CREATE POLICY "Words are updatable by everyone" ON public.words FOR UPDATE USING (true);

CREATE TRIGGER update_words_updated_at BEFORE UPDATE ON public.words FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Import sources table
CREATE TABLE public.import_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sheet_name TEXT NOT NULL DEFAULT 'Sheet1',
  rows_imported INTEGER NOT NULL DEFAULT 0,
  last_sync TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.import_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Import sources are readable by everyone" ON public.import_sources FOR SELECT USING (true);
CREATE POLICY "Import sources are insertable by everyone" ON public.import_sources FOR INSERT WITH CHECK (true);
