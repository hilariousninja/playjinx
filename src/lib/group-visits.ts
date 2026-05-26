/**
 * Per-group "last visit" tracking via localStorage.
 * Powers the "N new since you looked" pill and the bottom-nav badge.
 */

const KEY = 'jinx_group_visits_v1';

type VisitMap = Record<string, string>; // groupId -> ISO timestamp

function read(): VisitMap {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

function write(map: VisitMap) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore quota errors */
  }
}

export function getLastVisitedAt(groupId: string): string | null {
  return read()[groupId] ?? null;
}

export function markGroupVisited(groupId: string, when: Date = new Date()) {
  const map = read();
  map[groupId] = when.toISOString();
  write(map);
}

export function getAllLastVisits(): VisitMap {
  return read();
}
