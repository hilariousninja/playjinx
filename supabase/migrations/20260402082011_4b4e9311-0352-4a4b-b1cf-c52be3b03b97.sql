
CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  challenger_session_id text NOT NULL,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_challenges_token ON public.challenges (token);
CREATE INDEX idx_challenges_date ON public.challenges (date);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Challenges readable by everyone"
  ON public.challenges FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Challenges insertable by everyone"
  ON public.challenges FOR INSERT
  TO public
  WITH CHECK (true);
