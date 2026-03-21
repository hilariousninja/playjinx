import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EvalResult {
  pair: string;
  word_a: string;
  word_b: string;
  word_a_category: string;
  word_b_category: string;
  word_a_jinx_score: number;
  word_b_jinx_score: number;
  word_a_times_used: number;
  word_b_times_used: number;
  predicted_top_5: string[];
  consensus_strength: number;
  fragmentation_risk: number;
  fast_comprehension: number;
  reveal_satisfaction: number;
  naturalness: number;
  total_score: number;
  why_jinxable: string;
  why_might_fail: string;
  recommendation: "safe" | "test" | "risky" | "reject";
}

interface SuggestedWord {
  word: string;
  category: string;
  reason: string;
  strong_pairs: string[];
  fills_gap: string;
  confidence: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ─── Generate candidate pairs from word database ───
    if (action === "generate_candidates") {
      const count = body.count ?? 10;
      const categoryFilter = body.category ?? null;

      // Fetch words
      let query = supabase.from("words").select("*").in("status", ["keep", "approved", "unreviewed"]);
      if (categoryFilter) query = query.eq("category", categoryFilter);
      const { data: words } = await query.limit(500);

      if (!words || words.length < 4) {
        return new Response(JSON.stringify({ error: "Not enough words in database", candidates: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate candidate pairs — prefer cross-category
      const pairs: { word_a: any; word_b: any }[] = [];
      const usedPairKeys = new Set<string>();

      // Check existing prompts to avoid duplicates
      const { data: existingPrompts } = await supabase.from("prompts").select("word_a, word_b").limit(2000);
      const existingKeys = new Set((existingPrompts ?? []).map(p =>
        [p.word_a.toLowerCase(), p.word_b.toLowerCase()].sort().join("|")
      ));

      const shuffled = [...words].sort(() => Math.random() - 0.5);

      for (let i = 0; i < shuffled.length && pairs.length < count * 3; i++) {
        for (let j = i + 1; j < shuffled.length && pairs.length < count * 3; j++) {
          const a = shuffled[i];
          const b = shuffled[j];
          const key = [a.word.toLowerCase(), b.word.toLowerCase()].sort().join("|");
          if (usedPairKeys.has(key) || existingKeys.has(key)) continue;
          // Prefer cross-category
          if (a.category === b.category && a.category !== "Uncategorized" && Math.random() > 0.2) continue;
          usedPairKeys.add(key);
          pairs.push({ word_a: a, word_b: b });
        }
      }

      const candidatePairs = pairs.slice(0, count * 2);

      if (candidatePairs.length === 0) {
        return new Response(JSON.stringify({ candidates: [], suggested_words: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Build AI prompt for evaluation
      const pairList = candidatePairs.map((p, i) =>
        `${i + 1}. ${p.word_a.word.toUpperCase()} + ${p.word_b.word.toUpperCase()} (categories: ${p.word_a.category}, ${p.word_b.category})`
      ).join("\n");

      const systemPrompt = `You are a game designer evaluating word pairs for JINX Daily, a crowd-answer word game. Players see two words and type one linking word they think most other people will say. The goal is mind-matching — convergence, not cleverness.

A great JINX pair should:
- Be instantly understandable (fast comprehension)
- Have strong shared-answer gravity (at least one obvious crowd answer)
- Have controlled spread (multiple plausible answers but not infinite)
- Create a satisfying reveal ("ah, of course!")
- Feel natural and playable

HARD REJECT if: overlap is weak/forced, no satisfying top answer exists, answers would scatter randomly, pair feels abstract/awkward.

The "instant JINX feel" test: Within 2 seconds, a player should think "Yes, I can imagine what most people might say here."

Score each pair 0-100:
- Shared-answer gravity: /30
- Controlled spread: /20
- Fast comprehension: /20
- Reveal satisfaction: /20
- Naturalness: /10

Also suggest 3-5 NEW words not in the database that would make strong JINX building blocks. Only suggest words that are: concrete, broadly known, high-utility for crowd-answer convergence, and fill gaps in the current word categories.`;

      const userPrompt = `Evaluate these candidate JINX pairs and return a JSON response:

${pairList}

Current word categories in database: ${[...new Set(words.map(w => w.category))].filter(c => c !== "Uncategorized").join(", ")}

Return JSON with this exact structure:
{
  "evaluations": [
    {
      "index": 1,
      "word_a": "WORD",
      "word_b": "WORD",
      "predicted_top_5": ["answer1", "answer2", "answer3", "answer4", "answer5"],
      "consensus_strength": 75,
      "fragmentation_risk": 20,
      "fast_comprehension": 85,
      "reveal_satisfaction": 80,
      "naturalness": 90,
      "total_score": 78,
      "why_jinxable": "reason",
      "why_might_fail": "risk",
      "recommendation": "safe"
    }
  ],
  "suggested_words": [
    {
      "word": "word",
      "category": "Category",
      "reason": "why this word is good for JINX",
      "strong_pairs": ["WORD1 + word", "WORD2 + word"],
      "fills_gap": "what gap it fills",
      "confidence": 85
    }
  ]
}

Be critical. Don't approve weak pairs. recommendation must be one of: safe, test, risky, reject.`;

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
              name: "evaluate_pairs",
              description: "Return evaluation results for JINX word pairs",
              parameters: {
                type: "object",
                properties: {
                  evaluations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        index: { type: "number" },
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
                        recommendation: { type: "string", enum: ["safe", "test", "risky", "reject"] },
                      },
                      required: ["index", "word_a", "word_b", "predicted_top_5", "consensus_strength", "fragmentation_risk", "fast_comprehension", "reveal_satisfaction", "naturalness", "total_score", "why_jinxable", "why_might_fail", "recommendation"],
                    },
                  },
                  suggested_words: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        word: { type: "string" },
                        category: { type: "string" },
                        reason: { type: "string" },
                        strong_pairs: { type: "array", items: { type: "string" } },
                        fills_gap: { type: "string" },
                        confidence: { type: "number" },
                      },
                      required: ["word", "category", "reason", "strong_pairs", "fills_gap", "confidence"],
                    },
                  },
                },
                required: ["evaluations", "suggested_words"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "evaluate_pairs" } },
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("AI gateway error:", aiResponse.status, errText);
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "AI evaluation failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let parsed: { evaluations: any[]; suggested_words: any[] };

      try {
        parsed = JSON.parse(toolCall.function.arguments);
      } catch {
        return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Enrich evaluations with word metadata
      const candidates: EvalResult[] = parsed.evaluations.map((ev: any) => {
        const idx = (ev.index ?? 1) - 1;
        const pair = candidatePairs[idx];
        return {
          pair: `${ev.word_a} + ${ev.word_b}`,
          word_a: ev.word_a,
          word_b: ev.word_b,
          word_a_category: pair?.word_a?.category ?? "Unknown",
          word_b_category: pair?.word_b?.category ?? "Unknown",
          word_a_jinx_score: pair?.word_a?.jinx_score ?? 50,
          word_b_jinx_score: pair?.word_b?.jinx_score ?? 50,
          word_a_times_used: pair?.word_a?.times_used ?? 0,
          word_b_times_used: pair?.word_b?.times_used ?? 0,
          predicted_top_5: ev.predicted_top_5 ?? [],
          consensus_strength: ev.consensus_strength ?? 0,
          fragmentation_risk: ev.fragmentation_risk ?? 0,
          fast_comprehension: ev.fast_comprehension ?? 0,
          reveal_satisfaction: ev.reveal_satisfaction ?? 0,
          naturalness: ev.naturalness ?? 0,
          total_score: ev.total_score ?? 0,
          why_jinxable: ev.why_jinxable ?? "",
          why_might_fail: ev.why_might_fail ?? "",
          recommendation: ev.recommendation ?? "reject",
        };
      });

      // Sort by total_score descending, take top `count`
      candidates.sort((a, b) => b.total_score - a.total_score);

      return new Response(JSON.stringify({
        candidates: candidates.slice(0, count),
        suggested_words: parsed.suggested_words ?? [],
        total_evaluated: candidates.length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Accept a candidate: create prompt row ───
    if (action === "accept_candidate") {
      const { word_a, word_b, recommendation, total_score } = body;
      if (!word_a || !word_b) {
        return new Response(JSON.stringify({ error: "Missing word_a/word_b" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tag = recommendation === "safe" ? "safe" : recommendation === "test" ? "test" : null;

      const { data: inserted, error } = await supabase.from("prompts").insert({
        word_a: word_a.toUpperCase(),
        word_b: word_b.toUpperCase(),
        prompt_score: total_score ?? 50,
        prompt_status: "approved",
        prompt_tag: tag,
      }).select().single();

      if (error) throw error;

      return new Response(JSON.stringify({ prompt: inserted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Add suggested word to database ───
    if (action === "add_suggested_word") {
      const { word, category, reason } = body;
      if (!word) {
        return new Response(JSON.stringify({ error: "Missing word" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if already exists
      const { data: existing } = await supabase.from("words").select("id").eq("word", word.toLowerCase()).maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ error: "Word already exists", id: existing.id }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: inserted, error } = await supabase.from("words").insert({
        word: word.toLowerCase(),
        category: category ?? "Uncategorized",
        status: "unreviewed",
        source: "ai-suggested",
        notes: reason ?? "",
        jinx_score: 55,
      }).select().single();

      if (error) throw error;

      return new Response(JSON.stringify({ word: inserted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("evaluate-prompts error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
