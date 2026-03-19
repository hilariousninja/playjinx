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
    // Verify authentication
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

    // Use service role for admin operations
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

    // Compute post-play feedback for a prompt
    if (action === "compute_prompt_feedback") {
      const { prompt_id } = body;
      if (!prompt_id) {
        return new Response(
          JSON.stringify({ error: "Missing prompt_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get all answers for this prompt
      const { data: answers } = await supabase
        .from("answers")
        .select("normalized_answer")
        .eq("prompt_id", prompt_id);

      if (!answers || answers.length === 0) {
        return new Response(
          JSON.stringify({ total_players: 0, unique_answers: 0, top_answer_pct: 0, performance: null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const total = answers.length;
      const counts: Record<string, number> = {};
      for (const a of answers) {
        counts[a.normalized_answer] = (counts[a.normalized_answer] || 0) + 1;
      }
      const uniqueCount = Object.keys(counts).length;
      const topCount = Math.max(...Object.values(counts));
      const topPct = Math.round((topCount / total) * 100);

      // Classify performance
      let performance: string;
      if (topPct >= 40) {
        performance = "strong";
      } else if (topPct >= 20) {
        performance = "decent";
      } else {
        performance = "weak";
      }

      // Update prompt
      await supabase
        .from("prompts")
        .update({ total_players: total, unique_answers: uniqueCount, top_answer_pct: topPct, performance })
        .eq("id", prompt_id);

      // Get the prompt to update word-level tracking
      const { data: prompt } = await supabase
        .from("prompts")
        .select("word_a, word_b")
        .eq("id", prompt_id)
        .single();

      if (prompt) {
        const field = performance === "strong" ? "strong_appearances" : performance === "weak" ? "weak_appearances" : null;
        if (field) {
          for (const word of [prompt.word_a.toLowerCase(), prompt.word_b.toLowerCase()]) {
            const { data: wordRow } = await supabase
              .from("words")
              .select("id, strong_appearances, weak_appearances")
              .eq("word", word)
              .maybeSingle();
            if (wordRow) {
              await supabase
                .from("words")
                .update({ [field]: (wordRow[field as keyof typeof wordRow] as number) + 1 })
                .eq("id", wordRow.id);
            }
          }
        }
      }

      return new Response(
        JSON.stringify({ total_players: total, unique_answers: uniqueCount, top_answer_pct: topPct, performance }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "An internal error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
