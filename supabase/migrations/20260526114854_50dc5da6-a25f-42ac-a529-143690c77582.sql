
-- 1. Restrict import_sources to authenticated (admin-only)
DROP POLICY IF EXISTS "Import sources are readable by everyone" ON public.import_sources;
CREATE POLICY "Import sources readable by authenticated"
  ON public.import_sources FOR SELECT TO authenticated USING (true);

-- 2. Revoke EXECUTE on SECURITY DEFINER trigger functions
REVOKE EXECUTE ON FUNCTION public.update_prompt_stats_on_answer() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_word_stats_on_prompt_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
