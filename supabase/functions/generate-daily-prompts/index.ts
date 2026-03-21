import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Types ──────────────────────────────────────────────────────────

interface PromptCandidate {
  id: string;
  word_a: string;
  word_b: string;
  prompt_score: number;
  top_answer_pct: number;
  unique_answers: number;
  total_players: number;
  performance: string | null;
  prompt_tag: string | null;
}

interface TrioReport {
  trio: string;
  score: number;
  breakdown: Record<string, number>;
}

// ─── Trio quality scoring ───────────────────────────────────────────

function getWordCategories(
  prompt: { word_a: string; word_b: string },
  wordMap: Map<string, string>
): [string, string] {
  return [
    wordMap.get(prompt.word_a.toLowerCase()) ?? "unknown",
    wordMap.get(prompt.word_b.toLowerCase()) ?? "unknown",
  ];
}

/**
 * Score an individual prompt based on historical play data.
 * Higher = better quality prompt.
 */
function scorePromptQuality(p: PromptCandidate): { total: number; details: Record<string, number> } {
  const details: Record<string, number> = {};

  // Has the prompt ever been played? If not, neutral score.
  const hasHistory = p.total_players > 0;

  // 1. Consensus quality: top_answer_pct in the sweet spot (25-55%)
  //    Too high (>70%) = trivially obvious. Too low (<15%) = fragmented chaos.
  if (hasHistory) {
    const pct = p.top_answer_pct;
    if (pct >= 25 && pct <= 55) {
      details.consensus = 20; // sweet spot
    } else if (pct >= 15 && pct <= 70) {
      details.consensus = 10; // acceptable
    } else if (pct > 70) {
      details.consensus = -15; // too obvious
    } else {
      details.consensus = -10; // too fragmented
    }
  } else {
    details.consensus = 5; // neutral for unplayed
  }

  // 2. Fragmentation risk: too many unique answers relative to players
  if (hasHistory && p.total_players >= 5) {
    const ratio = p.unique_answers / p.total_players;
    if (ratio > 0.8) {
      details.fragmentation = -15; // almost everyone said something different
    } else if (ratio > 0.6) {
      details.fragmentation = -5;
    } else if (ratio <= 0.4) {
      details.fragmentation = 10; // healthy clustering
    } else {
      details.fragmentation = 0;
    }
  } else {
    details.fragmentation = 0;
  }

  // 3. Performance tag bonus/penalty
  if (p.performance === "strong") {
    details.performance = 15;
  } else if (p.performance === "decent") {
    details.performance = 5;
  } else if (p.performance === "weak") {
    details.performance = -20;
  } else {
    details.performance = 0;
  }

  // 4. Prompt score (pre-calculated from word jinx_scores)
  //    Prefer mid-range (40-70) over extremes
  const ps = p.prompt_score;
  if (ps >= 40 && ps <= 70) {
    details.prompt_score_range = 5;
  } else if (ps < 25 || ps > 85) {
    details.prompt_score_range = -5;
  } else {
    details.prompt_score_range = 0;
  }

  const total = Object.values(details).reduce((s, v) => s + v, 0);
  return { total, details };
}

/**
 * Score a trio of prompts for set-level quality.
 * Combines individual prompt quality + set composition signals.
 */
function scoreTrio(
  trio: PromptCandidate[],
  wordMap: Map<string, string>
): { score: number; breakdown: Record<string, number>; confidence: string } {
  const breakdown: Record<string, number> = {};

  // ── Individual prompt quality (sum) ──
  let individualSum = 0;
  for (const p of trio) {
    individualSum += scorePromptQuality(p).total;
  }
  breakdown.individual_quality = individualSum;

  // ── Category diversity ──
  const allCats = new Set<string>();
  for (const p of trio) {
    const [a, b] = getWordCategories(p, wordMap);
    allCats.add(a);
    allCats.add(b);
  }
  breakdown.category_diversity = allCats.size * 12;

  // ── Word uniqueness (no repeated words across trio) ──
  const allWords = trio.flatMap(p => [p.word_a.toLowerCase(), p.word_b.toLowerCase()]);
  const uniqueWords = new Set(allWords);
  if (uniqueWords.size < allWords.length) {
    breakdown.word_overlap = (allWords.length - uniqueWords.size) * -50;
  } else {
    breakdown.word_overlap = 0;
  }

  // ── Difficulty spread (mix of prompt_scores) ──
  const scores = trio.map(p => p.prompt_score);
  const range = Math.max(...scores) - Math.min(...scores);
  breakdown.difficulty_spread = Math.min(range, 40);

  // ── Self-overlap penalty (both words same category in a pair) ──
  let selfOverlapPenalty = 0;
  for (const p of trio) {
    const [catA, catB] = getWordCategories(p, wordMap);
    if (catA !== "unknown" && catA === catB) {
      selfOverlapPenalty -= 25;
    }
  }
  breakdown.self_overlap = selfOverlapPenalty;

  // ── Cross-pair category overlap ──
  let crossOverlap = 0;
  for (let i = 0; i < trio.length; i++) {
    for (let j = i + 1; j < trio.length; j++) {
      const catsI = new Set(getWordCategories(trio[i], wordMap));
      const catsJ = new Set(getWordCategories(trio[j], wordMap));
      const overlap = [...catsI].filter(c => catsJ.has(c) && c !== "unknown").length;
      if (overlap >= 2) crossOverlap -= 20;
      else if (overlap === 1) crossOverlap -= 3;
    }
  }
  breakdown.cross_overlap = crossOverlap;

  // ── Penalise all-weak or all-unplayed trios ──
  const weakCount = trio.filter(p => p.performance === "weak").length;
  const unplayedCount = trio.filter(p => p.total_players === 0).length;
  if (weakCount >= 2) breakdown.weak_cluster = -20;
  else breakdown.weak_cluster = 0;
  if (unplayedCount >= 3) breakdown.untested_risk = -10;
  else breakdown.untested_risk = 0;

  // ── Bonus for having a mix of strong + test/unplayed (discovery) ──
  const hasStrong = trio.some(p => p.performance === "strong");
  const hasTest = trio.some(p => p.prompt_tag === "test" || p.total_players === 0);
  if (hasStrong && hasTest) {
    breakdown.discovery_mix = 10;
  } else {
    breakdown.discovery_mix = 0;
  }

  // ── Surprise bonus: reward one "wild card" prompt in an otherwise safe trio ──
  // A wild card is a test-tagged or unplayed prompt among 2+ strong/decent prompts.
  // This prevents over-optimising toward safe-only trios.
  const solidCount = trio.filter(p => p.performance === "strong" || p.performance === "decent").length;
  const wildCards = trio.filter(p => p.prompt_tag === "test" || (p.total_players === 0 && p.performance === null));
  if (solidCount >= 2 && wildCards.length === 1) {
    breakdown.surprise_factor = 12; // one risky pick in a strong set = interesting
  } else if (solidCount === 3) {
    breakdown.surprise_factor = -3; // all proven = slightly boring, still fine
  } else {
    breakdown.surprise_factor = 0;
  }

  const score = Object.values(breakdown).reduce((s, v) => s + v, 0);

  // ── Editorial confidence label ──
  let confidence: string;
  if (score >= 100) confidence = "strong";
  else if (score >= 50) confidence = "acceptable";
  else confidence = "risky";

  return { score, breakdown, confidence };
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

    // Check if this is a dry-run / audit request
    let dryRun = false;
    try {
      const body = await req.clone().json();
      if (body?.dry_run) dryRun = true;
    } catch { /* no body is fine */ }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date().toISOString().split("T")[0];

    // Check if we already have active prompts for today
    const { data: existing } = await supabase
      .from("prompts")
      .select("*")
      .eq("active", true)
      .eq("date", today);

    if (existing && existing.length >= 3) {
      // Return audit info for the current set
      const { data: wordRows } = await supabase.from("words").select("word, category").limit(1000);
      const wordMap = new Map<string, string>();
      for (const w of wordRows ?? []) wordMap.set(w.word.toLowerCase(), w.category);

      const currentTrio = existing.map(p => ({
        ...p,
        top_answer_pct: p.top_answer_pct ?? 0,
        unique_answers: p.unique_answers ?? 0,
        total_players: p.total_players ?? 0,
      })) as PromptCandidate[];

      const { score, breakdown, confidence } = scoreTrio(currentTrio, wordMap);
      const individualDetails = currentTrio.map(p => ({
        pair: `${p.word_a} + ${p.word_b}`,
        tag: p.prompt_tag,
        performance: p.performance,
        top_answer_pct: p.top_answer_pct,
        unique_answers: p.unique_answers,
        total_players: p.total_players,
        quality: scorePromptQuality(p),
      }));

      return new Response(
        JSON.stringify({
          message: "Prompts already exist for today",
          count: existing.length,
          trio: currentTrio.map(p => `${p.word_a}+${p.word_b}`).join(", "),
          trio_quality_score: score,
          editorial_confidence: confidence,
          score_breakdown: breakdown,
          prompts: individualDetails,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!dryRun) {
      // Deactivate old active prompts
      await supabase
        .from("prompts")
        .update({ active: false, mode: "archive" })
        .eq("active", true)
        .neq("date", today);
    }

    const existingCount = existing?.length ?? 0;
    const needed = 3 - existingCount;

    if (needed <= 0 && !dryRun) {
      return new Response(
        JSON.stringify({ message: "Already have enough prompts", count: existingCount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Build word→category map ───
    const { data: wordRows } = await supabase
      .from("words")
      .select("word, category")
      .limit(1000);

    const wordMap = new Map<string, string>();
    for (const w of wordRows ?? []) {
      wordMap.set(w.word.toLowerCase(), w.category);
    }

    // ─── Fetch approved prompt candidates ───
    // Fetch approved prompt candidates (safe or untagged = safe, test = test)
    // Allow reuse of previously played prompts (don't filter by date IS NULL)
    const { data: approvedPrompts } = await supabase
      .from("prompts")
      .select("*")
      .eq("prompt_status", "approved")
      .eq("active", false)
      .neq("date", today) // don't pick today's deactivated ones
      .limit(100);

    const safePrompts = (approvedPrompts ?? []).filter(
      p => !p.prompt_tag || p.prompt_tag === "safe"
    );
    const testPrompts = (approvedPrompts ?? []).filter(
      p => p.prompt_tag === "test"
    );

    const toCandidate = (p: any): PromptCandidate => ({
      id: p.id,
      word_a: p.word_a,
      word_b: p.word_b,
      prompt_score: p.prompt_score ?? 50,
      top_answer_pct: p.top_answer_pct ?? 0,
      unique_answers: p.unique_answers ?? 0,
      total_players: p.total_players ?? 0,
      performance: p.performance ?? null,
      prompt_tag: p.prompt_tag ?? null,
    });

    const safePool = safePrompts.map(toCandidate);
    const testPool = testPrompts.map(toCandidate);

    // ─── Sample trios and pick the best ───
    let bestTrio: PromptCandidate[] = [];
    let bestScore = -Infinity;
    let bestBreakdown: Record<string, number> = {};
    let bestConfidence = "risky";
    const topCandidates: TrioReport[] = [];

    const sampleTrio = (candidates: PromptCandidate[]) => {
      const { score, breakdown, confidence } = scoreTrio(candidates, wordMap);
      const report: TrioReport = {
        trio: candidates.map(p => `${p.word_a}+${p.word_b}`).join(", "),
        score,
        breakdown,
      };
      topCandidates.push(report);

      if (score > bestScore) {
        bestScore = score;
        bestTrio = candidates;
        bestBreakdown = breakdown;
        bestConfidence = confidence;
      }
    };

    if (safePool.length >= 2 && testPool.length >= 1) {
      const attempts = Math.min(120, safePool.length * (safePool.length - 1) * testPool.length);
      for (let a = 0; a < attempts; a++) {
        const si = Math.floor(Math.random() * safePool.length);
        let sj = Math.floor(Math.random() * safePool.length);
        while (sj === si && safePool.length > 1) sj = Math.floor(Math.random() * safePool.length);
        const ti = Math.floor(Math.random() * testPool.length);
        sampleTrio([safePool[si], safePool[sj], testPool[ti]]);
      }
    } else {
      const combined = [...safePool, ...testPool];
      const attempts = Math.min(100, combined.length * (combined.length - 1));
      for (let a = 0; a < attempts; a++) {
        const pool = [...combined];
        const picked: PromptCandidate[] = [];
        for (let i = 0; i < needed && pool.length > 0; i++) {
          const idx = Math.floor(Math.random() * pool.length);
          picked.push(pool[idx]);
          pool.splice(idx, 1);
        }
        if (picked.length >= needed) sampleTrio(picked);
      }
    }

    // Sort top candidates for the audit log (top 5)
    topCandidates.sort((a, b) => b.score - a.score);
    const auditLog = topCandidates.slice(0, 5);

    // ─── Activate or return dry-run results ───
    if (bestTrio.length >= needed) {
      const toActivate = bestTrio.slice(0, needed);

      if (!dryRun) {
        for (const p of toActivate) {
          await supabase
            .from("prompts")
            .update({ active: true, date: today, mode: "daily" })
            .eq("id", p.id);
        }
      }

      const summary = toActivate.map(p => `${p.word_a}+${p.word_b}`).join(", ");
      const individualDetails = toActivate.map(p => ({
        pair: `${p.word_a} + ${p.word_b}`,
        tag: p.prompt_tag,
        performance: p.performance,
        top_answer_pct: p.top_answer_pct,
        unique_answers: p.unique_answers,
        total_players: p.total_players,
        quality: scorePromptQuality(p),
      }));

      return new Response(
        JSON.stringify({
          message: dryRun ? "Dry run — would select this trio" : "Activated curated daily set",
          dry_run: dryRun,
          count: toActivate.length,
          trio: summary,
          trio_quality_score: bestScore,
          editorial_confidence: bestConfidence,
          score_breakdown: bestBreakdown,
          prompts: individualDetails,
          runner_ups: auditLog.slice(1, 4),
          candidates_sampled: topCandidates.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── FALLBACK: Generate from word pairs ───
    const shuffle = <T>(arr: T[]): T[] =>
      arr.map(v => ({ v, s: Math.random() })).sort((a, b) => a.s - b.s).map(x => x.v);

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

    let bestFallbackTrio: PromptCandidate[] = [];
    let bestFallbackScore = -Infinity;

    for (let attempt = 0; attempt < 60; attempt++) {
      const shuffled = shuffle(words);
      const candidateTrio: PromptCandidate[] = [];
      for (let i = 0; i < needed; i++) {
        const wA = shuffled[i * 2];
        const wB = shuffled[i * 2 + 1];
        if (!wA || !wB) break;
        if (wA.category === wB.category && wA.category !== "Uncategorized") continue;
        candidateTrio.push({
          id: `fallback-${i}`,
          word_a: wA.word.toUpperCase(),
          word_b: wB.word.toUpperCase(),
          prompt_score: Math.round(((wA.jinx_score ?? 50) + (wB.jinx_score ?? 50)) / 2),
          top_answer_pct: 0,
          unique_answers: 0,
          total_players: 0,
          performance: null,
          prompt_tag: null,
        });
      }

      if (candidateTrio.length >= needed) {
        const { score } = scoreTrio(candidateTrio, wordMap);
        if (score > bestFallbackScore) {
          bestFallbackScore = score;
          bestFallbackTrio = candidateTrio;
        }
      }
    }

    if (bestFallbackTrio.length < needed) {
      const shuffled = shuffle(words);
      for (let i = 0; i < needed; i++) {
        bestFallbackTrio.push({
          id: `fallback-last-${i}`,
          word_a: shuffled[i * 2].word.toUpperCase(),
          word_b: shuffled[i * 2 + 1].word.toUpperCase(),
          prompt_score: Math.round(((shuffled[i * 2].jinx_score ?? 50) + (shuffled[i * 2 + 1].jinx_score ?? 50)) / 2),
          top_answer_pct: 0,
          unique_answers: 0,
          total_players: 0,
          performance: null,
          prompt_tag: null,
        });
      }
    }

    if (dryRun) {
      return new Response(
        JSON.stringify({
          message: "Dry run — would generate fallback trio",
          dry_run: true,
          trio: bestFallbackTrio.map(p => `${p.word_a}+${p.word_b}`).join(", "),
          trio_quality_score: bestFallbackScore,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newPrompts = bestFallbackTrio.map(p => ({
      word_a: p.word_a,
      word_b: p.word_b,
      prompt_score: p.prompt_score,
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
    console.error("generate-daily-prompts error:", err);
    return new Response(
      JSON.stringify({ error: "An internal error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
