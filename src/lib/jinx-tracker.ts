/**
 * Lightweight JINX tracking — counts #1 rank matches as "JINXes"
 * Stored in localStorage for instant access.
 */

interface JinxRecord {
  date: string;
  promptId: string;
}

const STORAGE_KEY = 'jinx_tracker';

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

/** Sync jinxes from results data — call after loading stats */
export function syncJinxesFromResults(results: { promptId: string; date: string; rank: number }[]) {
  for (const r of results) {
    if (r.rank === 1) {
      recordJinx(r.promptId, r.date);
    }
  }
}
