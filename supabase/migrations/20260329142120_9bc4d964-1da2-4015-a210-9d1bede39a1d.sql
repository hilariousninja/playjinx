-- Recalculate all word stats from actual prompt/answer data

UPDATE words w SET
  times_used = COALESCE(sub.cnt, 0)
FROM (
  SELECT LOWER(word) as lword, COUNT(*) as cnt
  FROM (
    SELECT LOWER(word_a) as word FROM prompts WHERE total_players > 0
    UNION ALL
    SELECT LOWER(word_b) as word FROM prompts WHERE total_players > 0
  ) all_words
  GROUP BY LOWER(word)
) sub
WHERE LOWER(w.word) = sub.lword;

UPDATE words w SET
  strong_appearances = COALESCE(sub.strong, 0),
  decent_appearances = COALESCE(sub.decent, 0),
  weak_appearances = COALESCE(sub.weak, 0),
  avg_top_answer_pct = COALESCE(sub.avg_top, 0),
  avg_unique_answers = COALESCE(sub.avg_unique, 0)
FROM (
  SELECT
    LOWER(word) as lword,
    COUNT(*) FILTER (WHERE top_answer_pct >= 50) as strong,
    COUNT(*) FILTER (WHERE top_answer_pct >= 25 AND top_answer_pct < 50) as decent,
    COUNT(*) FILTER (WHERE top_answer_pct < 25) as weak,
    ROUND(AVG(top_answer_pct)) as avg_top,
    ROUND(AVG(unique_answers)) as avg_unique
  FROM (
    SELECT LOWER(word_a) as word, top_answer_pct, unique_answers FROM prompts WHERE total_players > 0
    UNION ALL
    SELECT LOWER(word_b) as word, top_answer_pct, unique_answers FROM prompts WHERE total_players > 0
  ) pw
  GROUP BY LOWER(word)
) sub
WHERE LOWER(w.word) = sub.lword;

CREATE OR REPLACE FUNCTION public.update_word_stats_on_prompt_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  w TEXT;
  words_to_update TEXT[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    words_to_update := ARRAY[LOWER(OLD.word_a), LOWER(OLD.word_b)];
  ELSIF TG_OP = 'UPDATE' THEN
    words_to_update := ARRAY[LOWER(NEW.word_a), LOWER(NEW.word_b)];
    IF LOWER(OLD.word_a) != LOWER(NEW.word_a) THEN
      words_to_update := words_to_update || LOWER(OLD.word_a);
    END IF;
    IF LOWER(OLD.word_b) != LOWER(NEW.word_b) THEN
      words_to_update := words_to_update || LOWER(OLD.word_b);
    END IF;
  ELSE
    words_to_update := ARRAY[LOWER(NEW.word_a), LOWER(NEW.word_b)];
  END IF;

  FOREACH w IN ARRAY words_to_update LOOP
    UPDATE words SET
      times_used = (
        SELECT COUNT(*) FROM (
          SELECT id FROM prompts WHERE LOWER(word_a) = w AND total_players > 0
          UNION ALL
          SELECT id FROM prompts WHERE LOWER(word_b) = w AND total_players > 0
        ) x
      ),
      strong_appearances = (
        SELECT COUNT(*) FROM (
          SELECT id FROM prompts WHERE LOWER(word_a) = w AND total_players > 0 AND top_answer_pct >= 50
          UNION ALL
          SELECT id FROM prompts WHERE LOWER(word_b) = w AND total_players > 0 AND top_answer_pct >= 50
        ) x
      ),
      decent_appearances = (
        SELECT COUNT(*) FROM (
          SELECT id FROM prompts WHERE LOWER(word_a) = w AND total_players > 0 AND top_answer_pct >= 25 AND top_answer_pct < 50
          UNION ALL
          SELECT id FROM prompts WHERE LOWER(word_b) = w AND total_players > 0 AND top_answer_pct >= 25 AND top_answer_pct < 50
        ) x
      ),
      weak_appearances = (
        SELECT COUNT(*) FROM (
          SELECT id FROM prompts WHERE LOWER(word_a) = w AND total_players > 0 AND top_answer_pct < 25
          UNION ALL
          SELECT id FROM prompts WHERE LOWER(word_b) = w AND total_players > 0 AND top_answer_pct < 25
        ) x
      ),
      avg_top_answer_pct = COALESCE((
        SELECT ROUND(AVG(top_answer_pct)) FROM (
          SELECT top_answer_pct FROM prompts WHERE LOWER(word_a) = w AND total_players > 0
          UNION ALL
          SELECT top_answer_pct FROM prompts WHERE LOWER(word_b) = w AND total_players > 0
        ) x
      ), 0),
      avg_unique_answers = COALESCE((
        SELECT ROUND(AVG(unique_answers)) FROM (
          SELECT unique_answers FROM prompts WHERE LOWER(word_a) = w AND total_players > 0
          UNION ALL
          SELECT unique_answers FROM prompts WHERE LOWER(word_b) = w AND total_players > 0
        ) x
      ), 0)
    WHERE LOWER(word) = w;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_word_stats ON prompts;
CREATE TRIGGER trg_update_word_stats
  AFTER INSERT OR UPDATE OF total_players, top_answer_pct, unique_answers, word_a, word_b
  ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_word_stats_on_prompt_change();