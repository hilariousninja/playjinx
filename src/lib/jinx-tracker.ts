/**
 * JINX metric model
 *
 * A JINX = an overlap with another player on the same answer cluster.
 *   prompt_jinxes = max(0, cluster_size - 1)   // how many OTHER players I matched
 *   day_jinxes    = sum of prompt_jinxes across the day's prompts
 *
 * These are distinct from:
 *   - matched prompts: prompts where I overlapped with at least one other player
 *   - #1 / top answer: my cluster was the largest answer group on the prompt
 *   - perfect day: matched on every prompt of the day
 *
 * Persistence:
 *   - We store per-prompt JINX counts in localStorage so Archive cards stay
 *     stable across drill-in/out without refetching stats.
 */

interface JinxRecord {
  date: string;
  promptId: string;
  jinxes: number; // overlap count for this prompt (cluster_size - 1)
}

const STORAGE_KEY = 'jinx_tracker_v2';
const LEGACY_KEY = 'jinx_tracker';

/** Per-prompt overlap count: how many OTHER players matched my answer. */
export function promptJinxes(matchCount: number): number {
  return Math.max(0, matchCount - 1);
}

/** True overlap on this prompt (at least one other player matched). */
export function isMatchedPrompt(matchCount: number): boolean {
  return matchCount >= 2;
}

/** Top-answer flag (largest cluster) — independent of overlap count. */
export function isTopAnswer(rank: number): boolean {
  return rank === 1;
}

/** Provisional state — first/only player so far on this prompt. */
export function isProvisionalLead(rank: number, matchCount: number): boolean {
  return rank === 1 && matchCount < 2;
}

function getRecords(): JinxRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    // One-time migration: drop legacy boolean records (their counts aren't recoverable).
    if (localStorage.getItem(LEGACY_KEY)) {
      localStorage.removeItem(LEGACY_KEY);
    }
    return [];
  } catch { return []; }
}

function saveRecords(records: JinxRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function upsertRecord(promptId: string, date: string, jinxes: number) {
  const records = getRecords();
  const idx = records.findIndex(r => r.promptId === promptId);
  if (jinxes <= 0) {
    if (idx >= 0) {
      records.splice(idx, 1);
      saveRecords(records);
    }
    return;
  }
  if (idx >= 0) {
    if (records[idx].jinxes === jinxes && records[idx].date === date) return;
    records[idx] = { promptId, date, jinxes };
  } else {
    records.push({ promptId, date, jinxes });
  }
  saveRecords(records);
}

function sumJinxes(records: JinxRecord[]): number {
  return records.reduce((s, r) => s + r.jinxes, 0);
}

export function getJinxTotal(): number {
  return sumJinxes(getRecords());
}

export function getJinxesToday(): number {
  const today = new Date().toISOString().split('T')[0];
  return sumJinxes(getRecords().filter(r => r.date === today));
}

export function getJinxesThisWeek(): number {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const cutoff = weekAgo.toISOString().split('T')[0];
  return sumJinxes(getRecords().filter(r => r.date >= cutoff));
}

export function getJinxesThisMonth(): number {
  const now = new Date();
  const cutoff = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  return sumJinxes(getRecords().filter(r => r.date >= cutoff));
}

export function getJinxesThisYear(): number {
  const year = new Date().getFullYear();
  return sumJinxes(getRecords().filter(r => r.date.startsWith(`${year}-`)));
}

/** Returns { date, count } for the day with the most JINXes (null if none). */
export function getBestDay(): { date: string; count: number } | null {
  const totals = new Map<string, number>();
  for (const r of getRecords()) {
    totals.set(r.date, (totals.get(r.date) ?? 0) + r.jinxes);
  }
  let best: { date: string; count: number } | null = null;
  for (const [date, count] of totals) {
    if (!best || count > best.count) best = { date, count };
  }
  return best;
}

/** Count of distinct days that produced at least one JINX. */
export function getJinxDayCount(): number {
  const days = new Set(getRecords().filter(r => r.jinxes > 0).map(r => r.date));
  return days.size;
}

/** Sum of all overlap counts on a given day. */
export function getJinxesForDay(date: string): number {
  return sumJinxes(getRecords().filter(r => r.date === date));
}

/** Per-prompt overlap count as last persisted (0 if unknown / no overlap). */
export function getPromptJinxCount(promptId: string): number {
  return getRecords().find(r => r.promptId === promptId)?.jinxes ?? 0;
}

/** Did this specific prompt have any overlap (>=1 other player matched)? */
export function isPromptJinx(promptId: string): boolean {
  return getPromptJinxCount(promptId) > 0;
}

/**
 * Persist per-prompt overlap counts based on freshly-loaded stats.
 * Only persists when the prompt has actually been answered (matchCount >= 1
 * means the user submitted; we still store 0-overlap as removal).
 */
export function syncJinxesFromResults(
  results: { promptId: string; date: string; rank: number; matchCount: number }[]
) {
  for (const r of results) {
    if (r.matchCount <= 0) continue; // user didn't answer — leave existing record alone
    upsertRecord(r.promptId, r.date, promptJinxes(r.matchCount));
  }
}
