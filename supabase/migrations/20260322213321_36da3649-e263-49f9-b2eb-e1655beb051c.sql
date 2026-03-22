-- Fix total_players for March 21 prompts that have answers but show 0
UPDATE prompts SET total_players = 5 WHERE id = 'd102b53b-35c3-49c0-84b0-b6f00f9c0da5';
UPDATE prompts SET total_players = 6 WHERE id = 'f0d4d9ea-1d4b-49d3-aa87-0f4ba919ece0';
UPDATE prompts SET total_players = 4 WHERE id = 'f63a2c27-abdd-4633-8b19-193417707b81';

-- Also update unique_answers counts
UPDATE prompts SET unique_answers = (SELECT COUNT(DISTINCT normalized_answer) FROM answers WHERE prompt_id = 'd102b53b-35c3-49c0-84b0-b6f00f9c0da5') WHERE id = 'd102b53b-35c3-49c0-84b0-b6f00f9c0da5';
UPDATE prompts SET unique_answers = (SELECT COUNT(DISTINCT normalized_answer) FROM answers WHERE prompt_id = 'f0d4d9ea-1d4b-49d3-aa87-0f4ba919ece0') WHERE id = 'f0d4d9ea-1d4b-49d3-aa87-0f4ba919ece0';
UPDATE prompts SET unique_answers = (SELECT COUNT(DISTINCT normalized_answer) FROM answers WHERE prompt_id = 'f63a2c27-abdd-4633-8b19-193417707b81') WHERE id = 'f63a2c27-abdd-4633-8b19-193417707b81';