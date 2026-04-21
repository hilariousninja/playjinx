/**
 * Lightweight daily play streak tracker.
 *
 * - "Played" = the user submitted at least one answer for a daily set on a given local date.
 * - Current streak: consecutive days up to and including today (or yesterday if today not yet played).
 * - Best streak: max consecutive run ever recorded.
 *
 * Storage is localStorage-only and intentionally minimal.
 */

const STORAGE_KEY = 'jinx_streak_v1';

interface StreakState {
  lastPlayedDate: string | null; // YYYY-MM-DD (local)
  current: number;
  best: number;
}

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayDiff(a: string, b: string): number {
  // returns whole days between a and b (b - a), assuming YYYY-MM-DD local
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

function load(): StreakState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { lastPlayedDate: null, current: 0, best: 0 };
}

function save(s: StreakState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

/** Call when the user has answered today's set. Idempotent within a day. */
export function recordPlayToday(): StreakState {
  const today = todayLocal();
  const s = load();

  if (s.lastPlayedDate === today) return s; // already counted

  if (!s.lastPlayedDate) {
    s.current = 1;
  } else {
    const diff = dayDiff(s.lastPlayedDate, today);
    if (diff === 1) s.current += 1;
    else if (diff > 1) s.current = 1;
    // diff <= 0 (clock skew) — treat as same-day
  }

  s.lastPlayedDate = today;
  if (s.current > s.best) s.best = s.current;
  save(s);
  return s;
}

/**
 * Read current streak without mutating. If the user missed yesterday and hasn't
 * played today, the displayed current streak is 0 (broken).
 */
export function getStreak(): { current: number; best: number; playedToday: boolean } {
  const s = load();
  const today = todayLocal();
  if (!s.lastPlayedDate) return { current: 0, best: s.best, playedToday: false };

  const diff = dayDiff(s.lastPlayedDate, today);
  if (diff === 0) return { current: s.current, best: s.best, playedToday: true };
  if (diff === 1) return { current: s.current, best: s.best, playedToday: false }; // still alive — play today to extend
  return { current: 0, best: s.best, playedToday: false }; // broken
}
