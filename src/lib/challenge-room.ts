import { supabase } from '@/integrations/supabase/client';
import { getPlayerId } from './store';

const DISPLAY_NAME_KEY = 'jinx_display_name';

// --- Display Name (localStorage) ---

export function getDisplayName(): string | null {
  return localStorage.getItem(DISPLAY_NAME_KEY);
}

export function setDisplayName(name: string) {
  localStorage.setItem(DISPLAY_NAME_KEY, name.trim());
}

// --- Soft identity claim ---
// If someone uses a new browser/device but their friends already know them by
// a display name, look up prior sessions so they can "claim" them and keep
// their group history, answers and rivalry record. No password — fine for the
// current trust model where identity is device-local.

export interface ExistingIdentity {
  session_id: string;
  display_name: string;
  last_seen: string;
  answerCount: number;
  groupCount: number;
}

export async function findExistingIdentities(name: string): Promise<ExistingIdentity[]> {
  const trimmed = name.trim();
  if (!trimmed) return [];
  const currentSid = getPlayerId();

  const [gm, cp] = await Promise.all([
    supabase
      .from('group_members')
      .select('session_id, display_name, joined_at')
      .ilike('display_name', trimmed),
    supabase
      .from('challenge_participants')
      .select('session_id, display_name, created_at')
      .ilike('display_name', trimmed),
  ]);

  const map = new Map<string, ExistingIdentity>();
  for (const r of gm.data ?? []) {
    if (r.session_id === currentSid) continue;
    const prev = map.get(r.session_id) ?? { session_id: r.session_id, display_name: r.display_name, last_seen: r.joined_at, answerCount: 0, groupCount: 0 };
    if (prev.last_seen < r.joined_at) prev.last_seen = r.joined_at;
    prev.groupCount += 1;
    map.set(r.session_id, prev);
  }
  for (const r of cp.data ?? []) {
    if (r.session_id === currentSid) continue;
    const prev = map.get(r.session_id) ?? { session_id: r.session_id, display_name: r.display_name, last_seen: r.created_at, answerCount: 0, groupCount: 0 };
    if (prev.last_seen < r.created_at) prev.last_seen = r.created_at;
    map.set(r.session_id, prev);
  }

  // Enrich with answer counts so we can pick the richest historical session
  // as the canonical identity to merge into.
  const sids = Array.from(map.keys());
  if (sids.length > 0) {
    const { data: ans } = await supabase
      .from('answers')
      .select('session_id')
      .in('session_id', sids);
    for (const r of ans ?? []) {
      const prev = map.get(r.session_id);
      if (prev) prev.answerCount += 1;
    }
  }

  // Sort by total activity (answers + groups), then recency.
  return Array.from(map.values()).sort((a, b) => {
    const aw = a.answerCount + a.groupCount;
    const bw = b.answerCount + b.groupCount;
    if (bw !== aw) return bw - aw;
    return b.last_seen.localeCompare(a.last_seen);
  });
}

/**
 * Claim a prior identity. Merges every matched legacy session_id (answers,
 * group memberships, challenge participations, rivalries) into a single
 * canonical session_id so nothing is left stranded across old devices.
 */
export async function claimIdentity(
  canonicalSessionId: string,
  displayName: string,
  otherSessionIds: string[] = [],
) {
  const currentSid = getPlayerId();
  const others = Array.from(new Set([currentSid, ...otherSessionIds].filter(s => s && s !== canonicalSessionId)));

  try {
    await supabase.functions.invoke('merge-identities', {
      body: {
        canonical_session_id: canonicalSessionId,
        other_session_ids: others,
        display_name: displayName.trim(),
      },
    });
  } catch {
    // Non-fatal: identity still switches even if merge partially fails.
  }

  localStorage.setItem('jinx_player_id', canonicalSessionId);
  localStorage.removeItem('jinx_session_id');
  localStorage.setItem(DISPLAY_NAME_KEY, displayName.trim());
  localStorage.removeItem('jinx_completed_prompts');
}

// --- Participants ---

export interface RoomParticipant {
  id: string;
  challenge_id: string;
  session_id: string;
  display_name: string;
  created_at: string;
}

/**
 * Join a challenge room. Creates or updates the participant record.
 */
export async function joinChallengeRoom(challengeId: string, displayName: string): Promise<RoomParticipant> {
  const sessionId = getPlayerId();

  // Upsert: insert or update display name
  const { data: existing } = await supabase
    .from('challenge_participants')
    .select('*')
    .eq('challenge_id', challengeId)
    .eq('session_id', sessionId)
    .maybeSingle();

  if (existing) {
    // Update display name if changed
    if (existing.display_name !== displayName) {
      const { data, error } = await supabase
        .from('challenge_participants')
        .update({ display_name: displayName })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return data as RoomParticipant;
    }
    return existing as RoomParticipant;
  }

  const { data, error } = await supabase
    .from('challenge_participants')
    .insert({
      challenge_id: challengeId,
      session_id: sessionId,
      display_name: displayName,
    })
    .select()
    .single();

  if (error) throw error;
  return data as RoomParticipant;
}

/**
 * Get all participants for a challenge room.
 */
export async function getRoomParticipants(challengeId: string): Promise<RoomParticipant[]> {
  const { data, error } = await supabase
    .from('challenge_participants')
    .select('*')
    .eq('challenge_id', challengeId)
    .order('created_at');

  if (error) throw error;
  return (data ?? []) as RoomParticipant[];
}

/**
 * Check if the current player has already joined a room.
 */
export async function hasJoinedRoom(challengeId: string): Promise<boolean> {
  const sessionId = getPlayerId();
  const { data } = await supabase
    .from('challenge_participants')
    .select('id')
    .eq('challenge_id', challengeId)
    .eq('session_id', sessionId)
    .maybeSingle();

  return !!data;
}

// --- Room Results ---

export interface RoomAnswer {
  session_id: string;
  display_name: string;
  raw_answer: string;
  normalized_answer: string;
}

export interface RoomPromptResult {
  prompt_id: string;
  word_a: string;
  word_b: string;
  answers: RoomAnswer[];
  clusters: { answer: string; members: string[] }[]; // display_name groups
}

/**
 * Build room-level results: for each prompt, gather answers from all room participants.
 */
export async function getRoomResults(
  challengeId: string,
  promptIds: string[]
): Promise<RoomPromptResult[]> {
  // Get all participants
  const participants = await getRoomParticipants(challengeId);
  if (participants.length === 0) return [];

  const sessionIds = participants.map(p => p.session_id);
  const nameMap = new Map(participants.map(p => [p.session_id, p.display_name]));

  // Get all answers for these prompts from these session_ids
  const { data: answers, error } = await supabase
    .from('answers')
    .select('prompt_id, session_id, raw_answer, normalized_answer')
    .in('prompt_id', promptIds)
    .in('session_id', sessionIds);

  if (error) throw error;

  // Get prompt details
  const { data: prompts } = await supabase
    .from('prompts')
    .select('id, word_a, word_b')
    .in('id', promptIds);

  const promptMap = new Map((prompts ?? []).map(p => [p.id, p]));

  // Build results per prompt
  return promptIds.map(pid => {
    const prompt = promptMap.get(pid);
    const promptAnswers = (answers ?? [])
      .filter(a => a.prompt_id === pid)
      .map(a => ({
        session_id: a.session_id,
        display_name: nameMap.get(a.session_id) ?? 'Unknown',
        raw_answer: a.raw_answer,
        normalized_answer: a.normalized_answer,
      }));

    // Build clusters: group by normalized answer
    const clusterMap = new Map<string, string[]>();
    for (const a of promptAnswers) {
      const existing = clusterMap.get(a.normalized_answer) ?? [];
      existing.push(a.display_name);
      clusterMap.set(a.normalized_answer, existing);
    }

    const clusters = Array.from(clusterMap.entries())
      .map(([answer, members]) => ({ answer, members }))
      .sort((a, b) => b.members.length - a.members.length);

    return {
      prompt_id: pid,
      word_a: prompt?.word_a ?? '',
      word_b: prompt?.word_b ?? '',
      answers: promptAnswers,
      clusters,
    };
  });
}
