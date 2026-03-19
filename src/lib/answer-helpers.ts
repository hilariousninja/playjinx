import { supabase } from '@/integrations/supabase/client';

let aliasCache: Record<string, string> | null = null;
let blockedCache: Set<string> | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 60_000; // 1 minute

export async function getAliasMap(): Promise<Record<string, string>> {
  if (aliasCache && Date.now() - lastFetchTime < CACHE_TTL) return aliasCache;

  const { data } = await supabase
    .from('answer_aliases')
    .select('source_text, canonical_text')
    .eq('status', 'approved');

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.source_text] = row.canonical_text;
  }
  aliasCache = map;
  lastFetchTime = Date.now();
  return map;
}

export async function getBlockedTerms(): Promise<Set<string>> {
  if (blockedCache && Date.now() - lastFetchTime < CACHE_TTL) return blockedCache;

  const { data } = await supabase
    .from('blocked_terms')
    .select('term');

  blockedCache = new Set((data ?? []).map(r => r.term.toLowerCase()));
  return blockedCache;
}

/** Invalidate caches after admin changes */
export function invalidateAnswerCaches() {
  aliasCache = null;
  blockedCache = null;
  lastFetchTime = 0;
}
