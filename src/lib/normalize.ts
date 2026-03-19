/**
 * Normalize a player answer for comparison/grouping.
 * Preserves multi-word answers (e.g. "New York", "Ice Cream").
 * Handles plurals, basic formatting cleanup.
 */
export function normalizeAnswer(raw: string): string {
  let answer = raw.toLowerCase().trim();
  // Remove non-alphanumeric except spaces
  answer = answer.replace(/[^a-z0-9\s]/g, '');
  // Collapse whitespace
  answer = answer.replace(/\s+/g, ' ').trim();
  // Basic plural handling (only for single words to avoid mangling phrases)
  const words = answer.split(' ');
  if (words.length === 1) {
    answer = depluralize(answer);
  }
  return answer;
}

function depluralize(word: string): string {
  if (word.endsWith('ies') && word.length > 4) {
    return word.slice(0, -3) + 'y';
  } else if (word.endsWith('ses') || word.endsWith('xes') || word.endsWith('zes') || word.endsWith('ches') || word.endsWith('shes')) {
    return word.slice(0, -2);
  } else if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us') && word.length > 2) {
    return word.slice(0, -1);
  }
  return word;
}

/**
 * Apply alias mapping to a normalized answer.
 * Returns the canonical form if an alias exists, otherwise the original.
 */
export function applyAlias(normalized: string, aliasMap: Record<string, string>): string {
  return aliasMap[normalized] ?? normalized;
}

/**
 * Compute Levenshtein edit distance between two strings.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * Fuzzy-merge answer groups by Levenshtein distance.
 * Very conservative: only merges when confidence is high.
 * Guards: minimum word length, count-ratio, multi-word stricter rules.
 */
export function fuzzyMergeGroups(
  counts: Record<string, number>
): Record<string, number> {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const canonical: Record<string, string> = {};
  const merged: Record<string, number> = {};
  const mergeLog: Array<{ from: string; to: string; dist: number }> = [];

  for (const [answer] of entries) {
    canonical[answer] = answer;
  }

  for (let i = 0; i < entries.length; i++) {
    const [answerA, countA] = entries[i];
    if (canonical[answerA] !== answerA) continue;

    for (let j = i + 1; j < entries.length; j++) {
      const [answerB, countB] = entries[j];
      if (canonical[answerB] !== answerB) continue;

      // Count-ratio guard: B must look like a typo of A (rare vs popular)
      if (countB > 2 && countB > countA * 0.3) continue;

      const maxDist = getMaxEditDistance(answerA, answerB);
      if (maxDist === 0) continue;

      const dist = levenshtein(answerA, answerB);
      if (dist <= maxDist) {
        canonical[answerB] = answerA;
        mergeLog.push({ from: answerB, to: answerA, dist });
      }
    }
  }

  for (const [answer, count] of entries) {
    const canon = canonical[answer];
    merged[canon] = (merged[canon] || 0) + count;
  }

  // Expose merge log for admin debugging (console: window.__jinxLastMergeLog)
  if (mergeLog.length > 0 && typeof window !== 'undefined') {
    (window as any).__jinxLastMergeLog = mergeLog;
  }

  return merged;
}

/**
 * Max edit distance — very conservative to avoid merging real distinct words.
 * Short words (≤6 chars) are never fuzzy-matched.
 */
function getMaxEditDistance(a: string, b: string): number {
  const minLen = Math.min(a.length, b.length);
  const maxLen = Math.max(a.length, b.length);

  // Multi-word: only merge long phrases with distance 1
  if (a.includes(' ') || b.includes(' ')) {
    if (minLen < 12 || maxLen - minLen > 1) return 0;
    return 1;
  }

  // Single-word: no fuzzy for ≤6 chars (bake/bike, coat/coast, desert/dessert)
  if (minLen <= 6) return 0;
  if (maxLen - minLen > 2) return 0;
  // 7-9 chars: distance 1
  if (minLen <= 9) return 1;
  // 10+ chars: distance 2
  return 2;
}

/**
 * Validate player input. Returns an error message or null if valid.
 */
export function validateInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return 'Please enter an answer';
  if (trimmed.length > 80) return 'Answer is too long';
  if (trimmed.length < 1) return 'Please enter an answer';
  // Block excessive punctuation
  const punctCount = (trimmed.match(/[^a-zA-Z0-9\s]/g) || []).length;
  if (punctCount > trimmed.length * 0.5 && punctCount > 3) return 'Too much punctuation';
  // Block number spam
  if (/^\d{4,}$/.test(trimmed)) return 'Please enter a real answer';
  // Block repeated characters (e.g. "aaaaaaa")
  if (/^(.)\1{4,}$/.test(trimmed)) return 'Please enter a real answer';
  // Block very long single "words" with no spaces (likely garbage)
  if (!/\s/.test(trimmed) && trimmed.length > 40) return 'Answer is too long';
  return null;
}

/**
 * Check if a normalized answer matches any blocked term.
 */
export function isBlocked(normalized: string, blockedTerms: Set<string>): boolean {
  // Check exact match and substring match for blocked terms
  if (blockedTerms.has(normalized)) return true;
  for (const term of blockedTerms) {
    if (normalized.includes(term)) return true;
  }
  return false;
}
