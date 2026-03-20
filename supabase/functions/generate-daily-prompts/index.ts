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

    const token = authHeader.replace("Bearer ", "").trim();
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";

    let tokenRole: string | null = null;
    try {
      const [, payload] = token.split(".");
      if (payload) tokenRole = JSON.parse(atob(payload)).role ?? null;
    } catch {
      tokenRole = null;
    }

    const isSchedulerToken = token === anonKey || tokenRole === "anon";

    // Allow scheduled invocations that use the anon token, and authenticated user calls.
    if (!isSchedulerToken) {
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

    // Try to select from approved+tagged prompts first (2 safe, 1 test)
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

    // Shuffle helper
    const shuffle = <T>(arr: T[]): T[] =>
      arr.map(v => ({ v, s: Math.random() })).sort((a, b) => a.s - b.s).map(x => x.v);

    const safePicked = shuffle(safePrompts ?? []);
    const testPicked = shuffle(testPrompts ?? []);

    const selected: string[] = [];

    // Pick up to 2 safe
    for (const p of safePicked) {
      if (selected.length >= 2) break;
      selected.push(p.id);
    }

    // Pick up to 1 test
    if (testPicked.length > 0 && selected.length < 3) {
      selected.push(testPicked[0].id);
    }

    // Fill remaining from safe if test wasn't available
    for (const p of safePicked) {
      if (selected.length >= 3) break;
      if (!selected.includes(p.id)) selected.push(p.id);
    }

    // If we have enough pre-approved prompts, activate them
    if (selected.length >= needed) {
      const toActivate = selected.slice(0, needed);
      for (const id of toActivate) {
        await supabase
          .from("prompts")
          .update({ active: true, date: today, mode: "daily" })
          .eq("id", id);
      }

      return new Response(
        JSON.stringify({ message: "Activated approved prompts", count: toActivate.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // FALLBACK: Generate from word pairs (legacy behavior for bootstrapping)
    let { data: words } = await supabase
      .from("words")
      .select("word, jinx_score")
      .eq("status", "approved")
      .limit(500);

    if (!words || words.length < needed * 2) {
      const { data: allWords } = await supabase
        .from("words")
        .select("word, jinx_score")
        .limit(500);
      words = allWords;
    }

    if (!words || words.length < needed * 2) {
      return new Response(
        JSON.stringify({ error: "Not enough words in database" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const shuffled = shuffle(words);

    const newPrompts = [];
    for (let i = 0; i < needed; i++) {
      const wA = shuffled[i * 2];
      const wB = shuffled[i * 2 + 1];
      const promptScore = Math.round(((wA.jinx_score ?? 50) + (wB.jinx_score ?? 50)) / 2);
      newPrompts.push({
        word_a: wA.word.toUpperCase(),
        word_b: wB.word.toUpperCase(),
        active: true,
        date: today,
        mode: "daily",
        prompt_status: "pending",
        prompt_score: promptScore,
      });
    }

    const { data: inserted, error } = await supabase
      .from("prompts")
      .insert(newPrompts)
      .select();

    if (error) throw error;

    return new Response(
      JSON.stringify({ message: "Generated daily prompts (fallback)", prompts: inserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "An internal error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
