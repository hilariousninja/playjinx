CREATE POLICY "Prompts are updatable by everyone"
ON public.prompts
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);