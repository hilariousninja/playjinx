const STORAGE_KEY = 'jinx_my_room';
const LAST_SEEN_KEY = 'jinx_my_room_last_seen';

interface MyRoom {
  token: string;
  challengeId: string;
  date: string;
  createdAt: string;
}

export function saveMyRoom(token: string, challengeId: string, date: string): void {
  const room: MyRoom = { token, challengeId, date, createdAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(room));
}

export function getMyRoom(): MyRoom | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MyRoom;
  } catch {
    return null;
  }
}

/** Check if room is for today */
export function isRoomToday(): boolean {
  const room = getMyRoom();
  if (!room) return false;
  const today = new Date().toISOString().slice(0, 10);
  return room.date === today;
}

/** Mark room as seen now */
export function markRoomSeen(): void {
  localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
}

/** Get last time user checked the room */
export function getRoomLastSeen(): string | null {
  return localStorage.getItem(LAST_SEEN_KEY);
}

export function clearMyRoom(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LAST_SEEN_KEY);
}
