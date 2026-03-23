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
  source?: "future_bank" | "generated_new" | "reused_archive";
}

interface TrioReport {
  trio: string;
  score: number;
  breakdown: Record<string, number>;
}

// ─── Prompt lifecycle helpers ───────────────────────────────────────

/**
 * A prompt is "played" (historical) if it has ever received answers.
 * total_players > 0 is the primary signal.
 */
function isHistorical(p: { total_players: number; mode?: string }): boolean {
  return p.total_players > 0 || p.mode === "archive";
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

function scorePromptQuality(p: PromptCandidate): { total: number; details: Record<string, number> } {
  const details: Record<string, number> = {};
  const hasHistory = p.total_players > 0;

  if (hasHistory) {
    const pct = p.top_answer_pct;
    if (pct >= 25 && pct <= 55) details.consensus = 20;
    else if (pct >= 15 && pct <= 70) details.consensus = 10;
    else if (pct > 70) details.consensus = -15;
    else details.consensus = -10;
  } else {
    details.consensus = 5;
  }

  if (hasHistory && p.total_players >= 5) {
    const ratio = p.unique_answers / p.total_players;
    if (ratio > 0.8) details.fragmentation = -15;
    else if (ratio > 0.6) details.fragmentation = -5;
    else if (ratio <= 0.4) details.fragmentation = 10;
    else details.fragmentation = 0;
  } else {
    details.fragmentation = 0;
  }

  if (p.performance === "strong") details.performance = 15;
  else if (p.performance === "decent") details.performance = 5;
  else if (p.performance === "weak") details.performance = -20;
  else details.performance = 0;

  const ps = p.prompt_score;
  if (ps >= 40 && ps <= 70) details.prompt_score_range = 5;
  else if (ps < 25 || ps > 85) details.prompt_score_range = -5;
  else details.prompt_score_range = 0;

  const total = Object.values(details).reduce((s, v) => s + v, 0);
  return { total, details };
}

function scoreTrio(
  trio: PromptCandidate[],
  wordMap: Map<string, string>
): { score: number; breakdown: Record<string, number>; confidence: string } {
  const breakdown: Record<string, number> = {};

  let individualSum = 0;
  for (const p of trio) individualSum += scorePromptQuality(p).total;
  breakdown.individual_quality = individualSum;

  const allCats = new Set<string>();
  for (const p of trio) {
    const [a, b] = getWordCategories(p, wordMap);
    allCats.add(a);
    allCats.add(b);
  }
  breakdown.category_diversity = allCats.size * 12;

  const allWords = trio.flatMap(p => [p.word_a.toLowerCase(), p.word_b.toLowerCase()]);
  const uniqueWords = new Set(allWords);
  breakdown.word_overlap = uniqueWords.size < allWords.length
    ? (allWords.length - uniqueWords.size) * -50 : 0;

  const scores = trio.map(p => p.prompt_score);
  breakdown.difficulty_spread = Math.min(Math.max(...scores) - Math.min(...scores), 40);

  let selfOverlapPenalty = 0;
  for (const p of trio) {
    const [catA, catB] = getWordCategories(p, wordMap);
    if (catA !== "unknown" && catA === catB) selfOverlapPenalty -= 25;
  }
  breakdown.self_overlap = selfOverlapPenalty;

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

  const weakCount = trio.filter(p => p.performance === "weak").length;
  breakdown.weak_cluster = weakCount >= 2 ? -20 : 0;

  const unplayedCount = trio.filter(p => p.total_players === 0).length;
  breakdown.untested_risk = unplayedCount >= 3 ? -10 : 0;

  const hasStrong = trio.some(p => p.performance === "strong");
  const hasTest = trio.some(p => p.prompt_tag === "test" || p.total_players === 0);
  breakdown.discovery_mix = hasStrong && hasTest ? 10 : 0;

  const solidCount = trio.filter(p => p.performance === "strong" || p.performance === "decent").length;
  const wildCards = trio.filter(p => p.prompt_tag === "test" || (p.total_players === 0 && p.performance === null));
  if (solidCount >= 2 && wildCards.length === 1) breakdown.surprise_factor = 12;
  else if (solidCount === 3) breakdown.surprise_factor = -3;
  else breakdown.surprise_factor = 0;

  const score = Object.values(breakdown).reduce((s, v) => s + v, 0);
  const confidence = score >= 100 ? "strong" : score >= 50 ? "acceptable" : "risky";
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

    let dryRun = false;
    let forceAiGenerate = false;
    try {
      const body = await req.clone().json();
      if (body?.dry_run) dryRun = true;
      if (body?.ai_generate) forceAiGenerate = true;
    } catch { /* no body is fine */ }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date().toISOString().split("T")[0];
    const pairKey = (a: string, b: string) => [a.toLowerCase(), b.toLowerCase()].sort().join("|");

    // Historical prompt pairs: any pair that has actual answer history
    const { data: historicalPairs } = await supabase
      .from("prompts")
      .select("word_a, word_b")
      .gt("total_players", 0)
      .limit(2000);

    const historicalPairKeys = new Set((historicalPairs ?? []).map((p) => pairKey(p.word_a, p.word_b)));

    let { data: existingForToday } = await supabase
      .from("prompts")
      .select("*")
      .eq("active", true)
      .eq("date", today);

    const isInvalidActivePrompt = (p: any) => {
      const hasAnswerHistory = (p.total_players ?? 0) > 0;
      const pairWasHistorical = historicalPairKeys.has(pairKey(p.word_a, p.word_b));
      return hasAnswerHistory || p.mode === "archive" || pairWasHistorical;
    };

    const invalidActivePrompts = (existingForToday ?? []).filter(isInvalidActivePrompt);

    // Hard safeguard cleanup: historical prompts must not stay in today's active set
    if (invalidActivePrompts.length > 0 && !dryRun) {
      for (const p of invalidActivePrompts) {
        const createdDate = new Date(p.created_at).toISOString().split("T")[0];
        const hasAnswerHistory = (p.total_players ?? 0) > 0;

        const patch: Record<string, unknown> = { active: false };
        if (hasAnswerHistory) {
          patch.mode = "archive";
          patch.date = createdDate;
        }

        await supabase
          .from("prompts")
          .update(patch)
          .eq("id", p.id);
      }

      const { data: refreshed } = await supabase
        .from("prompts")
        .select("*")
        .eq("active", true)
        .eq("date", today);

      existingForToday = refreshed ?? [];
    }

    const validExisting = (existingForToday ?? []).filter((p) => !isInvalidActivePrompt(p));

    // ─── Audit: return info about current valid active set ───
    if (validExisting.length >= 3 && !forceAiGenerate) {
      const { data: wordRows } = await supabase.from("words").select("word, category").limit(1000);
      const wordMap = new Map<string, string>();
      for (const w of wordRows ?? []) wordMap.set(w.word.toLowerCase(), w.category);

      const currentTrio = validExisting.slice(0, 3).map(p => ({
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
        source: isHistorical(p) ? "reused_archive" : "future_bank",
        has_answer_history: p.total_players > 0,
      }));

      const reusedCount = individualDetails.filter(p => p.has_answer_history).length;
      const warnings: string[] = [];
      if (invalidActivePrompts.length > 0) {
        warnings.push(`Lifecycle safeguard removed ${invalidActivePrompts.length} invalid active prompt(s) from today's set.`);
      }

      return new Response(
        JSON.stringify({
          message: "Prompts already exist for today",
          count: currentTrio.length,
          trio: currentTrio.map(p => `${p.word_a}+${p.word_b}`).join(", "),
          trio_quality_score: score,
          editorial_confidence: confidence,
          score_breakdown: breakdown,
          prompts: individualDetails,
          warnings,
          lifecycle: {
            reused_archive: reusedCount,
            fresh: individualDetails.length - reusedCount,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── AI-powered trio generation ───
    if (forceAiGenerate) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Load tuning settings
      let categoryWeights: Record<string, number> = {};
      let generationControls: Record<string, number> = {};
      try {
        const { data: tuningRows } = await supabase.from("tuning_settings").select("key, value");
        for (const row of tuningRows ?? []) {
          if (row.key === "category_weights") categoryWeights = row.value as Record<string, number>;
          if (row.key === "generation_controls") generationControls = row.value as Record<string, number>;
        }
      } catch { /* use defaults */ }

      // Fetch word database
      const { data: wordRows } = await supabase
        .from("words")
        .select("word, category, jinx_score, times_used, status")
        .in("status", ["keep", "approved", "unreviewed"])
        .limit(500);

      if (!wordRows || wordRows.length < 6) {
        return new Response(JSON.stringify({ error: "Not enough words in database" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Apply category weights: filter out "Off" categories, annotate weight
      const filteredWords = wordRows.filter(w => {
        const cat = (w.category || "Uncategorized").toLowerCase();
        const weight = categoryWeights[cat] ?? 50;
        return weight > 10; // exclude "Off" categories
      });

      if (filteredWords.length < 6) {
        return new Response(JSON.stringify({ error: "Not enough words after applying category weights" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get historical prompts to avoid reuse
      const { data: historicalPrompts } = await supabase
        .from("prompts")
        .select("word_a, word_b")
        .gt("total_players", 0)
        .limit(500);

      const usedPairs = new Set((historicalPrompts ?? []).map(p =>
        [p.word_a.toLowerCase(), p.word_b.toLowerCase()].sort().join("|")
      ));

      // Get all existing prompts to avoid exact duplicates
      const { data: allPrompts } = await supabase
        .from("prompts")
        .select("word_a, word_b")
        .limit(2000);

      const existingPairs = new Set((allPrompts ?? []).map(p =>
        [p.word_a.toLowerCase(), p.word_b.toLowerCase()].sort().join("|")
      ));

      const categories = [...new Set(filteredWords.map(w => w.category).filter(c => c !== "Uncategorized"))];

      // Build weighted word list with weight annotations
      const wordList = filteredWords.map(w => {
        const cat = (w.category || "Uncategorized").toLowerCase();
        const weight = categoryWeights[cat] ?? 50;
        const weightTag = weight >= 80 ? "HIGH PRIORITY" : weight >= 60 ? "preferred" : weight <= 25 ? "low priority" : "";
        return `${w.word} (${w.category}, score: ${w.jinx_score}${weightTag ? `, ${weightTag}` : ""})`;
      }).join(", ");

      // Build tuning instructions
      const tuningInstructions: string[] = [];
      const conc = generationControls.concreteness_bias ?? 60;
      if (conc >= 70) tuningInstructions.push("STRONGLY prefer concrete, tangible word pairs. Avoid abstract pairings.");
      else if (conc >= 50) tuningInstructions.push("Prefer concrete word pairs when possible.");
      const absPen = generationControls.abstractness_penalty ?? 40;
      if (absPen >= 70) tuningInstructions.push("HEAVILY penalise abstract or vague word pairings like trust+power or memory+hope.");
      else if (absPen >= 50) tuningInstructions.push("Penalise abstract pairings — prefer real-world, tangible combinations.");
      const consTarget = generationControls.consensus_target ?? 70;
      if (consTarget >= 70) tuningInstructions.push("Target STRONG consensus — pairs should have an obvious likely top answer.");
      const fragPen = generationControls.fragmentation_penalty ?? 60;
      if (fragPen >= 70) tuningInstructions.push("STRONGLY avoid pairs likely to produce scattered, fragmented answers.");
      const catDiv = generationControls.category_diversity ?? 70;
      if (catDiv >= 70) tuningInstructions.push("Ensure the trio uses DIVERSE categories — no two pairs from the same category pair.");

      // Build category weight guidance
      const highCats = Object.entries(categoryWeights).filter(([, v]) => v >= 70).map(([k]) => k);
      const lowCats = Object.entries(categoryWeights).filter(([, v]) => v > 10 && v <= 25).map(([k]) => k);
      if (highCats.length > 0) tuningInstructions.push(`Favour words from these categories: ${highCats.join(", ")}`);
      if (lowCats.length > 0) tuningInstructions.push(`Use words from these categories sparingly: ${lowCats.join(", ")}`);

      const systemPrompt = `You are a game designer for JINX Daily. Players see two words and type one linking word they think most people will say. The goal is crowd convergence — mind-matching.

A great JINX trio needs 3 pairs where each pair:
- Is instantly understandable (2-second comprehension)
- Has strong shared-answer gravity (at least 1 obvious crowd answer)
- Has controlled spread (some variation, not chaos)
- Creates a satisfying reveal
- Feels natural and playable

The trio together should feel varied, not repetitive. Different categories, different energies, different likely answers.

${tuningInstructions.length > 0 ? `TUNING INSTRUCTIONS (from creator settings):\n${tuningInstructions.map(t => `- ${t}`).join("\n")}\n` : ""}
HARD RULES:
- Do NOT use these already-played pairs: ${[...usedPairs].map(p => p.replace("|", " + ")).join(", ") || "none"}
- Do NOT duplicate: ${[...existingPairs].map(p => p.replace("|", " + ")).join(", ") || "none"}
- Each word can appear at most ONCE across the trio
- Prefer cross-category pairs
- The "instant JINX feel" test: Would a player immediately think "I know what most people would say"?
- Words marked HIGH PRIORITY should be favoured
- Words marked low priority should be used sparingly`;

      const userPrompt = `Generate 3 strong JINX pairs for a daily set, using words from this database:

${wordList}

Categories available: ${categories.join(", ")}

For each pair, return:
- word_a, word_b (from the database above)
- predicted_top_5 likely crowd answers
- consensus_strength (0-100)
- fragmentation_risk (0-100, lower = better)
- fast_comprehension (0-100)
- reveal_satisfaction (0-100)
- naturalness (0-100)
- total_score (0-100)
- why_jinxable
- why_might_fail

Also return trio_reasoning explaining why these 3 work well together and any warnings.

Return JSON with this structure:
{
  "pairs": [
    { "word_a": "WORD", "word_b": "WORD", "predicted_top_5": [...], "consensus_strength": 80, "fragmentation_risk": 15, "fast_comprehension": 90, "reveal_satisfaction": 85, "naturalness": 90, "total_score": 85, "why_jinxable": "...", "why_might_fail": "..." }
  ],
  "trio_reasoning": "Why these 3 pairs work well as a daily set",
  "trio_confidence": "strong",
  "warnings": ["any concerns"],
  "runner_ups": [
    { "word_a": "WORD", "word_b": "WORD", "total_score": 75, "reason": "why this was close" }
  ]
}`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "generate_trio",
              description: "Generate a scored JINX daily trio",
              parameters: {
                type: "object",
                properties: {
                  pairs: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        word_a: { type: "string" },
                        word_b: { type: "string" },
                        predicted_top_5: { type: "array", items: { type: "string" } },
                        consensus_strength: { type: "number" },
                        fragmentation_risk: { type: "number" },
                        fast_comprehension: { type: "number" },
                        reveal_satisfaction: { type: "number" },
                        naturalness: { type: "number" },
                        total_score: { type: "number" },
                        why_jinxable: { type: "string" },
                        why_might_fail: { type: "string" },
                      },
                      required: ["word_a", "word_b", "predicted_top_5", "total_score", "why_jinxable", "why_might_fail"],
                    },
                  },
                  trio_reasoning: { type: "string" },
                  trio_confidence: { type: "string", enum: ["strong", "acceptable", "risky"] },
                  warnings: { type: "array", items: { type: "string" } },
                  runner_ups: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        word_a: { type: "string" },
                        word_b: { type: "string" },
                        total_score: { type: "number" },
                        reason: { type: "string" },
                      },
                    },
                  },
                },
                required: ["pairs", "trio_reasoning", "trio_confidence"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "generate_trio" } },
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("AI gateway error:", aiResponse.status, errText);
        return new Response(JSON.stringify({ error: "AI generation failed" }), {
          status: aiResponse.status === 429 ? 429 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let parsed: any;
      try {
        parsed = JSON.parse(toolCall.function.arguments);
      } catch {
        return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        message: "AI-generated trio candidates",
        ai_generated: true,
        pairs: parsed.pairs ?? [],
        trio_reasoning: parsed.trio_reasoning ?? "",
        trio_confidence: parsed.trio_confidence ?? "unknown",
        warnings: parsed.warnings ?? [],
        runner_ups: parsed.runner_ups ?? [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Standard generation: only from UNUSED approved future bank ───
    if (!dryRun) {
      await supabase
        .from("prompts")
        .update({ active: false, mode: "archive" })
        .eq("active", true)
        .neq("date", today);
    }

    const existingCount = validExisting.length;
    const needed = 3 - existingCount;

    if (needed <= 0 && !dryRun) {
      return new Response(
        JSON.stringify({ message: "Already have enough prompts", count: existingCount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: wordRows } = await supabase.from("words").select("word, category").limit(1000);
    const wordMap = new Map<string, string>();
    for (const w of wordRows ?? []) wordMap.set(w.word.toLowerCase(), w.category);

    // ─── STRICT LIFECYCLE: Only fetch UNUSED approved prompts ───
    // "Unused" = approved, not active, has NEVER been played (total_players = 0),
    // and mode is NOT 'archive' (never been live before)
    const { data: futureBank } = await supabase
      .from("prompts")
      .select("*")
      .eq("prompt_status", "approved")
      .eq("active", false)
      .eq("total_players", 0)        // HARD SAFEGUARD: never played
      .neq("mode", "archive")        // never been live
      .limit(100);

    const toCandidate = (p: any, source: "future_bank" | "generated_new"): PromptCandidate => ({
      id: p.id,
      word_a: p.word_a,
      word_b: p.word_b,
      prompt_score: p.prompt_score ?? 50,
      top_answer_pct: p.top_answer_pct ?? 0,
      unique_answers: p.unique_answers ?? 0,
      total_players: p.total_players ?? 0,
      performance: p.performance ?? null,
      prompt_tag: p.prompt_tag ?? null,
      source,
    });

    const futurePool = (futureBank ?? [])
      .map((p) => toCandidate(p, "future_bank"))
      .filter((p) => !historicalPairKeys.has(pairKey(p.word_a, p.word_b)));

    // ─── Try to build trio from future bank ───
    let bestTrio: PromptCandidate[] = [];
    let bestScore = -Infinity;
    let bestBreakdown: Record<string, number> = {};
    let bestConfidence = "risky";
    const topCandidates: TrioReport[] = [];

    const sampleTrio = (candidates: PromptCandidate[]) => {
      const { score, breakdown, confidence } = scoreTrio(candidates, wordMap);
      topCandidates.push({
        trio: candidates.map(p => `${p.word_a}+${p.word_b}`).join(", "),
        score,
        breakdown,
      });
      if (score > bestScore) {
        bestScore = score;
        bestTrio = candidates;
        bestBreakdown = breakdown;
        bestConfidence = confidence;
      }
    };

    if (futurePool.length >= needed) {
      const attempts = Math.min(200, futurePool.length ** 2);
      for (let a = 0; a < attempts; a++) {
        const pool = [...futurePool];
        const picked: PromptCandidate[] = [];
        for (let i = 0; i < needed && pool.length > 0; i++) {
          const idx = Math.floor(Math.random() * pool.length);
          picked.push(pool[idx]);
          pool.splice(idx, 1);
        }
        if (picked.length >= needed) sampleTrio(picked);
      }
    }

    topCandidates.sort((a, b) => b.score - a.score);

    // ─── Activate best trio if found ───
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

      return new Response(
        JSON.stringify({
          message: dryRun ? "Dry run — would select this trio" : "Activated curated daily set",
          dry_run: dryRun,
          count: toActivate.length,
          trio: toActivate.map(p => `${p.word_a}+${p.word_b}`).join(", "),
          trio_quality_score: bestScore,
          editorial_confidence: bestConfidence,
          score_breakdown: bestBreakdown,
          prompts: toActivate.map(p => ({
            pair: `${p.word_a} + ${p.word_b}`,
            tag: p.prompt_tag,
            performance: p.performance,
            top_answer_pct: p.top_answer_pct,
            unique_answers: p.unique_answers,
            total_players: p.total_players,
            quality: scorePromptQuality(p),
            source: p.source,
            has_answer_history: false,
          })),
          runner_ups: topCandidates.slice(1, 4),
          candidates_sampled: topCandidates.length,
          warnings: [],
          lifecycle: { future_bank: toActivate.length, generated_new: 0, reused_archive: 0 },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── FALLBACK: Generate from source words (never reuse archive) ───
    // Load tuning settings for fallback generation
    let fallbackCatWeights: Record<string, number> = {};
    try {
      const { data: tuningRows } = await supabase.from("tuning_settings").select("key, value").eq("key", "category_weights");
      if (tuningRows?.[0]?.value) fallbackCatWeights = tuningRows[0].value as Record<string, number>;
    } catch { /* defaults */ }

    const shuffle = <T>(arr: T[]): T[] =>
      arr.map(v => ({ v, s: Math.random() })).sort((a, b) => a.s - b.s).map(x => x.v);

    let { data: words } = await supabase
      .from("words")
      .select("word, jinx_score, category")
      .in("status", ["approved", "keep"])
      .limit(500);

    if (!words || words.length < needed * 2) {
      const { data: allWords } = await supabase
        .from("words")
        .select("word, jinx_score, category")
        .limit(500);
      words = allWords;
    }

    // Apply category weight filtering
    if (words && Object.keys(fallbackCatWeights).length > 0) {
      words = words.filter(w => {
        const cat = (w.category || "Uncategorized").toLowerCase();
        return (fallbackCatWeights[cat] ?? 50) > 10;
      });
    }

    if (!words || words.length < needed * 2) {
      return new Response(
        JSON.stringify({ error: "Not enough words in database. Add approved words or generate AI candidates." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exclude pairs that already exist as prompts (played or not)
    const { data: allExisting } = await supabase
      .from("prompts")
      .select("word_a, word_b")
      .limit(2000);

    const existingPairKeys = new Set((allExisting ?? []).map(p =>
      [p.word_a.toLowerCase(), p.word_b.toLowerCase()].sort().join("|")
    ));

    let bestFallbackTrio: PromptCandidate[] = [];
    let bestFallbackScore = -Infinity;

    for (let attempt = 0; attempt < 80; attempt++) {
      const shuffled = shuffle(words);
      const candidateTrio: PromptCandidate[] = [];
      const usedWords = new Set<string>();

      for (let i = 0; i < shuffled.length - 1 && candidateTrio.length < needed; i++) {
        for (let j = i + 1; j < shuffled.length && candidateTrio.length < needed; j++) {
          const wA = shuffled[i];
          const wB = shuffled[j];
          if (usedWords.has(wA.word) || usedWords.has(wB.word)) continue;
          if (wA.category === wB.category && wA.category !== "Uncategorized") continue;
          const key = [wA.word.toLowerCase(), wB.word.toLowerCase()].sort().join("|");
          if (existingPairKeys.has(key)) continue;

          usedWords.add(wA.word);
          usedWords.add(wB.word);
          candidateTrio.push({
            id: `generated-${candidateTrio.length}`,
            word_a: wA.word.toUpperCase(),
            word_b: wB.word.toUpperCase(),
            prompt_score: Math.round(((wA.jinx_score ?? 50) + (wB.jinx_score ?? 50)) / 2),
            top_answer_pct: 0,
            unique_answers: 0,
            total_players: 0,
            performance: null,
            prompt_tag: null,
            source: "generated_new",
          });
        }
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
      return new Response(
        JSON.stringify({ error: "Could not generate enough unique pairs. Consider adding more approved words or generating AI candidates." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (dryRun) {
      return new Response(
        JSON.stringify({
          message: "Dry run — would generate new trio from source words",
          dry_run: true,
          trio: bestFallbackTrio.map(p => `${p.word_a}+${p.word_b}`).join(", "),
          trio_quality_score: bestFallbackScore,
          prompts: bestFallbackTrio.map(p => ({
            pair: `${p.word_a} + ${p.word_b}`,
            source: "generated_new",
            has_answer_history: false,
          })),
          warnings: ["Generated from source words — not from approved future bank. Consider generating AI candidates first."],
          lifecycle: { future_bank: 0, generated_new: needed, reused_archive: 0 },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newPrompts = bestFallbackTrio.slice(0, needed).map(p => ({
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
        message: "Generated new daily prompts from source words",
        prompts: inserted,
        trio_quality_score: bestFallbackScore,
        warnings: ["These pairs were auto-generated from source words, not from the approved future bank."],
        lifecycle: { future_bank: 0, generated_new: needed, reused_archive: 0 },
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
