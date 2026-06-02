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

// Words that should never be depluralized (irregular, mass nouns, or would mangle)
const DEPLURAL_SKIP = new Set([
  'gas', 'has', 'was', 'his', 'this', 'yes', 'bus', 'plus', 'minus',
  'series', 'species', 'lens', 'atlas', 'alias', 'canvas', 'chaos',
  'news', 'mathematics', 'physics', 'economics', 'politics',
  'glasses', 'scissors', 'pants', 'shorts', 'jeans',
  'chess', 'moss', 'ross', 'boss', 'loss', 'toss',
  'moose', 'goose', 'geese', 'dice', 'mice', 'lice',
  // Holidays / proper nouns ending in -s that aren't plurals
  'christmas', 'xmas', 'easter', 'kwanzaas',
  'jesus', 'paris', 'venus', 'mars', 'thanos', 'judas',
  'mass', 'kiss', 'grass', 'class', 'glass', 'brass', 'cross',
  // Common false-plural single words
  'iris', 'lotus', 'cactus', 'octopus', 'virus', 'genius', 'campus', 'circus', 'bonus',
  'tennis', 'analysis', 'oasis', 'basis', 'crisis', 'thesis', 'kudos', 'ethos', 'hummus',
]);

function depluralize(word: string): string {
  if (DEPLURAL_SKIP.has(word)) return word;
  if (word.endsWith('ies') && word.length > 4) {
    return word.slice(0, -3) + 'y';
  } else if (word.endsWith('shes') || word.endsWith('ches')) {
    return word.slice(0, -2);
  } else if (word.endsWith('xes') || word.endsWith('zes')) {
    return word.slice(0, -2);
  } else if (word.endsWith('ses') && word.length > 4) {
    // Only deplural "ses" for longer words to avoid mangling (roses→ros)
    const base = word.slice(0, -1); // e.g. "houses" → "house"
    if (base.endsWith('se') || base.endsWith('ose') || base.endsWith('ase') || base.endsWith('use') || base.endsWith('ise')) {
      return base;
    }
    return word;
  } else if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us') && !word.endsWith('is') && !word.endsWith('os') && word.length > 3) {
    return word.slice(0, -1);
  }
  return word;
}

// =====================================================================
// Stemmer — groups morphological variants (drive/driving/drove,
// happy/happiness/happily) under a shared stem key for counting.
// Display surface forms are preserved separately by the stats layer.
// =====================================================================

/**
 * Irregular verbs + comparative/superlative adjectives mapped to base form.
 * Applied before suffix stripping. Bidirectional sources only — past tense,
 * past participle, irregular comparatives. Synonyms belong in the alias map.
 */
const IRREGULAR_FORMS: Record<string, string> = {
  // verbs — past tense / past participle
  drove: 'drive', driven: 'drive',
  ran: 'run',
  wrote: 'write', written: 'write',
  swam: 'swim', swum: 'swim',
  ate: 'eat', eaten: 'eat',
  saw: 'see', seen: 'see',
  went: 'go', gone: 'go',
  took: 'take', taken: 'take',
  came: 'come',
  flew: 'fly', flown: 'fly',
  knew: 'know', known: 'know',
  grew: 'grow', grown: 'grow',
  threw: 'throw', thrown: 'throw',
  blew: 'blow', blown: 'blow',
  drew: 'draw', drawn: 'draw',
  spoke: 'speak', spoken: 'speak',
  broke: 'break', broken: 'break',
  chose: 'choose', chosen: 'choose',
  froze: 'freeze', frozen: 'freeze',
  stole: 'steal', stolen: 'steal',
  rode: 'ride', ridden: 'ride',
  rose: 'rise', risen: 'rise',
  fell: 'fall', fallen: 'fall',
  bit: 'bite', bitten: 'bite',
  hid: 'hide', hidden: 'hide',
  began: 'begin', begun: 'begin',
  drank: 'drink', drunk: 'drink',
  sang: 'sing', sung: 'sing',
  sank: 'sink', sunk: 'sink',
  rang: 'ring', rung: 'ring',
  shrank: 'shrink', shrunk: 'shrink',
  sprang: 'spring', sprung: 'spring',
  told: 'tell',
  sold: 'sell',
  held: 'hold',
  built: 'build',
  brought: 'bring',
  bought: 'buy',
  caught: 'catch',
  taught: 'teach',
  thought: 'think',
  fought: 'fight',
  sought: 'seek',
  found: 'find',
  ground: 'grind',
  wound: 'wind',
  felt: 'feel',
  kept: 'keep',
  slept: 'sleep',
  swept: 'sweep',
  wept: 'weep',
  meant: 'mean',
  dealt: 'deal',
  knelt: 'kneel',
  left: 'leave',
  lost: 'lose',
  made: 'make',
  paid: 'pay',
  said: 'say',
  laid: 'lay',
  led: 'lead',
  fed: 'feed',
  bled: 'bleed',
  bred: 'breed',
  sent: 'send',
  spent: 'spend',
  lent: 'lend',
  bent: 'bend',
  built_: 'build',
  stood: 'stand',
  understood: 'understand',
  withdrew: 'withdraw', withdrawn: 'withdraw',
  shown: 'show',
  given: 'give', gave: 'give',
  forgot: 'forget', forgotten: 'forget',
  got: 'get', gotten: 'get',
  woke: 'wake', woken: 'wake',
  // irregular adjectives
  better: 'good', best: 'good',
  worse: 'bad', worst: 'bad',
  more: 'much', most: 'much',
  less: 'little', least: 'little',
  further: 'far', farther: 'far', furthest: 'far', farthest: 'far',
};

/** Words that look like -ing/-ed/-ly/-er but aren't morphological variants. */
const STEM_SKIP = new Set([
  // -ing nouns/adjectives that shouldn't be stripped
  'king', 'ring', 'sing', 'wing', 'thing', 'sting', 'bring', 'spring',
  'string', 'cling', 'fling', 'sling', 'swing', 'bling',
  'morning', 'evening', 'ceiling', 'building', 'something',
  'nothing', 'anything', 'everything', 'pudding', 'wedding',
  // -ed words that aren't past tense
  'bed', 'red', 'fed', 'wed', 'shed', 'sled', 'bled', 'bread', 'thread',
  'spread', 'dread', 'tweed', 'speed', 'seed', 'need', 'feed', 'weed',
  'breed', 'greed', 'creed', 'freed', 'indeed',
  // -ly words that aren't adverbs
  'only', 'holy', 'ugly', 'silly', 'jolly', 'family', 'reply', 'supply',
  'apply', 'belly', 'jelly', 'lily', 'rally', 'rely', 'fly', 'sky',
  'july', 'italy', 'sicily', 'mongoly', 'lonely', 'lovely', 'lively',
  'ally', 'bully', 'gully', 'fully', 'really', // really -> real handled below? real is fine
  // -er nouns
  'water', 'paper', 'sister', 'mother', 'father', 'brother', 'daughter',
  'winter', 'summer', 'finger', 'never', 'every', 'very', 'where',
  'here', 'there', 'were', 'after', 'under', 'over', 'river', 'dinner',
  'letter', 'computer', 'butter', 'matter', 'better', 'either', 'other',
  'another', 'either', 'order', 'border', 'corner', 'power', 'flower',
  'shower', 'tower', 'tiger', 'silver', 'soccer', 'doctor', 'master',
  'monster', 'hammer', 'soldier', 'speaker', 'character', 'number',
  'member', 'remember', 'december', 'november', 'october', 'september',
  'cancer', 'dancer', 'manager', 'teacher', 'farmer', 'singer',
  'lawyer', 'player', 'driver', 'writer', 'reader', 'leader', 'reader',
  // -est not superlative
  'forest', 'honest', 'modest', 'protest', 'arrest', 'invest', 'request',
  'suggest', 'interest', 'harvest', 'priest', 'guest', 'quest', 'west',
  'rest', 'best', 'test', 'nest', 'chest', 'vest', 'pest',
  // -ness common but irreducible
  'business', 'witness', 'fitness', 'illness', 'wilderness',
  // -ity common but should stay
  'city', 'pity', 'unity', 'entity',
]);

/** Words that should never be stemmed at all (proper nouns, common nouns). */
const STEM_HARD_SKIP = new Set([
  ...DEPLURAL_SKIP,
  ...STEM_SKIP,
]);

function restoreSilentE(stem: string): string {
  // After stripping -ing or -ed, check if the original word likely had a silent e
  // bake → bak (stripped 'ing' from baking) → bake (restore)
  // Heuristic: if stem ends in consonant+vowel+consonant where the final consonant
  // isn't doubled, OR ends in a specific pattern (-at, -it, -ot, -et, -ut + single consonant), restore.
  // Conservative: only restore when stem ends in specific patterns.
  if (stem.length < 3) return stem;
  // Common silent-e endings: -at, -it, -ot, -ut, -iv, -us (but -us caught earlier)
  const last3 = stem.slice(-3);
  const consonants = 'bcdfghjklmnpqrstvwxz';
  const vowels = 'aeiou';
  // pattern: [consonant][vowel][consonant] — restore e
  // e.g. bak+ing → bak → bake. writ+ing → writ → write.
  if (
    consonants.includes(last3[0]) &&
    vowels.includes(last3[1]) &&
    consonants.includes(last3[2]) &&
    last3[2] !== last3[1] &&
    // not a doubled consonant case (would be stop, plan, etc. → no e)
    stem[stem.length - 1] !== stem[stem.length - 2]
  ) {
    // Heuristic: -iv → -ive (giving → giv → give)
    if (last3 === 'giv' || last3 === 'liv' || last3 === 'hav') return stem + 'e';
    // Generic case — only restore for known patterns to stay conservative
    if (/[bcdfghjkmnprstvz]e$/.test(stem + 'e')) {
      // Confirmed for verbs like bake, write, ride, hide, drive, hope, joke, vote
      // Avoid: ban→bane, can→cane (these aren't real verb stems anyway)
      // Length guard: only restore on stems ≥4 chars
      if (stem.length >= 4) return stem + 'e';
    }
  }
  return stem;
}

function undoubleConsonant(stem: string): string {
  // running → runn → run, stopped → stopp → stop
  if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) {
    const c = stem[stem.length - 1];
    // Only undouble consonants typically doubled in English inflection
    if ('bdgmnprt'.includes(c)) {
      return stem.slice(0, -1);
    }
  }
  return stem;
}

/**
 * Strip a single morphological suffix and apply restoration heuristics.
 * Returns the stem, or the original word if no rule applied.
 */
function stemWord(word: string): string {
  if (word.length < 5) return word;
  if (STEM_HARD_SKIP.has(word)) return word;

  // Irregular forms — direct map
  if (IRREGULAR_FORMS[word]) return IRREGULAR_FORMS[word];

  // -ing → root
  if (word.endsWith('ing') && word.length >= 5) {
    let stem = word.slice(0, -3);
    stem = undoubleConsonant(stem);
    stem = restoreSilentE(stem);
    if (stem.length >= 3) return stem;
  }

  // -ed → root (only when clearly verbal: length and not in skip-list)
  if (word.endsWith('ed') && word.length >= 5) {
    let stem = word.slice(0, -2);
    // -ied → -y (carried → carry, studied → study)
    if (stem.endsWith('i')) {
      return stem.slice(0, -1) + 'y';
    }
    stem = undoubleConsonant(stem);
    stem = restoreSilentE(stem);
    if (stem.length >= 3) return stem;
  }

  // -ness → root (happiness → happy, kindness → kind, sadness → sad)
  if (word.endsWith('ness') && word.length >= 6) {
    let stem = word.slice(0, -4);
    // -iness → -y (happiness → happi → happy)
    if (stem.endsWith('i')) {
      return stem.slice(0, -1) + 'y';
    }
    if (stem.length >= 3) return stem;
  }

  // -ly → root (quickly → quick, happily → happy, sadly → sad)
  if (word.endsWith('ly') && word.length >= 5) {
    let stem = word.slice(0, -2);
    // -ily → -y (happily → happi → happy)
    if (stem.endsWith('i')) {
      return stem.slice(0, -1) + 'y';
    }
    // -bly → -ble (terribly → terrible)
    if (stem.endsWith('b')) {
      return stem + 'le';
    }
    if (stem.length >= 3) return stem;
  }

  // -ity / -ities → root (creativity → creative, ability → able)
  if (word.endsWith('ities') && word.length >= 7) {
    return word.slice(0, -5) + 'y';
  }
  if (word.endsWith('ity') && word.length >= 6) {
    let stem = word.slice(0, -3);
    // -bility → -ble (ability → able, possibility → possible)
    if (stem.endsWith('bil')) {
      return stem.slice(0, -3) + 'ble';
    }
    // -ivity → -ive (creativity → creative)
    if (stem.endsWith('iv')) {
      return stem + 'e';
    }
    if (stem.length >= 3) return stem;
  }

  // -est superlative (happiest → happy, biggest → big, nicest → nice)
  if (word.endsWith('est') && word.length >= 6) {
    let stem = word.slice(0, -3);
    if (stem.endsWith('i')) {
      return stem.slice(0, -1) + 'y'; // happiest → happi → happy
    }
    stem = undoubleConsonant(stem);
    stem = restoreSilentE(stem);
    if (stem.length >= 3) return stem;
  }

  // -er comparative (happier → happy, bigger → big, nicer → nice)
  // Conservative: only when result is plausibly an adjective stem.
  if (word.endsWith('er') && word.length >= 6) {
    let stem = word.slice(0, -2);
    if (stem.endsWith('i')) {
      return stem.slice(0, -1) + 'y'; // happier → happi → happy
    }
    // Skip undoubling/silent-e on -er to avoid mangling nouns we missed in skip-list.
    // Only return stem when length looks safe AND nothing obvious in skip-list.
    // Leave noun-like -er forms alone by default.
    return word;
  }

  return word;
}

/**
 * Compute the stem key for grouping. Multi-word answers are not stemmed
 * (we'd risk mangling proper nouns like "New York City").
 */
export function stemAnswer(normalized: string): string {
  if (!normalized || normalized.includes(' ')) return normalized;
  return stemWord(normalized);
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
export interface MergeLogEntry { from: string; to: string; dist: number }
export interface NearMissEntry { a: string; b: string; dist: number; countA: number; countB: number; reason: string }

export function fuzzyMergeGroups(
  counts: Record<string, number>
): Record<string, number> {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const canonical: Record<string, string> = {};
  const merged: Record<string, number> = {};
  const mergeLog: MergeLogEntry[] = [];
  const nearMisses: NearMissEntry[] = [];

  for (const [answer] of entries) {
    canonical[answer] = answer;
  }

  for (let i = 0; i < entries.length; i++) {
    const [answerA, countA] = entries[i];
    if (canonical[answerA] !== answerA) continue;

    for (let j = i + 1; j < entries.length; j++) {
      const [answerB, countB] = entries[j];
      if (canonical[answerB] !== answerB) continue;

      const maxDist = getMaxEditDistance(answerA, answerB);
      const dist = levenshtein(answerA, answerB);

      // Count-ratio guard: B must look like a typo of A (rare vs popular)
      if (maxDist > 0 && dist <= maxDist && countB > 2 && countB > countA * 0.3) {
        nearMisses.push({ a: answerA, b: answerB, dist, countA, countB, reason: 'count-ratio too high' });
        continue;
      }

      if (maxDist === 0) {
        // Track near-misses: words that are close but below length threshold
        if (dist <= 2 && dist > 0 && answerA.length >= 4 && answerB.length >= 4) {
          nearMisses.push({ a: answerA, b: answerB, dist, countA, countB, reason: 'below length threshold' });
        }
        continue;
      }

      if (dist <= maxDist) {
        canonical[answerB] = answerA;
        mergeLog.push({ from: answerB, to: answerA, dist });
      } else if (dist <= maxDist + 1 && dist <= 3) {
        nearMisses.push({ a: answerA, b: answerB, dist, countA, countB, reason: 'just outside distance threshold' });
      }
    }
  }

  for (const [answer, count] of entries) {
    const canon = canonical[answer];
    merged[canon] = (merged[canon] || 0) + count;
  }

  // Expose debug info for admin visibility
  if (typeof window !== 'undefined') {
    (window as any).__jinxLastMergeLog = mergeLog;
    (window as any).__jinxLastNearMisses = nearMisses;
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
