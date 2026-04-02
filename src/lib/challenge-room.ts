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
