-- Audit log for admin destructive actions
CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,                              -- e.g. 'wipe_player_day'
  target_session_id TEXT,
  target_display_name TEXT,
  target_date DATE,
  answers_count INTEGER NOT NULL DEFAULT 0,
  performed_by_user_id UUID,
  performed_by_email TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  restored_at TIMESTAMPTZ,
  restored_by_user_id UUID,
  restored_by_email TEXT
);

CREATE INDEX idx_admin_audit_log_created_at ON public.admin_audit_log (created_at DESC);
CREATE INDEX idx_admin_audit_log_action ON public.admin_audit_log (action);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audit log readable by authenticated"
  ON public.admin_audit_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Audit log insertable by authenticated"
  ON public.admin_audit_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Audit log updatable by authenticated"
  ON public.admin_audit_log FOR UPDATE TO authenticated USING (true);

-- Archive table holding wiped answer rows so they can be restored
CREATE TABLE public.deleted_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_answer_id UUID NOT NULL,
  prompt_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  raw_answer TEXT NOT NULL,
  normalized_answer TEXT NOT NULL,
  original_created_at TIMESTAMPTZ NOT NULL,
  audit_log_id UUID NOT NULL REFERENCES public.admin_audit_log(id) ON DELETE CASCADE,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deleted_answers_audit ON public.deleted_answers (audit_log_id);
CREATE INDEX idx_deleted_answers_deleted_at ON public.deleted_answers (deleted_at DESC);

ALTER TABLE public.deleted_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deleted answers readable by authenticated"
  ON public.deleted_answers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Deleted answers insertable by authenticated"
  ON public.deleted_answers FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Deleted answers deletable by authenticated"
  ON public.deleted_answers FOR DELETE TO authenticated USING (true);