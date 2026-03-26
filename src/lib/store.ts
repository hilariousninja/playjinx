import { supabase } from '@/integrations/supabase/client';
import { normalizeAnswer, applyAlias, isBlocked, fuzzyMergeGroups } from './normalize';
import { getAliasMap, getBlockedTerms } from './answer-helpers';
import type { Tables } from '@/integrations/supabase/types';

export type DbPrompt = Tables<'prompts'>;
export type DbAnswer = Tables<'answers'>;
export type DbWord = Tables<'words'>;
export type DbImportSource = Tables<'import_sources'>;

export function getPlayerId(): string {
  // Check for existing player_id first, then migrate from old session_id
  let pid = localStorage.getItem('jinx_player_id');
  if (!pid) {
    // Migrate from old session_id if it exists
    const oldSid = localStorage.getItem('jinx_session_id');
    if (oldSid) {
      pid = oldSid;
      localStorage.setItem('jinx_player_id', pid);
    } else {
      pid = 'player_' + crypto.randomUUID().replace(/-/g, '');
      localStorage.setItem('jinx_player_id', pid);
    }
  }
  return pid;
}

/** @deprecated Use getPlayerId() */
export const getSessionId = getPlayerId;

// --- Completed prompts tracking ---
export function getCompletedPrompts(): Set<string> {
  try {
    const raw = localStorage.getItem('jinx_completed_prompts');
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

export function markPromptCompleted(promptId: string) {
  const completed = getCompletedPrompts();
  completed.add(promptId);
  localStorage.setItem('jinx_completed_prompts', JSON.stringify([...completed]));
}

/** Check completion status against server, updating local cache */
export async function syncCompletionStatus(prompts: DbPrompt[]): Promise<Record<string, boolean>> {
  const localCompleted = getCompletedPrompts();
  const statusMap: Record<string, boolean> = {};

  await Promise.all(prompts.map(async (p) => {
    if (localCompleted.has(p.id)) {
      statusMap[p.id] = true;
      return;
    }
    const serverSubmitted = await hasSubmitted(p.id);
    if (serverSubmitted) {
      markPromptCompleted(p.id);
    }
    statusMap[p.id] = serverSubmitted;
  }));

  return statusMap;
}

// --- Prompts ---
function getUTCDateKey(date = new Date()): string {
  return date.toISOString().split('T')[0];
}

export async function getActivePrompts(): Promise<DbPrompt[]> {
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('active', true)
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

async function getActivePromptsForUTCDate(dateKey: string): Promise<DbPrompt[]> {
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('active', true)
    .eq('date', dateKey)
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

// Ensure the live set is today's UTC set; if missing, trigger regeneration.
export async function ensureDailyPrompts(): Promise<DbPrompt[]> {
  const todayUTC = getUTCDateKey();
  let prompts = await getActivePromptsForUTCDate(todayUTC);
  if (prompts.length === 3) return prompts;

  // Reconcile whenever today's active set is not exactly 3
  // (covers both missing prompts and accidental overflow).
  try {
    const { error } = await supabase.functions.invoke('generate-daily-prompts');
    if (!error) {
      prompts = await getActivePromptsForUTCDate(todayUTC);
    }
  } catch {
    // Silently fail and use fallback below.
  }

  // Never render more than the canonical daily trio in gameplay/archive "today" sections.
  if (prompts.length >= 3) return prompts.slice(0, 3);

  // Fallback: return most recent prompts so users never see empty state.
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at')
    .limit(3);
  if (error) throw error;
  return data ?? [];
}

export async function getArchivePrompts(): Promise<DbPrompt[]> {
  // Only return prompts that have actual play history (historical/archived)
  // Exclude future bank, candidates, and scheduled-but-unplayed prompts
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('mode', 'archive')
    .gt('total_players', 0)
    .order('date', { ascending: false })
    .order('created_at');
  if (error) throw error;

  // Safety clamp: archive should only ever show one 3-prompt daily release per date.
  const perDateCount = new Map<string, number>();
  const normalized: DbPrompt[] = [];

  for (const prompt of data ?? []) {
    const used = perDateCount.get(prompt.date) ?? 0;
    if (used >= 3) continue;
    normalized.push(prompt);
    perDateCount.set(prompt.date, used + 1);
  }

  return normalized;
}

export async function getPromptById(id: string): Promise<DbPrompt | null> {
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// --- Answers ---
export async function hasSubmitted(promptId: string): Promise<boolean> {
  const sid = getSessionId();
  const { count, error } = await supabase
    .from('answers')
    .select('*', { count: 'exact', head: true })
    .eq('prompt_id', promptId)
    .eq('session_id', sid);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function getUserAnswer(promptId: string): Promise<DbAnswer | null> {
  const sid = getSessionId();
  const { data, error } = await supabase
    .from('answers')
    .select('*')
    .eq('prompt_id', promptId)
    .eq('session_id', sid)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function submitAnswer(promptId: string, rawAnswer: string): Promise<DbAnswer> {
  const sid = getSessionId();
  let normalized = normalizeAnswer(rawAnswer);

  // Apply alias mapping
  const aliasMap = await getAliasMap();
  normalized = applyAlias(normalized, aliasMap);

  // Check blocked terms
  const blocked = await getBlockedTerms();
  if (isBlocked(normalized, blocked)) {
    throw new Error('This answer is not allowed.');
  }

  const { data, error } = await supabase
    .from('answers')
    .insert({
      prompt_id: promptId,
      session_id: sid,
      raw_answer: rawAnswer,
      normalized_answer: normalized,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export interface AnswerStat {
  normalized_answer: string;
  count: number;
  percentage: number;
  rank: number;
}

/**
 * Resolve a user's normalized_answer to its canonical form
 * (after alias + fuzzy merging) for stat lookups.
 */
export async function getCanonicalAnswer(normalizedAnswer: string): Promise<string> {
  const aliasMap = await getAliasMap();
  return applyAlias(normalizedAnswer, aliasMap);
}

export interface SuggestedAlias {
  source: string;
  canonical: string;
  distance: number;
  sourceCount: number;
  canonicalCount: number;
  reason: string;
}

/**
 * Scan recent prompts for near-miss answer pairs that weren't auto-merged.
 * Returns deduplicated suggestions for admin review.
 */
export async function getSuggestedAliases(): Promise<SuggestedAlias[]> {
  const { fuzzyMergeGroups } = await import('./normalize');
  const aliasMap = await getAliasMap();
  const { applyAlias } = await import('./normalize');

  // Fetch recent prompts with answers
  const { data: prompts } = await supabase
    .from('prompts')
    .select('id')
    .order('date', { ascending: false })
    .limit(30);

  if (!prompts?.length) return [];

  const seenPairs = new Set<string>();
  const suggestions: SuggestedAlias[] = [];

  for (const p of prompts) {
    const { data: answers } = await supabase
      .from('answers')
      .select('normalized_answer')
      .eq('prompt_id', p.id);

    if (!answers?.length) continue;

    // Build counts with alias applied
    const counts: Record<string, number> = {};
    for (const row of answers) {
      const canonical = applyAlias(row.normalized_answer, aliasMap);
      counts[canonical] = (counts[canonical] || 0) + 1;
    }

    // Run fuzzy merge to populate near-misses
    fuzzyMergeGroups(counts);

    // Read near-misses from window
    const nearMisses = (typeof window !== 'undefined' && (window as any).__jinxLastNearMisses) || [];
    for (const nm of nearMisses) {
      const key = [nm.a, nm.b].sort().join('|||');
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      suggestions.push({
        source: nm.countA >= nm.countB ? nm.b : nm.a,
        canonical: nm.countA >= nm.countB ? nm.a : nm.b,
        distance: nm.dist,
        sourceCount: Math.min(nm.countA, nm.countB),
        canonicalCount: Math.max(nm.countA, nm.countB),
        reason: nm.reason,
      });
    }
  }

  // Sort by canonical count descending (most impactful first)
  return suggestions.sort((a, b) => b.canonicalCount - a.canonicalCount);
}

export async function getStats(promptId: string): Promise<AnswerStat[]> {
  const [answersResult, aliasMap] = await Promise.all([
    supabase.from('answers').select('normalized_answer').eq('prompt_id', promptId),
    getAliasMap(),
  ]);
  if (answersResult.error) throw answersResult.error;

  // Step 1: Apply alias mappings to each answer
  const aliasedCounts: Record<string, number> = {};
  for (const row of answersResult.data ?? []) {
    const canonical = applyAlias(row.normalized_answer, aliasMap);
    aliasedCounts[canonical] = (aliasedCounts[canonical] || 0) + 1;
  }

  // Step 2: Fuzzy-merge typo variants
  const mergedCounts = fuzzyMergeGroups(aliasedCounts);

  const total = Object.values(mergedCounts).reduce((s, c) => s + c, 0);
  return Object.entries(mergedCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([word, count], i) => ({
      normalized_answer: word,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      rank: i + 1,
    }));
}

export async function getTotalSubmissions(promptId: string): Promise<number> {
  const { count, error } = await supabase
    .from('answers')
    .select('*', { count: 'exact', head: true })
    .eq('prompt_id', promptId);
  if (error) throw error;
  return count ?? 0;
}

export async function getDailyUniquePlayers(promptIds: string[]): Promise<number> {
  if (promptIds.length === 0) return 0;
  const { data, error } = await supabase
    .from('answers')
    .select('session_id')
    .in('prompt_id', promptIds);
  if (error) throw error;
  const unique = new Set((data ?? []).map(a => a.session_id));
  return unique.size;
}

// --- Words ---
export async function getWords(): Promise<DbWord[]> {
  const { data, error } = await supabase
    .from('words')
    .select('*')
    .order('word');
  if (error) throw error;
  return data ?? [];
}

export async function updateWord(id: string, updates: Partial<DbWord>): Promise<DbWord | null> {
  const { data, error } = await supabase
    .from('words')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function importWordsFromCSV(csvText: string, sourceName: string): Promise<number> {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return 0;

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const wordIdx = headers.indexOf('word');
  const catIdx = headers.indexOf('category');
  const statusIdx = headers.indexOf('status');
  const sourceIdx = headers.indexOf('source_sheet');

  if (wordIdx < 0) return 0;

  // Get existing words to deduplicate
  const existing = await getWords();
  const existingSet = new Set(existing.map(w => w.word.toLowerCase()));

  const newWords: { word: string; category: string; source: string; status: string; jinx_score: number }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    const word = cols[wordIdx];
    if (!word || existingSet.has(word.toLowerCase())) continue;

    newWords.push({
      word: word.toLowerCase(),
      category: catIdx >= 0 ? cols[catIdx] : 'Uncategorized',
      source: sourceIdx >= 0 ? cols[sourceIdx] : sourceName,
      status: statusIdx >= 0 ? cols[statusIdx] : 'unreviewed',
      jinx_score: Math.floor(Math.random() * 40) + 50,
    });
    existingSet.add(word.toLowerCase());
  }

  if (newWords.length === 0) return 0;

  // Batch insert in chunks of 100
  for (let i = 0; i < newWords.length; i += 100) {
    const chunk = newWords.slice(i, i + 100);
    const { error } = await supabase.from('words').insert(chunk);
    if (error) throw error;
  }

  // Record import source
  await supabase.from('import_sources').insert({
    name: sourceName,
    rows_imported: newWords.length,
  });

  return newWords.length;
}

export async function bulkUpdateStatus(fromStatus: string, toStatus: string): Promise<void> {
  const { error } = await supabase
    .from('words')
    .update({ status: toStatus })
    .eq('status', fromStatus);
  if (error) throw error;
}

export async function getImportSources(): Promise<DbImportSource[]> {
  const { data, error } = await supabase
    .from('import_sources')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// --- Admin: Answer Cleaning ---
export async function mergeAnswers(promptId: string, sourceNormalized: string, targetNormalized: string): Promise<number> {
  const { data, error } = await supabase.functions.invoke('admin-actions', {
    body: {
      action: 'merge_answers',
      prompt_id: promptId,
      source: sourceNormalized,
      target: targetNormalized,
    },
  });
  if (error) throw error;
  return data?.merged ?? 0;
}

export async function deleteAnswersByNormalized(promptId: string, normalizedAnswer: string): Promise<number> {
  const { data, error } = await supabase.functions.invoke('admin-actions', {
    body: {
      action: 'delete_answers',
      prompt_id: promptId,
      normalized_answer: normalizedAnswer,
    },
  });
  if (error) throw error;
  return data?.deleted ?? 0;
}

// --- JINX Score (client-side for MVP) ---
export function getJinxScoreBreakdown(word: DbWord) {
  const s = word.jinx_score;
  const metrics = [
    { name: 'Linkability', weight: 0.25, score: Math.min(100, Math.max(0, s + ((hashCode(word.word + 'link') % 15) - 5))) },
    { name: 'Recognition', weight: 0.20, score: Math.min(100, Math.max(0, s + (hashCode(word.word + 'recog') % 10))) },
    { name: 'Cluster Health', weight: 0.15, score: Math.min(100, Math.max(0, s + ((hashCode(word.word + 'cluster') % 20) - 10))) },
    { name: 'Replay Value', weight: 0.15, score: Math.min(100, Math.max(0, s + ((hashCode(word.word + 'replay') % 10) - 5))) },
    { name: 'Uniqueness', weight: 0.10, score: Math.min(100, Math.max(0, s + ((hashCode(word.word + 'unique') % 15) - 5))) },
    { name: 'Overuse Risk', weight: 0.10, score: Math.min(100, Math.max(0, 100 - s + (hashCode(word.word + 'overuse') % 20))) },
    { name: 'Dead Prompt Risk', weight: 0.05, score: Math.min(100, Math.max(0, 100 - s + (hashCode(word.word + 'dead') % 15))) },
  ];
  return metrics.map(m => ({ ...m, weighted: Math.round(m.weight * m.score) }));
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
