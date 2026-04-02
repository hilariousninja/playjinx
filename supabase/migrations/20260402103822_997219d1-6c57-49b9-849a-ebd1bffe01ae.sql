
CREATE TABLE public.challenge_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(challenge_id, session_id)
);

ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants readable by everyone"
ON public.challenge_participants FOR SELECT
TO public
USING (true);

CREATE POLICY "Participants insertable by everyone"
ON public.challenge_participants FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Participants updatable by everyone"
ON public.challenge_participants FOR UPDATE
TO public
USING (true);

CREATE INDEX idx_challenge_participants_challenge ON public.challenge_participants(challenge_id);
