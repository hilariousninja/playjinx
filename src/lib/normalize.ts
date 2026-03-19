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
 * Merges shorter/less-popular variants into the most popular canonical form.
 * Only merges when confidence is high (short edit distance relative to word length).
 */
export function fuzzyMergeGroups(
  counts: Record<string, number>
): Record<string, number> {
  // Sort by count descending so popular answers absorb typos
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const canonical: Record<string, string> = {}; // maps each key to its canonical form
  const merged: Record<string, number> = {};

  for (const [answer] of entries) {
    canonical[answer] = answer; // default to self
  }

  // For each answer, check if it's a typo of a more popular answer
  for (let i = 0; i < entries.length; i++) {
    const [answerA] = entries[i];
    if (canonical[answerA] !== answerA) continue; // already merged

    for (let j = i + 1; j < entries.length; j++) {
      const [answerB] = entries[j];
      if (canonical[answerB] !== answerB) continue; // already merged

      const maxDist = getMaxEditDistance(answerA, answerB);
      if (maxDist === 0) continue; // too short to fuzzy match

      const dist = levenshtein(answerA, answerB);
      if (dist <= maxDist) {
        canonical[answerB] = answerA; // merge B into A (A is more popular)
      }
    }
  }

  // Rebuild counts using canonical forms
  for (const [answer, count] of entries) {
    const canon = canonical[answer];
    merged[canon] = (merged[canon] || 0) + count;
  }

  return merged;
}

/**
 * Determine max edit distance for fuzzy matching based on word lengths.
 * Conservative: only merge when confidence is high.
 */
function getMaxEditDistance(a: string, b: string): number {
  const minLen = Math.min(a.length, b.length);
  const maxLen = Math.max(a.length, b.length);

  // Don't fuzzy match very short words (too many false positives)
  if (minLen <= 3) return 0;
  // Length difference too large — probably different words
  if (maxLen - minLen > 2) return 0;
  // 4-5 char words: allow distance 1
  if (minLen <= 5) return 1;
  // 6-9 char words: allow distance 1-2
  if (minLen <= 9) return Math.min(2, Math.floor(minLen / 4));
  // 10+ char words: allow distance 2
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
