import { Prompt, Answer, PromptAnswerStat, Word, WordStats, ImportSource } from './types';
import { normalizeAnswer } from './normalize';

// In-memory store for MVP. Replace with Supabase later.

const STORAGE_PREFIX = 'jinx_';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function save<T>(key: string, data: T) {
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
}

// --- Prompts ---
const SEED_PROMPTS: Prompt[] = [
  { id: 'p1', word_a: 'PIRATE', word_b: 'SPACE', mode: 'daily', date: new Date().toISOString().split('T')[0], results_unlock_at: '', created_at: '' },
  { id: 'p2', word_a: 'VAMPIRE', word_b: 'BREAD', mode: 'daily', date: new Date().toISOString().split('T')[0], results_unlock_at: '', created_at: '' },
  { id: 'p3', word_a: 'WEDDING', word_b: 'JUNGLE', mode: 'daily', date: new Date().toISOString().split('T')[0], results_unlock_at: '', created_at: '' },
  { id: 'a1', word_a: 'FIRE', word_b: 'OCEAN', mode: 'archive', date: '2026-03-10', results_unlock_at: '', created_at: '' },
  { id: 'a2', word_a: 'GHOST', word_b: 'KITCHEN', mode: 'archive', date: '2026-03-10', results_unlock_at: '', created_at: '' },
  { id: 'a3', word_a: 'ROBOT', word_b: 'GARDEN', mode: 'archive', date: '2026-03-10', results_unlock_at: '', created_at: '' },
  { id: 'a4', word_a: 'MOON', word_b: 'LIBRARY', mode: 'archive', date: '2026-03-09', results_unlock_at: '', created_at: '' },
  { id: 'a5', word_a: 'DRAGON', word_b: 'COFFEE', mode: 'archive', date: '2026-03-09', results_unlock_at: '', created_at: '' },
  { id: 'a6', word_a: 'CASTLE', word_b: 'MUSIC', mode: 'archive', date: '2026-03-09', results_unlock_at: '', created_at: '' },
];

// Seed fake answers for archive prompts
const SEED_ANSWERS: Record<string, Record<string, number>> = {
  a1: { steam: 45, wave: 30, heat: 20, volcano: 15, lava: 10 },
  a2: { cook: 35, haunt: 25, spirit: 20, knife: 15, recipe: 10 },
  a3: { plant: 40, grow: 28, seed: 18, flower: 14, weed: 8 },
  a4: { light: 38, quiet: 22, read: 20, night: 18, space: 12 },
  a5: { fire: 42, breath: 25, hot: 20, cup: 15, bean: 10 },
  a6: { rock: 35, hall: 28, song: 22, tower: 18, band: 12 },
};

export function getSessionId(): string {
  let sid = localStorage.getItem(STORAGE_PREFIX + 'session_id');
  if (!sid) {
    sid = 'sess_' + Math.random().toString(36).slice(2);
    localStorage.setItem(STORAGE_PREFIX + 'session_id', sid);
  }
  return sid;
}

export function getDailyPrompts(): Prompt[] {
  return SEED_PROMPTS.filter(p => p.mode === 'daily');
}

export function getArchivePrompts(): Prompt[] {
  return SEED_PROMPTS.filter(p => p.mode === 'archive');
}

export function getPromptById(id: string): Prompt | undefined {
  return SEED_PROMPTS.find(p => p.id === id);
}

export function getAnswersForPrompt(promptId: string): Answer[] {
  return load<Answer[]>('answers_' + promptId, []);
}

export function hasSubmitted(promptId: string): boolean {
  const sid = getSessionId();
  const answers = getAnswersForPrompt(promptId);
  return answers.some(a => a.session_id === sid);
}

export function getUserAnswer(promptId: string): Answer | undefined {
  const sid = getSessionId();
  return getAnswersForPrompt(promptId).find(a => a.session_id === sid);
}

export function submitAnswer(promptId: string, rawAnswer: string): Answer {
  const sid = getSessionId();
  const answer: Answer = {
    id: 'ans_' + Math.random().toString(36).slice(2),
    prompt_id: promptId,
    session_id: sid,
    raw_answer: rawAnswer,
    normalized_answer: normalizeAnswer(rawAnswer),
    created_at: new Date().toISOString(),
  };
  const answers = getAnswersForPrompt(promptId);
  answers.push(answer);
  save('answers_' + promptId, answers);
  return answer;
}

export function getStats(promptId: string): PromptAnswerStat[] {
  const answers = getAnswersForPrompt(promptId);
  // Include seed data for archive
  const seedData = SEED_ANSWERS[promptId];

  const counts: Record<string, number> = {};

  if (seedData) {
    for (const [word, count] of Object.entries(seedData)) {
      counts[word] = (counts[word] || 0) + count;
    }
  }

  for (const a of answers) {
    counts[a.normalized_answer] = (counts[a.normalized_answer] || 0) + 1;
  }

  const total = Object.values(counts).reduce((s, c) => s + c, 0);
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([word, count], i) => ({
      prompt_id: promptId,
      normalized_answer: word,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      rank: i + 1,
      updated_at: new Date().toISOString(),
    }));

  return sorted;
}

export function getTotalSubmissions(promptId: string): number {
  const stats = getStats(promptId);
  return stats.reduce((s, st) => s + st.count, 0);
}

// --- Words / Deck ---
export function getWords(): Word[] {
  return load<Word[]>('words', []);
}

export function saveWords(words: Word[]) {
  save('words', words);
}

export function updateWord(id: string, updates: Partial<Word>) {
  const words = getWords();
  const idx = words.findIndex(w => w.id === id);
  if (idx >= 0) {
    words[idx] = { ...words[idx], ...updates, updated_at: new Date().toISOString() };
    saveWords(words);
  }
  return words[idx];
}

export function importWordsFromCSV(csvText: string, sourceName: string): number {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return 0;

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const wordIdx = headers.indexOf('word');
  const catIdx = headers.indexOf('category');
  const statusIdx = headers.indexOf('status');
  const sourceIdx = headers.indexOf('source_sheet');

  if (wordIdx < 0) return 0;

  const existing = getWords();
  const existingSet = new Set(existing.map(w => w.word.toLowerCase()));
  const newWords: Word[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    const word = cols[wordIdx];
    if (!word || existingSet.has(word.toLowerCase())) continue;

    newWords.push({
      id: 'w_' + Math.random().toString(36).slice(2),
      word: word.toLowerCase(),
      category: catIdx >= 0 ? cols[catIdx] : 'Uncategorized',
      source: sourceIdx >= 0 ? cols[sourceIdx] : sourceName,
      status: (statusIdx >= 0 ? cols[statusIdx] : 'unreviewed') as any,
      jinx_score: Math.floor(Math.random() * 40) + 50,
      notes: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    existingSet.add(word.toLowerCase());
  }

  saveWords([...existing, ...newWords]);

  // Save import source
  const sources = load<ImportSource[]>('import_sources', []);
  sources.push({
    id: 'src_' + Math.random().toString(36).slice(2),
    name: sourceName,
    sheet_name: 'Sheet1',
    rows_imported: newWords.length,
    last_sync: new Date().toISOString(),
    created_at: new Date().toISOString(),
  });
  save('import_sources', sources);

  return newWords.length;
}

export function getImportSources(): ImportSource[] {
  return load<ImportSource[]>('import_sources', []);
}

export function getJinxScoreBreakdown(word: Word): { name: string; weight: number; score: number; weighted: number }[] {
  const s = word.jinx_score;
  const metrics = [
    { name: 'Linkability', weight: 0.25, score: Math.min(100, s + Math.floor(Math.random() * 15 - 5)) },
    { name: 'Recognition', weight: 0.20, score: Math.min(100, s + Math.floor(Math.random() * 10)) },
    { name: 'Cluster Health', weight: 0.15, score: Math.min(100, s + Math.floor(Math.random() * 20 - 10)) },
    { name: 'Replay Value', weight: 0.15, score: Math.min(100, s + Math.floor(Math.random() * 10 - 5)) },
    { name: 'Uniqueness', weight: 0.10, score: Math.min(100, s + Math.floor(Math.random() * 15 - 5)) },
    { name: 'Overuse Risk', weight: 0.10, score: Math.min(100, 100 - s + Math.floor(Math.random() * 20)) },
    { name: 'Dead Prompt Risk', weight: 0.05, score: Math.min(100, 100 - s + Math.floor(Math.random() * 15)) },
  ];
  return metrics.map(m => ({ ...m, weighted: Math.round(m.weight * m.score) }));
}
