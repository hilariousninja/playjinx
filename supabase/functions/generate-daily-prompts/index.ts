import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    // How many new prompts do we need?
    const existingCount = existing?.length ?? 0;
    const needed = 3 - existingCount;

    if (needed <= 0) {
      return new Response(
        JSON.stringify({ message: "Already have enough prompts", count: existingCount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get approved words (status = 'approved' or 'unreviewed' as fallback)
    let { data: words } = await supabase
      .from("words")
      .select("word")
      .eq("status", "approved")
      .limit(500);

    // Fallback to all words if not enough approved
    if (!words || words.length < needed * 2) {
      const { data: allWords } = await supabase
        .from("words")
        .select("word")
        .limit(500);
      words = allWords;
    }

    if (!words || words.length < needed * 2) {
      return new Response(
        JSON.stringify({ error: "Not enough words in database" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Shuffle and pick pairs
    const shuffled = words
      .map((w) => ({ word: w.word, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map((w) => w.word);

    const newPrompts = [];
    for (let i = 0; i < needed; i++) {
      newPrompts.push({
        word_a: shuffled[i * 2].toUpperCase(),
        word_b: shuffled[i * 2 + 1].toUpperCase(),
        active: true,
        date: today,
        mode: "daily",
      });
    }

    const { data: inserted, error } = await supabase
      .from("prompts")
      .insert(newPrompts)
      .select();

    if (error) throw error;

    return new Response(
      JSON.stringify({ message: "Generated daily prompts", prompts: inserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
