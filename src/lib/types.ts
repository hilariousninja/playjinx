export type WordStatus = 'unreviewed' | 'keep' | 'review' | 'cut';

export interface Word {
  id: string;
  word: string;
  category: string;
  source: string;
  status: WordStatus;
  jinx_score: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface WordStats {
  word_id: string;
  times_seen: number;
  times_submitted: number;
  times_top_cluster: number;
  avg_rank: number;
  top_answer_rate: number;
  unique_answer_rate: number;
  data_points: number;
  overuse_flag: boolean;
  last_seen_at: string | null;
}

export interface Prompt {
  id: string;
  word_a: string;
  word_b: string;
  mode: 'daily' | 'archive';
  date: string;
  results_unlock_at: string;
  created_at: string;
}

export interface Answer {
  id: string;
  prompt_id: string;
  session_id: string;
  raw_answer: string;
  normalized_answer: string;
  created_at: string;
}

export interface PromptAnswerStat {
  prompt_id: string;
  normalized_answer: string;
  count: number;
  percentage: number;
  rank: number;
  updated_at: string;
}

export interface ImportSource {
  id: string;
  name: string;
  sheet_name: string;
  rows_imported: number;
  last_sync: string;
  created_at: string;
}

export interface JinxScoreMetric {
  name: string;
  weight: number;
  score: number;
  weighted: number;
}
