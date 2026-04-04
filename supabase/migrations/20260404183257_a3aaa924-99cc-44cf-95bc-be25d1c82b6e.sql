
CREATE TABLE public.match_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_session_id text NOT NULL,
  matched_session_id text NOT NULL,
  player_display_name text NOT NULL DEFAULT '',
  matched_display_name text NOT NULL DEFAULT '',
  challenge_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  prompts_matched integer NOT NULL DEFAULT 0,
  total_prompts integer NOT NULL DEFAULT 3,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Prevent duplicate entries per player pair per challenge
CREATE UNIQUE INDEX idx_match_history_unique 
  ON public.match_history (player_session_id, matched_session_id, challenge_id);

-- Fast lookups by player
CREATE INDEX idx_match_history_player ON public.match_history (player_session_id, date);

-- Enable RLS
ALTER TABLE public.match_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Match history readable by everyone"
  ON public.match_history FOR SELECT
  TO public USING (true);

CREATE POLICY "Match history insertable by everyone"
  ON public.match_history FOR INSERT
  TO public WITH CHECK (true);

CREATE POLICY "Match history updatable by everyone"
  ON public.match_history FOR UPDATE
  TO public USING (true);
