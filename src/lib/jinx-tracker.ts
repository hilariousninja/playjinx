/**
 * Lightweight JINX tracking — counts true crowd matches as "JINXes"
 * A JINX = #1 rank AND at least one other player matched the same answer.
 * Solo top answers are "leading so far" (provisional), not JINXes.
 * Stored in localStorage for instant access.
 */

interface JinxRecord {
  date: string;
  promptId: string;
}

const STORAGE_KEY = 'jinx_tracker';

/** Minimum matchCount (including the user) for a #1 result to count as a real JINX */
export const MIN_MATCH_FOR_JINX = 2;

/** True JINX = top answer + actual overlap with others */
export function isRealJinx(rank: number, matchCount: number): boolean {
  return rank === 1 && matchCount >= MIN_MATCH_FOR_JINX;
}

/** Provisional state — first/only player on a top answer */
export function isProvisionalLead(rank: number, matchCount: number): boolean {
  return rank === 1 && matchCount < MIN_MATCH_FOR_JINX;
}

function getRecords(): JinxRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRecords(records: JinxRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function recordJinx(promptId: string, date: string) {
  const records = getRecords();
  if (records.some(r => r.promptId === promptId)) return;
  records.push({ date, promptId });
  saveRecords(records);
}

/** Remove a previously recorded jinx (e.g., if it turned out to be solo). */
export function unrecordJinx(promptId: string) {
  const records = getRecords().filter(r => r.promptId !== promptId);
  saveRecords(records);
}

export function getJinxTotal(): number {
  return getRecords().length;
}

export function getJinxesToday(): number {
  const today = new Date().toISOString().split('T')[0];
  return getRecords().filter(r => r.date === today).length;
}

export function getJinxesThisWeek(): number {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const cutoff = weekAgo.toISOString().split('T')[0];
  return getRecords().filter(r => r.date >= cutoff).length;
}

export function getJinxesForDay(date: string): number {
  return getRecords().filter(r => r.date === date).length;
}

/** Was this specific prompt a real JINX (per stored tracker)? */
export function isPromptJinx(promptId: string): boolean {
  return getRecords().some(r => r.promptId === promptId);
}

/** Sync jinxes from results data — only records true JINXes (matchCount >= 2) */
export function syncJinxesFromResults(
  results: { promptId: string; date: string; rank: number; matchCount: number }[]
) {
  for (const r of results) {
    if (isRealJinx(r.rank, r.matchCount)) {
      recordJinx(r.promptId, r.date);
    } else {
      // Defensive: if previously recorded but no longer qualifies, remove.
      unrecordJinx(r.promptId);
    }
  }
}
