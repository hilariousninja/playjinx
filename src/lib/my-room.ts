const STORAGE_KEY = 'jinx_my_room';

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
    const room = JSON.parse(raw) as MyRoom;
    // Only return if it's for today
    const today = new Date().toISOString().slice(0, 10);
    if (room.date !== today) return null;
    return room;
  } catch {
    return null;
  }
}

export function clearMyRoom(): void {
  localStorage.removeItem(STORAGE_KEY);
}
