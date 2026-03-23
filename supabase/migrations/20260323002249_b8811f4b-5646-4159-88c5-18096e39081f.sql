
-- 1. Create trigger function to auto-update total_players and unique_answers on answer insert
CREATE OR REPLACE FUNCTION public.update_prompt_stats_on_answer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE prompts SET
    total_players = (SELECT COUNT(*) FROM answers WHERE prompt_id = NEW.prompt_id),
    unique_answers = (SELECT COUNT(DISTINCT normalized_answer) FROM answers WHERE prompt_id = NEW.prompt_id)
  WHERE id = NEW.prompt_id;
  RETURN NEW;
END;
$$;

-- 2. Create trigger on answers table
CREATE TRIGGER trg_update_prompt_stats_on_answer
  AFTER INSERT ON public.answers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_prompt_stats_on_answer();

-- 3. Fix existing stale counters for all prompts
UPDATE prompts p SET
  total_players = sub.cnt,
  unique_answers = sub.uniq
FROM (
  SELECT prompt_id, COUNT(*) as cnt, COUNT(DISTINCT normalized_answer) as uniq
  FROM answers
  GROUP BY prompt_id
) sub
WHERE p.id = sub.prompt_id AND (p.total_players != sub.cnt OR p.unique_answers != sub.uniq);
