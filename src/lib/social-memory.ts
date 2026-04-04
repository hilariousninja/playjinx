import { supabase } from '@/integrations/supabase/client';
import { getPlayerId } from './store';
import { getDisplayName } from './challenge-room';

// --- Types ---

export interface MatchRecord {
  matched_session_id: string;
  matched_display_name: string;
  challenge_id: string;
  date: string;
  prompts_matched: number;
  total_prompts: number;
}

export interface SocialInsight {
  /** Best match(es) today */
  todayMatches: { name: string; matched: number; total: number }[];
  /** Best match(es) this week (rolling 7 days) */
  weeklyBest: { name: string; totalMatched: number; totalPrompts: number; days: number } | null;
  /** Recurring overlap entries (people matched 2+ days) */
  recurring: { name: string; totalMatched: number; days: number }[];
  /** Total unique people matched today */
  todayPeopleCount: number;
  /** Whether we have any data at all */
  hasData: boolean;
}

// --- Recording ---

/**
 * Record match results between the current player and all other room participants.
 * Called after viewing comparison results.
 */
export async function recordRoomMatches(
  challengeId: string,
  date: string,
  participantMatches: { sessionId: string; displayName: string; matched: number; total: number }[]
): Promise<void> {
  const mySessionId = getPlayerId();
  const myName = getDisplayName() || 'You';

  // Filter out self
  const others = participantMatches.filter(p => p.sessionId !== mySessionId);
  if (others.length === 0) return;

  // Upsert match records (one per other participant)
  for (const other of others) {
    // Record from my perspective
    await supabase
      .from('match_history')
      .upsert(
        {
          player_session_id: mySessionId,
          matched_session_id: other.sessionId,
          player_display_name: myName,
          matched_display_name: other.displayName,
          challenge_id: challengeId,
          date,
          prompts_matched: other.matched,
          total_prompts: other.total,
        },
        { onConflict: 'player_session_id,matched_session_id,challenge_id' }
      );
  }
}

/**
 * Self-contained match recording: fetches participants and answers from the DB,
 * computes pairwise matches, and upserts match_history.
 * Idempotent via unique constraint on (player_session_id, matched_session_id, challenge_id).
 * Called when a player finishes all prompts in a challenge context.
 */
export async function recordMatchesForChallenge(challengeId: string): Promise<void> {
  const mySessionId = getPlayerId();
  const myName = getDisplayName() || 'You';

  // Fetch challenge to get date
  const { data: challenge } = await supabase
    .from('challenges')
    .select('date')
    .eq('id', challengeId)
    .single();
  if (!challenge) return;

  // Fetch all room participants
  const { data: participants } = await supabase
    .from('challenge_participants')
    .select('session_id, display_name')
    .eq('challenge_id', challengeId);
  if (!participants || participants.length < 2) return;

  const others = participants.filter(p => p.session_id !== mySessionId);
  if (others.length === 0) return;

  // Get prompt IDs for this date
  const { data: prompts } = await supabase
    .from('prompts')
    .select('id')
    .eq('date', challenge.date)
    .eq('active', true);
  if (!prompts || prompts.length === 0) return;

  const promptIds = prompts.map(p => p.id);
  const sessionIds = participants.map(p => p.session_id);

  // Fetch all answers for these prompts from room participants
  const { data: answers } = await supabase
    .from('answers')
    .select('prompt_id, session_id, normalized_answer')
    .in('prompt_id', promptIds)
    .in('session_id', sessionIds);
  if (!answers) return;

  // Build lookup: prompt_id -> session_id -> normalized_answer
  const answerMap = new Map<string, Map<string, string>>();
  for (const a of answers) {
    if (!answerMap.has(a.prompt_id)) answerMap.set(a.prompt_id, new Map());
    answerMap.get(a.prompt_id)!.set(a.session_id, a.normalized_answer);
  }

  // Compute pairwise matches with each other participant
  const matchData = others.map(other => {
    let matched = 0;
    for (const pid of promptIds) {
      const promptAnswers = answerMap.get(pid);
      if (!promptAnswers) continue;
      const myAnswer = promptAnswers.get(mySessionId);
      const theirAnswer = promptAnswers.get(other.session_id);
      if (myAnswer && theirAnswer && myAnswer === theirAnswer) matched++;
    }
    return {
      player_session_id: mySessionId,
      matched_session_id: other.session_id,
      player_display_name: myName,
      matched_display_name: other.display_name,
      challenge_id: challengeId,
      date: challenge.date,
      prompts_matched: matched,
      total_prompts: promptIds.length,
    };
  });

  // Upsert all at once
  await supabase
    .from('match_history')
    .upsert(matchData, { onConflict: 'player_session_id,matched_session_id,challenge_id' });
}

// --- Querying ---

/**
 * Get social insights for the current player.
 */
export async function getSocialInsights(): Promise<SocialInsight> {
  const mySessionId = getPlayerId();
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data: records, error } = await supabase
    .from('match_history')
    .select('*')
    .eq('player_session_id', mySessionId)
    .gte('date', weekAgo)
    .order('date', { ascending: false });

  if (error || !records || records.length === 0) {
    return { todayMatches: [], weeklyBest: null, recurring: [], todayPeopleCount: 0, hasData: false };
  }

  // --- Today's matches ---
  const todayRecords = records.filter(r => r.date === today);
  const todayByPerson = new Map<string, { name: string; matched: number; total: number }>();
  for (const r of todayRecords) {
    const existing = todayByPerson.get(r.matched_session_id);
    if (existing) {
      existing.matched += r.prompts_matched;
      existing.total += r.total_prompts;
    } else {
      todayByPerson.set(r.matched_session_id, {
        name: r.matched_display_name,
        matched: r.prompts_matched,
        total: r.total_prompts,
      });
    }
  }
  const todayMatches = Array.from(todayByPerson.values())
    .filter(m => m.matched > 0)
    .sort((a, b) => (b.matched / b.total) - (a.matched / a.total));

  // --- Weekly aggregation ---
  const weeklyByPerson = new Map<string, { name: string; totalMatched: number; totalPrompts: number; days: Set<string> }>();
  for (const r of records) {
    const key = r.matched_session_id;
    const existing = weeklyByPerson.get(key);
    if (existing) {
      existing.totalMatched += r.prompts_matched;
      existing.totalPrompts += r.total_prompts;
      existing.days.add(r.date);
      // Use most recent name
      existing.name = r.matched_display_name;
    } else {
      weeklyByPerson.set(key, {
        name: r.matched_display_name,
        totalMatched: r.prompts_matched,
        totalPrompts: r.total_prompts,
        days: new Set([r.date]),
      });
    }
  }

  const weeklyEntries = Array.from(weeklyByPerson.values())
    .map(e => ({ name: e.name, totalMatched: e.totalMatched, totalPrompts: e.totalPrompts, days: e.days.size }));

  // Weekly best: only show if 2+ days of data with this person
  const weeklyBestCandidates = weeklyEntries
    .filter(e => e.days >= 2 && e.totalMatched >= 2)
    .sort((a, b) => b.totalMatched - a.totalMatched);

  const weeklyBest = weeklyBestCandidates.length > 0 ? weeklyBestCandidates[0] : null;

  // Recurring: people matched on 2+ different days
  const recurring = weeklyEntries
    .filter(e => e.days >= 2)
    .sort((a, b) => b.totalMatched - a.totalMatched);

  return {
    todayMatches,
    weeklyBest,
    recurring,
    todayPeopleCount: todayByPerson.size,
    hasData: true,
  };
}
