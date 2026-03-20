import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Trio quality helpers ───────────────────────────────────────────

/** Extract the categories of both words in a prompt */
function getWordCategories(prompt: { word_a: string; word_b: string }, wordMap: Map<string, string>): [string, string] {
  return [
    wordMap.get(prompt.word_a.toLowerCase()) ?? "unknown",
    wordMap.get(prompt.word_b.toLowerCase()) ?? "unknown",
  ];
}

/** Check if two words in a pair share a category (too overlapping) */
function isSelfOverlapping(prompt: { word_a: string; word_b: string }, wordMap: Map<string, string>): boolean {
  const [catA, catB] = getWordCategories(prompt, wordMap);
  return catA !== "unknown" && catA === catB;
}

/** Score a trio of prompts for variety/quality (higher = better) */
function scoreTrio(
  trio: Array<{ word_a: string; word_b: string; prompt_score: number }>,
  wordMap: Map<string, string>
): number {
  let score = 0;

  // 1. Collect all categories used across the trio
  const allCats = new Set<string>();
  for (const p of trio) {
    const [a, b] = getWordCategories(p, wordMap);
    allCats.add(a);
    allCats.add(b);
  }
  // Reward category diversity (max 6 unique categories across 3 pairs)
  score += allCats.size * 15;

  // 2. Penalise repeated words across prompts
  const allWords = trio.flatMap(p => [p.word_a.toLowerCase(), p.word_b.toLowerCase()]);
  const uniqueWords = new Set(allWords);
  if (uniqueWords.size < allWords.length) {
    score -= (allWords.length - uniqueWords.size) * 50; // heavy penalty
  }

  // 3. Prefer a spread of prompt_scores (mix of easy + hard)
  const scores = trio.map(p => p.prompt_score);
  const range = Math.max(...scores) - Math.min(...scores);
  score += Math.min(range, 40); // reward up to 40 points of spread

  // 4. Penalise self-overlapping pairs (both words same category)
  for (const p of trio) {
    if (isSelfOverlapping(p, wordMap)) {
      score -= 30;
    }
  }

  // 5. Penalise if any pair's categories fully overlap with another pair's
  for (let i = 0; i < trio.length; i++) {
    for (let j = i + 1; j < trio.length; j++) {
      const catsI = new Set(getWordCategories(trio[i], wordMap));
      const catsJ = new Set(getWordCategories(trio[j], wordMap));
      const overlap = [...catsI].filter(c => catsJ.has(c) && c !== "unknown").length;
      if (overlap >= 2) score -= 25;
      else if (overlap === 1) score -= 5;
    }
  }

  return score;
}

/** Pick the best trio from a pool of candidates via sampling */
function selectBestTrio<T extends { word_a: string; word_b: string; prompt_score: number; id: string }>(
  candidates: T[],
  wordMap: Map<string, string>,
  needed: number,
  maxAttempts = 80
): T[] {
  if (candidates.length <= needed) return candidates.slice(0, needed);

  let bestTrio: T[] = [];
  let bestScore = -Infinity;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Fisher-Yates partial shuffle to pick `needed` items
    const pool = [...candidates];
    const picked: T[] = [];
    for (let i = 0; i < needed && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      picked.push(pool[idx]);
      pool.splice(idx, 1);
    }

    const s = scoreTrio(picked, wordMap);
    if (s > bestScore) {
      bestScore = s;
      bestTrio = picked;
    }
  }

  return bestTrio;
}

// ─── Main handler ───────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date().toISOString().split("T")[0];

    // Check if we already have active prompts for today
    const { data: existing } = await supabase
      .from("prompts")
      .select("id")
      .eq("active", true)
      .eq("date", today);

    if (existing && existing.length >= 3) {
      return new Response(
        JSON.stringify({ message: "Prompts already exist for today", count: existing.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deactivate old active prompts and move to archive
    await supabase
      .from("prompts")
      .update({ active: false, mode: "archive" })
      .eq("active", true)
      .neq("date", today);

    const existingCount = existing?.length ?? 0;
    const needed = 3 - existingCount;

    if (needed <= 0) {
      return new Response(
        JSON.stringify({ message: "Already have enough prompts", count: existingCount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Build word→category map for quality scoring ───
    const { data: wordRows } = await supabase
      .from("words")
      .select("word, category")
      .limit(1000);

    const wordMap = new Map<string, string>();
    for (const w of wordRows ?? []) {
      wordMap.set(w.word.toLowerCase(), w.category);
    }

    // ─── Fetch approved prompt candidates ───
    const { data: safePrompts } = await supabase
      .from("prompts")
      .select("*")
      .eq("prompt_status", "approved")
      .eq("prompt_tag", "safe")
      .eq("active", false)
      .is("date", null)
      .limit(50);

    const { data: testPrompts } = await supabase
      .from("prompts")
      .select("*")
      .eq("prompt_status", "approved")
      .eq("prompt_tag", "test")
      .eq("active", false)
      .is("date", null)
      .limit(50);

    const safePool = safePrompts ?? [];
    const testPool = testPrompts ?? [];

    // ─── Assemble the best trio: 2 safe + 1 test (ideal) ───
    let finalTrio: typeof safePool = [];

    if (safePool.length >= 2 && testPool.length >= 1) {
      // Strategy: sample many combos of 2-safe + 1-test, score each trio
      let bestScore = -Infinity;
      const attempts = Math.min(100, safePool.length * (safePool.length - 1) * testPool.length);

      for (let a = 0; a < attempts; a++) {
        const si = Math.floor(Math.random() * safePool.length);
        let sj = Math.floor(Math.random() * safePool.length);
        while (sj === si && safePool.length > 1) sj = Math.floor(Math.random() * safePool.length);
        const ti = Math.floor(Math.random() * testPool.length);

        const candidate = [safePool[si], safePool[sj], testPool[ti]];
        const s = scoreTrio(candidate, wordMap);
        if (s > bestScore) {
          bestScore = s;
          finalTrio = candidate;
        }
      }
    } else {
      // Not enough tagged prompts; use best-trio selection from combined pool
      const combined = [...safePool, ...testPool];
      finalTrio = selectBestTrio(combined, wordMap, needed);
    }

    // ─── Activate the chosen prompts ───
    if (finalTrio.length >= needed) {
      const toActivate = finalTrio.slice(0, needed);
      for (const p of toActivate) {
        await supabase
          .from("prompts")
          .update({ active: true, date: today, mode: "daily" })
          .eq("id", p.id);
      }

      const summary = toActivate.map(p => `${p.word_a}+${p.word_b}`).join(", ");
      const trioScore = scoreTrio(toActivate, wordMap);

      return new Response(
        JSON.stringify({
          message: "Activated curated daily set",
          count: toActivate.length,
          trio: summary,
          trio_quality_score: trioScore,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── FALLBACK: Generate from word pairs with quality filtering ───
    let { data: words } = await supabase
      .from("words")
      .select("word, jinx_score, category")
      .eq("status", "approved")
      .limit(500);

    if (!words || words.length < needed * 2) {
      const { data: allWords } = await supabase
        .from("words")
        .select("word, jinx_score, category")
        .limit(500);
      words = allWords;
    }

    if (!words || words.length < needed * 2) {
      return new Response(
        JSON.stringify({ error: "Not enough words in database" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate candidate pairs, score them as a trio, pick the best
    const shuffle = <T>(arr: T[]): T[] =>
      arr.map(v => ({ v, s: Math.random() })).sort((a, b) => a.s - b.s).map(x => x.v);

    let bestFallbackTrio: Array<{ word_a: string; word_b: string; prompt_score: number }> = [];
    let bestFallbackScore = -Infinity;

    for (let attempt = 0; attempt < 60; attempt++) {
      const shuffled = shuffle(words);
      const candidateTrio = [];
      for (let i = 0; i < needed; i++) {
        const wA = shuffled[i * 2];
        const wB = shuffled[i * 2 + 1];
        if (!wA || !wB) break;

        // Skip pairs where both words share a category
        if (wA.category === wB.category && wA.category !== "Uncategorized") continue;

        candidateTrio.push({
          word_a: wA.word.toUpperCase(),
          word_b: wB.word.toUpperCase(),
          prompt_score: Math.round(((wA.jinx_score ?? 50) + (wB.jinx_score ?? 50)) / 2),
        });
      }

      if (candidateTrio.length >= needed) {
        const s = scoreTrio(candidateTrio, wordMap);
        if (s > bestFallbackScore) {
          bestFallbackScore = s;
          bestFallbackTrio = candidateTrio;
        }
      }
    }

    if (bestFallbackTrio.length < needed) {
      // Last resort: just take anything
      const shuffled = shuffle(words);
      for (let i = 0; i < needed; i++) {
        bestFallbackTrio.push({
          word_a: shuffled[i * 2].word.toUpperCase(),
          word_b: shuffled[i * 2 + 1].word.toUpperCase(),
          prompt_score: Math.round(((shuffled[i * 2].jinx_score ?? 50) + (shuffled[i * 2 + 1].jinx_score ?? 50)) / 2),
        });
      }
    }

    const newPrompts = bestFallbackTrio.map(p => ({
      ...p,
      active: true,
      date: today,
      mode: "daily",
      prompt_status: "pending",
    }));

    const { data: inserted, error } = await supabase
      .from("prompts")
      .insert(newPrompts)
      .select();

    if (error) throw error;

    return new Response(
      JSON.stringify({
        message: "Generated curated daily prompts (fallback)",
        prompts: inserted,
        trio_quality_score: bestFallbackScore,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "An internal error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
