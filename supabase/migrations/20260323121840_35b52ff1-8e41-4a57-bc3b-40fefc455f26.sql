CREATE TABLE public.tuning_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tuning_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tuning readable by authenticated" ON public.tuning_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Tuning writable by authenticated" ON public.tuning_settings
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Tuning updatable by authenticated" ON public.tuning_settings
  FOR UPDATE TO authenticated USING (true);

INSERT INTO public.tuning_settings (key, value) VALUES (
  'category_weights',
  '{"animals":50,"body parts":50,"food":50,"objects":50,"places":50,"weather":50,"nature":50,"transport":50,"people":50,"culture":50,"events":50,"signals":50,"abstract":25,"emotions":25}'::jsonb
);

INSERT INTO public.tuning_settings (key, value) VALUES (
  'generation_controls',
  '{"concreteness_bias":60,"abstractness_penalty":40,"consensus_target":70,"fragmentation_penalty":60,"category_diversity":70}'::jsonb
);