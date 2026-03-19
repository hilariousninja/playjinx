import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "merge_answers") {
      const { prompt_id, source, target } = body;
      if (!prompt_id || !source || !target) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { count } = await supabase
        .from("answers")
        .select("*", { count: "exact", head: true })
        .eq("prompt_id", prompt_id)
        .eq("normalized_answer", source);

      const { error } = await supabase
        .from("answers")
        .update({ normalized_answer: target.toLowerCase().trim() })
        .eq("prompt_id", prompt_id)
        .eq("normalized_answer", source);

      if (error) throw error;

      return new Response(
        JSON.stringify({ merged: count ?? 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete_answers") {
      const { prompt_id, normalized_answer } = body;
      if (!prompt_id || !normalized_answer) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { count } = await supabase
        .from("answers")
        .select("*", { count: "exact", head: true })
        .eq("prompt_id", prompt_id)
        .eq("normalized_answer", normalized_answer);

      const { error } = await supabase
        .from("answers")
        .delete()
        .eq("prompt_id", prompt_id)
        .eq("normalized_answer", normalized_answer);

      if (error) throw error;

      return new Response(
        JSON.stringify({ deleted: count ?? 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Compute feedback for a single prompt
    if (action === "compute_prompt_feedback") {
      const { prompt_id } = body;
      if (!prompt_id) {
        return new Response(
          JSON.stringify({ error: "Missing prompt_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await computePromptFeedback(supabase, prompt_id);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Backfill ALL prompts and word-level aggregation
    if (action === "backfill_all") {
      // Get all prompts
      const { data: allPrompts } = await supabase
        .from("prompts")
        .select("id");

      if (!allPrompts || allPrompts.length === 0) {
        return new Response(
          JSON.stringify({ prompts_processed: 0, words_updated: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Compute feedback for every prompt
      let promptsProcessed = 0;
      for (const p of allPrompts) {
        await computePromptFeedback(supabase, p.id);
        promptsProcessed++;
      }

      // Now aggregate word-level stats from all prompts
      const wordsUpdated = await aggregateWordStats(supabase);

      return new Response(
        JSON.stringify({ prompts_processed: promptsProcessed, words_updated: wordsUpdated }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("admin-actions error:", err);
    return new Response(
      JSON.stringify({ error: "An internal error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper: compute feedback for one prompt and update it
async function computePromptFeedback(supabase: ReturnType<typeof createClient>, promptId: string) {
  const { data: answers } = await supabase
    .from("answers")
    .select("normalized_answer")
    .eq("prompt_id", promptId);

  if (!answers || answers.length === 0) {
    await supabase
      .from("prompts")
      .update({ total_players: 0, unique_answers: 0, top_answer_pct: 0, performance: null })
      .eq("id", promptId);
    return { total_players: 0, unique_answers: 0, top_answer_pct: 0, performance: null };
  }

  const total = answers.length;
  const counts: Record<string, number> = {};
  for (const a of answers) {
    counts[a.normalized_answer] = (counts[a.normalized_answer] || 0) + 1;
  }
  const uniqueCount = Object.keys(counts).length;
  const sorted = Object.values(counts).sort((a, b) => b - a);
  const topCount = sorted[0] ?? 0;
  const topPct = Math.round((topCount / total) * 100);

  let performance: string;
  if (topPct >= 40) performance = "strong";
  else if (topPct >= 20) performance = "decent";
  else performance = "weak";

  await supabase
    .from("prompts")
    .update({ total_players: total, unique_answers: uniqueCount, top_answer_pct: topPct, performance })
    .eq("id", promptId);

  return { total_players: total, unique_answers: uniqueCount, top_answer_pct: topPct, performance };
}

// Helper: aggregate word-level stats from all prompts
async function aggregateWordStats(supabase: ReturnType<typeof createClient>) {
  // Get all prompts with their performance and words
  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, word_a, word_b, performance, top_answer_pct, unique_answers, total_players");

  if (!prompts || prompts.length === 0) return 0;

  // Build word -> stats map
  const wordStats: Record<string, {
    times_used: number;
    strong: number;
    decent: number;
    weak: number;
    topPcts: number[];
    uniqueCounts: number[];
  }> = {};

  for (const p of prompts) {
    if (p.total_players === 0) continue; // skip unplayed prompts

    for (const rawWord of [p.word_a, p.word_b]) {
      const word = rawWord.toLowerCase();
      if (!wordStats[word]) {
        wordStats[word] = { times_used: 0, strong: 0, decent: 0, weak: 0, topPcts: [], uniqueCounts: [] };
      }
      const ws = wordStats[word];
      ws.times_used++;
      if (p.performance === "strong") ws.strong++;
      else if (p.performance === "decent") ws.decent++;
      else if (p.performance === "weak") ws.weak++;
      ws.topPcts.push(p.top_answer_pct);
      ws.uniqueCounts.push(p.unique_answers);
    }
  }

  // Update each word in DB
  let updated = 0;
  for (const [word, stats] of Object.entries(wordStats)) {
    const avgTopPct = stats.topPcts.length > 0
      ? Math.round(stats.topPcts.reduce((a, b) => a + b, 0) / stats.topPcts.length)
      : 0;
    const avgUnique = stats.uniqueCounts.length > 0
      ? Math.round(stats.uniqueCounts.reduce((a, b) => a + b, 0) / stats.uniqueCounts.length)
      : 0;

    // Compute data-driven jinx_score
    // Strong rate weighted heavily, penalize weak rate
    const totalAppearances = stats.strong + stats.decent + stats.weak;
    let dataScore = 50; // default
    if (totalAppearances > 0) {
      const strongRate = stats.strong / totalAppearances;
      const decentRate = stats.decent / totalAppearances;
      const weakRate = stats.weak / totalAppearances;
      // Score: strong contributes positively, weak negatively, decent neutral
      dataScore = Math.round(
        Math.min(100, Math.max(0,
          50 + (strongRate * 40) - (weakRate * 40) + (decentRate * 10) + Math.min(totalAppearances, 10) * 1
        ))
      );
    }

    const { error } = await supabase
      .from("words")
      .update({
        times_used: stats.times_used,
        strong_appearances: stats.strong,
        decent_appearances: stats.decent,
        weak_appearances: stats.weak,
        avg_top_answer_pct: avgTopPct,
        avg_unique_answers: avgUnique,
        jinx_score: dataScore,
      })
      .eq("word", word);

    if (!error) updated++;
  }

  return updated;
}
