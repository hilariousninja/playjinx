
-- Drop dangerous public UPDATE/DELETE policies on answers
DROP POLICY IF EXISTS "Answers are updatable by everyone" ON public.answers;
DROP POLICY IF EXISTS "Answers are deletable by everyone" ON public.answers;

-- Restrict answers UPDATE/DELETE to authenticated users only
CREATE POLICY "Answers updatable by authenticated users"
ON public.answers FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Answers deletable by authenticated users"
ON public.answers FOR DELETE TO authenticated
USING (true);

-- Restrict words INSERT/UPDATE to authenticated users only
DROP POLICY IF EXISTS "Words are insertable by everyone" ON public.words;
DROP POLICY IF EXISTS "Words are updatable by everyone" ON public.words;

CREATE POLICY "Words insertable by authenticated users"
ON public.words FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Words updatable by authenticated users"
ON public.words FOR UPDATE TO authenticated
USING (true);

-- Restrict prompts INSERT/UPDATE to authenticated users only
DROP POLICY IF EXISTS "Prompts are insertable by everyone" ON public.prompts;
DROP POLICY IF EXISTS "Prompts are updatable by everyone" ON public.prompts;

CREATE POLICY "Prompts insertable by authenticated users"
ON public.prompts FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Prompts updatable by authenticated users"
ON public.prompts FOR UPDATE TO authenticated
USING (true);

-- Restrict import_sources INSERT to authenticated users only
DROP POLICY IF EXISTS "Import sources are insertable by everyone" ON public.import_sources;

CREATE POLICY "Import sources insertable by authenticated users"
ON public.import_sources FOR INSERT TO authenticated
WITH CHECK (true);
