// Merges multiple legacy session_ids into a single canonical session_id.
// Used when a returning player claims "Yes, that's me" on the name prompt and
// they have history scattered across multiple old browsers/devices. Reassigns
// answers, group_members, challenge_participants, and match_history rows so
// that all past results, group memberships, and rivalry history are accessible
// under one identity.
//
// No JWT required — identity claim is part of the normal player flow. Display
// name match is verified server-side to prevent claiming arbitrary sessions.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { canonical_session_id, other_session_ids, display_name } = await req.json();

    if (
      !canonical_session_id ||
      !Array.isArray(other_session_ids) ||
      !display_name
    ) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const trimmed = String(display_name).trim().toLowerCase();
    const allSids: string[] = Array.from(
      new Set([canonical_session_id, ...other_session_ids].filter(Boolean)),
    );

    // Verify every sid we touch is genuinely associated with this display name
    // in either group_members or challenge_participants. Prevents arbitrary
    // session takeover via the merge endpoint.
    const [gmCheck, cpCheck] = await Promise.all([
      supabase
        .from("group_members")
        .select("session_id, display_name")
        .in("session_id", allSids),
      supabase
        .from("challenge_participants")
        .select("session_id, display_name")
        .in("session_id", allSids),
    ]);

    const verified = new Set<string>([canonical_session_id]); // current device is always allowed
    for (const r of gmCheck.data ?? []) {
      if ((r.display_name ?? "").trim().toLowerCase() === trimmed) {
        verified.add(r.session_id);
      }
    }
    for (const r of cpCheck.data ?? []) {
      if ((r.display_name ?? "").trim().toLowerCase() === trimmed) {
        verified.add(r.session_id);
      }
    }

    const toMerge = other_session_ids.filter((s: string) =>
      s && s !== canonical_session_id && verified.has(s)
    );

    if (toMerge.length === 0) {
      return new Response(
        JSON.stringify({ merged: 0, tables: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result: Record<string, number> = {};

    // answers.session_id
    {
      const { data, error } = await supabase
        .from("answers")
        .update({ session_id: canonical_session_id })
        .in("session_id", toMerge)
        .select("id");
      if (error) throw error;
      result.answers = data?.length ?? 0;
    }

    // group_members: merge, but if (group_id, canonical) already exists,
    // delete the duplicate rows from the other sids first.
    {
      const { data: existing } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("session_id", canonical_session_id);
      const canonicalGroups = new Set((existing ?? []).map((r) => r.group_id));

      if (canonicalGroups.size > 0) {
        await supabase
          .from("group_members")
          .delete()
          .in("session_id", toMerge)
          .in("group_id", Array.from(canonicalGroups));
      }

      const { data, error } = await supabase
        .from("group_members")
        .update({ session_id: canonical_session_id, display_name })
        .in("session_id", toMerge)
        .select("id");
      if (error) throw error;
      result.group_members = data?.length ?? 0;
    }

    // challenge_participants: same dedupe approach
    {
      const { data: existing } = await supabase
        .from("challenge_participants")
        .select("challenge_id")
        .eq("session_id", canonical_session_id);
      const canonicalChallenges = new Set((existing ?? []).map((r) => r.challenge_id));

      if (canonicalChallenges.size > 0) {
        await supabase
          .from("challenge_participants")
          .delete()
          .in("session_id", toMerge)
          .in("challenge_id", Array.from(canonicalChallenges));
      }

      const { data, error } = await supabase
        .from("challenge_participants")
        .update({ session_id: canonical_session_id, display_name })
        .in("session_id", toMerge)
        .select("id");
      if (error) throw error;
      result.challenge_participants = data?.length ?? 0;
    }

    // match_history: two columns
    {
      const { data: a, error: aErr } = await supabase
        .from("match_history")
        .update({ player_session_id: canonical_session_id, player_display_name: display_name })
        .in("player_session_id", toMerge)
        .select("id");
      if (aErr) throw aErr;

      const { data: b, error: bErr } = await supabase
        .from("match_history")
        .update({ matched_session_id: canonical_session_id, matched_display_name: display_name })
        .in("matched_session_id", toMerge)
        .select("id");
      if (bErr) throw bErr;

      result.match_history = (a?.length ?? 0) + (b?.length ?? 0);
    }

    return new Response(
      JSON.stringify({ merged: toMerge.length, tables: result, canonical: canonical_session_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String((e as Error).message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
