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
