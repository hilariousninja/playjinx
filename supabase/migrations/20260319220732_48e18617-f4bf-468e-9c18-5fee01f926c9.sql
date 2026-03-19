
-- Answer aliases: canonical answer groupings (typo corrections, aliases, etc.)
CREATE TABLE public.answer_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_text text NOT NULL,
  canonical_text text NOT NULL,
  alias_type text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_text)
);

-- Blocked terms: offensive/spam words
CREATE TABLE public.blocked_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(term)
);

-- RLS
ALTER TABLE public.answer_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_terms ENABLE ROW LEVEL SECURITY;

-- Everyone can read aliases (needed for client-side normalization)
CREATE POLICY "Aliases readable by everyone" ON public.answer_aliases FOR SELECT TO public USING (true);
CREATE POLICY "Aliases manageable by authenticated" ON public.answer_aliases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Aliases updatable by authenticated" ON public.answer_aliases FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Aliases deletable by authenticated" ON public.answer_aliases FOR DELETE TO authenticated USING (true);

-- Everyone can read blocked terms (needed for client-side validation)
CREATE POLICY "Blocked terms readable by everyone" ON public.blocked_terms FOR SELECT TO public USING (true);
CREATE POLICY "Blocked terms manageable by authenticated" ON public.blocked_terms FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Blocked terms deletable by authenticated" ON public.blocked_terms FOR DELETE TO authenticated USING (true);
