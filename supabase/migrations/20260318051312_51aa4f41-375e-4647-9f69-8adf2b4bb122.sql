
CREATE POLICY "Answers are updatable by everyone"
ON public.answers
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Answers are deletable by everyone"
ON public.answers
FOR DELETE
TO public
USING (true);
