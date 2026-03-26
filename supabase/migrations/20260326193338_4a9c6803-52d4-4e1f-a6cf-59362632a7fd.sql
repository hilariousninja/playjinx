-- Recalculate top_answer_pct from actual answer data for all prompts with incorrect 0 values
WITH top_counts AS (
  SELECT a.prompt_id, MAX(cnt) as max_count
  FROM (
    SELECT prompt_id, normalized_answer, COUNT(*) as cnt
    FROM answers
    GROUP BY prompt_id, normalized_answer
  ) a
  GROUP BY a.prompt_id
)
UPDATE prompts p
SET top_answer_pct = CASE 
  WHEN p.total_players > 0 THEN GREATEST(ROUND((tc.max_count::numeric / p.total_players) * 100)::int, 1)
  ELSE 0
END
FROM top_counts tc
WHERE tc.prompt_id = p.id
AND p.top_answer_pct = 0
AND p.total_players > 0;