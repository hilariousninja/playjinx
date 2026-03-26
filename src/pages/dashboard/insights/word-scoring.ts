export interface PromptRow {
  id: string;
  word_a: string;
  word_b: string;
  total_players: number;
  unique_answers: number;
  top_answer_pct: number;
  performance: string | null;
  prompt_tag: string | null;
  date: string;
}

export interface WordRow {
  id: string;
  word: string;
  category: string;
  status: string;
  times_used: number;
  strong_appearances: number;
  decent_appearances: number;
  weak_appearances: number;
  avg_top_answer_pct: number;
  avg_unique_answers: number;
  in_core_deck: boolean;
  deck_override: string | null;
  jinx_score: number;
}

export type Recommendation = 'keep' | 'watch' | 'cut' | 'add';
export type Confidence = 'high' | 'medium' | 'low';

export interface ScoredWord extends WordRow {
  strengthScore: number;
  recommendation: Recommendation;
  confidence: Confidence;
  explanation: string;
  promptPairings: PromptRow[];
}

const CONCRETE_CATS = ['food', 'animals', 'transport', 'objects', 'places', 'people', 'sports', 'weather', 'body', 'clothing', 'nature', 'home', 'tools', 'vehicles', 'music', 'drinks', 'toys', 'buildings'];
const ABSTRACT_CATS = ['concepts', 'emotions', 'abstract', 'philosophy', 'feelings'];

function isConcrete(category: string): boolean {
  const lower = category.toLowerCase();
  return CONCRETE_CATS.some(c => lower.includes(c));
}

function isAbstract(category: string): boolean {
  const lower = category.toLowerCase();
  return ABSTRACT_CATS.some(c => lower.includes(c));
}

export function computeWordScore(word: WordRow, wordPrompts: PromptRow[]): number {
  if (wordPrompts.length === 0) {
    return isConcrete(word.category) ? 55 : isAbstract(word.category) ? 35 : 45;
  }

  // Convergence (0-100): how well players agree
  const convergence = Math.min(100, word.avg_top_answer_pct);

  // Anti-fragmentation (0-100): lower unique/total ratio = better
  const avgFragRatio = wordPrompts.reduce((s, p) =>
    s + (p.total_players > 0 ? p.unique_answers / p.total_players : 1), 0) / wordPrompts.length;
  const antiFrag = Math.max(0, Math.min(100, (1 - avgFragRatio) * 100));

  // Consistency (0-100): strong vs weak ratio
  const totalApp = word.strong_appearances + word.decent_appearances + word.weak_appearances;
  const consistency = totalApp > 0
    ? ((word.strong_appearances + word.decent_appearances * 0.5) / totalApp) * 100
    : 50;

  // Versatility (0-100): more distinct pairings = better, cap at 8
  const versatility = Math.min(100, (word.times_used / 8) * 100);

  // Category bonus
  const catBonus = isConcrete(word.category) ? 80 : isAbstract(word.category) ? 25 : 55;

  const score =
    convergence * 0.30 +
    antiFrag * 0.25 +
    consistency * 0.20 +
    versatility * 0.10 +
    catBonus * 0.15;

  return Math.round(Math.max(0, Math.min(100, score)));
}

export function getConfidence(timesUsed: number): Confidence {
  if (timesUsed >= 5) return 'high';
  if (timesUsed >= 3) return 'medium';
  return 'low';
}

export function getRecommendation(score: number, confidence: Confidence, inCoreDeck: boolean, override: string | null): Recommendation {
  if (override === 'locked_keep') return 'keep';
  if (override === 'locked_cut') return 'cut';

  if (confidence === 'low') return 'watch';

  if (inCoreDeck) {
    if (score >= 65) return 'keep';
    if (score < 40) return 'cut';
    return 'watch';
  } else {
    if (score >= 60) return 'add';
    if (score >= 45) return 'watch';
    return 'cut';
  }
}

export function getExplanation(word: ScoredWord): string {
  const { strengthScore: s, confidence: c, recommendation: r, in_core_deck, deck_override } = word;

  if (deck_override === 'locked_keep') return 'Manually locked as keeper';
  if (deck_override === 'locked_cut') return 'Manually locked for removal';
  if (deck_override === 'designer_favourite') return `Designer favourite (auto-score: ${s})`;
  if (deck_override === 'test_more') return 'Flagged for more testing';

  if (c === 'low') return `Only ${word.times_used} appearance${word.times_used === 1 ? '' : 's'} — need more data`;

  if (r === 'keep') return word.strong_appearances >= 3
    ? 'Strong vivid convergence across multiple pairings'
    : `Solid performer (${s}/100) with consistent results`;

  if (r === 'cut') {
    if (word.weak_appearances > word.strong_appearances) return 'Too abstract and repeatedly fragmented';
    return `Consistently weak results (${s}/100)`;
  }

  if (r === 'add') return `Promising non-deck word scoring ${s}/100`;

  // watch
  if (word.strong_appearances > 0 && word.weak_appearances > 0) return 'Mixed results — some strong, some weak pairings';
  return `Moderate performance (${s}/100), needs more data`;
}

export function scoreAllWords(words: WordRow[], prompts: PromptRow[]): ScoredWord[] {
  return words.map(w => {
    const wordPrompts = prompts.filter(p =>
      p.word_a.toLowerCase() === w.word.toLowerCase() ||
      p.word_b.toLowerCase() === w.word.toLowerCase()
    );
    const strengthScore = computeWordScore(w, wordPrompts);
    const confidence = getConfidence(w.times_used);
    const recommendation = getRecommendation(strengthScore, confidence, w.in_core_deck, w.deck_override);
    const scored: ScoredWord = {
      ...w,
      strengthScore,
      confidence,
      recommendation,
      promptPairings: wordPrompts,
      explanation: '',
    };
    scored.explanation = getExplanation(scored);
    return scored;
  });
}
